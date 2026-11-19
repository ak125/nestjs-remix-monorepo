-- =============================================================================
-- Migration : sortir de la vente toutes les pièces de la marque KLAXCAR
--             (pieces_marque.pm_id 2590) et les retirer des pages, sans rien
--             supprimer
-- Date      : 2026-11-19 (mandat DB, suite du mandat CO #2187 ; complément n° 1)
-- Scope     : public.pieces_price, les 8 487 lignes des pièces KLAXCAR
--             (une ligne par pièce, toutes chez CAL) : pri_dispo,
--             pricing_state, pricing_state_reason, pricing_updated_by,
--             pricing_updated_source.
--             public.pieces.piece_display des 8 128 pièces KLAXCAR affichées
--             (true -> false), journalisé dans public.pieces_display_history
--             (8 128 lignes ajoutées, lot cb9bd8ac-1e4e-4e94-9c6e-a660608795a3).
--             Rien d'autre : ni prix, ni pieces_marque, ni relations, ni
--             images, ni commandes, ni autre marque. Aucun DELETE.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — décisions de Marwane du 19/11/2026 (heure de Paris) : 00:37 et
-- 00:39, KLAXCAR n'est plus vendu, sortie de vente de toutes ses pièces ;
-- 07:27, complément n° 1, « oui » : les pièces KLAXCAR disparaissent des pages
-- R2 au lieu d'y rester « Indisponible ».
-- Décision 118 : vendable = pri_dispo '1', '2' ou '3', ni FROZEN ni masquée.
-- Décision 20 : la base reste le référentiel de compatibilité ; d'où une
-- sortie de vente et un masquage, pas une suppression.
--
-- MÉCANISME — les leviers déjà en vigueur, dans cet ordre :
--   * pri_dispo '0' : retire la pièce de tout lecteur servi qui lit la dispo
--     (recherche ; panier par estVendable ; flux marchand ; aperçu de prix).
--   * pricing_state 'FROZEN' : verrou import-safe du plan de quarantaine
--     (audit/unavailable-quarantine-plan.md). Sans lui, un import CAL avec
--     activate (pricing_commit_chunk force pri_dispo '1') ou un lot
--     d'activation (pricing_activate_chunk) remettrait KLAXCAR en vente.
--     C'est l'état des lignes FROZEN depuis 20261116_pricing_frozen_masked_dispo_zero.
--   * piece_display false par catalog_display_quarantine (20260607, étape 8
--     « R2-bruit » de .claude/knowledge/ops/supplier-brand-price-load-procedure.md) :
--     piece_display = true est le filtre de get_listing_products_extended_filtered
--     (compte et grille de la page R2 servie par rm_get_page_complete_v2),
--     get_pieces_for_type_gamme_v3/v4, get_piece_detail, du flux marchand, de
--     l'aperçu de prix gamme, de la recherche et de l'indexation. La fonction
--     masque les pièces affichées et non vendables de la marque : appelée après
--     le passage à pri_dispo '0', elle retient exactement les 8 128 pièces
--     affichées, et journalise old_display = true par pièce sous le lot fixe.
--     Les 1 482 pièces KLAXCAR déjà masquées (359 avec prix, 1 123 sans) ne
--     sont ni touchées ni journalisées : le retour ne les réaffiche pas.
--
-- PÉRIMÈTRE (relevé en lecture seule, base unique DEV/PREPROD/PROD ; prix le
-- 2026-11-18 à 23:42 UTC, affichage le 2026-11-19 à 06:32 UTC) :
-- toutes les lignes pieces_price des pièces pieces.piece_pm_id = 2590, soit
-- 8 487 lignes pour 8 487 pièces :
--   pri_dispo '1' : 8 189 (dont 8 128 vendables, 61 de pièces masquées)
--   pri_dispo '3' :   283 (toutes de pièces masquées)
--   pri_dispo '0' :    15 (déjà hors vente ; passent FROZEN, dispo inchangée)
-- Toutes : pricing_state 'ACTIVE', pri_type '0', pri_frs 'CAL',
-- pri_pm_id '2590', motif / auteur / source NULL. Aucune ligne
-- pieces_price_history. pieces_price ne porte aucun trigger.
-- pieces : 9 610 pièces KLAXCAR, 8 128 affichées (= les 8 128 vendables),
-- 1 482 masquées. Aucune ligne pieces_display_history pour la marque 2590.
-- pieces porte le trigger pieces_search_vector_update (recalcule
-- search_vector à partir du nom, de la description, de la référence et du
-- libellé, qui ne changent pas). search_vector est NULL sur les 8 128 pièces
-- affichées : le masquage le remplit, le retour le laisse rempli (colonne
-- dérivée ; seules des fonctions plein texte sans appelant applicatif la
-- lisent). catalog_display_quarantine porte statement_timeout à 120 s pour le
-- reste de la transaction.
-- Lot = 100 % des pièces vendables KLAXCAR et 20,2 % des lignes vendables de
-- CAL (8 128 / 40 176) : au-delà du garde-fou de 5 % de la décision 51,
-- donc appliqué seulement sur le oui de Marwane.
--
-- TRAÇABILITÉ ET RETOUR EXACT :
--   * prix : la dispo d'origine est écrite en tête de pricing_state_reason
--     (« SORTIE_VENTE_MARQUE:2590:dispo_origine=<d> | … ») ; le .down.sql la
--     relit et remet pri_dispo d'origine, pricing_state 'ACTIVE' et motif /
--     auteur / source à NULL. Le motif non NULL fait aussi ignorer ces lignes
--     par pricing_deactivate_chunk.
--   * affichage : pieces_display_history, lot cb9bd8ac-1e4e-4e94-9c6e-a660608795a3,
--     operator = owner-decision-2026-11-19-klaxcar ; le .down.sql appelle
--     catalog_display_rollback_batch sur ce lot (8 128 pièces réaffichées).
--
-- IDEMPOTENT ET REJOUABLE : chaque ligne est acceptée dans son état relevé ou
-- déjà traitée par ce fichier ; le second passage écrit 0 ligne. Tout autre
-- état, ou un décompte différent du relevé, interrompt la migration (codes
-- P1-P10 avant écriture, Q1-Q6 après) : il faut alors relever de nouveau.
-- Après un retour par le .down.sql, le lot reste au journal : une nouvelle
-- application exige un nouveau relevé et un nouvel identifiant de lot (P9).
--
-- EFFET SERVI ATTENDU : 8 128 pièces cessent d'être vendables et disparaissent
-- de la grille R2, de la recherche, de la fiche pièce et du flux marchand.
-- Aucune commande KLAXCAR sur les 12 derniers mois. Pages véhicule × gamme
-- qui n'ont plus aucune pièce affichée (page « alternatives », noindex) :
-- voir docs/audit/klaxcar-sortie-vente-20261118/.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply Supabase
-- migrations (manual) », dry_run avec only_ids = cet identifiant, puis réel),
-- après fusion sur main, sur le oui de Marwane après lecture du décompte.
-- Zones STOP prix/stock et SEO indexé. Les blocs $precheck$ et
-- $precheck_affichage$ se jouent seuls en lecture seule avant.
--
-- ROLLBACK : 20261119_pricing_klaxcar_sortie_vente.down.sql, à la main.
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_temp;

