-- Rollback : 20261117_pricing_commit_chunk_frs_date_from
-- Remet les corps de pricing_commit_chunk et pricing_rollback_batch servis le
-- 2026-11-17 avant cette migration (extraits par pg_get_functiondef ; commit_chunk
-- = 20260608_pricing_commit_chunk_persist_pri_ref.sql, search_path épinglé).
-- Après ce retour, un import n'écrit plus pri_frs ni pri_date_from, et un rollback
-- de lot ne les restaure plus.
-- Les colonnes old_frs, new_frs, old_date_from, new_date_from de
-- pieces_price_history sont CONSERVÉES : elles portent la trace des lots passés
-- sous la nouvelle fonction, utile pour remettre à la main pri_frs et
-- pri_date_from avant un rollback. Les retirer (DROP COLUMN) est un geste
-- destructif distinct, à décider par l'owner.
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.pricing_commit_chunk(p_batch_id uuid, p_chunk_id uuid, p_supplier text, p_operator text, p_rows jsonb, p_activate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row        JSONB;
  v_existing   pieces_price%ROWTYPE;
  v_committed  BIGINT := 0;
  v_skipped    BIGINT := 0;
  v_missing    BIGINT := 0;
  v_new_dispo  TEXT;
  v_pri_ref    TEXT;
BEGIN
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
      IF v_existing.pricing_state IN ('MANUAL_OVERRIDE', 'FROZEN') THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
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
        pri_dispo = v_new_dispo,
        pricing_updated_by = p_operator,
        pricing_updated_source = 'import:' || p_batch_id::text
      WHERE pri_piece_id_i = v_existing.pri_piece_id_i
        AND pri_type = v_existing.pri_type;
    ELSE
      v_new_dispo := CASE WHEN p_activate THEN '1' ELSE '0' END;
      v_pri_ref := COALESCE(
        NULLIF(v_row->>'ref', ''),
        (SELECT p.piece_ref FROM pieces p WHERE p.piece_id = (v_row->>'piece_id_i')::int)
      );

      INSERT INTO pieces_price_history (
        batch_id, chunk_id, pri_piece_id_i, pri_type, operation,
        new_gros_ht, new_remise, new_achat_ht, new_marge, new_vente_ht, new_vente_ttc, new_dispo
      ) VALUES (
        p_batch_id, p_chunk_id, (v_row->>'piece_id_i')::BIGINT, coalesce(v_row->>'pri_type','0'), 'INSERT',
        (v_row->>'gros_ht')::NUMERIC, (v_row->>'remise')::NUMERIC, (v_row->>'achat_ht')::NUMERIC,
        (v_row->>'marge')::NUMERIC, (v_row->>'vente_ht')::NUMERIC, (v_row->>'vente_ttc')::NUMERIC, v_new_dispo
      );

      INSERT INTO pieces_price (
        pri_piece_id, pri_piece_id_i, pri_type, pri_pm_id, pri_ref,
        pri_gros_ht, pri_gros_ht_n, pri_remise, pri_remise_n,
        pri_achat_ht, pri_achat_ht_n, pri_marge, pri_marge_n,
        pri_vente_ht, pri_vente_ht_n, pri_vente_ttc, pri_vente_ttc_n,
        pri_dispo, pricing_state, pricing_state_reason, pricing_updated_by, pricing_updated_source
      ) VALUES (
        (v_row->>'piece_id_i'), (v_row->>'piece_id_i')::BIGINT, coalesce(v_row->>'pri_type','0'), (v_row->>'pm_id'), v_pri_ref,
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
$function$

;

CREATE OR REPLACE FUNCTION public.pricing_rollback_batch(p_batch_id uuid, p_supplier text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_h          pieces_price_history%ROWTYPE;
  v_restored   BIGINT := 0;
  v_superseded BIGINT := 0;
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
$function$

;

COMMENT ON FUNCTION pricing_commit_chunk(uuid, uuid, text, text, jsonb, boolean) IS
  'Pricing Control Plane V1 atomic chunk commit. p_activate=false (default) = PENDING (cost only: INSERT pri_dispo=0 + pending_stock_check, UPDATE preserves dispo); p_activate=true = activate (pri_dispo=1). INSERT persists pri_ref = COALESCE(payload ref, pieces.piece_ref) so the row is activation-resolvable (the dispo activation matches by pri_ref). See supplier-brand-price-load-procedure.md.';

COMMIT;
