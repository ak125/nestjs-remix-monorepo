-- ============================================================================
-- Pricing Control Plane V1 — l'import écrit le fournisseur réel et la date du tarif
-- ----------------------------------------------------------------------------
-- POURQUOI : pricing_commit_chunk (corps servi = 20260608_pricing_commit_chunk_persist_pri_ref.sql)
--   n'écrit ni pieces_price.pri_frs ni pieces_price.pri_date_from, ni dans la
--   branche UPDATE ni dans la branche INSERT, et la charge utile envoyée par
--   price-import.service.ts ne les porte pas. Conséquence relevée le 2026-11-17 :
--   après les imports gouvernés de juin 2026, aucune ligne n'a de pri_date_from
--   postérieure au 2023-10-01 et pri_frs garde l'ancien fournisseur (SEIM : CAL
--   et NED, alors que le net importé vient de DCA). La fraîcheur affichée et le
--   fournisseur de commande (order-line-supplier) sont donc faux après import.
--
-- QUOI :
--   1. pieces_price_history reçoit quatre colonnes nullables : old_frs, new_frs,
--      old_date_from, new_date_from (même convention old/new que les prix).
--   2. pricing_commit_chunk écrit pri_frs = p_rows.frs et
--      pri_date_from = p_rows.date_from sur chaque ligne qu'il met à jour ou crée,
--      et trace l'ancienne et la nouvelle valeur. Les lignes hors du lot ne sont
--      pas touchées (la fonction n'écrit que les pièces de p_rows, inchangé).
--      Si la charge utile ne porte pas la clé (backend antérieur pendant le
--      déploiement), la valeur existante est conservée et new_frs /
--      new_date_from restent NULL dans l'historique : l'écart est observable.
--      Le backend de cette PR refuse un commit sans date de tarif ni fournisseur.
--   3. pricing_rollback_batch restaure pri_frs et pri_date_from depuis
--      l'historique pour les lignes que ce lot a marquées (new_frs ou
--      new_date_from non NULL). Les lignes d'historique antérieures (colonnes
--      NULL) gardent le comportement actuel.
--
-- SÛRETÉ : ADD COLUMN nullable sans défaut = changement de catalogue seul (pas de
--   réécriture de table) ; verrou bref sur la table partitionnée et ses
--   partitions, borné par lock_timeout. Les partitions futures (cron
--   20260621_pricing_partition_rotation_cron.sql, PARTITION OF) héritent des
--   colonnes. Fonctions : CREATE OR REPLACE à signature identique, search_path
--   épinglé conservé (20260616_vague5_pin_function_search_path.sql), droits
--   inchangés. Aucune donnée existante modifiée par cette migration.
--
-- PRÉPARÉE, NON APPLIQUÉE (mandat AS, complément du 2026-11-17). Zone prix :
--   application par Marwane seulement.
-- RETOUR : 20261117_pricing_commit_chunk_frs_date_from.down.sql (corps antérieurs).
-- ============================================================================

SET lock_timeout = '2s';
SET statement_timeout = '30s';

ALTER TABLE pieces_price_history
  ADD COLUMN IF NOT EXISTS old_frs       TEXT,
  ADD COLUMN IF NOT EXISTS new_frs       TEXT,
  ADD COLUMN IF NOT EXISTS old_date_from TEXT,
  ADD COLUMN IF NOT EXISTS new_date_from TEXT;

COMMENT ON COLUMN pieces_price_history.new_frs IS
  'pri_frs écrit par le lot (fournisseur réel du tarif). NULL = le lot n''a pas écrit pri_frs.';
COMMENT ON COLUMN pieces_price_history.new_date_from IS
  'pri_date_from écrit par le lot (date du tarif). NULL = le lot n''a pas écrit pri_date_from.';

