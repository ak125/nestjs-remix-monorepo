-- =====================================================
-- Pricing Control Plane V1 — server-side functions (atomic commit / LIFO rollback)
-- Date: 2026-05-22
-- Refs: plan pricing-control-plane-v1 ; 20260522_pricing_control_plane_v1.sql (schema)
-- =====================================================
--
-- Why server-side: the backend uses supabase-js only (no pg session). Per-chunk
-- atomicity is therefore done in PL/pgSQL: each function call = ONE transaction,
-- with a transaction-level advisory lock serializing concurrent writes for the
-- same supplier. Batch-level mutual exclusion is the partial unique index
-- (one COMMITTING batch per supplier) from the schema migration.
--
-- ADDITIF. Idempotent (CREATE OR REPLACE). Forward-only. NOT applied to the
-- shared DB here — governed apply step. SECURITY INVOKER (service-role caller).
-- =====================================================

-- ----------------------------------------------------------------------------
-- pricing_commit_chunk: apply one chunk's rows atomically.
--   p_rows : jsonb array of objects:
--     { piece_id_i, pri_type, gros_ht, remise, achat_ht, marge, vente_ht, vente_ttc }
--   Skips MANUAL_OVERRIDE / FROZEN rows. Writes pieces_price_history (old→new) and
--   updates BOTH text and _n columns. Returns { committed, skipped, missing }.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pricing_commit_chunk(
  p_batch_id  UUID,
  p_chunk_id  UUID,
  p_supplier  TEXT,
  p_operator  TEXT,
  p_rows      JSONB
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_row        JSONB;
  v_existing   pieces_price%ROWTYPE;
  v_committed  INTEGER := 0;
  v_skipped    INTEGER := 0;
  v_missing    INTEGER := 0;
BEGIN
  -- Serialize concurrent chunk writes for the same supplier (released at tx end).
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_supplier, 'pricing')));

  UPDATE price_import_batch_chunks SET status = 'COMMITTING' WHERE chunk_id = p_chunk_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    SELECT * INTO v_existing
    FROM pieces_price
    WHERE pri_piece_id_i = (v_row->>'piece_id_i')::INTEGER
      AND pri_type = coalesce(v_row->>'pri_type', '0')
    FOR UPDATE;

    IF FOUND THEN
      -- UPDATE (re-price). Never touch manually-set / frozen prices.
      IF v_existing.pricing_state IN ('MANUAL_OVERRIDE', 'FROZEN') THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO pieces_price_history (
        batch_id, chunk_id, pri_piece_id_i, pri_type, operation,
        old_gros_ht, new_gros_ht, old_remise, new_remise,
        old_achat_ht, new_achat_ht, old_marge, new_marge,
        old_vente_ht, new_vente_ht, old_vente_ttc, new_vente_ttc,
        old_dispo, new_dispo
      ) VALUES (
        p_batch_id, p_chunk_id, v_existing.pri_piece_id_i, v_existing.pri_type, 'UPDATE',
        v_existing.pri_gros_ht_n,  (v_row->>'gros_ht')::NUMERIC,
        v_existing.pri_remise_n,   (v_row->>'remise')::NUMERIC,
        v_existing.pri_achat_ht_n, (v_row->>'achat_ht')::NUMERIC,
        v_existing.pri_marge_n,    (v_row->>'marge')::NUMERIC,
        v_existing.pri_vente_ht_n, (v_row->>'vente_ht')::NUMERIC,
        v_existing.pri_vente_ttc_n,(v_row->>'vente_ttc')::NUMERIC,
        v_existing.pri_dispo,      '1'
      );

      UPDATE pieces_price SET
        pri_gros_ht_n   = (v_row->>'gros_ht')::NUMERIC,   pri_gros_ht   = (v_row->>'gros_ht'),
        pri_remise_n    = (v_row->>'remise')::NUMERIC,    pri_remise    = (v_row->>'remise'),
        pri_achat_ht_n  = (v_row->>'achat_ht')::NUMERIC,  pri_achat_ht  = (v_row->>'achat_ht'),
        pri_marge_n     = (v_row->>'marge')::NUMERIC,     pri_marge     = (v_row->>'marge'),
        pri_vente_ht_n  = (v_row->>'vente_ht')::NUMERIC,  pri_vente_ht  = (v_row->>'vente_ht'),
        pri_vente_ttc_n = (v_row->>'vente_ttc')::NUMERIC, pri_vente_ttc = (v_row->>'vente_ttc'),
        pri_dispo = '1',  -- Step 1: activate the piece (it now has a valid tariff)
        pricing_updated_by = p_operator,
        pricing_updated_source = 'import:' || p_batch_id::text
      WHERE pri_piece_id_i = v_existing.pri_piece_id_i
        AND pri_type = v_existing.pri_type;
    ELSE
      -- INSERT (recovery): the catalog piece exists but lost its price row.
      INSERT INTO pieces_price_history (
        batch_id, chunk_id, pri_piece_id_i, pri_type, operation,
        new_gros_ht, new_remise, new_achat_ht, new_marge, new_vente_ht, new_vente_ttc, new_dispo
      ) VALUES (
        p_batch_id, p_chunk_id, (v_row->>'piece_id_i')::INTEGER, coalesce(v_row->>'pri_type','0'), 'INSERT',
        (v_row->>'gros_ht')::NUMERIC, (v_row->>'remise')::NUMERIC, (v_row->>'achat_ht')::NUMERIC,
        (v_row->>'marge')::NUMERIC, (v_row->>'vente_ht')::NUMERIC, (v_row->>'vente_ttc')::NUMERIC, '1'
      );

      INSERT INTO pieces_price (
        pri_piece_id, pri_piece_id_i, pri_type, pri_pm_id,
        pri_gros_ht, pri_gros_ht_n, pri_remise, pri_remise_n,
        pri_achat_ht, pri_achat_ht_n, pri_marge, pri_marge_n,
        pri_vente_ht, pri_vente_ht_n, pri_vente_ttc, pri_vente_ttc_n,
        pri_dispo, pricing_state, pricing_updated_by, pricing_updated_source
      ) VALUES (
        (v_row->>'piece_id_i'), (v_row->>'piece_id_i')::INTEGER, coalesce(v_row->>'pri_type','0'), (v_row->>'pm_id'),
        (v_row->>'gros_ht'), (v_row->>'gros_ht')::NUMERIC, (v_row->>'remise'), (v_row->>'remise')::NUMERIC,
        (v_row->>'achat_ht'), (v_row->>'achat_ht')::NUMERIC, (v_row->>'marge'), (v_row->>'marge')::NUMERIC,
        (v_row->>'vente_ht'), (v_row->>'vente_ht')::NUMERIC, (v_row->>'vente_ttc'), (v_row->>'vente_ttc')::NUMERIC,
        '1', 'ACTIVE', p_operator, 'import:' || p_batch_id::text
      );
    END IF;

    v_committed := v_committed + 1;
  END LOOP;

  UPDATE price_import_batch_chunks SET status = 'COMMITTED' WHERE chunk_id = p_chunk_id;

  RETURN jsonb_build_object('committed', v_committed, 'skipped', v_skipped, 'missing', v_missing);
