-- Rollback : 20260930_rls_align_service_role_only_policies
-- (documentation d'intervention manuelle ; le runner ignore les .down.sql,
-- politique forward-only).
--
-- Restaure À L'IDENTIQUE les 18 politiques de départ, telles que pg_policies les
-- servait le 2026-09-30 avant la migration (lecture seule), et retire la
-- politique que la migration a créée. On passe par DROP + CREATE : ALTER POLICY
-- ne sait pas remettre un WITH CHECK à NULL, et 12 des 14 politiques alignées
-- n'en avaient pas.
--
-- EFFET DU ROLLBACK — à lire avant de l'appliquer :
--   * auth_rls_initplan (×18) et multiple_permissive_policies (×24) reviennent ;
--   * la politique « Allow admin read on seo_link_metrics_daily » revient, et
--     avec elle la lecture accordée à tout utilisateur Supabase Auth qui écrit
--     isAdmin = 'true' dans ses propres raw_user_meta_data. C'est la porte que la
--     migration ferme. Ne rouler en arrière que si la migration a cassé un usage
--     réel, jamais pour faire taire un advisor.
-- Le résultat des requêtes, lui, est le même avant et après (raisonnement dans
-- l'en-tête de la migration) : aucun comportement applicatif ne dépend de ce
-- rollback.
--
-- Transaction explicite : tout ou rien.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- Pré-condition fail-closed : l'état d'arrivée de la migration, et lui seul.
DO $precheck$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n
    FROM (VALUES
      ('public',      '__admin_audit_log',         'service_role_aal'),
      ('public',      '__claims',                  'service_role_claims'),
      ('public',      '__db_governance_snapshots', 'service_role_only'),
      ('public',      '__pipeline_chain_queue',    'service_role_all'),
      ('public',      '__quote_requests',          'service_role_qr'),
      ('public',      '__quotes',                  'service_role_qt'),
      ('public',      '__refunds',                 'service_role_refunds'),
      ('public',      '__seo_brand_editorial',     '__seo_brand_editorial_service_role_all'),
      ('public',      '__seo_r1_gamme_slots',      'Service role full access on __seo_r1_gamme_slots'),
      ('public',      '__video_execution_log',     'Service role full access'),
      ('public',      'seo_link_metrics_daily',    'seo_link_metrics_daily_service_role_all'),
      ('_archive',    '__agentic_chain_rules',     'service_role_only_chain_rules'),
      ('tecdoc_norm', 't001',                      'service_role_only'),
      ('tecdoc_norm', 't100',                      'service_role_only'),
      ('tecdoc_norm', 't200',                      'service_role_only'),
      ('tecdoc_norm', 't209',                      'service_role_only'),
      ('tecdoc_norm', 't210',                      'service_role_only')
    ) AS t(sch, tbl, pol)
   WHERE (SELECT count(*) FROM pg_policies p
           WHERE p.schemaname = t.sch AND p.tablename = t.tbl) = 1
     AND EXISTS (SELECT 1 FROM pg_policies p
                  WHERE p.schemaname = t.sch AND p.tablename = t.tbl AND p.policyname = t.pol
                    AND p.permissive = 'PERMISSIVE' AND p.cmd = 'ALL'
                    AND p.roles = '{service_role}'
                    AND p.qual = 'true' AND p.with_check = 'true');
  IF v_n <> 17 THEN
    RAISE EXCEPTION 'ABORT: % tables sur 17 dans l''état d''arrivée de la migration', v_n;
  END IF;
END
$precheck$;

-- 14 politiques alignées → définition de départ (même nom)
DROP POLICY service_role_aal ON public.__admin_audit_log;
CREATE POLICY service_role_aal ON public.__admin_audit_log
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

DROP POLICY service_role_claims ON public.__claims;
CREATE POLICY service_role_claims ON public.__claims
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

DROP POLICY service_role_only ON public.__db_governance_snapshots;
CREATE POLICY service_role_only ON public.__db_governance_snapshots
  AS PERMISSIVE FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY service_role_qr ON public.__quote_requests;
CREATE POLICY service_role_qr ON public.__quote_requests
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

DROP POLICY service_role_qt ON public.__quotes;
CREATE POLICY service_role_qt ON public.__quotes
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

DROP POLICY service_role_refunds ON public.__refunds;
CREATE POLICY service_role_refunds ON public.__refunds
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

DROP POLICY "Service role full access on __seo_r1_gamme_slots" ON public.__seo_r1_gamme_slots;
CREATE POLICY "Service role full access on __seo_r1_gamme_slots" ON public.__seo_r1_gamme_slots
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

DROP POLICY "Service role full access" ON public.__video_execution_log;
CREATE POLICY "Service role full access" ON public.__video_execution_log
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

DROP POLICY service_role_only_chain_rules ON _archive.__agentic_chain_rules;
CREATE POLICY service_role_only_chain_rules ON _archive.__agentic_chain_rules
  AS PERMISSIVE FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY service_role_only ON tecdoc_norm.t001;
CREATE POLICY service_role_only ON tecdoc_norm.t001
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

DROP POLICY service_role_only ON tecdoc_norm.t100;
CREATE POLICY service_role_only ON tecdoc_norm.t100
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

DROP POLICY service_role_only ON tecdoc_norm.t200;
CREATE POLICY service_role_only ON tecdoc_norm.t200
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

DROP POLICY service_role_only ON tecdoc_norm.t209;
CREATE POLICY service_role_only ON tecdoc_norm.t209
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

DROP POLICY service_role_only ON tecdoc_norm.t210;
CREATE POLICY service_role_only ON tecdoc_norm.t210
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

-- 3 doublons retirés → recréés
CREATE POLICY service_role_only ON _archive.__agentic_chain_rules
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

CREATE POLICY service_only_pcq ON public.__pipeline_chain_queue
  AS PERMISSIVE FOR ALL TO public USING (auth.role() = 'service_role');

CREATE POLICY editorial_write_service_role ON public.__seo_brand_editorial
  AS PERMISSIVE FOR ALL TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- seo_link_metrics_daily → politique d'origine
-- (texte de migrations/002_create_seo_link_tracking.sql)
DROP POLICY seo_link_metrics_daily_service_role_all ON public.seo_link_metrics_daily;
CREATE POLICY "Allow admin read on seo_link_metrics_daily"
  ON public.seo_link_metrics_daily FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
       WHERE auth.users.id = auth.uid()
         AND auth.users.raw_user_meta_data->>'isAdmin' = 'true'
    )
  );

