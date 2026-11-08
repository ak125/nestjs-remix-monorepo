-- Rollback: 20261022_pricing_quarantine_rupture_cremaillere_snra_sor1706375
-- Remet en vente la crémaillère SNRA SOR1706375, seulement si sa ligne tarif porte
-- encore exactement le retrait de ce fichier (pri_dispo '0', FROZEN,
-- pricing_updated_source = la migration). Une ligne modifiée depuis par un autre
-- canal est conservée et signalée.
-- Remet l'état mesuré : piece_display = true, pri_dispo = '1', pricing_state =
-- 'ACTIVE', motif, auteur et source à NULL. Aucun prix n'est touché.
-- À lancer quand le fournisseur reconfirme la dispo (sinon la pièce redevient
-- commandable alors qu'elle est en rupture).
-- L'engine est forward-only : ce fichier se lance à la main. La transaction
-- explicite borne les délais par SET LOCAL et rend retour et constat
-- indivisibles.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DO $unquarantine$
DECLARE
  c_piece  CONSTANT integer := 8415883;
  c_source CONSTANT text := 'backend/supabase/migrations/20261022_pricing_quarantine_rupture_cremaillere_snra_sor1706375.sql';
  v_active bigint;
  v_shown  bigint := 0;
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
  GET DIAGNOSTICS v_active = ROW_COUNT;

  IF v_active = 1 THEN
    UPDATE public.pieces
       SET piece_display = true
     WHERE piece_id = c_piece
       AND piece_display = false;
    GET DIAGNOSTICS v_shown = ROW_COUNT;
  END IF;

  RAISE NOTICE 'rollback retrait SOR1706375 : % ligne tarif remise en vente, % pièce réaffichée%',
    v_active, v_shown,
    CASE WHEN v_active = 0 THEN ' — ligne hors de ce retrait, conservée telle quelle' ELSE '' END;
END
$unquarantine$;

-- Constat : état de la pièce après retour.
SELECT p.piece_id, p.piece_ref, p.piece_display, pp.pri_dispo, pp.pricing_state, pp.pricing_updated_source
  FROM public.pieces p
  JOIN public.pieces_price pp ON pp.pri_piece_id_i = p.piece_id
 WHERE p.piece_id = 8415883;

COMMIT;