-- §0 — PRÉ-CONDITIONS, en lecture seule.
DO $precheck$
DECLARE
  c_source CONSTANT text := 'backend/supabase/migrations/20261119_pricing_klaxcar_sortie_vente.sql';
  c_by     CONSTANT text := 'owner-decision-2026-11-19-klaxcar';
  c_prefix CONSTANT text := '^SORTIE_VENTE_MARQUE:2590:dispo_origine=([013]) \| ';
  v_brand  text;
  v_vend   bigint;
  v_attendu bigint;
  r        record;
BEGIN
  SELECT pm_name INTO v_brand FROM public.pieces_marque WHERE pm_id = 2590;
  IF v_brand IS DISTINCT FROM 'KLAXCAR' THEN
    RAISE EXCEPTION 'ABORT P1: pieces_marque 2590 = « % », KLAXCAR attendu', v_brand;
  END IF;

  WITH lignes AS (
    SELECT pp.*,
           (pp.pricing_state = 'ACTIVE'
            AND pp.pricing_state_reason IS NULL
            AND pp.pricing_updated_by IS NULL
            AND pp.pricing_updated_source IS NULL) AS a_origine,
           (pp.pricing_state = 'FROZEN'
            AND pp.pri_dispo = '0'
            AND pp.pricing_updated_by = c_by
            AND pp.pricing_updated_source = c_source
            AND pp.pricing_state_reason ~ c_prefix) AS sortie
      FROM public.pieces_price pp
      JOIN public.pieces p ON p.piece_id = pp.pri_piece_id_i
     WHERE p.piece_pm_id = 2590
  ), classees AS (
    SELECT l.*,
           CASE WHEN l.sortie THEN substring(l.pricing_state_reason FROM c_prefix)
                WHEN l.a_origine THEN l.pri_dispo END AS dispo_origine
      FROM lignes l
  )
  SELECT count(*)                                                   AS total,
         count(DISTINCT pri_piece_id_i)                             AS pieces,
         count(*) FILTER (WHERE a_origine)                          AS n_origine,
         count(*) FILTER (WHERE sortie)                             AS n_sortie,
         count(*) FILTER (WHERE pri_pm_id IS DISTINCT FROM '2590'
                             OR pri_type IS DISTINCT FROM '0'
                             OR pri_piece_id IS DISTINCT FROM pri_piece_id_i::text) AS n_cle,
         count(*) FILTER (WHERE dispo_origine = '1')                AS d1,
         count(*) FILTER (WHERE dispo_origine = '3')                AS d3,
         count(*) FILTER (WHERE dispo_origine = '0')                AS d0
    INTO r
    FROM classees;

  IF r.total <> 8487 OR r.pieces <> 8487 THEN
    RAISE EXCEPTION 'ABORT P2: % ligne(s) pour % pièce(s) KLAXCAR, 8487 / 8487 relevées : relever de nouveau',
      r.total, r.pieces;
  END IF;
  IF r.n_cle <> 0 THEN
    RAISE EXCEPTION 'ABORT P3: % ligne(s) KLAXCAR hors clé relevée (pri_pm_id 2590, pri_type 0, pri_piece_id = pri_piece_id_i)',
      r.n_cle;
  END IF;
  IF r.n_origine + r.n_sortie <> 8487 THEN
    RAISE EXCEPTION 'ABORT P4: % ligne(s) ni dans l''état relevé ni sorties par ce fichier : la base a changé',
      8487 - r.n_origine - r.n_sortie;
  END IF;
  IF r.d1 <> 8189 OR r.d3 <> 283 OR r.d0 <> 15 THEN
    RAISE EXCEPTION 'ABORT P5: dispo d''origine 1/3/0 = %/%/%, 8189/283/15 relevées : relever de nouveau',
      r.d1, r.d3, r.d0;
  END IF;

  -- Lignes vendables (décision 118) : 8 128 à l'état relevé, 0 une fois sorties.
  SELECT count(*) INTO v_vend
    FROM public.pieces_price pp
    JOIN public.pieces p ON p.piece_id = pp.pri_piece_id_i
   WHERE p.piece_pm_id = 2590
     AND pp.pri_dispo IN ('1', '2', '3')
     AND pp.pricing_state IS DISTINCT FROM 'FROZEN'
     AND p.piece_display = true
     AND pp.pri_vente_ttc_n > 0;
  v_attendu := CASE WHEN r.n_sortie = 8487 THEN 0
                    WHEN r.n_origine = 8487 THEN 8128
                    ELSE -1 END;                    -- lot mixte : refusé
  IF v_vend <> v_attendu THEN
    RAISE EXCEPTION 'ABORT P6: % ligne(s) KLAXCAR vendables (état relevé 8128, 0 une fois sorties ; lot mixte refusé) : relever de nouveau',
      v_vend;
  END IF;

  -- Aucune ligne d'une autre marque ne porte la trace de ce fichier.
  IF EXISTS (
    SELECT 1 FROM public.pieces_price pp
      LEFT JOIN public.pieces p ON p.piece_id = pp.pri_piece_id_i
     WHERE pp.pricing_updated_source = c_source
       AND p.piece_pm_id IS DISTINCT FROM 2590) THEN
    RAISE EXCEPTION 'ABORT P7: une ligne hors KLAXCAR porte la source de ce fichier';
  END IF;

  RAISE NOTICE 'pré-condition sortie de vente KLAXCAR : OK (8487 lignes, % à l''état relevé, % déjà sorties)',
    r.n_origine, r.n_sortie;
