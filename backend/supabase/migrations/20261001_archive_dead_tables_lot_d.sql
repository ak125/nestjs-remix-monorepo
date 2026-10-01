-- =============================================================================
-- Migration : archiver 7 tables mortes (SET SCHEMA _archive) et retirer une vue
--             sans consommateur
-- Date      : 2026-10-01
-- Scope     : 7 tables DÉPLACÉES, aucune ligne supprimée ; 1 vue supprimée, sa
--             définition exacte est restituée par le .down.
--               * public.cars_engine                    35 661 lignes
--               * public.__qa_audit_runs                   540 lignes
--               * public.__qa_audit_issues              15 064 lignes
--               * public.__qa_audit_alerts                 268 lignes
--               * _filter.signal_s1_volume              13 575 lignes
--               * _filter.signal_s2_cohort2025         119 702 lignes
--               * _filter.signal_s3_orphan_t400         11 929 lignes
--               * public.seo_ab_testing_top_formulas    (vue, rien de stocké)
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — lot D de l'audit d'hygiène de la base (2026-09-15), re-mesuré le
-- 2026-10-01 :
--   * aucune écriture depuis la remise à zéro des statistiques de l'instance
--     (2026-09-17) : n_tup_ins = n_tup_upd = n_tup_del = 0 sur les 7 tables ;
--   * aucun lecteur applicatif : pg_stat_statements (depuis le 2026-09-17) ne
--     montre que l'ANALYZE de supabase_admin et des requêtes de diagnostic du
--     rôle postgres ; aucune fonction (pg_proc.prosrc), vue, règle, job pg_cron
--     ni clé étrangère extérieure au lot ne les cite ;
--   * cars_engine : le code ne la cite qu'en commentaires ;
--   * __qa_audit_* : dernier run le 2026-04-23. Seul écrivain : le reporter
--     Playwright de frontend/tests/qa-audit/, que ni un script npm, ni un
--     workflow, ni une crontab ne lance. La même PR retire ce reporter : sans
--     cela, un lancement manuel verrait chaque écriture échouer, erreur
--     journalisée puis ignorée ;
--   * _filter.signal_s1/s2/s3 : feuilles de calcul dont le résultat est
--     _filter.rtp_pollution_ids (NON touchée) : ses 11 929 lignes sont
--     exactement l'intersection s1 ∩ s2 ∩ s3, avec n_relations (s1) et
--     source_artnr/source_dlnr (s3) recopiés sans écart, marked_at unique
--     2026-04-13 20:24 UTC ;
--   * seo_ab_testing_top_formulas : aucun consommateur dans le code.
--
-- POURQUOI SET SCHEMA _archive ET PAS DROP :
--   * aucune donnée perdue ; retour exact par le .down (SET SCHEMA inverse) ;
--   * index, contraintes, clés étrangères internes (issues et alerts → runs),
--     triggers, politiques RLS, droits et commentaires suivent la table ;
--   * _archive est le schéma qui tient déjà 55 tables retirées. Ni anon, ni
--     authenticated, ni service_role n'y ont USAGE (vérifié ci-dessous) : un
--     lecteur oublié échoue visiblement, il ne lit pas une table figée en
--     silence ;
--   * une suppression physique depuis _archive reste une décision séparée.
-- La vue est supprimée plutôt que déplacée : elle ne stocke rien.
--
-- HORS LOT, VOLONTAIREMENT :
--   * __sitemap_motorisation : encore interrogée depuis le 2026-09-17 ;
--   * __seo_keyword_type_mapping : delete-policy `__seo_*` = ADR_REQUIRED ;
--   * partitions cf_rum vides : décision owner (activer le collecteur ou sortir
--     cf_rum de maintain_snapshot_partitions) ;
--   * les autres vues seo_ab_testing_* et _filter.rtp_pollution_ids (lue).
--
-- EFFETS CONNUS :
--   * dev_readonly perd la lecture de ces 7 tables (pas de USAGE sur _archive) ;
--   * les types générés (backend/src/database/types/, packages/database-types/)
--     projettent la base vivante : ils se régénèrent APRÈS l'application.
--
-- IDEMPOTENT ET REJOUABLE : chaque table est acceptée soit dans son schéma
-- d'origine (état mesuré), soit déjà dans _archive (rejeu) ; ALTER TABLE IF
-- EXISTS et DROP VIEW IF EXISTS ne font rien au second passage.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », only_ids = cet identifiant), après fusion sur
-- main — jamais par un canal qui contourne infra.schema_migrations.
--
-- ROLLBACK : 20261001_archive_dead_tables_lot_d.down.sql (SET SCHEMA inverse,
-- vue recréée à l'identique), à lancer à la main : le moteur est forward-only.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`). SET SCHEMA prend un
-- verrou ACCESS EXCLUSIVE bref (catalogue seul, aucune réécriture de données).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- pg_get_viewdef qualifie les noms selon le search_path de la session : on le
-- fixe pour que l'empreinte de la vue (§0) ne dépende pas du rôle qui applique.
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
  v_view regclass;
  v_hits text;
  c_names CONSTANT text :=
    '(cars_engine|__qa_audit_(runs|issues|alerts)|signal_s1_volume|signal_s2_cohort2025|signal_s3_orphan_t400|seo_ab_testing_top_formulas)';
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
      ('public',  'cars_engine',            35661::bigint),
      ('public',  '__qa_audit_runs',          540),
      ('public',  '__qa_audit_issues',      15064),
      ('public',  '__qa_audit_alerts',        268),
      ('_filter', 'signal_s1_volume',       13575),
      ('_filter', 'signal_s2_cohort2025',  119702),
      ('_filter', 'signal_s3_orphan_t400',  11929)
    ) AS t(src, tbl, nrows)
  LOOP
    v_src := to_regclass(format('%I.%I', r.src, r.tbl));
    v_dst := to_regclass(format('_archive.%I', r.tbl));

    IF v_src IS NULL AND v_dst IS NOT NULL THEN
      CONTINUE;  -- déjà archivée : rejeu
    END IF;
    IF v_src IS NULL THEN
      RAISE EXCEPTION 'ABORT: %.% introuvable, et absente de _archive', r.src, r.tbl;
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
      RAISE EXCEPTION 'ABORT: % compte % lignes, % mesurées le 2026-10-01 — un écrivain existe',
        v_src, v_n, r.nrows;
    END IF;

    -- Les index et le type de ligne changent de schéma avec la table.
    IF EXISTS (SELECT 1 FROM pg_index i JOIN pg_class ci ON ci.oid = i.indexrelid
                WHERE i.indrelid = v_src
                  AND to_regclass(format('_archive.%I', ci.relname)) IS NOT NULL)
       OR EXISTS (SELECT 1 FROM pg_type ty
                   WHERE ty.typnamespace = '_archive'::regnamespace
                     AND ty.typname IN (r.tbl, '_' || r.tbl)) THEN
      RAISE EXCEPTION 'ABORT: collision d''index ou de type dans _archive pour %', v_src;
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

  -- La vue est celle que le .down restitue, et rien ne s'appuie dessus.
  v_view := to_regclass('public.seo_ab_testing_top_formulas');
  IF v_view IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_class c
                    WHERE c.oid = v_view AND c.relkind = 'v'
                      AND md5(pg_get_viewdef(c.oid, true)) = '67ec8784156a1dcea7acf565ed2a1275'
                      AND c.reloptions = ARRAY['security_invoker=true']) THEN
      RAISE EXCEPTION 'ABORT: seo_ab_testing_top_formulas diffère de la définition que restitue le .down';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_depend d JOIN pg_rewrite rw ON rw.oid = d.objid
                WHERE d.classid = 'pg_rewrite'::regclass
                  AND d.refobjid = v_view AND rw.ev_class <> v_view) THEN
      RAISE EXCEPTION 'ABORT: une vue dépend de seo_ab_testing_top_formulas';
    END IF;
  END IF;
