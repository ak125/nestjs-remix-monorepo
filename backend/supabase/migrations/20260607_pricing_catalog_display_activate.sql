-- =====================================================
-- Catalog Visibility Control Plane — catalog_display_activate (étape A: réf-only)
-- Date: 2026-06-07
-- Refs: 20260606_pricing_activate_chunk.sql (sibling dispo activation, same governance),
--       20260522_pricing_control_plane_v1_functions.sql (price_import_batches lifecycle),
--       20260118_rm_remove_stock_filter.sql (get_listing_products_for_build gates the R2
--         listing on pieces.piece_display = true — the stock/dispo filter was REMOVED, so
--         piece_display IS the visibility gate),
--       audit/supplier-nk-dca-availability-2026-06-06 (NK CONFIRMED-available set).
--
-- WHY (étape A — make sellable NK refs visible, réf-only):
--   pricing_activate_chunk already flipped the 6 431 NK CONFIRMED refs to SELLABLE
--   (pri_dispo '1'/'2', batch 2f7f7762-...). They are STILL invisible: the R2 listing
--   build includes a piece ONLY when pieces.piece_display = true, and all 6 431 are
--   piece_display = false. This function flips piece_display false -> true for the NK
--   pieces that are ALREADY sellable. It is the visibility (réf) step of the supplier
--   activation flow that pricing_activate_chunk started (sellability).
--
-- WHY SET-BASED (not a passed list of ids):
--   The action is uniform (false -> true) and the scope is FULLY derivable from the
--   governed DB signal — a piece is in scope iff it has a sellable price row for the
--   brand and is currently hidden. Deriving the scope from the DB (single source of
--   truth) is more robust than re-feeding an external id list: it is idempotent and
--   REPEATABLE — re-running after any future tariff/TecDoc import activates exactly the
--   newly-sellable-but-hidden refs, with no external artifact to drift. Empirically the
--   gate (pri_pm_id='3410' AND pri_dispo IN '1','2' AND piece_display=false) == the
--   6 431 CONFIRMED set, with 0 orphan prices and 0 brand mismatch.
--
-- SCOPE (étape A — réf ONLY). Touches EXACTLY pieces.piece_display. NEVER touches
--   pieces_gamme.pg_display, auto_type.type_display, prices, pri_dispo, the sitemap, or
--   indexation. Gamme/véhicule visibility (étage B) is a separate, SEO-gated step.
--
-- SAFETY INVARIANTS:
--   - brand-locked by p_supplier (pieces.piece_pm_id): never touches a non-brand piece;
--   - GATE: only ever exposes a piece that ALREADY has a sellable pieces_price row for
--     the brand (pri_dispo '1'/'2'). REVIEW/BLOCK refs (dispo null/'0') are excluded by
--     construction — visibility follows sellability, never the reverse;
--   - idempotent: only flips piece_display false -> true; already-visible pieces are not
--     re-touched; re-running is a no-op once everything sellable is visible;
--   - prices, dispo, gamme, vehicle are NEVER mutated — display-only;
--   - dry-run (p_dry_run = true, the DEFAULT) computes the projection with ZERO writes,
--     sharing the EXACT same eligibility set as the commit (no dry-run/commit drift).
--
-- REVERSIBILITY. Each flip is journaled in pieces_display_history (old_display ->
--   new_display); catalog_display_rollback_batch(batch_id, supplier) restores the prior
--   piece_display for the whole batch, brand-locked.
--
-- ADDITIF. Idempotent (CREATE OR REPLACE / IF NOT EXISTS). Forward-only. NOT applied to
-- the shared DB here — governed apply step is owner-gated. SECURITY INVOKER (service-role
-- caller bypasses RLS). No explicit BEGIN/COMMIT (squawk assume_in_transaction=true).
--
-- RLS: pieces_display_history is RLS-disabled to mirror its sibling governed audit tables
-- (pieces_price_history, price_import_batches, price_import_batch_chunks are all RLS-off).
-- Service-role-only internal rollback journal; no anon/frontend read path.
-- =====================================================

set lock_timeout = '2s';
set statement_timeout = '120s';

