-- =============================================================================
-- Migration : retirer 2 clés uniques dupliquées (auto_type_motor_code,
--             rm_rebuild_queue) sans déplacer aucun plan
-- Date      : 2026-09-30
-- Détecteur : advisor de performance Supabase `duplicate_index` (lint 0009), le seul
--             détecteur de doublons du projet. Ces 2 groupes étaient hors périmètre de
--             #1619 ; ils sont traités ici, chacun par la méthode qui lui convient.
-- Zone DB destructive (DROP CONSTRAINT) : GO owner nominatif du 2026-09-30
--             (« PK auto_type_motor_code, UNIQUE rm_rebuild_queue »).
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- 1. public.auto_type_motor_code — permuter la clé primaire sur l'index déjà servi
-- --------------------------------------------------------------------------------
-- Deux index UNIQUE de définition identique, (tmc_type_id, tmc_code), btree :
--   auto_type_motor_code_pkey  porte la contrainte PRIMARY KEY  0 parcours
--   auto_type_motor_code_uniq  index unique sans contrainte      64 541 parcours
-- (compteurs au 2026-09-30 21:20Z, depuis le démarrage de l'instance le 2026-09-17).
--
-- Pourquoi pas un simple DROP INDEX de `_uniq` (ce qui justifiait l'exclusion par
-- #1619) : les chemins d'accès par `_uniq`, par la clé primaire et par l'index simple
-- `idx_auto_type_motor_code_tmc_type_id` ont exactement le même coût estimé
-- (0.29..2.51 pour `tmc_type_id = '19050'`). Le planificateur les départage par ordre,
-- et `_uniq` gagne aujourd'hui. Masquage hypopg de `_uniq` seul, dans la session de
-- mesure, avec EXPLAIN sans ANALYZE : les deux requêtes par `tmc_type_id`
-- (build_vehicle_page_payload, PostgREST) passent d'un Index Only Scan à un Index Scan
-- sur `idx_auto_type_motor_code_tmc_type_id`, avec lecture de la table. Plan déplacé.
--
-- La méthode retenue garde l'index physique que le planificateur choisit : on retire
-- l'ANCIENNE clé primaire (et son index, jamais parcouru), puis on promeut `_uniq` en
-- clé primaire par `ADD CONSTRAINT … PRIMARY KEY USING INDEX`. PostgreSQL renomme alors
-- l'index en `auto_type_motor_code_pkey` ; c'est le même objet (même OID, mêmes pages),
-- ce que §4 vérifie. Masquage hypopg de l'ancienne clé seule (2026-09-30 21:20Z, après
-- l'application de #1628) : les 5 formes de requête mesurées gardent le même plan nœud
-- pour nœud. Les 4 formes par `tmc_type_id` texte (SELECT par tmc_type_id, SELECT
-- PostgREST avec LIMIT, clé complète, jointure depuis auto_type avec jsonb_agg) restent
-- en Index Only Scan sur cet index ; la forme `tmc_type_id::integer` reste en Index
-- Scan sur `idx_auto_type_motor_code_tmc_type_id_int_expr` (#1628), non touché ici.
--
-- Répétition sur PostgreSQL 17 local jetable (docker postgres:17-alpine), 2026-09-30 :
-- l'OID de l'index promu est conservé, les colonnes restent NOT NULL (PG 17 ne retire
-- pas attnotnull avec la clé primaire), et le .down.sql restaure bien 2 index uniques.
--
-- Attaches vérifiées (aucune) : pas de clé étrangère vers la table, pas de publication,
-- pas de trigger, identité de réplication par défaut (suit la nouvelle clé), aucune
-- entrée `pg_depend` sur les deux index, aucun `ON CONFLICT` dans les fonctions ni dans
-- le code. `_uniq` n'est pas une contrainte : aucun `ON CONFLICT ON CONSTRAINT` ne
-- pouvait le nommer. Un `ON CONFLICT (tmc_type_id, tmc_code)` resterait inféré par la
-- clé primaire.
--
-- 2. public.rm_rebuild_queue — retirer la contrainte UNIQUE doublant la clé primaire
-- --------------------------------------------------------------------------------
--   rm_rebuild_queue_pkey                                PRIMARY KEY (rmrq_gamme_id, rmrq_vehicle_id)
--   rm_rebuild_queue_rmrq_gamme_id_rmrq_vehicle_id_key   UNIQUE      (rmrq_gamme_id, rmrq_vehicle_id)
-- Table vide (0 ligne, 0 écriture depuis le 2026-09-17), 0 parcours sur les deux index.
-- Aucun fichier du dépôt ne crée la table ni la contrainte. Aucune clé étrangère,
-- aucun INSERT ni `ON CONFLICT` dans les 3 fonctions qui lisent la file
-- (acquire/heartbeat/complete_rebuild_job) ni dans le code. La clé primaire, conservée,
-- garantit la même unicité.
--
-- VERROUS : les deux ALTER TABLE prennent ACCESS EXCLUSIVE sur leur table jusqu'au
-- COMMIT, quelques millisecondes : aucune réécriture ni relecture de table (colonnes
-- déjà NOT NULL, index déjà construit). `auto_type_motor_code` est lue par les pages
-- pièces et véhicule : lock_timeout court, pour qu'une lecture longue fasse échouer la
-- migration en bloc (rien n'est appliqué, il suffit de relancer) au lieu de faire
-- attendre ce trafic.
--
-- NON REJOUABLE, PAR CONSTRUCTION : §0 n'accepte que l'état de départ exact. Un second
-- passage s'arrête sur ABORT sans rien modifier ; le registre infra.schema_migrations
-- garantit déjà l'application unique.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply Supabase
-- migrations (manual) », only_ids = cet identifiant), après fusion sur main.
--
-- ROLLBACK : 20260930_drop_duplicate_unique_keys.down.sql, à lancer à la main (engine
-- forward-only). Il recrée `auto_type_motor_code_uniq` et la contrainte UNIQUE de
-- rm_rebuild_queue, en CONCURRENTLY.
--
-- Effet de bord attendu : rechargement du cache de schéma PostgREST (event triggers),
-- sans changement de l'API exposée : les colonnes de clé primaire sont les mêmes.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une transaction
-- (.squawk.toml `assume_in_transaction = true`).
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- -----------------------------------------------------------------------------
-- §0 — PRÉ-CONDITIONS FAIL-CLOSED (lecture de catalogue uniquement)
-- -----------------------------------------------------------------------------
DO $precheck$
DECLARE
  v_tbl  constant regclass := 'public.auto_type_motor_code'::regclass;
  v_rmq  constant regclass := 'public.rm_rebuild_queue'::regclass;
  v_pk   oid;
  v_uniq oid := to_regclass('public.auto_type_motor_code_uniq');
BEGIN
  -- auto_type_motor_code : état de départ exact.
  IF v_uniq IS NULL THEN
    RAISE EXCEPTION 'ABORT: auto_type_motor_code_uniq absent (déjà appliquée, ou état inattendu)';
  END IF;

  SELECT c.conindid INTO v_pk
    FROM pg_constraint c
   WHERE c.conrelid = v_tbl AND c.contype = 'p' AND c.conname = 'auto_type_motor_code_pkey'
     AND pg_get_constraintdef(c.oid) = 'PRIMARY KEY (tmc_type_id, tmc_code)';
  IF v_pk IS NULL OR v_pk = v_uniq THEN
    RAISE EXCEPTION 'ABORT: clé primaire de auto_type_motor_code absente ou inattendue';
  END IF;

  -- Même définition physique : colonnes, classes d'opérateurs, collations, options,
  -- méthode d'accès ; ni prédicat ni expression ; `_uniq` UNIQUE, valide et prêt.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_index a
      JOIN pg_index b ON b.indexrelid = v_uniq
      JOIN pg_class ca ON ca.oid = a.indexrelid
      JOIN pg_class cb ON cb.oid = b.indexrelid
     WHERE a.indexrelid = v_pk
       AND a.indrelid = v_tbl AND b.indrelid = v_tbl
       AND a.indkey::text = b.indkey::text
       AND a.indclass::text = b.indclass::text
       AND a.indcollation::text = b.indcollation::text
       AND a.indoption::text = b.indoption::text
       AND a.indnullsnotdistinct = b.indnullsnotdistinct
       AND ca.relam = cb.relam
       AND a.indpred IS NULL AND b.indpred IS NULL
       AND a.indexprs IS NULL AND b.indexprs IS NULL
       AND b.indisunique AND NOT b.indisprimary
       AND b.indisvalid AND b.indisready AND b.indislive
  ) THEN
    RAISE EXCEPTION 'ABORT: auto_type_motor_code_uniq ne duplique plus exactement la clé primaire';
  END IF;

  -- Aucune attache.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conindid = v_uniq) THEN
    RAISE EXCEPTION 'ABORT: auto_type_motor_code_uniq porte désormais une contrainte';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE confrelid = v_tbl) THEN
    RAISE EXCEPTION 'ABORT: une clé étrangère référence désormais auto_type_motor_code';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_depend WHERE refclassid = 'pg_class'::regclass
                                       AND refobjid IN (v_pk, v_uniq)) THEN
    RAISE EXCEPTION 'ABORT: un objet dépend désormais d''un des deux index de auto_type_motor_code';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute
              WHERE attrelid = v_tbl AND attname IN ('tmc_type_id', 'tmc_code')
                AND NOT attnotnull) THEN
    RAISE EXCEPTION 'ABORT: une colonne de clé de auto_type_motor_code accepte NULL';
  END IF;

  -- Mémorise l'OID de l'index promu pour §4 (paramètre local à la transaction).
  PERFORM set_config('migration_20260930.uniq_oid', v_uniq::text, true);

  -- rm_rebuild_queue : état de départ exact.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = v_rmq AND contype = 'p' AND conname = 'rm_rebuild_queue_pkey'
                    AND pg_get_constraintdef(oid) = 'PRIMARY KEY (rmrq_gamme_id, rmrq_vehicle_id)') THEN
    RAISE EXCEPTION 'ABORT: clé primaire de rm_rebuild_queue absente ou inattendue';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = v_rmq AND contype = 'u'
                    AND conname = 'rm_rebuild_queue_rmrq_gamme_id_rmrq_vehicle_id_key'
                    AND pg_get_constraintdef(oid) = 'UNIQUE (rmrq_gamme_id, rmrq_vehicle_id)') THEN
    RAISE EXCEPTION 'ABORT: contrainte UNIQUE de rm_rebuild_queue absente (déjà appliquée, ou état inattendu)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE confrelid = v_rmq) THEN
    RAISE EXCEPTION 'ABORT: une clé étrangère référence désormais rm_rebuild_queue';
  END IF;