EXCEPTION WHEN OTHERS THEN
  UPDATE price_import_batch_chunks SET status = 'FAILED' WHERE chunk_id = p_chunk_id;
  RAISE;
END;
$$;

-- ----------------------------------------------------------------------------
-- pricing_rollback_batch: restore a batch's rows (LIFO), guarding against
--   superseded lines (a later batch touched the same piece). Returns
--   { restored, superseded } and sets batch status ROLLED_BACK / ROLLBACK_PARTIAL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pricing_rollback_batch(
  p_batch_id UUID,
  p_supplier TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_h          pieces_price_history%ROWTYPE;
  v_restored   INTEGER := 0;
  v_superseded INTEGER := 0;
  v_latest_id  BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_supplier, 'pricing')));

  -- LIFO: most-recent history rows of this batch first.
  FOR v_h IN
    SELECT * FROM pieces_price_history WHERE batch_id = p_batch_id ORDER BY id DESC
  LOOP
    -- Superseded guard: is this batch's entry the latest for that piece?
    SELECT id INTO v_latest_id
    FROM pieces_price_history
    WHERE pri_piece_id_i = v_h.pri_piece_id_i AND pri_type IS NOT DISTINCT FROM v_h.pri_type
    ORDER BY id DESC
    LIMIT 1;

    IF v_latest_id <> v_h.id THEN
      v_superseded := v_superseded + 1;
      CONTINUE; -- a newer batch owns this line; do not restore a stale value
    END IF;

    IF v_h.operation = 'INSERT' THEN
      -- The batch created this row → undo = delete it (back to "no price").
      DELETE FROM pieces_price
      WHERE pri_piece_id_i = v_h.pri_piece_id_i
        AND pri_type IS NOT DISTINCT FROM v_h.pri_type;
    ELSE
      UPDATE pieces_price SET
        pri_gros_ht_n   = v_h.old_gros_ht,   pri_gros_ht   = v_h.old_gros_ht::text,
        pri_remise_n    = v_h.old_remise,    pri_remise    = v_h.old_remise::text,
        pri_achat_ht_n  = v_h.old_achat_ht,  pri_achat_ht  = v_h.old_achat_ht::text,
        pri_marge_n     = v_h.old_marge,     pri_marge     = v_h.old_marge::text,
        pri_vente_ht_n  = v_h.old_vente_ht,  pri_vente_ht  = v_h.old_vente_ht::text,
        pri_vente_ttc_n = v_h.old_vente_ttc, pri_vente_ttc = v_h.old_vente_ttc::text,
        pri_dispo       = coalesce(v_h.old_dispo, pri_dispo),  -- restore activation state
        pricing_updated_source = 'rollback:' || p_batch_id::text
      WHERE pri_piece_id_i = v_h.pri_piece_id_i
        AND pri_type IS NOT DISTINCT FROM v_h.pri_type;
    END IF;

    v_restored := v_restored + 1;
  END LOOP;

  UPDATE price_import_batches
  SET status = CASE WHEN v_superseded > 0 THEN 'ROLLBACK_PARTIAL' ELSE 'ROLLED_BACK' END,
      completed_at = now()
  WHERE batch_id = p_batch_id;

  RETURN jsonb_build_object('restored', v_restored, 'superseded', v_superseded);
END;
$$;
