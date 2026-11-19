-- =============================================================================
-- Migration : sortir de la vente toutes les pièces de la marque KLAXCAR
--             (pieces_marque.pm_id 2590), sans rien supprimer
-- Date      : 2026-11-19 (mandat DB, suite du mandat CO #2187)
-- Scope     : public.pieces_price, les 8 487 lignes des pièces KLAXCAR
--             (une ligne par pièce, toutes chez CAL) : pri_dispo,
--             pricing_state, pricing_state_reason, pricing_updated_by,
--             pricing_updated_source. Rien d'autre : ni prix, ni pieces,
--             ni pieces.piece_display, ni pieces_marque, ni relations, ni
--             images, ni commandes. Aucun DELETE.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — décision de Marwane du 19/11/2026 (00:37 et 00:39, heure de
-- Paris) : KLAXCAR n'est plus vendu ; sortie de vente de toutes ses pièces
-- (pages R2, recherche, panier) en les passant « non disponibles ».
-- Décision 118 : vendable = pri_dispo '1', '2' ou '3', ni FROZEN ni masquée.
-- Décision 20 : la base reste le référentiel de compatibilité ; d'où une
-- sortie de vente, pas une suppression.
--
-- MÉCANISME — les deux leviers déjà en vigueur, ensemble :
--   * pri_dispo '0' : retire la pièce de tout lecteur servi qui lit la dispo
--     (grille R2 v3 : prix 0 et « Indisponible » ; recherche ; panier par
--     estVendable ; flux marchand ; fiche pièce ; aperçu de prix gamme).
--   * pricing_state 'FROZEN' : verrou import-safe du plan de quarantaine
--     (audit/unavailable-quarantine-plan.md). Sans lui, un import CAL avec
--     activate (pricing_commit_chunk force pri_dispo '1') ou un lot
--     d'activation (pricing_activate_chunk) remettrait KLAXCAR en vente.
--   C'est l'état des lignes FROZEN depuis 20261116_pricing_frozen_masked_dispo_zero.
--   piece_display n'est PAS touché : la pièce reste en base et sur la grille
--   comme « Indisponible » ; son retrait de la grille serait une autre décision.
--
-- PÉRIMÈTRE (relevé en lecture seule le 2026-11-18 à 23:42 UTC, base unique
-- DEV/PREPROD/PROD) : toutes les lignes pieces_price des pièces
-- pieces.piece_pm_id = 2590, soit 8 487 lignes pour 8 487 pièces :
--   pri_dispo '1' : 8 189 (dont 8 128 vendables, 61 de pièces masquées)
--   pri_dispo '3' :   283 (toutes de pièces masquées)
--   pri_dispo '0' :    15 (déjà hors vente ; passent FROZEN, dispo inchangée)
-- Toutes : pricing_state 'ACTIVE', pri_type '0', pri_frs 'CAL',
-- pri_pm_id '2590', motif / auteur / source NULL. Aucune ligne
-- pieces_price_history. pieces_price ne porte aucun trigger.
-- Lot = 100 % des pièces vendables KLAXCAR et 20,2 % des lignes vendables de
-- CAL (8 128 / 40 176) : au-delà du garde-fou de 5 % de la décision 51,
-- donc appliqué seulement sur le oui de Marwane.
--
-- TRAÇABILITÉ ET RETOUR EXACT : la dispo d'origine est écrite en tête de
-- pricing_state_reason (« SORTIE_VENTE_MARQUE:2590:dispo_origine=<d> | … »).
-- Le .down.sql la relit et remet pri_dispo d'origine, pricing_state 'ACTIVE'
-- et motif / auteur / source à NULL, c'est-à-dire l'état relevé.
-- Le motif non NULL fait aussi ignorer ces lignes par pricing_deactivate_chunk.
--
-- IDEMPOTENT ET REJOUABLE : chaque ligne est acceptée dans son état relevé ou
-- déjà sortie par ce fichier. Tout autre état, ou un décompte différent du
-- relevé, interrompt la migration : il faut alors relever de nouveau.
--
-- EFFET SERVI ATTENDU : 8 128 pièces cessent d'être vendables (grille R2,
-- recherche, panier). Aucune commande KLAXCAR sur les 12 derniers mois.
-- Pages véhicule × gamme qui perdent leur dernière pièce vendable : voir
-- docs/audit/klaxcar-sortie-vente-20261118/.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply Supabase
-- migrations (manual) », dry_run avec only_ids = cet identifiant, puis réel),
-- après fusion sur main, sur le oui de Marwane après lecture du décompte.
-- Zone STOP prix/stock. Le bloc $precheck$ se joue seul en lecture seule avant.
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
    RAISE EXCEPTION 'ABORT: pieces_marque 2590 = « % », KLAXCAR attendu', v_brand;
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
    RAISE EXCEPTION 'ABORT: % ligne(s) pour % pièce(s) KLAXCAR, 8487 / 8487 relevées : relever de nouveau',
      r.total, r.pieces;
  END IF;
  IF r.n_cle <> 0 THEN
    RAISE EXCEPTION 'ABORT: % ligne(s) KLAXCAR hors clé relevée (pri_pm_id 2590, pri_type 0, pri_piece_id = pri_piece_id_i)',
      r.n_cle;
  END IF;
  IF r.n_origine + r.n_sortie <> 8487 THEN
    RAISE EXCEPTION 'ABORT: % ligne(s) ni dans l''état relevé ni sorties par ce fichier : la base a changé',
      8487 - r.n_origine - r.n_sortie;
  END IF;
  IF r.d1 <> 8189 OR r.d3 <> 283 OR r.d0 <> 15 THEN
    RAISE EXCEPTION 'ABORT: dispo d''origine 1/3/0 = %/%/%, 8189/283/15 relevées : relever de nouveau',
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
    RAISE EXCEPTION 'ABORT: % ligne(s) KLAXCAR vendables (état relevé 8128, 0 une fois sorties ; lot mixte refusé) : relever de nouveau',
      v_vend;
  END IF;

  -- Aucune ligne d'une autre marque ne porte la trace de ce fichier.
  IF EXISTS (
    SELECT 1 FROM public.pieces_price pp
      LEFT JOIN public.pieces p ON p.piece_id = pp.pri_piece_id_i
     WHERE pp.pricing_updated_source = c_source
       AND p.piece_pm_id IS DISTINCT FROM 2590) THEN
    RAISE EXCEPTION 'ABORT: une ligne hors KLAXCAR porte la source de ce fichier';
  END IF;

  RAISE NOTICE 'pré-condition sortie de vente KLAXCAR : OK (8487 lignes, % à l''état relevé, % déjà sorties)',
    r.n_origine, r.n_sortie;
END
$precheck$;

-- §1 — ÉCRITURE ET POST-CONDITIONS.
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
    RAISE EXCEPTION 'ABORT: % ligne(s) écrite(s), 8487 (ou 0 au rejeu) attendues', v_set;
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
    RAISE EXCEPTION 'ABORT: post-condition — total %, sorties %, encore disponibles %, origine 1/3/0 = %/%/%',
      r.total, r.sorties, r.encore_vendables, r.d1, r.d3, r.d0;
  END IF;

  RAISE NOTICE 'sortie de vente KLAXCAR : % ligne(s) écrite(s) maintenant (0 = rejeu), 8487/8487 à pri_dispo 0 et FROZEN', v_set;
END
$sortie$;