END
$precheck$;

-- -----------------------------------------------------------------------------
-- §1 — auto_type_motor_code : retirer l'ancienne clé primaire (index jamais parcouru)
-- -----------------------------------------------------------------------------
ALTER TABLE public.auto_type_motor_code
  DROP CONSTRAINT auto_type_motor_code_pkey;

-- -----------------------------------------------------------------------------
-- §2 — auto_type_motor_code : promouvoir l'index servi en clé primaire
-- -----------------------------------------------------------------------------
-- Même transaction, même verrou : aucune session ne voit la table sans clé primaire.
-- PostgreSQL renomme auto_type_motor_code_uniq en auto_type_motor_code_pkey.
ALTER TABLE public.auto_type_motor_code
  ADD CONSTRAINT auto_type_motor_code_pkey PRIMARY KEY USING INDEX auto_type_motor_code_uniq;

-- -----------------------------------------------------------------------------
-- §3 — rm_rebuild_queue : retirer la contrainte UNIQUE doublant la clé primaire
-- -----------------------------------------------------------------------------
ALTER TABLE public.rm_rebuild_queue
  DROP CONSTRAINT rm_rebuild_queue_rmrq_gamme_id_rmrq_vehicle_id_key;

-- -----------------------------------------------------------------------------
-- §4 — POST-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
DO $postcheck$
DECLARE
  v_uniq_oid constant oid := current_setting('migration_20260930.uniq_oid')::oid;
  v_n int;
