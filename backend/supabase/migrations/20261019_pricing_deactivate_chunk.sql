-- =====================================================
-- Pricing Control Plane — pricing_deactivate_chunk + pricing_deactivate_rollback
-- (availability withdrawal, the mirror of pricing_activate_chunk)
-- Date: 2026-10-19
-- Refs: 20260606_pricing_activate_chunk.sql (activation, mirrored here),
--       20260522_pricing_control_plane_v1_functions.sql (batch/chunk lifecycle,
--       pricing_rollback_batch), backend/src/modules/pricing/services/
--       price-deactivation.service.ts (caller: POST /api/admin/pricing/deactivate/*).
-- =====================================================
--
-- WHY a dedicated withdrawal function:
--   The price module can make a ref sellable (pricing_activate_chunk) but never the
--   reverse: a ref discontinued on the supplier tariff, or confirmed out of stock at
--   the supplier, stays sellable. Withdrawing it is a DISPO-ONLY state change, per
--   row: pri_dispo '1'|'2'|'3' -> '0'. Prices are never mutated.
--
-- WHY a dedicated rollback (not pricing_rollback_batch):
--   pricing_rollback_batch rewrites every text price column from its numeric twin
--   (pri_vente_ttc = old_vente_ttc::text, ...): on a row whose numeric column is
--   null it would blank the displayed price. pricing_deactivate_rollback restores
--   pri_dispo and the reason ONLY. The service refuses pricing_rollback_batch for
--   a DISPO_DEACTIVATION batch (pricing.repository.ts rollbackBatch).
--
-- SAFETY INVARIANTS (no collateral writes, exact reversal):
--   - the caller's batch must exist with operation 'DISPO_DEACTIVATION', the same
--     supplier and status 'COMMITTING' (the per-supplier mutex held by the service),
--     and the chunk must belong to it; otherwise the call raises, nothing is written;
--   - reason whitelisted to ('DISCONTINUED_TARIFF','CONFIRMED_OUT') — anything else
--     is rejected, never coerced;
--   - brand-locked by p_supplier (pri_pm_id): never touches another brand's row;
--   - skips MANUAL_OVERRIDE / FROZEN (respects quarantine / manual control);
--   - skips any row not sellable today (pri_dispo null or not in '1','2','3');
--   - skips any row already carrying a pricing_state_reason: the rollback restores
--     the reason to NULL, so it only ever withdraws rows whose reason was NULL;
--   - journals old -> new dispo to pieces_price_history (prices old = new);
--   - the rollback only restores a row this batch still owns: its history entry is
--     the latest for (piece, type) AND the row still reads pri_dispo '0' with this
--     batch as pricing_updated_source. Any later write (activation, import, manual
--     edit) leaves the row untouched and is counted as superseded.
--
-- Errors: each call is one transaction (PostgREST). An error rolls the whole call
-- back — chunk status included — so no EXCEPTION handler is declared here: one
-- that marks the chunk FAILED then re-raises would be rolled back with the rest.
-- The service marks the batch FAILED; the rollback accepts a FAILED batch.
--
-- ADDITIF. Idempotent (CREATE OR REPLACE). Forward-only. NOT applied to the shared DB
-- here — governed apply step (owner-gated). SECURITY INVOKER (service-role caller);
-- EXECUTE revoked from PUBLIC, anon and authenticated (Supabase default privileges
-- grant it to them on every new function).
-- No explicit BEGIN/COMMIT (squawk assume_in_transaction=true: each call = 1 tx).
--
-- ROLLBACK: 20261019_pricing_deactivate_chunk.down.sql (manual; the runner ignores
-- it, forward-only policy).
--
-- Behaviour test (throwaway PostgreSQL 17, no network):
--   bash scripts/db/test-pricing-deactivate-chunk.sh
-- =====================================================

set lock_timeout = '2s';
set statement_timeout = '30s';

CREATE OR REPLACE FUNCTION pricing_deactivate_chunk(
  p_batch_id  UUID,
  p_chunk_id  UUID,
  p_supplier  TEXT,    -- pri_pm_id (brand). Brand-lock.
  p_operator  TEXT,
  p_rows      JSONB    -- [{ "piece_id_i": <bigint>, "pri_type": "0", "reason": "CONFIRMED_OUT" }]
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row          JSONB;
  v_existing     pieces_price%ROWTYPE;
  v_reason       TEXT;
  v_deactivated  BIGINT := 0;
  v_skipped      BIGINT := 0;
  v_missing      BIGINT := 0;
  v_rejected     BIGINT := 0;
BEGIN
  -- Serialize concurrent writes for the same supplier (released at tx end).
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_supplier, 'pricing')));

  IF NOT EXISTS (
    SELECT 1
    FROM price_import_batches b
    JOIN price_import_batch_chunks c ON c.batch_id = b.batch_id
    WHERE b.batch_id = p_batch_id
      AND c.chunk_id = p_chunk_id
      AND b.operation = 'DISPO_DEACTIVATION'
      AND b.supplier_id = p_supplier
      AND b.status = 'COMMITTING'
  ) THEN
    RAISE EXCEPTION 'pricing_deactivate_chunk: batch % / chunk % is not a COMMITTING DISPO_DEACTIVATION batch of supplier %',
      p_batch_id, p_chunk_id, p_supplier;
  END IF;

  UPDATE price_import_batch_chunks SET status = 'COMMITTING' WHERE chunk_id = p_chunk_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_reason := v_row->>'reason';

    IF v_reason IS NULL OR v_reason NOT IN ('DISCONTINUED_TARIFF', 'CONFIRMED_OUT') THEN
      v_rejected := v_rejected + 1;
      CONTINUE;
    END IF;

    SELECT * INTO v_existing
    FROM pieces_price
    WHERE pri_piece_id_i = (v_row->>'piece_id_i')::BIGINT
      AND pri_type       = coalesce(v_row->>'pri_type', '0')
      AND pri_pm_id      = p_supplier          -- brand-lock
    FOR UPDATE;

    IF NOT FOUND THEN
      v_missing := v_missing + 1;
      CONTINUE;
    END IF;

    IF v_existing.pricing_state IN ('MANUAL_OVERRIDE', 'FROZEN')
       OR v_existing.pri_dispo IS NULL
       OR v_existing.pri_dispo NOT IN ('1', '2', '3')
       OR v_existing.pricing_state_reason IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Audit (old -> new). Prices UNCHANGED (dispo-only): old = new on every price column.
    INSERT INTO pieces_price_history (
      batch_id, chunk_id, pri_piece_id_i, pri_type, operation,
      old_gros_ht,  new_gros_ht,  old_remise,   new_remise,
      old_achat_ht, new_achat_ht, old_marge,    new_marge,
      old_vente_ht, new_vente_ht, old_vente_ttc, new_vente_ttc,
      old_dispo,    new_dispo
    ) VALUES (
      p_batch_id, p_chunk_id, v_existing.pri_piece_id_i, v_existing.pri_type, 'UPDATE',
      v_existing.pri_gros_ht_n,   v_existing.pri_gros_ht_n,
      v_existing.pri_remise_n,    v_existing.pri_remise_n,
      v_existing.pri_achat_ht_n,  v_existing.pri_achat_ht_n,
      v_existing.pri_marge_n,     v_existing.pri_marge_n,
      v_existing.pri_vente_ht_n,  v_existing.pri_vente_ht_n,
      v_existing.pri_vente_ttc_n, v_existing.pri_vente_ttc_n,
      v_existing.pri_dispo,       '0'
    );

    -- Withdrawal: dispo ONLY, with the reason. No price mutation.
    UPDATE pieces_price SET
      pri_dispo              = '0',
      pricing_state_reason   = 'DISPO_DEACTIVATION:' || v_reason,
      pricing_updated_by     = p_operator,
      pricing_updated_source = 'deactivate:' || p_batch_id::text
    WHERE pri_piece_id_i = v_existing.pri_piece_id_i
      AND pri_type       = v_existing.pri_type
      AND pri_pm_id      = p_supplier;

    v_deactivated := v_deactivated + 1;
  END LOOP;

  UPDATE price_import_batch_chunks SET status = 'COMMITTED' WHERE chunk_id = p_chunk_id;

  RETURN jsonb_build_object(
    'deactivated', v_deactivated, 'skipped', v_skipped,
    'missing',     v_missing,     'rejected', v_rejected
  );
END;
$$;

CREATE OR REPLACE FUNCTION pricing_deactivate_rollback(
  p_batch_id UUID,
  p_supplier TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_h          pieces_price_history%ROWTYPE;
  v_restored   BIGINT := 0;
  v_superseded BIGINT := 0;
  v_latest_id  BIGINT;
  v_n          BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_supplier, 'pricing')));

  IF NOT EXISTS (
    SELECT 1 FROM price_import_batches
    WHERE batch_id = p_batch_id
      AND operation = 'DISPO_DEACTIVATION'
      AND supplier_id = p_supplier
      AND status IN ('COMMITTED', 'FAILED')
  ) THEN
    RAISE EXCEPTION 'pricing_deactivate_rollback: batch % is not a COMMITTED or FAILED DISPO_DEACTIVATION batch of supplier %',
      p_batch_id, p_supplier;
  END IF;

  -- LIFO: most-recent history rows of this batch first.
  FOR v_h IN
    SELECT * FROM pieces_price_history WHERE batch_id = p_batch_id ORDER BY id DESC
  LOOP
    -- Superseded guard: is this batch's entry the latest for that row?
    SELECT id INTO v_latest_id
    FROM pieces_price_history
    WHERE pri_piece_id_i = v_h.pri_piece_id_i AND pri_type IS NOT DISTINCT FROM v_h.pri_type
    ORDER BY id DESC
    LIMIT 1;

    IF v_latest_id <> v_h.id THEN
      v_superseded := v_superseded + 1;
      CONTINUE;
    END IF;

    -- Restore dispo + reason ONLY, and only if the row is still this batch's
    -- withdrawal (an unjournaled later write is caught here).
    UPDATE pieces_price SET
      pri_dispo              = v_h.old_dispo,
      pricing_state_reason   = NULL,
      pricing_updated_source = 'rollback:' || p_batch_id::text
    WHERE pri_piece_id_i = v_h.pri_piece_id_i
      AND pri_type IS NOT DISTINCT FROM v_h.pri_type
      AND pri_pm_id = p_supplier
      AND pri_dispo = '0'
      AND pricing_updated_source = 'deactivate:' || p_batch_id::text;
    GET DIAGNOSTICS v_n = ROW_COUNT;

    IF v_n = 0 THEN
      v_superseded := v_superseded + 1;
    ELSE
      v_restored := v_restored + v_n;
    END IF;
  END LOOP;

  UPDATE price_import_batches
  SET status = CASE WHEN v_superseded > 0 THEN 'ROLLBACK_PARTIAL' ELSE 'ROLLED_BACK' END,
      completed_at = now()
  WHERE batch_id = p_batch_id;

  RETURN jsonb_build_object('restored', v_restored, 'superseded', v_superseded);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pricing_deactivate_chunk(UUID, UUID, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pricing_deactivate_rollback(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION pricing_deactivate_chunk(UUID, UUID, TEXT, TEXT, JSONB) IS
  'Availability withdrawal (dispo-only): flips pri_dispo 1|2|3 -> 0 for supplier refs discontinued on the tariff or confirmed out, per row, with reason DISPO_DEACTIVATION:<reason>. Brand-locked, requires a COMMITTING DISPO_DEACTIVATION batch, skips FROZEN/MANUAL/unsellable/reason-carrying rows. Journals to pieces_price_history; reversed by pricing_deactivate_rollback. Owner-gated.';

COMMENT ON FUNCTION pricing_deactivate_rollback(UUID, TEXT) IS
  'LIFO dispo-only rollback of a DISPO_DEACTIVATION batch: restores pri_dispo and clears the reason on rows the batch still owns; never touches prices. Sets ROLLED_BACK / ROLLBACK_PARTIAL. Owner-gated.';
