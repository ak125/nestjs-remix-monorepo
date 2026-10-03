-- Rollback: 20261001_archive_dead_tables_lot_d
-- Ramène les 7 tables de _archive vers leur schéma d'origine (public ou _filter)
-- et recrée public.seo_ab_testing_top_formulas à l'identique : même définition
-- (empreinte md5 de pg_get_viewdef vérifiée), security_invoker, commentaire et
-- droits mesurés avant la migration. SET SCHEMA ne touche aucune ligne : index,
-- contraintes, triggers, politiques et droits reviennent avec chaque table.
-- L'engine est forward-only : ce fichier se lance à la main. La transaction
-- explicite borne les délais par SET LOCAL et rend pré-condition, retour et
-- post-condition indivisibles.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Même search_path que la migration : l'empreinte de la vue en dépend.
SET LOCAL search_path = public, pg_temp;

-- Pré-condition : chaque table est dans _archive (ou déjà revenue : rejeu), sans
-- collision de nom dans son schéma d'origine ; la vue est absente ou identique.
DO $precheck$
DECLARE
  r      record;
  v_src  regclass;
  v_dst  regclass;
  v_view regclass;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public',  'cars_engine'),
      ('public',  '__qa_audit_runs'),
      ('public',  '__qa_audit_issues'),
      ('public',  '__qa_audit_alerts'),
      ('_filter', 'signal_s1_volume'),
      ('_filter', 'signal_s2_cohort2025'),
      ('_filter', 'signal_s3_orphan_t400')
    ) AS t(src, tbl)
  LOOP
    v_src := to_regclass(format('_archive.%I', r.tbl));
    v_dst := to_regclass(format('%I.%I', r.src, r.tbl));

    IF v_src IS NULL AND v_dst IS NOT NULL THEN
      CONTINUE;  -- déjà revenue : rejeu
    END IF;
    IF v_src IS NULL THEN
      RAISE EXCEPTION 'ABORT: _archive.% introuvable, et absente de %', r.tbl, r.src;
    END IF;
    IF v_dst IS NOT NULL THEN
      RAISE EXCEPTION 'ABORT: %.% existe déjà — collision de nom', r.src, r.tbl;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_index i JOIN pg_class ci ON ci.oid = i.indexrelid
                WHERE i.indrelid = v_src
                  AND to_regclass(format('%I.%I', r.src, ci.relname)) IS NOT NULL)
       OR EXISTS (SELECT 1 FROM pg_type ty
                   WHERE ty.typnamespace = r.src::regnamespace
                     AND ty.typname IN (r.tbl, '_' || r.tbl)) THEN
      RAISE EXCEPTION 'ABORT: collision d''index ou de type dans % pour %', r.src, v_src;
    END IF;
  END LOOP;

  IF to_regclass('public.seo_link_clicks') IS NULL
     OR to_regclass('public.seo_link_impressions') IS NULL THEN
    RAISE EXCEPTION 'ABORT: seo_link_clicks ou seo_link_impressions absente — la vue ne peut pas être recréée';
  END IF;
  v_view := to_regclass('public.seo_ab_testing_top_formulas');
  IF v_view IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_class c
                      WHERE c.oid = v_view AND c.relkind = 'v'
                        AND md5(pg_get_viewdef(c.oid, true)) = '67ec8784156a1dcea7acf565ed2a1275') THEN
    RAISE EXCEPTION 'ABORT: public.seo_ab_testing_top_formulas existe avec une autre définition';
  END IF;
END
$precheck$;

ALTER TABLE IF EXISTS _archive.cars_engine SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__qa_audit_runs SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__qa_audit_issues SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.__qa_audit_alerts SET SCHEMA public;
ALTER TABLE IF EXISTS _archive.signal_s1_volume SET SCHEMA _filter;
ALTER TABLE IF EXISTS _archive.signal_s2_cohort2025 SET SCHEMA _filter;
ALTER TABLE IF EXISTS _archive.signal_s3_orphan_t400 SET SCHEMA _filter;

