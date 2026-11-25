-- =============================================================================
-- Migration : RETOUR — remettre type_name et type_name_meta relevés (mandat EH)
-- Date      : 2026-11-20 (mandat EH, « 07 Pages et SEO »)
-- Scope     : public.auto_type.type_name de 5 types (et type_name_meta quand
--             il est faux aussi), rien d'autre. Ni type_name_url, ni type_alias,
--             ni URL, ni modèle, ni marque. Aucun DELETE, aucun DDL.
-- Généré par docs/audit/mandat-eh-sources-noms-motorisation-20261120/12-generer-migration-origine.py
-- depuis decisions.tsv (migration = « origine ») : ne pas éditer à la main, régénérer.
-- =============================================================================
--
-- POURQUOI : pour ces 5 types, le nom d'origine (TecDoc ou base ancienne)
-- nomme une autre motorisation que celle décrite par le code moteur, la
-- puissance, la cylindrée et les années du type. Valeur juste et URL des
-- sources par ligne : verdicts-sources.tsv et la PR du mandat EH.
-- type_name alimente le H1 des pages R8 (build_vehicle_page_payload) et, en
-- repli du nom d'affichage, le titre des pages R2 et R8.
--
-- APPLICATION : acte réservé à Marwane, après validation de la liste. Retirer
-- d'abord du bloc VALUES (ici ET dans le .down.sql) toute ligne non validée.
-- À appliquer APRÈS 20261120_auto_type_name_meta_corrections_mandat_ee.sql
-- (ordre alphabétique du runner) ; les deux listes sont disjointes.
--
-- GARDE : chaque type doit exister et porter exactement le couple
-- (type_name, type_name_meta) relevé le 2026-11-20, ou déjà le couple corrigé
-- (rejeu). Toute autre valeur lève une exception avant toute écriture : rien
-- n'est écrit.
-- REJOUABLE : au second passage, 0 ligne écrite, 0 page invalidée.
-- URL : aucune. Les URL des types lisent type_alias, renseigné pour ces 5
-- types et jamais réécrit ici ; le repli sur type_name
-- (packages/seo-url-contract/src/url-rules.ts:40-49) ne s'applique à aucun.
-- RÉIMPORT : scripts/tecdoc-pipeline/create-vehicles-p4a.py n'insère que des
-- types absents (ON CONFLICT (type_id) DO NOTHING) et n'écrase donc pas
-- cette correction.
-- CACHE : __vehicle_page_cache n'a de déclencheur que sur type_display ; les
-- pages R8 des types modifiés sont invalidées et reconstruites par la
-- fonction canonique mark_stale_with_followup_rebuild (INC-2026-007). Le cache
-- Redis applicatif (TTL 1 h, vehicle-rpc.service.ts) expire de lui-même.
-- SENS : ce fichier est le retour ; il remet les valeurs relevées le 2026-11-20.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

DO $mandat_eh$
DECLARE
  v_ecarts   text;
  v_a_ecrire integer[];
  v_ecrits   integer;
  v_marques  integer;
BEGIN
  CREATE TEMP TABLE mandat_eh_corrections (
    type_id       integer PRIMARY KEY,
    nom_releve    text NOT NULL,
    meta_releve   text NOT NULL,
    nom_cible     text NOT NULL,
    meta_cible    text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO mandat_eh_corrections (type_id, nom_releve, meta_releve, nom_cible, meta_cible) VALUES
    (33063, '350 BlueTEC 4-Matic', '350 BlueTEC 4Matic', '320 CDI 4-Matic', '320 CDI 350 BlueTEC 4Matic'),  -- MERCEDES | CLASSE GL (X164) | nom d'origine faux aussi
    (33593, '2.2 D Multijet', '2.2 D Multijet', '2.0 D Multijet', '2.0 JTD'),  -- LANCIA | PHEDRA | nom d'origine faux aussi
    (60342, '2.0 TFSI', '2.0 TFSI', '2.0 45 TFSI', '2.0 TFSI'),  -- AUDI | A3 III Sportback | nom d'origine faux (nom d'affichage juste)
    (66951, '1.0 EcoBoost', '1.0 EcoBoost', '1.0 Titanium Plus EcoBoost', '1.0 Econetic'),  -- FORD | FIESTA VI Berline | nom d'origine faux aussi
    (73442, '220 D', '220 d', '200 D', '220 d')  -- MERCEDES | CLASSE C Coupé (C205) | nom d'origine faux (nom d'affichage juste)
    ;

  -- Garde : existence et couple exact (relevé ou cible), sinon exception et rien d'écrit.
  SELECT string_agg(format('%s : %L / %L', c.type_id,
                           coalesce(t.type_name, CASE WHEN t.type_id IS NULL THEN '<type absent>' ELSE '<NULL>' END),
                           coalesce(t.type_name_meta, '<NULL>')),
                    ' ; ' ORDER BY c.type_id)
    INTO v_ecarts
    FROM mandat_eh_corrections c
    LEFT JOIN public.auto_type t ON t.type_id = c.type_id::text
   WHERE t.type_id IS NULL
      OR t.type_name IS NULL
      OR t.type_name_meta IS NULL
      OR NOT ((t.type_name = c.nom_releve AND t.type_name_meta = c.meta_releve)
           OR (t.type_name = c.nom_cible  AND t.type_name_meta = c.meta_cible));
  IF v_ecarts IS NOT NULL THEN
    RAISE EXCEPTION 'mandat EH : valeur actuelle différente de la valeur relevée, rien n''est écrit. %', v_ecarts;
  END IF;

  SELECT array_agg(c.type_id ORDER BY c.type_id)
    INTO v_a_ecrire
    FROM mandat_eh_corrections c
    JOIN public.auto_type t ON t.type_id = c.type_id::text
   WHERE t.type_name = c.nom_releve
     AND t.type_name_meta = c.meta_releve;

  IF v_a_ecrire IS NULL THEN
    RAISE NOTICE 'mandat EH : déjà appliqué, 0 ligne écrite';
    RETURN;
  END IF;

  UPDATE public.auto_type t
     SET type_name = c.nom_cible,
         type_name_meta = c.meta_cible
    FROM mandat_eh_corrections c
   WHERE t.type_id = c.type_id::text
     AND t.type_name = c.nom_releve
     AND t.type_name_meta = c.meta_releve;
  GET DIAGNOSTICS v_ecrits = ROW_COUNT;
  IF v_ecrits <> cardinality(v_a_ecrire) THEN
    RAISE EXCEPTION 'mandat EH : % lignes écrites pour % attendues', v_ecrits, cardinality(v_a_ecrire);
  END IF;

  v_marques := public.mark_stale_with_followup_rebuild(v_a_ecrire, 'retour du mandat EH 2026-11-20 : type_name et type_name_meta d''origine remis', true);
  RAISE NOTICE 'mandat EH : % types corrigés, % pages R8 invalidées et reconstruites', v_ecrits, v_marques;
END
$mandat_eh$;

-- Contrôle après application (lecture seule ; attendu : 0 ligne) :
-- docs/audit/mandat-eh-sources-noms-motorisation-20261120/13-controle-apres.sql