END
$precheck$;

-- §0b — PRÉ-CONDITIONS D'AFFICHAGE, en lecture seule.
-- État relevé (A) : 9 610 pièces KLAXCAR, 8 128 affichées, 1 482 masquées,
-- aucune ligne au journal pour le lot. État déjà traité (B) : 0 affichée,
-- 9 610 masquées, 8 128 lignes au journal pour le lot, toutes conformes.
DO $precheck_affichage$
DECLARE
  c_batch CONSTANT uuid := 'cb9bd8ac-1e4e-4e94-9c6e-a660608795a3';
  c_by    CONSTANT text := 'owner-decision-2026-11-19-klaxcar';
  a record;
  h record;
BEGIN
  SELECT count(*)                                AS total,
         count(*) FILTER (WHERE piece_display)     AS affichees,
         count(*) FILTER (WHERE NOT piece_display) AS masquees
    INTO a
    FROM public.pieces
   WHERE piece_pm_id = 2590;

  IF a.total <> 9610 THEN
    RAISE EXCEPTION 'ABORT P8: % pièce(s) KLAXCAR, 9610 relevées : relever de nouveau', a.total;
  END IF;

  SELECT count(*)                                                    AS n,
         count(DISTINCT h0.piece_id)                                 AS pieces,
         count(*) FILTER (WHERE h0.pm_id = '2590'
                            AND h0.old_display AND NOT h0.new_display
                            AND h0.operator = c_by
                            AND p.piece_pm_id = 2590)                AS conformes,
         count(*) FILTER (WHERE p.piece_display)                     AS reaffichees
    INTO h
    FROM public.pieces_display_history h0
    LEFT JOIN public.pieces p ON p.piece_id = h0.piece_id
   WHERE h0.batch_id = c_batch;

  IF h.n = 0 AND a.affichees = 8128 AND a.masquees = 1482 THEN
    RAISE NOTICE 'pré-condition affichage KLAXCAR : état relevé (8128 affichées, 1482 masquées, lot vide)';
  ELSIF h.n = 8128 AND h.pieces = 8128 AND h.conformes = 8128 AND h.reaffichees = 0
        AND a.affichees = 0 AND a.masquees = 9610 THEN
    RAISE NOTICE 'pré-condition affichage KLAXCAR : déjà masquées par ce fichier (lot de 8128, rejeu)';
  ELSIF h.n > 0 AND h.reaffichees > 0 THEN
    RAISE EXCEPTION 'ABORT P9: lot % déjà au journal (% ligne(s)) avec % pièce(s) réaffichée(s) : retour déjà joué ; nouveau relevé et nouvel identifiant de lot requis',
      c_batch, h.n, h.reaffichees;
  ELSE
    RAISE EXCEPTION 'ABORT P9: affichage KLAXCAR % affichées / % masquées, journal du lot % ligne(s) (% conformes) : ni l''état relevé (8128 / 1482 / 0) ni l''état traité (0 / 9610 / 8128) ; relever de nouveau',
      a.affichees, a.masquees, h.n, h.conformes;
  END IF;

  IF EXISTS (SELECT 1 FROM public.pieces_display_history
              WHERE batch_id = c_batch AND pm_id IS DISTINCT FROM '2590') THEN
    RAISE EXCEPTION 'ABORT P10: le lot % est déjà utilisé pour une autre marque', c_batch;
  END IF;
