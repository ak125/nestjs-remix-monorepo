-- @non_transactional
--   DROP INDEX CONCURRENTLY est interdit DANS une transaction : le marqueur ci-dessus
--   fait exécuter ce fichier en autocommit par l'engine, une instruction à la fois
--   (gate A5 `--lint-markers`). La première instruction qui lève arrête le fichier et
--   marque la migration `failed` : le bloc de pré-conditions, placé avant tout DROP,
--   est donc réellement bloquant.
--
-- Migration: retirer `idx_seo_event_log_payload_gin` et `idx_seo_event_log_entity_url`
--
-- Deux index secondaires non uniques de `__seo_event_log`, créés par
-- `20260425_seo_event_log.sql` et qu'aucun lecteur ne choisit. Le GIN sur `payload`
-- était prescrit par ADR-025 (§ « Event log unifié ») : ce fichier exécute ADR-105, qui
-- amende ADR-025 sur ce point. L'index `entity_url` n'a jamais figuré dans ADR-025.
-- Aucune ligne ni colonne n'est touchée, seulement deux index.
--
-- NE PAS FUSIONNER AVANT LA FUSION D'ADR-105 AU VAULT, NI AVANT LE 2026-10-17 (instance
-- démarrée le 2026-09-17 01:14Z) : la pré-condition §0.1 interdit l'application tant que
-- les compteurs couvrent moins de 30 jours. Appliquée trop tôt, la migration s'arrête
-- AVANT tout DROP, mais sa ligne `failed` bloque ensuite TOUS les runs de l'engine
-- jusqu'à `--retry` : fusionnée avant cette date, elle serait tentée par le premier
-- apply sans `only_ids`.
--
-- PREUVE — `idx_seo_event_log_payload_gin` (gin (payload), 75 112 448 octets) :
--   1. instance actuelle (PG 17.6, `pg_postmaster_start_time()` 2026-09-17 01:14Z,
--      `stats_reset` nul) : 2 parcours, le dernier le 2026-09-26 12:24:31.768545Z,
--      relevé le 2026-10-03 à 07:45Z. Aucun lecteur du dépôt ne les explique.
--   2. Un GIN `jsonb_ops` ne sert que `@>`, `?`, `?|`, `?&`, `@?` et `@@`. Relevé du
--      2026-10-03 : les 40 fichiers du dépôt qui citent la table (hors tests et
--      migrations) n'en emploient aucun. Leurs lectures passent par `->>`, que ce GIN
--      ne sert pas : `seo-monitoring.controller.ts` (`event_type IN …`),
--      `seo-monitoring-runs.service.ts` (`payload->>source`), `seo-shadow-purge.cron.ts`
--      (`payload->>subtype LIKE …`). Côté `pg_proc.prosrc`, 4 fonctions citent la table.
--      Une seule emploie `@>` : `trg_auto_type_rebuild_cache`, à chaque type rendu
--      affichable, pour l'UPDATE d'auto-résolution et le NOT EXISTS de dédup.
--   3. LE PLANIFICATEUR NE LE CHOISIT PAS pour ces deux requêtes (EXPLAIN sans ANALYZE,
--      2026-10-03 07:42Z, compteurs inchangés avant/après) : les deux passent par
--      `idx_seo_event_log_type_created` (Index Cond `event_type = 'anomaly_detected'`,
--      2 lignes sur 746 814), et le `@>` n'est qu'un filtre sur ces 2 lignes. Le
--      commentaire « COÛT » de `20260924_vehicle_cache_trigger_rebuild_failure_observable.sql`,
--      qui attribue cette requête au GIN, est donc inexact. Il reste en l'état, comme
--      toute migration appliquée ; ce fichier le corrige.
--
-- PREUVE — `idx_seo_event_log_entity_url` (btree (entity_url) WHERE entity_url IS NOT
-- NULL, 67 215 360 octets) :
--   1. instance actuelle : 2 parcours, le dernier le 2026-09-23 15:03:49.477088Z. Aucun
--      lecteur du dépôt ne les explique.
--   2. Aucun code ni aucune fonction ne filtre `__seo_event_log.entity_url` : le seul
--      `.eq('entity_url', …)` du backend (`audit-findings.service.ts`) vise
--      `__seo_audit_findings`. `rpc_seo_alerts_v1`, `detect_cwv_aggregation_coverage_gap`
--      et `detect_cwv_trend_divergence` ne font que projeter ou insérer la colonne.
--      `rpc_seo_alerts_v1` joint ensuite `__seo_gsc_daily.page = entity_url` : c'est
--      `__seo_gsc_daily` qui est cherché, pas cet index.
--   3. Le prédicat partiel ne retire presque rien : 743 228 lignes indexées sur 746 814.
--
-- Chacun est non unique, valide, ne porte aucune contrainte, n'a aucun objet dépendant
-- (`pg_depend`), n'est ni identité de réplication ni CLUSTER (relevé du 2026-10-03).
--
-- GAIN : 135,7 Mo de disque (142 327 808 octets, 247 → 111 Mo d'index sur la table),
-- 6 → 4 index, deux index de moins à maintenir à chaque insertion (58 675 depuis le
-- 2026-09-17, soit ~3 600 par jour, dont le GIN avec sa liste d'attente).
--
-- Un futur lecteur `@>` ou `entity_url` apporte son propre index, ciblé (partiel ou
-- d'expression) et justifié par un plan mesuré (ADR-105).
--
-- Timeouts EXPLICITES à 0 : un GUC omis hérite des 60 s du rôle `postgres` (incident
-- 20260529, PR #1395). DROP INDEX CONCURRENTLY ne relit pas la heap, mais il attend la
-- fin des transactions qui voient la table ; ces attentes comptent contre lock_timeout.
-- Il ne bloque ni les lectures ni les écritures. Le job CI borne le run.
--
-- REJOUABLE : `IF EXISTS` sur chaque DROP. Un DROP CONCURRENTLY interrompu laisse un
-- index INVALIDE, qu'une seconde exécution retire. Les pré-conditions acceptent donc un
-- index déjà absent ; elles ne contrôlent que ceux qui restent.
--
-- Effet de bord attendu : chaque DROP déclenche les event triggers `sql_drop`
-- (`pgrst_drop_watch`, qui recharge le cache de schéma de PostgREST, et
-- `issue_graphql_placeholder`), sans changement de l'API exposée (un index n'y figure
-- pas).
--
-- Retour arrière : `20261003_drop_seo_event_log_unread_indexes.down.sql` recrée les
-- deux index à l'identique (CONCURRENTLY). L'engine est forward-only : ce fichier se
-- lance à la main.
SET lock_timeout = 0;
SET statement_timeout = 0;

-- -----------------------------------------------------------------------------
-- §0 — PRÉ-CONDITIONS FAIL-CLOSED (lecture de catalogue uniquement)
-- -----------------------------------------------------------------------------
-- §0.1 Fenêtre de preuve : les compteurs d'usage doivent couvrir au moins 30 jours.
--   Leur origine est le plus récent de deux instants : le démarrage de l'instance et la
--   dernière remise à zéro des statistiques de la base. Un redémarrage propre conserve
--   les compteurs depuis PG 15 ; le compter quand même comme une origine ne peut que
--   retarder l'application, jamais l'avancer.
-- §0.2 Par index encore présent : définition exacte attendue, sur
--   public.__seo_event_log, non unique, sans contrainte ni objet dépendant, ni identité
--   de réplication ni CLUSTER, et compteur FIGÉ depuis la mesure — `idx_scan` ET
--   `last_idx_scan` identiques aux valeurs relevées. Une seule lecture entre la mesure
--   et l'application = ABORT : l'index a trouvé un lecteur, la preuve est à refaire.
--   Attention : un EXPLAIN, même sans ANALYZE, d'un prédicat d'intervalle sur
--   `entity_url` incrémente `idx_scan` à lui seul. Ne pas sonder cette colonne avant
--   l'APPLY.
DO $precheck$
DECLARE
  v_origin    timestamptz;
  v_name      text;
  v_def       text;
  v_scan      bigint;
  v_last      timestamptz;
  v_exp_scan  bigint;
  v_exp_last  timestamptz;
  v_oid       oid;
BEGIN
  IF to_regclass('public.__seo_event_log') IS NULL THEN
    RAISE EXCEPTION 'ABORT: table public.__seo_event_log introuvable';
  END IF;

  SELECT GREATEST(pg_postmaster_start_time(), COALESCE(d.stats_reset, '-infinity'))
    INTO v_origin
    FROM pg_stat_database d
   WHERE d.datname = current_database();
  IF v_origin IS NULL OR v_origin > now() - interval '30 days' THEN
    RAISE EXCEPTION 'ABORT: les compteurs d''usage ne couvrent que depuis % (30 jours requis, soit jusqu''au %) — ne pas appliquer avant',
      v_origin, v_origin + interval '30 days';
  END IF;

  FOR v_name, v_def, v_exp_scan, v_exp_last IN
    SELECT * FROM (VALUES
      ('idx_seo_event_log_payload_gin',
       'CREATE INDEX idx_seo_event_log_payload_gin ON public.__seo_event_log USING gin (payload)',
       2::bigint, '2026-09-26 12:24:31.768545+00'::timestamptz),
      ('idx_seo_event_log_entity_url',
       'CREATE INDEX idx_seo_event_log_entity_url ON public.__seo_event_log USING btree (entity_url) WHERE (entity_url IS NOT NULL)',
       2::bigint, '2026-09-23 15:03:49.477088+00'::timestamptz)
    ) AS t(name, def, exp_scan, exp_last)
  LOOP
    v_oid := to_regclass('public.' || v_name);
    CONTINUE WHEN v_oid IS NULL;  -- déjà retiré (rejeu après interruption)

    IF NOT EXISTS (
      SELECT 1
        FROM pg_index i
       WHERE i.indexrelid = v_oid
         AND i.indrelid = 'public.__seo_event_log'::regclass
         AND NOT i.indisunique
         AND NOT i.indisprimary
         AND NOT i.indisexclusion
         AND NOT i.indisreplident
         AND NOT i.indisclustered
         AND pg_get_indexdef(i.indexrelid) = v_def
    ) THEN
      RAISE EXCEPTION 'ABORT: public.% ne correspond plus à la définition mesurée (table, unicité, définition, réplication ou CLUSTER)', v_name;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = v_oid) THEN
      RAISE EXCEPTION 'ABORT: public.% porte une contrainte', v_name;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_depend d
       WHERE d.refclassid = 'pg_class'::regclass
         AND d.refobjid = v_oid
    ) THEN
      RAISE EXCEPTION 'ABORT: un objet dépend de public.%', v_name;
    END IF;

    SELECT s.idx_scan, s.last_idx_scan INTO v_scan, v_last
      FROM pg_stat_user_indexes s
     WHERE s.indexrelid = v_oid;
    IF v_scan IS DISTINCT FROM v_exp_scan OR v_last IS DISTINCT FROM v_exp_last THEN
      RAISE EXCEPTION 'ABORT: public.% a été parcouru depuis la mesure (idx_scan %, dernier %, attendu %, %) — preuve à refaire',
        v_name, v_scan, v_last, v_exp_scan, v_exp_last;
    END IF;
  END LOOP;
END
$precheck$;

-- -----------------------------------------------------------------------------
-- §1 — RETRAIT, un DROP par instruction (autocommit)
-- -----------------------------------------------------------------------------
DROP INDEX CONCURRENTLY IF EXISTS public.idx_seo_event_log_payload_gin;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_seo_event_log_entity_url;

-- -----------------------------------------------------------------------------
-- §2 — POST-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
-- Les deux index ont disparu ; ceux qui servent les lectures relevées (dont les deux
-- requêtes de `trg_auto_type_rebuild_cache`, par `idx_seo_event_log_type_created`) et
-- les deux index uniques sont toujours là, valides et prêts.
DO $postcheck$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['idx_seo_event_log_payload_gin', 'idx_seo_event_log_entity_url'] LOOP
    IF to_regclass('public.' || v_name) IS NOT NULL THEN
      RAISE EXCEPTION 'postcheck: public.% toujours présent', v_name;
    END IF;
  END LOOP;

  FOREACH v_name IN ARRAY ARRAY[
    '__seo_event_log_pkey',
    'idx_seo_event_log_type_created',
    'idx_seo_event_log_severity_unresolved',
    'uq_seo_event_log_r2_order_placed_order_id'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_index i
       WHERE i.indexrelid = to_regclass('public.' || v_name)
         AND i.indrelid = 'public.__seo_event_log'::regclass
         AND i.indisvalid
         AND i.indisready
    ) THEN
      RAISE EXCEPTION 'postcheck: index conservé public.% absent ou invalide', v_name;
    END IF;
  END LOOP;
END
$postcheck$;

-- =============================================================================
-- Vérification après application (lecture seule, catalogue uniquement)
-- =============================================================================
--   SELECT count(*) FROM pg_index WHERE indrelid = 'public.__seo_event_log'::regclass;  -- 4
--   SELECT to_regclass('public.idx_seo_event_log_payload_gin'),
--          to_regclass('public.idx_seo_event_log_entity_url');                          -- NULL, NULL
--   SELECT pg_size_pretty(pg_indexes_size('public.__seo_event_log'));                   -- ~111 MB
-- =============================================================================
