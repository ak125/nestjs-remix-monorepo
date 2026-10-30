-- Rollback: 20261021_pricing_rupture_emetteur_embrayage_luk_5130041
-- Remet en vente le jeu émetteur/récepteur d'embrayage LUK 513 0041 10, et lui
-- seul : la ligne tarif n'est remise que si elle porte encore exactement la
-- rupture de ce fichier (pri_dispo '0', FROZEN, pricing_updated_source = la
-- migration). Une ligne modifiée depuis par un autre canal est conservée et
-- signalée.
-- Remet l'état mesuré : pri_dispo = '1', pricing_state = 'ACTIVE', motif, auteur
-- et source à NULL. Aucun prix ni piece_display n'est touché.
-- À lancer quand le fournisseur reconfirme la dispo de cette réf (sinon la pièce
-- redevient commandable alors qu'elle est en rupture).
-- L'engine est forward-only : ce fichier se lance à la main. La transaction
-- explicite borne les délais par SET LOCAL et rend retour et constat
-- indivisibles.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DO $unrupture$
DECLARE
  c_piece  CONSTANT integer := 3283437;
  c_source CONSTANT text := 'backend/supabase/migrations/20261021_pricing_rupture_emetteur_embrayage_luk_5130041.sql';
  v_back   bigint;
BEGIN
  UPDATE public.pieces_price
     SET pri_dispo              = '1',
         pricing_state          = 'ACTIVE',
         pricing_state_reason   = NULL,
         pricing_updated_by     = NULL,
         pricing_updated_source = NULL
   WHERE pri_piece_id_i = c_piece
     AND pri_dispo = '0'
     AND pricing_state = 'FROZEN'
     AND pricing_updated_source = c_source;
  GET DIAGNOSTICS v_back = ROW_COUNT;

  RAISE NOTICE 'rollback rupture LUK 513 0041 10 : % ligne tarif remise en vente (0 = ligne hors de cette rupture, conservée)',
    v_back;
END
$unrupture$;

-- Constat : état de la ligne après retour.
SELECT p.piece_id, p.piece_ref, p.piece_display, pp.pri_dispo, pp.pricing_state, pp.pricing_updated_source
  FROM public.pieces p
  JOIN public.pieces_price pp ON pp.pri_piece_id_i = p.piece_id
 WHERE p.piece_id = 3283437;

COMMIT;