END
$precheck_affichage$;

-- §1 — PRIX : ÉCRITURE ET POST-CONDITIONS.
DO $sortie$
DECLARE
  c_source CONSTANT text := 'backend/supabase/migrations/20261119_pricing_klaxcar_sortie_vente.sql';
  c_by     CONSTANT text := 'owner-decision-2026-11-19-klaxcar';
  c_prefix CONSTANT text := '^SORTIE_VENTE_MARQUE:2590:dispo_origine=([013]) \| ';
  c_suffix CONSTANT text := ' | 2026-11-19 : marque KLAXCAR (pm_id 2590) sortie de la vente sur décision de Marwane ; '
                         || 'pri_dispo d''origine ci-contre. Réversible par 20261119_pricing_klaxcar_sortie_vente.down.sql.';
  v_set bigint;
  r     record;
BEGIN
  UPDATE public.pieces_price pp
     SET pricing_state_reason   = 'SORTIE_VENTE_MARQUE:2590:dispo_origine=' || pp.pri_dispo || c_suffix,
         pri_dispo              = '0',
         pricing_state          = 'FROZEN',
         pricing_updated_by     = c_by,
         pricing_updated_source = c_source
    FROM public.pieces p
   WHERE p.piece_id = pp.pri_piece_id_i
     AND p.piece_pm_id = 2590
     AND pp.pri_pm_id = '2590'
     AND pp.pri_type = '0'
     AND pp.pri_dispo IN ('0', '1', '3')
     AND pp.pricing_state = 'ACTIVE'
     AND pp.pricing_state_reason IS NULL
     AND pp.pricing_updated_by IS NULL
     AND pp.pricing_updated_source IS NULL;
  GET DIAGNOSTICS v_set = ROW_COUNT;               -- 8487 maintenant, 0 au rejeu

  IF v_set NOT IN (0, 8487) THEN
    RAISE EXCEPTION 'ABORT Q1: % ligne(s) écrite(s), 8487 (ou 0 au rejeu) attendues', v_set;
  END IF;

  SELECT count(*) AS total,
         count(*) FILTER (WHERE pp.pri_dispo = '0'
                            AND pp.pricing_state = 'FROZEN'
                            AND pp.pricing_updated_by = c_by
                            AND pp.pricing_updated_source = c_source
                            AND pp.pricing_state_reason ~ c_prefix
                            AND right(pp.pricing_state_reason, length(c_suffix)) = c_suffix) AS sorties,
         count(*) FILTER (WHERE substring(pp.pricing_state_reason FROM c_prefix) = '1') AS d1,
         count(*) FILTER (WHERE substring(pp.pricing_state_reason FROM c_prefix) = '3') AS d3,
         count(*) FILTER (WHERE substring(pp.pricing_state_reason FROM c_prefix) = '0') AS d0,
         count(*) FILTER (WHERE pp.pri_dispo IN ('1', '2', '3')
                             OR pp.pricing_state IS DISTINCT FROM 'FROZEN') AS encore_vendables
    INTO r
    FROM public.pieces_price pp
    JOIN public.pieces p ON p.piece_id = pp.pri_piece_id_i
   WHERE p.piece_pm_id = 2590;

  IF r.total <> 8487 OR r.sorties <> 8487 OR r.encore_vendables <> 0
     OR r.d1 <> 8189 OR r.d3 <> 283 OR r.d0 <> 15 THEN
    RAISE EXCEPTION 'ABORT Q2: post-condition — total %, sorties %, encore disponibles %, origine 1/3/0 = %/%/%',
      r.total, r.sorties, r.encore_vendables, r.d1, r.d3, r.d0;
  END IF;

  RAISE NOTICE 'sortie de vente KLAXCAR : % ligne(s) écrite(s) maintenant (0 = rejeu), 8487/8487 à pri_dispo 0 et FROZEN', v_set;
