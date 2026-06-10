-- ============================================================================
-- Catalog display activation — gate on gamme visibility (pg_display='1')
-- ----------------------------------------------------------------------------
-- WHY: catalog_display_activate (20260607) selected eligible pieces by brand +
--      sellable (pri_dispo IN '1','2') + currently-hidden ONLY — no gamme gate.
--      So it would flip piece_display=true even for pieces whose gamme hub is
--      hidden-by-design (level-4/5 accessoires, pg_display='0'), surfacing them
--      in vehicle listings against the design intent
--      (reference_pg_display_gates_gamme_hub_not_listing). Surfaced by the
--      MECAFILTER load (2026-06-08): 1 935 sellable+hidden, but 4 sit in level-4
--      gammes (pg_display='0') that must stay hidden — owner scoped exactly 1 931.
--
-- WHAT: add `JOIN pieces_gamme g ... AND g.pg_display='1'` to the eligibility —
--       a piece is never made visible if its gamme hub is off. General + correct
--       for every brand (MECAFILTER → eligible 1 935 → 1 931).
--
-- SAFETY: function-body change only (CREATE OR REPLACE, identical signature).
--   No table rewrite, no lock on pieces. Read-only join (never touches gamme).
--   Reversible: re-apply the body from 20260607_pricing_catalog_display_activate.sql.
-- ============================================================================

-- Apply-time guards (match the pricing-functions migration pattern; squawk require-timeout-settings).
SET lock_timeout = '2s';
SET statement_timeout = '30s';

CREATE OR REPLACE FUNCTION catalog_display_activate(
  p_batch_id  UUID,
  p_supplier  TEXT,
  p_operator  TEXT,
  p_dry_run   BOOLEAN DEFAULT true
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_eligible  BIGINT := 0;
  v_displayed BIGINT := 0;
BEGIN
  IF p_supplier IS NULL OR p_supplier = '' THEN
    RAISE EXCEPTION 'catalog_display_activate: p_supplier (brand pm_id) is required';
  END IF;
  IF NOT p_dry_run AND p_batch_id IS NULL THEN
    RAISE EXCEPTION 'catalog_display_activate: p_batch_id is required for a commit';
  END IF;

  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_supplier, 'catalog-display')));

  -- Eligible = brand-locked piece, currently hidden, with a SELLABLE price, AND whose
  -- gamme hub is displayed (pg_display='1'). The gamme gate prevents surfacing pieces
  -- in hidden-by-design gammes (level-4/5 accessoires, pg_display='0') — a piece must
  -- never become visible if its gamme hub is off. (Added 2026-06-08; the prior version
  -- lacked this gate and would over-flip into hidden gammes.)
  CREATE TEMP TABLE _disp_eligible ON COMMIT DROP AS
    SELECT p.piece_id, p.piece_display AS old_display
    FROM pieces p
    JOIN (
      SELECT DISTINCT pri_piece_id_i AS piece_id
      FROM pieces_price
      WHERE pri_pm_id = p_supplier
        AND pri_dispo IN ('1', '2')
    ) s ON s.piece_id = p.piece_id
    JOIN pieces_gamme g ON g.pg_id::text = p.piece_pg_id::text
    WHERE p.piece_pm_id::text = p_supplier
      AND p.piece_display = false
      AND g.pg_display = '1';

  SELECT count(*) INTO v_eligible FROM _disp_eligible;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true, 'supplier', p_supplier, 'eligible', v_eligible
    );
  END IF;

  INSERT INTO pieces_display_history (batch_id, piece_id, pm_id, old_display, new_display, operator)
  SELECT p_batch_id, piece_id, p_supplier, old_display, true, p_operator
  FROM _disp_eligible;

  UPDATE pieces SET piece_display = true
  WHERE piece_id IN (SELECT piece_id FROM _disp_eligible);
  GET DIAGNOSTICS v_displayed = ROW_COUNT;

  RETURN jsonb_build_object(
    'dry_run', false, 'supplier', p_supplier, 'batch_id', p_batch_id,
    'eligible', v_eligible, 'displayed', v_displayed
  );
END;
$$;

COMMENT ON FUNCTION catalog_display_activate(UUID, TEXT, TEXT, BOOLEAN) IS
  'Catalog visibility activation (réf-only): flips pieces.piece_display false -> true for brand-locked pieces that are ALREADY sellable (pieces_price.pri_dispo IN 1,2), currently hidden, AND whose gamme hub is displayed (pieces_gamme.pg_display=1 — never surface pieces in hidden-by-design level-4/5 gammes). Set-based + idempotent. p_dry_run=true (default) projects without writing. Never touches gamme/vehicle/price/dispo. Journals to pieces_display_history; reverse with catalog_display_rollback_batch. Owner-gated.';
