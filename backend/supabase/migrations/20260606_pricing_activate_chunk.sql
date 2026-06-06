-- =====================================================
-- Pricing Control Plane — pricing_activate_chunk (availability activation)
-- Date: 2026-06-06
-- Refs: 20260522_pricing_control_plane_v1_functions.sql (commit/rollback infra),
--       20260604_pricing_commit_chunk_import_pending_mode.sql (import-pending mode),
--       audit/supplier-nk-dca-availability-2026-06-06 (NK availability run).
-- =====================================================
--
-- WHY a dedicated activation function (not commit_chunk):
--   The portal-verified NK prices are ALREADY in pieces_price (loaded import-pending,
--   pri_dispo=null = invisible). Making them sellable is a DISPO-ONLY state change,
--   per-reference: portal-CONFIRMED agency stock -> '1' (En stock), group stock ->
--   '2' (Disponible, livraison 48h). commit_chunk re-imports PRICES and only ever
--   activates to '1' (hardcoded) — it cannot carry the per-ref '1'/'2' split and would
--   needlessly rewrite correct prices. This function flips pri_dispo ONLY, per row.
--
-- REUSES the existing governance verbatim:
--   - writes pieces_price_history (old_dispo -> new_dispo, prices unchanged: old=new),
--     so the EXISTING pricing_rollback_batch(batch_id) reverses it for free
--     (it restores old_dispo, line 178 of the V1 functions migration);
--   - same price_import_batches / price_import_batch_chunks lifecycle + advisory lock.
--
-- SAFETY INVARIANTS (no false in-stock, no collateral writes):
--   - target dispo whitelisted to ('1','2') ONLY — never '0'/'3'/null/other (rejected);
--   - brand-locked by p_supplier (pri_pm_id): never touches a non-NK row;
--   - skips MANUAL_OVERRIDE / FROZEN (respects quarantine / manual control);
--   - skips any row ALREADY sellable (pri_dispo IN '1','2','3') — never downgrades nor
--     re-touches an active price; activation only ever moves null/'0' -> '1'/'2';
--   - prices are NOT mutated (dispo-only), so the storefront price is untouched.
--
-- ADDITIF. Idempotent (CREATE OR REPLACE). Forward-only. NOT applied to the shared DB
-- here — governed apply step (owner-gated). SECURITY INVOKER (service-role caller).
-- No explicit BEGIN/COMMIT (squawk assume_in_transaction=true: each call = 1 tx).
-- =====================================================

set lock_timeout = '2s';
set statement_timeout = '30s';

CREATE OR REPLACE FUNCTION pricing_activate_chunk(
  p_batch_id  UUID,
  p_chunk_id  UUID,
  p_supplier  TEXT,    -- pri_pm_id (brand), e.g. '3410' (NK). Brand-lock.
  p_operator  TEXT,
  p_rows      JSONB    -- [{ "piece_id_i": <bigint>, "pri_type": "0", "dispo": "1"|"2" }]
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_row        JSONB;
  v_existing   pieces_price%ROWTYPE;
  v_dispo      TEXT;
  v_activated  BIGINT := 0;
  v_skipped    BIGINT := 0;
  v_missing    BIGINT := 0;
  v_rejected   BIGINT := 0;
BEGIN
  -- Serialize concurrent writes for the same supplier (released at tx end).
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_supplier, 'pricing')));

  UPDATE price_import_batch_chunks SET status = 'COMMITTING' WHERE chunk_id = p_chunk_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_dispo := v_row->>'dispo';

    -- Whitelist: activation only ever sets '1' (agence) or '2' (groupe). Anything
    -- else (incl '0','3',null) is rejected — never silently coerced.
    IF v_dispo IS NULL OR v_dispo NOT IN ('1', '2') THEN
      v_rejected := v_rejected + 1;
      CONTINUE;
    END IF;

    SELECT * INTO v_existing
    FROM pieces_price
    WHERE pri_piece_id_i = (v_row->>'piece_id_i')::BIGINT
      AND pri_type       = coalesce(v_row->>'pri_type', '0')
      AND pri_pm_id      = p_supplier          -- brand-lock: never touch a non-NK row
    FOR UPDATE;

    IF NOT FOUND THEN
      v_missing := v_missing + 1;
      CONTINUE;
    END IF;

    -- Respect quarantine / manual control; never re-touch an already-sellable row.
    IF v_existing.pricing_state IN ('MANUAL_OVERRIDE', 'FROZEN')
       OR v_existing.pri_dispo IN ('1', '2', '3') THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Audit (old -> new). Prices UNCHANGED (dispo-only): old=new on every price column,
    -- so rollback restores prices as a no-op and restores old_dispo (null/'0').
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
      v_existing.pri_dispo,       v_dispo
    );

    -- Activation: dispo ONLY. Clear the pending reason. No price mutation.
    UPDATE pieces_price SET
      pri_dispo              = v_dispo,
      pricing_state_reason   = NULL,
      pricing_updated_by     = p_operator,
      pricing_updated_source = 'activate:' || p_batch_id::text
    WHERE pri_piece_id_i = v_existing.pri_piece_id_i
      AND pri_type       = v_existing.pri_type
      AND pri_pm_id      = p_supplier;

    v_activated := v_activated + 1;
  END LOOP;

  UPDATE price_import_batch_chunks SET status = 'COMMITTED' WHERE chunk_id = p_chunk_id;

  RETURN jsonb_build_object(
    'activated', v_activated, 'skipped', v_skipped,
    'missing',   v_missing,   'rejected', v_rejected
  );
EXCEPTION WHEN OTHERS THEN
  UPDATE price_import_batch_chunks SET status = 'FAILED' WHERE chunk_id = p_chunk_id;
  RAISE;
END;
$$;

COMMENT ON FUNCTION pricing_activate_chunk(UUID, UUID, TEXT, TEXT, JSONB) IS
  'Availability activation (dispo-only) for portal-CONFIRMED supplier refs: flips pri_dispo null/0 -> 1 (agence) | 2 (groupe), per row. Brand-locked, skips FROZEN/MANUAL/already-sellable, whitelists 1/2. Writes pieces_price_history so pricing_rollback_batch reverses it. Owner-gated.';