-- ── Rollback journal (old_display -> new_display, per piece, per batch) ──────────────
CREATE TABLE IF NOT EXISTS pieces_display_history (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id    UUID        NOT NULL,
  piece_id    INTEGER     NOT NULL,
  pm_id       TEXT        NOT NULL,   -- brand (p_supplier), e.g. '3410' (NK)
  old_display BOOLEAN     NOT NULL,
  new_display BOOLEAN     NOT NULL,
  operator    TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pieces_display_history_batch
  ON pieces_display_history (batch_id);

COMMENT ON TABLE pieces_display_history IS
  'Rollback journal for catalog_display_activate: per-piece old/new piece_display, keyed by governed batch_id. Service-role-only (RLS-off like pieces_price_history).';

-- ── Activation: piece_display false -> true, set-based, dry-run-capable, gated ───────
CREATE OR REPLACE FUNCTION catalog_display_activate(
  p_batch_id  UUID,          -- governed batch (price_import_batches); required for commit
  p_supplier  TEXT,          -- pieces.piece_pm_id (brand), e.g. '3410' (NK). Brand-lock.
  p_operator  TEXT,
  p_dry_run   BOOLEAN DEFAULT true   -- safe default: project, do not write
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

  -- Give this run its own runtime budget (the set UPDATE on a large table), and
  -- serialize concurrent runs for the same supplier (lock released at tx end).
  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_supplier, 'catalog-display')));

  -- SINGLE SOURCE OF THE ELIGIBILITY PREDICATE (captured once, used by both dry-run and
  -- commit). Driven from pieces_price (the small, filtered sellable set) then PK-joined
  -- to pieces. Eligible = brand-locked piece, currently hidden, with a SELLABLE price.
  CREATE TEMP TABLE _disp_eligible ON COMMIT DROP AS
    SELECT p.piece_id, p.piece_display AS old_display
    FROM pieces p
    JOIN (
      SELECT DISTINCT pri_piece_id_i AS piece_id
      FROM pieces_price
      WHERE pri_pm_id = p_supplier
        AND pri_dispo IN ('1', '2')
    ) s ON s.piece_id = p.piece_id
    WHERE p.piece_pm_id::text = p_supplier   -- brand-lock (defense-in-depth)
      AND p.piece_display = false;           -- only flip hidden -> visible

  SELECT count(*) INTO v_eligible FROM _disp_eligible;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true, 'supplier', p_supplier, 'eligible', v_eligible
    );
  END IF;

  -- Journal (false -> true) so rollback restores the prior value.
  INSERT INTO pieces_display_history (batch_id, piece_id, pm_id, old_display, new_display, operator)
  SELECT p_batch_id, piece_id, p_supplier, old_display, true, p_operator
  FROM _disp_eligible;

  -- Activation: piece_display ONLY. Never touches gamme/vehicle/price/dispo.
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
  'Catalog visibility activation (réf-only): flips pieces.piece_display false -> true for brand-locked pieces that are ALREADY sellable (pieces_price.pri_dispo IN 1,2) and currently hidden. Set-based + idempotent. p_dry_run=true (default) projects without writing. Never touches gamme/vehicle/price/dispo. Journals to pieces_display_history; reverse with catalog_display_rollback_batch. Owner-gated.';

-- ── Rollback: restore the prior piece_display for an entire batch (brand-locked) ─────
CREATE OR REPLACE FUNCTION catalog_display_rollback_batch(
  p_batch_id UUID,
  p_supplier TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_restored BIGINT := 0;
BEGIN
  IF p_batch_id IS NULL OR p_supplier IS NULL THEN
    RAISE EXCEPTION 'catalog_display_rollback_batch: p_batch_id and p_supplier are required';
  END IF;

  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_supplier, 'catalog-display')));

  -- Restore each journaled piece to its old_display (brand-locked, set-based).
  UPDATE pieces p SET piece_display = h.old_display
  FROM pieces_display_history h
  WHERE h.batch_id = p_batch_id
    AND h.pm_id    = p_supplier
    AND p.piece_id = h.piece_id
    AND p.piece_pm_id::text = p_supplier;
  GET DIAGNOSTICS v_restored = ROW_COUNT;

  RETURN jsonb_build_object('restored', v_restored, 'batch_id', p_batch_id);
END;
$$;

COMMENT ON FUNCTION catalog_display_rollback_batch(UUID, TEXT) IS
  'Reverses catalog_display_activate: restores pieces.piece_display to its journaled old value for every piece in the batch, brand-locked. Idempotent.';
