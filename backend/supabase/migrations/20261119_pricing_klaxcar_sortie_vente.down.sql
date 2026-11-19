-- Rollback: 20261119_pricing_klaxcar_sortie_vente
-- Remet les lignes pieces_price KLAXCAR (pm_id 2590) dans l'état relevé avant
-- la sortie de vente : pri_dispo d'origine (relu en tête de
-- pricing_state_reason), pricing_state 'ACTIVE', motif / auteur / source NULL.
-- Une ligne n'est touchée que si elle porte encore exactement la sortie de ce
-- fichier (pri_dispo '0', FROZEN, auteur, source et motif de la migration).
-- Une ligne modifiée depuis est conservée et comptée.
-- Les prix, pieces, piece_display et pieces_marque n'ont pas été touchés par
-- la migration : rien à restaurer de ce côté.
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_temp;

DO $retour$
DECLARE
  c_source CONSTANT text := 'backend/supabase/migrations/20261119_pricing_klaxcar_sortie_vente.sql';
  c_by     CONSTANT text := 'owner-decision-2026-11-19-klaxcar';
  c_prefix CONSTANT text := '^SORTIE_VENTE_MARQUE:2590:dispo_origine=([013]) \| ';
  c_suffix CONSTANT text := ' | 2026-11-19 : marque KLAXCAR (pm_id 2590) sortie de la vente sur décision de Marwane ; '
                         || 'pri_dispo d''origine ci-contre. Réversible par 20261119_pricing_klaxcar_sortie_vente.down.sql.';
  v_back   bigint;
  v_reste  bigint;
BEGIN
  UPDATE public.pieces_price pp
     SET pri_dispo              = substring(pp.pricing_state_reason FROM c_prefix),
         pricing_state          = 'ACTIVE',
         pricing_state_reason   = NULL,
         pricing_updated_by     = NULL,
         pricing_updated_source = NULL
   WHERE pp.pri_pm_id = '2590'
     AND pp.pri_dispo = '0'
     AND pp.pricing_state = 'FROZEN'
     AND pp.pricing_updated_by = c_by
     AND pp.pricing_updated_source = c_source
     AND pp.pricing_state_reason ~ c_prefix
     AND pp.pricing_state_reason = 'SORTIE_VENTE_MARQUE:2590:dispo_origine='
                                   || substring(pp.pricing_state_reason FROM c_prefix) || c_suffix;
  GET DIAGNOSTICS v_back = ROW_COUNT;

  SELECT count(*) INTO v_reste
    FROM public.pieces_price
   WHERE pricing_updated_source = c_source;

  RAISE NOTICE 'rollback sortie de vente KLAXCAR : % / 8487 ligne(s) remise(s) à l''état relevé ; % ligne(s) portent encore la source (modifiées depuis, conservées)',
    v_back, v_reste;
END
$retour$;

SELECT pp.pri_dispo, pp.pricing_state, count(*) AS lignes,
       count(*) FILTER (WHERE pp.pricing_state_reason IS NULL
                          AND pp.pricing_updated_by IS NULL
                          AND pp.pricing_updated_source IS NULL) AS sans_trace
  FROM public.pieces_price pp
  JOIN public.pieces p ON p.piece_id = pp.pri_piece_id_i
 WHERE p.piece_pm_id = 2590
 GROUP BY 1, 2
 ORDER BY 1, 2;

COMMIT;