-- Définition relevée par pg_get_viewdef le 2026-10-01 (empreinte ci-dessous).
CREATE OR REPLACE VIEW public.seo_ab_testing_top_formulas
  WITH (security_invoker = true) AS
 WITH formula_clicks AS (
         SELECT seo_link_clicks.switch_formula,
            count(*) AS clicks
           FROM seo_link_clicks
          WHERE seo_link_clicks.switch_formula IS NOT NULL
          GROUP BY seo_link_clicks.switch_formula
        ), formula_impressions AS (
         SELECT seo_link_impressions.link_type,
            sum(seo_link_impressions.link_count) AS impressions
           FROM seo_link_impressions
          WHERE seo_link_impressions.link_type::text = 'LinkGammeCar'::text
          GROUP BY seo_link_impressions.link_type
        )
 SELECT fc.switch_formula,
    fc.clicks,
    fi.impressions,
        CASE
            WHEN fi.impressions > 0 THEN round(fc.clicks::numeric / fi.impressions::numeric * 100::numeric, 2)
            ELSE 0::numeric
        END AS ctr_pct
   FROM formula_clicks fc
     CROSS JOIN formula_impressions fi
  ORDER BY fc.clicks DESC
 LIMIT 20;

COMMENT ON VIEW public.seo_ab_testing_top_formulas IS 'Top 20 formulations avec CTR estimé';

-- Les droits par défaut du schéma public donnent tout à anon et authenticated :
-- on remet exactement l'ACL mesurée avant la migration.
REVOKE ALL ON public.seo_ab_testing_top_formulas FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.seo_ab_testing_top_formulas TO service_role;
GRANT SELECT ON public.seo_ab_testing_top_formulas TO dev_readonly;

DO $postcheck$
DECLARE
  r     record;
  v     regclass;
  v_n   bigint;
  v_acl text[];
BEGIN
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
    IF to_regclass(format('_archive.%I', r.tbl)) IS NOT NULL THEN
      RAISE EXCEPTION 'ABORT: _archive.% existe encore', r.tbl;
    END IF;
    v := to_regclass(format('%I.%I', r.src, r.tbl));
    IF v IS NULL THEN
      RAISE EXCEPTION 'ABORT: %.% absente après SET SCHEMA', r.src, r.tbl;
    END IF;
    EXECUTE format('SELECT count(*) FROM %s', v) INTO v_n;
    IF v_n <> r.nrows THEN
      RAISE EXCEPTION 'ABORT: % compte % lignes, % attendues', v, v_n, r.nrows;
    END IF;
    IF (SELECT count(*) FROM pg_index i JOIN pg_class ci ON ci.oid = i.indexrelid
         WHERE i.indrelid = v AND ci.relnamespace <> r.src::regnamespace) > 0 THEN
      RAISE EXCEPTION 'ABORT: un index de % est resté hors de %', v, r.src;
    END IF;
  END LOOP;

  SELECT array_agg(a ORDER BY a) INTO v_acl
    FROM pg_class c, unnest(c.relacl::text[]) AS a
   WHERE c.oid = 'public.seo_ab_testing_top_formulas'::regclass;
  IF NOT EXISTS (SELECT 1 FROM pg_class c
                  WHERE c.oid = 'public.seo_ab_testing_top_formulas'::regclass
                    AND c.relkind = 'v'
                    AND md5(pg_get_viewdef(c.oid, true)) = '67ec8784156a1dcea7acf565ed2a1275'
                    AND c.reloptions = ARRAY['security_invoker=true'])
     OR v_acl IS DISTINCT FROM ARRAY['dev_readonly=r/postgres',
                                     'postgres=arwdDxtm/postgres',
                                     'service_role=arwdDxtm/postgres'] THEN
    RAISE EXCEPTION 'ABORT: vue recréée différente de l''état mesuré (droits : %)', v_acl;
  END IF;
END
$postcheck$;

COMMIT;
