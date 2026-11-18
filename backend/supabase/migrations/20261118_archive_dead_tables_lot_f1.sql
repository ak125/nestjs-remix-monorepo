-- =============================================================================
-- Migration : archiver 19 tables mortes (SET SCHEMA _archive) — lot F1
-- Date      : 2026-11-18
-- Mandat    : CF (pilotage, 2026-11-18, sur le « oui » de Marwane de 13:14
--             Paris) ; candidats et preuves : mandat CA,
--             docs/audit/mandat-ca-20261118/candidats-archivage.md
-- Scope     : 19 tables DÉPLACÉES de public vers _archive, aucune ligne
--             supprimée. Lignes exactes comptées le 2026-11-18 13:10 UTC,
--             identiques au relevé CA de 10:12 UTC :
--               * public.__agent_runs                              7 lignes
--               * public.__catalog_import_history                  3 lignes
--               * public.__marketing_analytics_digests             0 ligne
--               * public.__marketing_content_library               0 ligne
--               * public.__marketing_guest_posts                   0 ligne
--               * public.__qa_protected_meta_hash                140 lignes
--               * public.__rag_check_history                       3 lignes
--               * public.__rag_pipeline_incidents                 30 lignes
--               * public.__rag_readiness                        1219 lignes
--               * public.__v_level_computed                       16 lignes
--               * public.__v_level_raw                            16 lignes
--               * public.audit_vlevel_pg424_snapshot_20260608   1616 lignes
--               * public.error_statistics                          0 ligne
--               * public.gamme_filter_criteria                   320 lignes
--               * public.norm_vehicle                              0 ligne
--               * public.rm_data_version                          24 lignes
--               * public.rm_listing_content                        0 ligne
--               * public.rm_oem_top                                0 ligne
--               * public.stg_compatibility                         0 ligne
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — lot F1 de l'hygiène de la base (mandat CA), re-mesuré le
-- 2026-11-18 pour le mandat CF :
--   * aucune écriture depuis la remise à zéro des statistiques de l'instance
--     (2026-09-17) : n_tup_ins = n_tup_upd = n_tup_del = 0 sur les 19 tables ;
--   * aucun lecteur applicatif : pg_stat_statements (depuis le 2026-09-17) ne
--     montre que l'ANALYZE de supabase_admin et des requêtes de diagnostic du
--     rôle postgres, aucun appel d'anon, authenticated, service_role ni
--     authenticator ; dernier parcours séquentiel = le comptage CA du
--     2026-11-18, sauf __qa_protected_meta_hash et __rag_readiness (un même
--     parcours le 2026-10-10 16:30:08 UTC, non attribué, aucune écriture) ;
--   * aucune fonction (pg_proc.prosrc), vue, règle, job pg_cron, publication,
--     extension ni clé étrangère entrante ne les cite ;
--   * aucun code ne les lit ni ne les écrit : git grep du monorepo hors
--     migrations, documentation et types générés, et des dépôts
--     automecanik-raw, automecanik-wiki et automecanik-rag : 0 fichier ;
--     crontab, /etc/cron*, systemd, workflows GitHub : 0 ; aucune edge function
--     déployée ; journaux PostgREST et edge (24 h) : 0 requête ;
--   * audit_vlevel_pg424_snapshot_20260608 : copie datée de plus de 90 jours ;
--     la règle `copie_ponctuelle` (décision 84 précisée le 2026-11-18) dit
--     « archiver dans _archive ».
--
-- POURQUOI SET SCHEMA _archive ET PAS DROP (comme le lot D) :
--   * aucune donnée perdue ; retour exact par le .down (SET SCHEMA inverse) ;
--   * index, contraintes, clés étrangères sortantes, séquences possédées,
--     triggers, politiques RLS, droits et commentaires suivent la table ;
--   * ni anon, ni authenticated, ni service_role n'ont USAGE sur _archive
--     (vérifié ci-dessous) : un lecteur oublié échoue visiblement, il ne lit pas
--     une table figée en silence. Comme le lot D, la migration ne retire aucun
--     droit de table : c'est l'absence de USAGE qui coupe l'accès ;
--   * une suppression physique depuis _archive reste une décision séparée.
--
-- HORS LOT, VOLONTAIREMENT :
--   * lot F2 (20 tables __seo_*, __diag_*, kg_*) : delete-policy ADR_REQUIRED,
--     décision écrite de Marwane d'abord ;
--   * tables partitionnées, ancien site, pieces_media_img* (zone interdite) ;
--   * toute table « à trancher » de l'inventaire CA.
--
-- EFFETS CONNUS :
--   * dev_readonly perd la lecture de ces 19 tables (pas de USAGE sur _archive) ;
--   * clés étrangères sortantes conservées, cibles restées dans public :
--     stg_compatibility → import_batch ; norm_vehicle → import_batch,
--     stg_vehicle ; rm_listing_content → rm_listing ; __marketing_guest_posts →
--     __marketing_campaigns, __marketing_outreach. Les quatre tables
--     archivées sont vides ; les contrôles d'intégrité s'exécutent sous le
--     propriétaire postgres, que l'absence de USAGE ne bloque pas ;
--   * triggers déplacés avec leur table, fonctions restées dans public :
--     trg_write_scope___qa_protected_meta_hash (enforce_agent_write_scope) et
--     trg_mcl_updated_at (__marketing_set_updated_at) ;
--   * 14 séquences possédées passent dans _archive avec leur table ; aucune
--     autre table ni fonction ne s'en sert (mesuré) ;
--   * les types générés (backend/src/database/types/, packages/database-types/)
--     projettent la base vivante : ils se régénèrent APRÈS l'application ; l'alias
--     QaProtectedMetaHash de packages/database-types/src/types.ts (sans
--     utilisateur) devra alors disparaître ;
--   * .spec/tests/qa-seo-protected-fields-runbook.md (procédure manuelle, S1 et
--     S6) écrit et lit __qa_protected_meta_hash : après archivage, elle échoue
--     visiblement ; aucune exécution observée depuis le 2026-09-17 ;
--   * le skill déprécié workspaces/seo-batch/.claude/skills/rag-check (étape 10)
--     contient CREATE TABLE IF NOT EXISTS __rag_check_history : lancé après
--     archivage par un rôle qui écrit en base, il recréerait une table vide dans
--     public.
--
-- IDEMPOTENT ET REJOUABLE : chaque table est acceptée soit dans public (état
-- mesuré), soit déjà dans _archive (rejeu) ; ALTER TABLE IF EXISTS ne fait rien
-- au second passage.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », only_ids = cet identifiant), essai à blanc
-- d'abord, après fusion sur main — jamais par un canal qui contourne
-- infra.schema_migrations.
--
-- ROLLBACK : 20261118_archive_dead_tables_lot_f1.down.sql (SET SCHEMA inverse),
-- à lancer à la main : le moteur est forward-only.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`). SET SCHEMA prend un
-- verrou ACCESS EXCLUSIVE bref (catalogue seul, aucune réécriture de données).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Tous les objets de ce fichier sont qualifiés par leur schéma.
SET LOCAL search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- §0 — PRÉ-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
DO $precheck$
DECLARE
  r      record;
  v_src  regclass;
  v_dst  regclass;
  v_n    bigint;
  v_set  oid[] := '{}';
  v_hits text;
  c_names CONSTANT text :=
    '(__agent_runs|__catalog_import_history|__marketing_(analytics_digests|content_library|guest_posts)|__qa_protected_meta_hash|__rag_(check_history|pipeline_incidents|readiness)|__v_level_(computed|raw)|audit_vlevel_pg424_snapshot_20260608|error_statistics|gamme_filter_criteria|norm_vehicle|rm_data_version|rm_listing_content|rm_oem_top|stg_compatibility)';
BEGIN
  -- _archive existe, appartient à postgres, et reste fermé aux rôles de l'API :
  -- c'est ce qui rend un lecteur oublié visible.
  IF NOT EXISTS (SELECT 1 FROM pg_namespace
                  WHERE nspname = '_archive' AND pg_get_userbyid(nspowner) = 'postgres') THEN
    RAISE EXCEPTION 'ABORT: schéma _archive absent ou propriétaire inattendu';
  END IF;
  IF has_schema_privilege('anon', '_archive', 'USAGE')
     OR has_schema_privilege('authenticated', '_archive', 'USAGE')
     OR has_schema_privilege('service_role', '_archive', 'USAGE') THEN
    RAISE EXCEPTION 'ABORT: un rôle de l''API a USAGE sur _archive — l''archivage ne couperait pas l''accès';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('__agent_runs',                             7::bigint),
      ('__catalog_import_history',                 3),
      ('__marketing_analytics_digests',            0),
      ('__marketing_content_library',              0),
      ('__marketing_guest_posts',                  0),
      ('__qa_protected_meta_hash',               140),
      ('__rag_check_history',                      3),
      ('__rag_pipeline_incidents',                30),
      ('__rag_readiness',                       1219),
      ('__v_level_computed',                      16),
      ('__v_level_raw',                           16),
      ('audit_vlevel_pg424_snapshot_20260608',  1616),
      ('error_statistics',                         0),
      ('gamme_filter_criteria',                  320),
      ('norm_vehicle',                             0),
      ('rm_data_version',                         24),
      ('rm_listing_content',                       0),
      ('rm_oem_top',                               0),
      ('stg_compatibility',                        0)
    ) AS t(tbl, nrows)
  LOOP
    v_src := to_regclass(format('public.%I', r.tbl));
    v_dst := to_regclass(format('_archive.%I', r.tbl));

    IF v_src IS NULL AND v_dst IS NOT NULL THEN
      CONTINUE;  -- déjà archivée : rejeu
    END IF;
    IF v_src IS NULL THEN
      RAISE EXCEPTION 'ABORT: public.% introuvable, et absente de _archive', r.tbl;
    END IF;
    IF v_dst IS NOT NULL THEN
      RAISE EXCEPTION 'ABORT: _archive.% existe déjà — collision de nom', r.tbl;
    END IF;
    v_set := v_set || v_src::oid;

    IF NOT EXISTS (SELECT 1 FROM pg_class c
                    WHERE c.oid = v_src AND c.relkind = 'r'
                      AND NOT c.relispartition AND NOT c.relhassubclass
                      AND pg_get_userbyid(c.relowner) = 'postgres') THEN
      RAISE EXCEPTION 'ABORT: % n''est pas une table simple appartenant à postgres', v_src;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_depend
                WHERE classid = 'pg_class'::regclass AND objid = v_src AND deptype = 'e')
       OR EXISTS (SELECT 1 FROM pg_publication_rel WHERE prrelid = v_src) THEN
      RAISE EXCEPTION 'ABORT: % appartient à une extension ou à une publication', v_src;
    END IF;

    -- Même nombre de lignes qu'à la mesure : un écart prouve un écrivain vivant.
    EXECUTE format('SELECT count(*) FROM %s', v_src) INTO v_n;
    IF v_n <> r.nrows THEN
      RAISE EXCEPTION 'ABORT: % compte % lignes, % mesurées le 2026-11-18 — un écrivain existe',
        v_src, v_n, r.nrows;
    END IF;

    -- Les index, les séquences possédées et le type de ligne changent de schéma
    -- avec la table.
    IF EXISTS (SELECT 1 FROM pg_index i JOIN pg_class ci ON ci.oid = i.indexrelid
                WHERE i.indrelid = v_src
                  AND to_regclass(format('_archive.%I', ci.relname)) IS NOT NULL)
       OR EXISTS (SELECT 1 FROM pg_depend d JOIN pg_class s ON s.oid = d.objid
                   WHERE d.classid = 'pg_class'::regclass AND d.refobjid = v_src
                     AND d.deptype IN ('a', 'i') AND s.relkind = 'S'
                     AND to_regclass(format('_archive.%I', s.relname)) IS NOT NULL)
       OR EXISTS (SELECT 1 FROM pg_type ty
                   WHERE ty.typnamespace = '_archive'::regnamespace
                     AND ty.typname IN (r.tbl, '_' || r.tbl)) THEN
      RAISE EXCEPTION 'ABORT: collision d''index, de séquence ou de type dans _archive pour %', v_src;
    END IF;
  END LOOP;

  -- Aucune vue ni règle sur ces tables ; aucune clé étrangère venue d'ailleurs.
  IF EXISTS (SELECT 1 FROM pg_depend d
              WHERE d.refclassid = 'pg_class'::regclass AND d.refobjid = ANY (v_set)
                AND d.classid = 'pg_rewrite'::regclass) THEN
    RAISE EXCEPTION 'ABORT: une vue ou une règle dépend d''une table du lot';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint co
              WHERE co.contype = 'f' AND co.confrelid = ANY (v_set)
                AND NOT (co.conrelid = ANY (v_set))) THEN
    RAISE EXCEPTION 'ABORT: une clé étrangère extérieure au lot référence une de ses tables';
  END IF;

  -- Aucune fonction ni aucun job pg_cron ne cite un objet du lot.
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_hits
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
     AND p.prosrc ~* c_names;
  IF v_hits IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: fonction(s) citant un objet du lot : %', v_hits;
  END IF;
  SELECT string_agg(format('%s (jobid %s)', jobname, jobid), ', ') INTO v_hits
    FROM cron.job WHERE command ~* c_names;
  IF v_hits IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: job(s) pg_cron citant un objet du lot : %', v_hits;
  END IF;
END
$precheck$;

-- -----------------------------------------------------------------------------
-- §1 — ARCHIVAGE
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.__agent_runs SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__catalog_import_history SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__marketing_analytics_digests SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__marketing_content_library SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__marketing_guest_posts SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__qa_protected_meta_hash SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__rag_check_history SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__rag_pipeline_incidents SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__rag_readiness SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__v_level_computed SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__v_level_raw SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.audit_vlevel_pg424_snapshot_20260608 SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.error_statistics SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.gamme_filter_criteria SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.norm_vehicle SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.rm_data_version SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.rm_listing_content SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.rm_oem_top SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.stg_compatibility SET SCHEMA _archive;

-- -----------------------------------------------------------------------------
-- §2 — POST-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
-- Chaque table est dans _archive, avec ses lignes, sa RLS, ses politiques, ses
-- index, ses séquences, ses triggers, ses clés étrangères sortantes et ses
-- droits d'avant ; _archive reste fermé à l'API.
-- Droits mesurés le 2026-11-18 : groupe A = postgres, service_role et
-- dev_readonly (lecture) ; groupe B = A plus anon et authenticated.
DO $postcheck$
DECLARE
  r       record;
  v       regclass;
  v_n     bigint;
  v_acl   text[];
  c_acl_a CONSTANT text[] := ARRAY['dev_readonly=r/postgres',
                                   'postgres=arwdDxtm/postgres',
                                   'service_role=arwdDxtm/postgres'];
  c_acl_b CONSTANT text[] := ARRAY['anon=arwdDxtm/postgres',
                                   'authenticated=arwdDxtm/postgres',
                                   'dev_readonly=r/postgres',
                                   'postgres=arwdDxtm/postgres',
                                   'service_role=arwdDxtm/postgres'];
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('__agent_runs',                             7::bigint, true, 1, 3, 0, 1, 0, 'A'),
      ('__catalog_import_history',                 3,         true, 1, 3, 0, 1, 0, 'B'),
      ('__marketing_analytics_digests',            0,         true, 1, 2, 0, 1, 0, 'B'),
      ('__marketing_content_library',              0,         true, 1, 2, 1, 1, 0, 'B'),
      ('__marketing_guest_posts',                  0,         true, 1, 3, 0, 1, 2, 'B'),
      ('__qa_protected_meta_hash',               140,         true, 1, 2, 1, 0, 0, 'B'),
      ('__rag_check_history',                      3,         true, 1, 1, 0, 1, 0, 'A'),
      ('__rag_pipeline_incidents',                30,         true, 1, 1, 0, 1, 0, 'A'),
      ('__rag_readiness',                       1219,         true, 1, 5, 0, 1, 0, 'A'),
      ('__v_level_computed',                      16,         true, 1, 5, 0, 1, 0, 'B'),
      ('__v_level_raw',                           16,         true, 1, 2, 0, 1, 0, 'B'),
      ('audit_vlevel_pg424_snapshot_20260608',  1616,         true, 1, 0, 0, 0, 0, 'A'),
      ('error_statistics',                         0,         true, 1, 4, 0, 1, 0, 'B'),
      ('gamme_filter_criteria',                  320,         true, 1, 3, 0, 1, 0, 'A'),
      ('norm_vehicle',                             0,         true, 1, 4, 0, 1, 2, 'B'),
      ('rm_data_version',                         24,         true, 1, 3, 0, 0, 0, 'B'),
      ('rm_listing_content',                       0,         true, 1, 1, 0, 0, 1, 'B'),
      ('rm_oem_top',                               0,         true, 1, 1, 0, 0, 0, 'B'),
      ('stg_compatibility',                        0,         true, 1, 2, 0, 1, 1, 'B')
    ) AS t(tbl, nrows, rls, npol, nidx, ntrg, nseq, nfk, acl)
  LOOP
    IF to_regclass(format('public.%I', r.tbl)) IS NOT NULL THEN
      RAISE EXCEPTION 'ABORT: public.% existe encore', r.tbl;
    END IF;
    v := to_regclass(format('_archive.%I', r.tbl));
    IF v IS NULL THEN
      RAISE EXCEPTION 'ABORT: _archive.% absente après SET SCHEMA', r.tbl;
    END IF;

    EXECUTE format('SELECT count(*) FROM %s', v) INTO v_n;
    IF v_n <> r.nrows THEN
      RAISE EXCEPTION 'ABORT: % compte % lignes, % attendues', v, v_n, r.nrows;
    END IF;
    IF (SELECT relrowsecurity FROM pg_class WHERE oid = v) IS DISTINCT FROM r.rls
       OR (SELECT count(*) FROM pg_policy WHERE polrelid = v) <> r.npol THEN
      RAISE EXCEPTION 'ABORT: RLS ou politiques de % modifiées', v;
    END IF;
    IF (SELECT count(*) FROM pg_index i JOIN pg_class ci ON ci.oid = i.indexrelid
         WHERE i.indrelid = v AND ci.relnamespace = '_archive'::regnamespace) <> r.nidx THEN
      RAISE EXCEPTION 'ABORT: index de % absents de _archive', v;
    END IF;
    IF (SELECT count(*) FROM pg_depend d JOIN pg_class s ON s.oid = d.objid
         WHERE d.classid = 'pg_class'::regclass AND d.refobjid = v
           AND d.deptype IN ('a', 'i') AND s.relkind = 'S'
           AND s.relnamespace = '_archive'::regnamespace) <> r.nseq THEN
      RAISE EXCEPTION 'ABORT: séquence(s) de % absente(s) de _archive', v;
    END IF;
    IF (SELECT count(*) FROM pg_trigger
         WHERE tgrelid = v AND NOT tgisinternal AND tgenabled = 'O') <> r.ntrg THEN
      RAISE EXCEPTION 'ABORT: triggers de % modifiés', v;
    END IF;
    IF (SELECT count(*) FROM pg_constraint
         WHERE conrelid = v AND contype = 'f' AND convalidated) <> r.nfk THEN
      RAISE EXCEPTION 'ABORT: clés étrangères sortantes de % modifiées', v;
    END IF;

    SELECT array_agg(a ORDER BY a) INTO v_acl
      FROM pg_class c, unnest(c.relacl::text[]) AS a WHERE c.oid = v;
    IF v_acl IS DISTINCT FROM CASE r.acl WHEN 'A' THEN c_acl_a ELSE c_acl_b END THEN
      RAISE EXCEPTION 'ABORT: droits de % modifiés : %', v, v_acl;
    END IF;
  END LOOP;

  IF has_schema_privilege('anon', '_archive', 'USAGE')
     OR has_schema_privilege('authenticated', '_archive', 'USAGE')
     OR has_schema_privilege('service_role', '_archive', 'USAGE') THEN
    RAISE EXCEPTION 'ABORT: un rôle de l''API a USAGE sur _archive';
  END IF;
END
$postcheck$;

-- =============================================================================