BEGIN
  -- auto_type_motor_code : la clé primaire est portée par l'index physique qu'utilisait
  -- le planificateur, et il n'existe plus de doublon.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.auto_type_motor_code'::regclass AND contype = 'p'
                    AND conname = 'auto_type_motor_code_pkey' AND conindid = v_uniq_oid
                    AND pg_get_constraintdef(oid) = 'PRIMARY KEY (tmc_type_id, tmc_code)') THEN
    RAISE EXCEPTION 'ABORT: la clé primaire n''est pas portée par l''index promu (OID %)', v_uniq_oid;
  END IF;
  IF to_regclass('public.auto_type_motor_code_uniq') IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: auto_type_motor_code_uniq existe encore';
  END IF;
  SELECT count(*) INTO v_n FROM pg_index
   WHERE indrelid = 'public.auto_type_motor_code'::regclass AND indisunique;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: % index uniques sur auto_type_motor_code (attendu : 1)', v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute
              WHERE attrelid = 'public.auto_type_motor_code'::regclass
                AND attname IN ('tmc_type_id', 'tmc_code') AND NOT attnotnull) THEN
    RAISE EXCEPTION 'ABORT: une colonne de clé de auto_type_motor_code a perdu NOT NULL';
  END IF;

  -- rm_rebuild_queue : seule la clé primaire garantit l'unicité.
  SELECT count(*) INTO v_n FROM pg_index
   WHERE indrelid = 'public.rm_rebuild_queue'::regclass AND indisunique;
  IF v_n <> 1 OR NOT EXISTS (SELECT 1 FROM pg_constraint
                              WHERE conrelid = 'public.rm_rebuild_queue'::regclass
                                AND contype = 'p' AND conname = 'rm_rebuild_queue_pkey') THEN
    RAISE EXCEPTION 'ABORT: rm_rebuild_queue n''a pas exactement 1 index unique (la clé primaire)';
  END IF;
END
$postcheck$;

-- =============================================================================
-- Vérification post-migration (lecture seule, à jouer après apply)
-- =============================================================================
--   SELECT conrelid::regclass, conname, contype, conindid::regclass
--     FROM pg_constraint
--    WHERE conrelid IN ('public.auto_type_motor_code'::regclass, 'public.rm_rebuild_queue'::regclass)
--      AND contype IN ('p', 'u');
--   -- attendu : 2 lignes, 2 clés primaires, aucune contrainte 'u'
--   EXPLAIN (COSTS OFF) SELECT tmc_code FROM public.auto_type_motor_code WHERE tmc_type_id = '19050';
--   -- attendu : Index Only Scan using auto_type_motor_code_pkey
--   Advisor performance `duplicate_index` : 3 → 1. Le groupe restant, sur
--   pieces_media_img, est en zone interdite : volontairement laissé ouvert.
-- =============================================================================
