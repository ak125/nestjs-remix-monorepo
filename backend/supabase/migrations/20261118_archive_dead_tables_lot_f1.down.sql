-- Rollback: 20261118_archive_dead_tables_lot_f1
-- Ramène les 19 tables du lot F1 de _archive vers public. SET SCHEMA ne touche
-- aucune ligne : index, contraintes, clés étrangères sortantes, séquences
-- possédées, triggers, politiques et droits reviennent avec chaque table.
-- L'engine est forward-only : ce fichier se lance à la main. La transaction
-- explicite borne les délais par SET LOCAL et rend pré-condition, retour et
-- post-condition indivisibles.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_temp;

-- Pré-condition : chaque table est dans _archive (ou déjà revenue : rejeu), sans
-- collision de nom (table, index, séquence, type) dans public.
DO $precheck$
DECLARE
  r      record;
  v_src  regclass;
  v_dst  regclass;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('__agent_runs'),
      ('__catalog_import_history'),
      ('__marketing_analytics_digests'),
      ('__marketing_content_library'),
      ('__marketing_guest_posts'),
      ('__qa_protected_meta_hash'),
      ('__rag_check_history'),
      ('__rag_pipeline_incidents'),
      ('__rag_readiness'),
      ('__v_level_computed'),
      ('__v_level_raw'),
      ('audit_vlevel_pg424_snapshot_20260608'),
      ('error_statistics'),
      ('gamme_filter_criteria'),
      ('norm_vehicle'),
      ('rm_data_version'),
      ('rm_listing_content'),
      ('rm_oem_top'),
      ('stg_compatibility')
    ) AS t(tbl)
  LOOP
    v_src := to_regclass(format('_archive.%I', r.tbl));
    v_dst := to_regclass(format('public.%I', r.tbl));

    IF v_src IS NULL AND v_dst IS NOT NULL THEN
      CONTINUE;  -- déjà revenue : rejeu
    END IF;
    IF v_src IS NULL THEN
      RAISE EXCEPTION 'ABORT: _archive.% introuvable, et absente de public', r.tbl;
    END IF;
    IF v_dst IS NOT NULL THEN
      RAISE EXCEPTION 'ABORT: public.% existe déjà — collision de nom', r.tbl;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_index i JOIN pg_class ci ON ci.oid = i.indexrelid
                WHERE i.indrelid = v_src
                  AND to_regclass(format('public.%I', ci.relname)) IS NOT NULL)
       OR EXISTS (SELECT 1 FROM pg_depend d JOIN pg_class s ON s.oid = d.objid
                   WHERE d.classid = 'pg_class'::regclass AND d.refobjid = v_src
                     AND d.deptype IN ('a', 'i') AND s.relkind = 'S'
                     AND to_regclass(format('public.%I', s.relname)) IS NOT NULL)
       OR EXISTS (SELECT 1 FROM pg_type ty
                   WHERE ty.typnamespace = 'public'::regnamespace
                     AND ty.typname IN (r.tbl, '_' || r.tbl)) THEN
      RAISE EXCEPTION 'ABORT: collision d''index, de séquence ou de type dans public pour %', v_src;
    END IF;
  END LOOP;
END
$precheck$;

ALTER TABLE IF EXISTS _archive.__agent_runs SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__catalog_import_history SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__marketing_analytics_digests SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__marketing_content_library SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__marketing_guest_posts SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__qa_protected_meta_hash SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__rag_check_history SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__rag_pipeline_incidents SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__rag_readiness SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__v_level_computed SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__v_level_raw SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.audit_vlevel_pg424_snapshot_20260608 SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.error_statistics SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.gamme_filter_criteria SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.norm_vehicle SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.rm_data_version SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.rm_listing_content SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.rm_oem_top SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.stg_compatibility SET SCHEMA public;

DO $postcheck$
DECLARE
  r     record;
  v     regclass;
  v_n   bigint;
BEGIN
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
    IF to_regclass(format('_archive.%I', r.tbl)) IS NOT NULL THEN
      RAISE EXCEPTION 'ABORT: _archive.% existe encore', r.tbl;
    END IF;
    v := to_regclass(format('public.%I', r.tbl));
    IF v IS NULL THEN
      RAISE EXCEPTION 'ABORT: public.% absente après SET SCHEMA', r.tbl;
    END IF;
    EXECUTE format('SELECT count(*) FROM %s', v) INTO v_n;
    IF v_n <> r.nrows THEN
      RAISE EXCEPTION 'ABORT: % compte % lignes, % attendues', v, v_n, r.nrows;
    END IF;
    IF (SELECT count(*) FROM pg_index i JOIN pg_class ci ON ci.oid = i.indexrelid
         WHERE i.indrelid = v AND ci.relnamespace <> 'public'::regnamespace) > 0 THEN
      RAISE EXCEPTION 'ABORT: un index de % est resté hors de public', v;
    END IF;
    IF (SELECT count(*) FROM pg_depend d JOIN pg_class s ON s.oid = d.objid
         WHERE d.classid = 'pg_class'::regclass AND d.refobjid = v
           AND d.deptype IN ('a', 'i') AND s.relkind = 'S'
           AND s.relnamespace <> 'public'::regnamespace) > 0 THEN
      RAISE EXCEPTION 'ABORT: une séquence de % est restée hors de public', v;
    END IF;
  END LOOP;
END
$postcheck$;

COMMIT;