END
$precheck$;

-- -----------------------------------------------------------------------------
-- §1 — ARCHIVAGE
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.cars_engine SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__qa_audit_alerts SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__qa_audit_issues SET SCHEMA _archive;
ALTER TABLE IF EXISTS public.__qa_audit_runs SET SCHEMA _archive;
ALTER TABLE IF EXISTS _filter.signal_s1_volume SET SCHEMA _archive;
ALTER TABLE IF EXISTS _filter.signal_s2_cohort2025 SET SCHEMA _archive;
ALTER TABLE IF EXISTS _filter.signal_s3_orphan_t400 SET SCHEMA _archive;

-- RESTRICT (par défaut) : échoue si une dépendance est apparue depuis le précheck.
DROP VIEW IF EXISTS public.seo_ab_testing_top_formulas;

-- -----------------------------------------------------------------------------
-- §2 — POST-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
-- Chaque table est dans _archive, avec ses lignes, sa RLS, ses politiques, ses
-- index, ses triggers et ses droits d'avant ; les clés étrangères internes
-- tiennent ; la vue a disparu ; _archive reste fermé à l'API.
DO $postcheck$
DECLARE
  r     record;
  v     regclass;
  v_n   bigint;
  v_acl text[];
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public',  'cars_engine',            35661::bigint, true,  1, 3, 0, true),
      ('public',  '__qa_audit_runs',          540,         true,  1, 2, 1, true),
      ('public',  '__qa_audit_issues',      15064,         true,  1, 3, 1, true),
      ('public',  '__qa_audit_alerts',        268,         true,  1, 2, 1, true),
      ('_filter', 'signal_s1_volume',       13575,         false, 0, 1, 0, false),
      ('_filter', 'signal_s2_cohort2025',  119702,         false, 0, 1, 0, false),
      ('_filter', 'signal_s3_orphan_t400',  11929,         false, 0, 1, 0, false)
    ) AS t(src, tbl, nrows, rls, npol, nidx, ntrg, has_acl)
  LOOP
    IF to_regclass(format('%I.%I', r.src, r.tbl)) IS NOT NULL THEN
      RAISE EXCEPTION 'ABORT: %.% existe encore', r.src, r.tbl;
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
    IF (SELECT count(*) FROM pg_trigger
         WHERE tgrelid = v AND NOT tgisinternal AND tgenabled = 'O') <> r.ntrg THEN
      RAISE EXCEPTION 'ABORT: triggers de % modifiés', v;
    END IF;

    SELECT array_agg(a ORDER BY a) INTO v_acl
      FROM pg_class c, unnest(c.relacl::text[]) AS a WHERE c.oid = v;
    IF (r.has_acl AND v_acl IS DISTINCT FROM ARRAY['dev_readonly=r/postgres',
                                                   'postgres=arwdDxtm/postgres',
                                                   'service_role=arwdDxtm/postgres'])
       OR (NOT r.has_acl AND v_acl IS NOT NULL) THEN
      RAISE EXCEPTION 'ABORT: droits de % modifiés : %', v, v_acl;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_constraint
       WHERE contype = 'f' AND convalidated
         AND confrelid = '_archive.__qa_audit_runs'::regclass
         AND conrelid IN ('_archive.__qa_audit_issues'::regclass,
                          '_archive.__qa_audit_alerts'::regclass)) <> 2 THEN
    RAISE EXCEPTION 'ABORT: clés étrangères issues/alerts → runs rompues';
  END IF;

  IF to_regclass('public.seo_ab_testing_top_formulas') IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: seo_ab_testing_top_formulas existe encore';
  END IF;

  IF has_schema_privilege('anon', '_archive', 'USAGE')
     OR has_schema_privilege('authenticated', '_archive', 'USAGE')
     OR has_schema_privilege('service_role', '_archive', 'USAGE') THEN
    RAISE EXCEPTION 'ABORT: un rôle de l''API a USAGE sur _archive';
  END IF;
END
$postcheck$;

-- =============================================================================