CREATE OR REPLACE FUNCTION pricing_commit_chunk(
  p_batch_id  UUID,
  p_chunk_id  UUID,
  p_supplier  TEXT,
  p_operator  TEXT,
  p_rows      JSONB,
  p_activate  BOOLEAN DEFAULT false   -- false = PENDING (cost only, not sellable)
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_row        JSONB;
  v_existing   pieces_price%ROWTYPE;
  v_committed  BIGINT := 0;
  v_skipped    BIGINT := 0;
  v_missing    BIGINT := 0;
  v_new_dispo  TEXT;
  v_pri_ref    TEXT;
  v_frs        TEXT;
  v_date_from  TEXT;
BEGIN
  -- Serialize concurrent chunk writes for the same supplier (released at tx end).
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_supplier, 'pricing')));

  UPDATE price_import_batch_chunks SET status = 'COMMITTING' WHERE chunk_id = p_chunk_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    -- Fournisseur réel et date du tarif portés par la ligne (NULL si absents).
    v_frs       := NULLIF(v_row->>'frs', '');
    v_date_from := NULLIF(v_row->>'date_from', '');

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
        old_dispo, new_dispo,
        old_frs, new_frs, old_date_from, new_date_from
      ) VALUES (
        p_batch_id, p_chunk_id, v_existing.pri_piece_id_i, v_existing.pri_type, 'UPDATE',
        v_existing.pri_gros_ht_n,  (v_row->>'gros_ht')::NUMERIC,
        v_existing.pri_remise_n,   (v_row->>'remise')::NUMERIC,
        v_existing.pri_achat_ht_n, (v_row->>'achat_ht')::NUMERIC,
        v_existing.pri_marge_n,    (v_row->>'marge')::NUMERIC,
        v_existing.pri_vente_ht_n, (v_row->>'vente_ht')::NUMERIC,
        v_existing.pri_vente_ttc_n,(v_row->>'vente_ttc')::NUMERIC,
        v_existing.pri_dispo,      v_new_dispo,
        v_existing.pri_frs,        v_frs,
        v_existing.pri_date_from,  v_date_from
      );

      -- pri_ref intentionally preserved on re-price (do not rewrite an existing row's reference).
      UPDATE pieces_price SET
        pri_gros_ht_n   = (v_row->>'gros_ht')::NUMERIC,   pri_gros_ht   = (v_row->>'gros_ht'),
        pri_remise_n    = (v_row->>'remise')::NUMERIC,    pri_remise    = (v_row->>'remise'),
        pri_achat_ht_n  = (v_row->>'achat_ht')::NUMERIC,  pri_achat_ht  = (v_row->>'achat_ht'),
        pri_marge_n     = (v_row->>'marge')::NUMERIC,     pri_marge     = (v_row->>'marge'),
        pri_vente_ht_n  = (v_row->>'vente_ht')::NUMERIC,  pri_vente_ht  = (v_row->>'vente_ht'),
        pri_vente_ttc_n = (v_row->>'vente_ttc')::NUMERIC, pri_vente_ttc = (v_row->>'vente_ttc'),
        pri_dispo = v_new_dispo,  -- ACTIVATE='1' ; PENDING=preserved (cost-only re-price)
        pri_frs       = coalesce(v_frs, v_existing.pri_frs),
        pri_date_from = coalesce(v_date_from, v_existing.pri_date_from),
        pricing_updated_by = p_operator,
        pricing_updated_source = 'import:' || p_batch_id::text
      WHERE pri_piece_id_i = v_existing.pri_piece_id_i
        AND pri_type = v_existing.pri_type;
    ELSE
      -- INSERT (recovery): the catalog piece exists but lost its price row.
      -- ACTIVATE → '1' (sellable) ; PENDING → '0' (non-sellable) + reason.
      v_new_dispo := CASE WHEN p_activate THEN '1' ELSE '0' END;

      -- pri_ref = imported supplier ref if carried in the payload, else the
      -- canonical catalog reference (pieces.piece_ref). Required by the dispo
      -- activation resolver (it matches pieces_price BY pri_ref).
      v_pri_ref := COALESCE(
        NULLIF(v_row->>'ref', ''),
        (SELECT p.piece_ref FROM pieces p WHERE p.piece_id = (v_row->>'piece_id_i')::int)
      );

      INSERT INTO pieces_price_history (
        batch_id, chunk_id, pri_piece_id_i, pri_type, operation,
        new_gros_ht, new_remise, new_achat_ht, new_marge, new_vente_ht, new_vente_ttc, new_dispo,
        new_frs, new_date_from
      ) VALUES (
        p_batch_id, p_chunk_id, (v_row->>'piece_id_i')::BIGINT, coalesce(v_row->>'pri_type','0'), 'INSERT',
        (v_row->>'gros_ht')::NUMERIC, (v_row->>'remise')::NUMERIC, (v_row->>'achat_ht')::NUMERIC,
        (v_row->>'marge')::NUMERIC, (v_row->>'vente_ht')::NUMERIC, (v_row->>'vente_ttc')::NUMERIC, v_new_dispo,
        v_frs, v_date_from
      );

      INSERT INTO pieces_price (
        pri_piece_id, pri_piece_id_i, pri_type, pri_pm_id, pri_ref,
        pri_gros_ht, pri_gros_ht_n, pri_remise, pri_remise_n,
        pri_achat_ht, pri_achat_ht_n, pri_marge, pri_marge_n,
        pri_vente_ht, pri_vente_ht_n, pri_vente_ttc, pri_vente_ttc_n,
        pri_dispo, pri_frs, pri_date_from,
        pricing_state, pricing_state_reason, pricing_updated_by, pricing_updated_source
      ) VALUES (
        (v_row->>'piece_id_i'), (v_row->>'piece_id_i')::BIGINT, coalesce(v_row->>'pri_type','0'), (v_row->>'pm_id'), v_pri_ref,
        (v_row->>'gros_ht'), (v_row->>'gros_ht')::NUMERIC, (v_row->>'remise'), (v_row->>'remise')::NUMERIC,
        (v_row->>'achat_ht'), (v_row->>'achat_ht')::NUMERIC, (v_row->>'marge'), (v_row->>'marge')::NUMERIC,
        (v_row->>'vente_ht'), (v_row->>'vente_ht')::NUMERIC, (v_row->>'vente_ttc'), (v_row->>'vente_ttc')::NUMERIC,
        v_new_dispo, v_frs, v_date_from,
        'ACTIVE',
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
  'Pricing Control Plane V1 atomic chunk commit. p_activate=false (default) = PENDING (cost only: INSERT pri_dispo=0 + pending_stock_check, UPDATE preserves dispo); p_activate=true = activate (pri_dispo=1). INSERT persists pri_ref = COALESCE(payload ref, pieces.piece_ref). Writes pri_frs = payload frs and pri_date_from = payload date_from on committed rows only (kept when absent), traced in pieces_price_history old/new_frs and old/new_date_from (20261117).';

CREATE OR REPLACE FUNCTION pricing_rollback_batch(p_batch_id uuid, p_supplier text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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
        -- Fournisseur et date : restaurés seulement si ce lot les a écrits.
        pri_frs         = CASE WHEN v_h.new_frs IS NOT NULL THEN v_h.old_frs ELSE pri_frs END,
        pri_date_from   = CASE WHEN v_h.new_date_from IS NOT NULL THEN v_h.old_date_from ELSE pri_date_from END,
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
