-- Rollback: 20261119_pricing_klaxcar_sortie_vente
-- Remet les lignes pieces_price KLAXCAR (pm_id 2590) dans l'état relevé avant
-- la sortie de vente : pri_dispo d'origine (relu en tête de
-- pricing_state_reason), pricing_state 'ACTIVE', motif / auteur / source NULL.
-- Une ligne n'est touchée que si elle porte encore exactement la sortie de ce
-- fichier (pri_dispo '0', FROZEN, auteur, source et motif de la migration).
-- Une ligne modifiée depuis est conservée et comptée.
-- Remet ensuite piece_display = true sur les 8 128 pièces du lot
-- cb9bd8ac-1e4e-4e94-9c6e-a660608795a3, par le retour gouverné
-- catalog_display_rollback_batch (old_display relu au journal). Les 1 482
-- pièces KLAXCAR masquées avant la migration ne sont pas au lot et restent
-- masquées. Les lignes du journal sont conservées (aucun DELETE).
-- Seule différence avec l'état relevé : search_vector des 8 128 pièces, NULL
-- avant, reste rempli par le trigger pieces_search_vector_update (colonne
-- dérivée, recalculée des mêmes colonnes inchangées).
-- Les prix et pieces_marque n'ont pas été touchés par la migration : rien à
-- restaurer de ce côté.
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

-- Affichage : D1-D4. Retour seulement si les 8 128 pièces du lot sont encore
-- toutes masquées ; déjà toutes réaffichées = rien à faire ; tout autre état
-- interrompt le retour (prix compris) : relever de nouveau.
DO $retour_affichage$
DECLARE
  c_batch CONSTANT uuid := 'cb9bd8ac-1e4e-4e94-9c6e-a660608795a3';
  c_by    CONSTANT text := 'owner-decision-2026-11-19-klaxcar';
  v_res   jsonb;
  v_rest  bigint;
  h       record;
  a       record;
BEGIN
  SELECT count(*)                                                    AS n,
         count(DISTINCT h0.piece_id)                                 AS pieces,
         count(*) FILTER (WHERE h0.pm_id = '2590'
                            AND h0.old_display AND NOT h0.new_display
                            AND h0.operator = c_by
                            AND p.piece_pm_id = 2590)                AS conformes,
         count(*) FILTER (WHERE NOT p.piece_display)                 AS masquees,
         count(*) FILTER (WHERE p.piece_display)                     AS reaffichees
    INTO h
    FROM public.pieces_display_history h0
    LEFT JOIN public.pieces p ON p.piece_id = h0.piece_id
   WHERE h0.batch_id = c_batch;

  IF h.n = 0 THEN
    RAISE NOTICE 'rollback affichage KLAXCAR : lot % absent du journal, migration jamais appliquée : rien à remettre', c_batch;
    RETURN;
  END IF;
  IF h.n <> 8128 OR h.pieces <> 8128 OR h.conformes <> 8128 THEN
    RAISE EXCEPTION 'ABORT D1: journal du lot % : % ligne(s), % pièce(s), % conforme(s) ; 8128 attendues',
      c_batch, h.n, h.pieces, h.conformes;
  END IF;

  IF h.masquees = 8128 THEN
    v_res  := public.catalog_display_rollback_batch(c_batch, '2590');
    v_rest := (v_res ->> 'restored')::bigint;
    IF v_rest IS DISTINCT FROM 8128 THEN
      RAISE EXCEPTION 'ABORT D2: % pièce(s) réaffichée(s), 8128 attendues — %', v_rest, v_res;
    END IF;
  ELSIF h.reaffichees = 8128 THEN
    v_rest := 0;                                     -- rejeu du retour
  ELSE
    RAISE EXCEPTION 'ABORT D3: lot % : % pièce(s) masquée(s), % réaffichée(s) ; état modifié depuis la migration, relever de nouveau',
      c_batch, h.masquees, h.reaffichees;
  END IF;

  SELECT count(*)                                AS total,
         count(*) FILTER (WHERE piece_display)     AS affichees,
         count(*) FILTER (WHERE NOT piece_display) AS masquees
    INTO a
    FROM public.pieces
   WHERE piece_pm_id = 2590;

  IF a.total <> 9610 OR a.affichees <> 8128 OR a.masquees <> 1482 THEN
    RAISE EXCEPTION 'ABORT D4: KLAXCAR % pièce(s), % affichée(s), % masquée(s) ; état relevé 9610 / 8128 / 1482',
      a.total, a.affichees, a.masquees;
  END IF;

  RAISE NOTICE 'rollback affichage KLAXCAR : % pièce(s) réaffichée(s) maintenant (0 = rejeu) ; 8128 affichées, 1482 masquées comme relevé',
    v_rest;
END
$retour_affichage$;

SELECT pp.pri_dispo, pp.pricing_state, count(*) AS lignes,
       count(*) FILTER (WHERE pp.pricing_state_reason IS NULL
                          AND pp.pricing_updated_by IS NULL
                          AND pp.pricing_updated_source IS NULL) AS sans_trace
  FROM public.pieces_price pp
  JOIN public.pieces p ON p.piece_id = pp.pri_piece_id_i
 WHERE p.piece_pm_id = 2590
 GROUP BY 1, 2
 ORDER BY 1, 2;

SELECT p.piece_display, count(*) AS pieces,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.pieces_display_history h
                                       WHERE h.batch_id = 'cb9bd8ac-1e4e-4e94-9c6e-a660608795a3'
                                         AND h.piece_id = p.piece_id)) AS au_lot
  FROM public.pieces p
 WHERE p.piece_pm_id = 2590
 GROUP BY 1
 ORDER BY 1;

COMMIT;
