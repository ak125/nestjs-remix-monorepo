-- Rollback: 20261018_pricing_quarantine_rupture_sphere_c00282
-- Remet en vente les 6 sphères retirées par la migration, et elles seules : une
-- pièce n'est remise que si sa ligne tarif porte encore exactement la quarantaine
-- de ce fichier (FROZEN, pricing_updated_source = la migration). Une ligne
-- modifiée depuis par un autre canal est conservée et signalée.
-- Remet l'état mesuré : piece_display = true, pricing_state = 'ACTIVE', motif,
-- auteur et source à NULL. Aucun prix ni pri_dispo n'est touché.
-- À lancer quand un fournisseur reconfirme la dispo d'une de ces réfs (sinon la
-- pièce redevient commandable alors qu'elle est en rupture).
-- L'engine est forward-only : ce fichier se lance à la main. La transaction
-- explicite borne les délais par SET LOCAL et rend retour et constat
-- indivisibles.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DO $unquarantine$
DECLARE
  c_source CONSTANT text := 'backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql';
  c_ids    CONSTANT bigint[] := ARRAY[5660748, 9613328, 1008195, 1011020, 1303637, 1306850];
  v_ours   bigint[];
  v_shown  bigint;
  v_active bigint;
BEGIN
  SELECT coalesce(array_agg(pp.pri_piece_id_i), '{}') INTO v_ours
    FROM public.pieces_price pp
   WHERE pp.pri_piece_id_i = ANY (c_ids)
     AND pp.pricing_state = 'FROZEN'
     AND pp.pricing_updated_source = c_source;

  UPDATE public.pieces_price
     SET pricing_state          = 'ACTIVE',
         pricing_state_reason   = NULL,
         pricing_updated_by     = NULL,
         pricing_updated_source = NULL
   WHERE pri_piece_id_i = ANY (v_ours)
     AND pricing_state = 'FROZEN'
     AND pricing_updated_source = c_source;
  GET DIAGNOSTICS v_active = ROW_COUNT;

  UPDATE public.pieces
     SET piece_display = true
   WHERE piece_id = ANY (v_ours)
     AND piece_display = false;
  GET DIAGNOSTICS v_shown = ROW_COUNT;

  RAISE NOTICE 'rollback quarantaine C00282 : % ligne(s) tarif réactivée(s), % pièce(s) réaffichée(s), % pièce(s) hors de ce retrait conservée(s)',
    v_active, v_shown, 6 - cardinality(v_ours);
END
$unquarantine$;

-- Constat : état de chaque pièce après retour.
SELECT p.piece_id, p.piece_ref, p.piece_display, pp.pri_dispo, pp.pricing_state, pp.pricing_updated_source
  FROM public.pieces p
  JOIN public.pieces_price pp ON pp.pri_piece_id_i = p.piece_id
 WHERE p.piece_id IN (5660748, 9613328, 1008195, 1011020, 1303637, 1306850)
 ORDER BY p.piece_id;

COMMIT;
