-- ============================================================================
-- Pricing Control Plane V1 — import-pending mode for pricing_commit_chunk
-- ----------------------------------------------------------------------------
-- WHY: the commit function hardcoded pri_dispo='1' (activated every imported
--      piece as sellable). Owner doctrine (2026-06-04): an import puts the COST
--      in base but must NOT make pieces sellable automatically — activation is
--      a separate, owner-gated step, and only CONFIRMED-available refs become
--      sellable (pri_dispo IN '1'/'2'/'3'). See runbook
--      .claude/knowledge/ops/supplier-brand-price-load-procedure.md (§Garde-fou
--      storefront) + can_sell gate (PR #850).
--
-- WHAT: add a trailing param `p_activate BOOLEAN DEFAULT false`:
--   - false (PENDING, the new default): INSERT → pri_dispo='0' (non-sellable) +
--       pricing_state_reason='pending_stock_check'; UPDATE → preserve the
--       existing pri_dispo (cost-only re-price, sellability unchanged).
--   - true (ACTIVATE): previous behaviour (pri_dispo='1' on INSERT and UPDATE).
--
-- SAFETY: function-definition change only (no table rewrite, no lock on
--   pieces_price). Backward-compatible: any caller that omits p_activate
--   resolves via the DEFAULT to PENDING (the safe default). Reversible
--   (rollback re-creates the original below).
-- ============================================================================

-- Apply-time guards (match the original pricing functions migration pattern).
SET lock_timeout = '2s';
SET statement_timeout = '30s';

BEGIN;

-- DROP the old signature (CREATE OR REPLACE cannot change the parameter list).
-- Backward-compatible: any caller that omits p_activate resolves via the DEFAULT
-- to PENDING (the safe default). This PR also updates the sole caller
-- (pricing.repository.ts) to pass p_activate explicitly.
DROP FUNCTION IF EXISTS pricing_commit_chunk(uuid, uuid, text, text, jsonb);

CREATE OR REPLACE FUNCTION pricing_commit_chunk(
  p_batch_id  UUID,
  p_chunk_id  UUID,
  p_supplier  TEXT,
  p_operator  TEXT,
  p_rows      JSONB,
  p_activate  BOOLEAN DEFAULT false   -- false = PENDING (cost only, not sellable)
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_row        JSONB;
  v_existing   pieces_price%ROWTYPE;
  v_committed  BIGINT := 0;
  v_skipped    BIGINT := 0;
  v_missing    BIGINT := 0;
  v_new_dispo  TEXT;
BEGIN
  -- Serialize concurrent chunk writes for the same supplier (released at tx end).
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_supplier, 'pricing')));

  UPDATE price_import_batch_chunks SET status = 'COMMITTING' WHERE chunk_id = p_chunk_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    SELECT * INTO v_existing
    FROM pieces_price
    WHERE pri_piece_id_i = (v_row->>'piece_id_i')::BIGINT
      AND pri_type = coalesce(v_row->>'pri_type', '0')
    FOR UPDATE;

    IF FOUND THEN
      -- UPDATE (re-price). Never touch manually-set / frozen prices.
      IF v_existing.pricing_state IN ('MANUAL_OVERRIDE', 'FROZEN') THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- ACTIVATE → '1'; PENDING → preserve existing dispo (cost-only, no sellability change).
      v_new_dispo := CASE WHEN p_activate THEN '1' ELSE v_existing.pri_dispo END;

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
        v_existing.pri_dispo,      v_new_dispo
      );

      UPDATE pieces_price SET
        pri_gros_ht_n   = (v_row->>'gros_ht')::NUMERIC,   pri_gros_ht   = (v_row->>'gros_ht'),
        pri_remise_n    = (v_row->>'remise')::NUMERIC,    pri_remise    = (v_row->>'remise'),
        pri_achat_ht_n  = (v_row->>'achat_ht')::NUMERIC,  pri_achat_ht  = (v_row->>'achat_ht'),
        pri_marge_n     = (v_row->>'marge')::NUMERIC,     pri_marge     = (v_row->>'marge'),
        pri_vente_ht_n  = (v_row->>'vente_ht')::NUMERIC,  pri_vente_ht  = (v_row->>'vente_ht'),
        pri_vente_ttc_n = (v_row->>'vente_ttc')::NUMERIC, pri_vente_ttc = (v_row->>'vente_ttc'),
        pri_dispo = v_new_dispo,  -- ACTIVATE='1' ; PENDING=preserved (cost-only re-price)
        pricing_updated_by = p_operator,
        pricing_updated_source = 'import:' || p_batch_id::text
      WHERE pri_piece_id_i = v_existing.pri_piece_id_i
        AND pri_type = v_existing.pri_type;
    ELSE
      -- INSERT (recovery): the catalog piece exists but lost its price row.
      -- ACTIVATE → '1' (sellable) ; PENDING → '0' (non-sellable) + reason.
      v_new_dispo := CASE WHEN p_activate THEN '1' ELSE '0' END;

      INSERT INTO pieces_price_history (
        batch_id, chunk_id, pri_piece_id_i, pri_type, operation,
        new_gros_ht, new_remise, new_achat_ht, new_marge, new_vente_ht, new_vente_ttc, new_dispo
      ) VALUES (
        p_batch_id, p_chunk_id, (v_row->>'piece_id_i')::BIGINT, coalesce(v_row->>'pri_type','0'), 'INSERT',
        (v_row->>'gros_ht')::NUMERIC, (v_row->>'remise')::NUMERIC, (v_row->>'achat_ht')::NUMERIC,
        (v_row->>'marge')::NUMERIC, (v_row->>'vente_ht')::NUMERIC, (v_row->>'vente_ttc')::NUMERIC, v_new_dispo
      );

      INSERT INTO pieces_price (
        pri_piece_id, pri_piece_id_i, pri_type, pri_pm_id,
        pri_gros_ht, pri_gros_ht_n, pri_remise, pri_remise_n,
        pri_achat_ht, pri_achat_ht_n, pri_marge, pri_marge_n,
        pri_vente_ht, pri_vente_ht_n, pri_vente_ttc, pri_vente_ttc_n,
        pri_dispo, pricing_state, pricing_state_reason, pricing_updated_by, pricing_updated_source
      ) VALUES (
        (v_row->>'piece_id_i'), (v_row->>'piece_id_i')::BIGINT, coalesce(v_row->>'pri_type','0'), (v_row->>'pm_id'),
        (v_row->>'gros_ht'), (v_row->>'gros_ht')::NUMERIC, (v_row->>'remise'), (v_row->>'remise')::NUMERIC,
        (v_row->>'achat_ht'), (v_row->>'achat_ht')::NUMERIC, (v_row->>'marge'), (v_row->>'marge')::NUMERIC,
        (v_row->>'vente_ht'), (v_row->>'vente_ht')::NUMERIC, (v_row->>'vente_ttc'), (v_row->>'vente_ttc')::NUMERIC,
        v_new_dispo, 'ACTIVE',
        CASE WHEN p_activate THEN NULL ELSE 'pending_stock_check' END,
        p_operator, 'import:' || p_batch_id::text
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

COMMENT ON FUNCTION pricing_commit_chunk(uuid, uuid, text, text, jsonb, boolean) IS
  'Pricing Control Plane V1 atomic chunk commit. p_activate=false (default) = PENDING (cost only, not sellable: INSERT pri_dispo=0 + reason pending_stock_check, UPDATE preserves dispo); p_activate=true = activate (pri_dispo=1). See supplier-brand-price-load-procedure.md.';

COMMIT;

-- ============================================================================
-- ROLLBACK (manual, owner-gated) — restore the original always-activating fn:
-- ----------------------------------------------------------------------------
-- BEGIN;
-- DROP FUNCTION IF EXISTS pricing_commit_chunk(uuid, uuid, text, text, jsonb, boolean);
-- CREATE OR REPLACE FUNCTION pricing_commit_chunk(
--   p_batch_id UUID, p_chunk_id UUID, p_supplier TEXT, p_operator TEXT, p_rows JSONB
-- ) RETURNS JSONB LANGUAGE plpgsql AS $$ ... (original body, pri_dispo hardcoded '1') $$;
-- COMMIT;
-- (Original body preserved in 20260522_pricing_control_plane_v1_functions.sql.)
-- ============================================================================