-- Post-condition : 20 politiques sur les 17 tables, dont 19 appellent
-- auth.role() et 1 lit raw_user_meta_data (état de départ mesuré).
DO $postcheck$
DECLARE
  v_total int;
  v_legacy int;
  v_meta int;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE roles = '{public}' AND cmd = 'ALL'
                            AND qual = '(auth.role() = ''service_role''::text)'),
         count(*) FILTER (WHERE cmd = 'SELECT' AND qual LIKE '%raw_user_meta_data%isAdmin%')
    INTO v_total, v_legacy, v_meta
    FROM pg_policies
   WHERE (schemaname, tablename) IN (
           ('public','__admin_audit_log'), ('public','__claims'), ('public','__db_governance_snapshots'),
           ('public','__pipeline_chain_queue'), ('public','__quote_requests'), ('public','__quotes'),
           ('public','__refunds'), ('public','__seo_brand_editorial'), ('public','__seo_r1_gamme_slots'),
           ('public','__video_execution_log'), ('public','seo_link_metrics_daily'),
           ('_archive','__agentic_chain_rules'), ('tecdoc_norm','t001'), ('tecdoc_norm','t100'),
           ('tecdoc_norm','t200'), ('tecdoc_norm','t209'), ('tecdoc_norm','t210'));
  IF v_total <> 20 OR v_legacy <> 17 OR v_meta <> 1 THEN
    RAISE EXCEPTION 'ABORT: état restauré inattendu (total=%, legacy=%, isAdmin=%)',
      v_total, v_legacy, v_meta;
  END IF;
END
$postcheck$;

COMMIT;