END
$sortie$;

-- §2 — AFFICHAGE : MASQUAGE PAR LE LEVIER GOUVERNÉ, JOURNAL ET POST-CONDITIONS.
-- Après §1, les 8 128 pièces affichées n'ont plus de ligne vendable :
-- catalog_display_quarantine les retient toutes et seulement elles.
DO $affichage$
DECLARE
  c_batch  CONSTANT uuid := 'cb9bd8ac-1e4e-4e94-9c6e-a660608795a3';
  c_by     CONSTANT text := 'owner-decision-2026-11-19-klaxcar';
  v_res    jsonb;
  v_hidden bigint;
  v_elig   bigint;
  a        record;
  h        record;
BEGIN
  v_res    := public.catalog_display_quarantine(c_batch, '2590', c_by, false);
  v_hidden := (v_res ->> 'hidden')::bigint;
  v_elig   := (v_res ->> 'eligible')::bigint;   -- 8128 maintenant, 0 au rejeu

  IF v_hidden IS DISTINCT FROM v_elig OR v_hidden NOT IN (0, 8128) THEN
    RAISE EXCEPTION 'ABORT Q3: % pièce(s) masquée(s) pour % éligible(s), 8128 (ou 0 au rejeu) attendues — %',
      v_hidden, v_elig, v_res;
  END IF;

  SELECT count(*)                                AS total,
         count(*) FILTER (WHERE piece_display)     AS affichees,
         count(*) FILTER (WHERE NOT piece_display) AS masquees
    INTO a
    FROM public.pieces
   WHERE piece_pm_id = 2590;

  IF a.total <> 9610 OR a.affichees <> 0 OR a.masquees <> 9610 THEN
    RAISE EXCEPTION 'ABORT Q4: KLAXCAR % pièce(s), % affichée(s), % masquée(s) ; 9610 / 0 / 9610 attendues',
      a.total, a.affichees, a.masquees;
  END IF;

  SELECT count(*)                                                    AS n,
         count(DISTINCT h0.piece_id)                                 AS pieces,
         count(*) FILTER (WHERE h0.pm_id = '2590'
                            AND h0.old_display AND NOT h0.new_display
                            AND h0.operator = c_by
                            AND p.piece_pm_id = 2590)                AS conformes
    INTO h
    FROM public.pieces_display_history h0
    LEFT JOIN public.pieces p ON p.piece_id = h0.piece_id
   WHERE h0.batch_id = c_batch;

  IF h.n <> 8128 OR h.pieces <> 8128 OR h.conformes <> 8128 THEN
    RAISE EXCEPTION 'ABORT Q5: journal du lot % : % ligne(s), % pièce(s), % conforme(s) ; 8128 attendues',
      c_batch, h.n, h.pieces, h.conformes;
  END IF;

  -- Les 1 482 pièces masquées avant ce fichier restent hors du lot : le retour
  -- ne les réaffichera pas.
  IF (SELECT count(*) FROM public.pieces p
       WHERE p.piece_pm_id = 2590
         AND NOT EXISTS (SELECT 1 FROM public.pieces_display_history h1
                          WHERE h1.batch_id = c_batch AND h1.piece_id = p.piece_id)) <> 1482 THEN
    RAISE EXCEPTION 'ABORT Q6: les pièces KLAXCAR hors du lot ne sont pas les 1482 masquées relevées';
  END IF;

  RAISE NOTICE 'affichage KLAXCAR : % pièce(s) masquée(s) maintenant (0 = rejeu), 0 affichée sur 9610, lot % = 8128 lignes',
    v_hidden, c_batch;
END
$affichage$;
