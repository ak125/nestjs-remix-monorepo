-- Metadata only. No customer/contact rows, no DDL, no ledger repair.
-- Requires SELECT on BOTH existing migration ledgers; missing ledger = STOP.
-- Run on the explicitly approved target with psql -X -v ON_ERROR_STOP=1.
-- READ ONLY and ROLLBACK remain effective independently of the client.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
WITH wanted(name) AS (VALUES
  ('__marketing_brief'), ('__marketing_social_posts'),
  ('__marketing_social_post_history'), ('__marketing_publication_preparations'),
  ('__retention_trigger_rules'), ('___xtr_customer')
), relations AS (
  SELECT w.name, c.oid, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
         c.relacl, pg_get_userbyid(c.relowner) AS owner
  FROM wanted w LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||w.name)
)
SELECT jsonb_build_object(
  'captured_at', transaction_timestamp(),
  'database', current_database(), 'user', current_user,
  'server_version', current_setting('server_version'),
  'transaction_read_only', current_setting('transaction_read_only'),
  'relations', (SELECT jsonb_agg(to_jsonb(r) ORDER BY name) FROM relations r),
  'columns', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table',r.name,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),
      'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl)
      ORDER BY r.name,a.attnum),'[]'::jsonb)
    FROM relations r JOIN pg_attribute a ON a.attrelid=r.oid
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attnum>0 AND NOT a.attisdropped),
  'consent_column_present', EXISTS(SELECT 1 FROM pg_attribute
    WHERE attrelid=to_regclass('public.___xtr_customer')
    AND attname='cst_marketing_consent_at' AND NOT attisdropped),
  'constraints', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table',r.name,'name',c.conname,'validated',c.convalidated,
      'definition',pg_get_constraintdef(c.oid)) ORDER BY r.name,c.conname),'[]'::jsonb)
    FROM relations r JOIN pg_constraint c ON c.conrelid=r.oid),
  'indexes', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table',r.name,'name',c.relname,'valid',i.indisvalid,'ready',i.indisready,
      'definition',pg_get_indexdef(i.indexrelid)) ORDER BY r.name,c.relname),'[]'::jsonb)
    FROM relations r JOIN pg_index i ON i.indrelid=r.oid
    JOIN pg_class c ON c.oid=i.indexrelid),
  'policies', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname),'[]'::jsonb)
    FROM pg_policies p WHERE p.schemaname='public' AND p.tablename IN(SELECT name FROM wanted)),
  'roles', (SELECT jsonb_agg(jsonb_build_object('name',rolname,'bypass_rls',rolbypassrls))
    FROM pg_roles WHERE rolname IN('anon','authenticated','service_role')),
  'effective_privileges', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table',r.name,'role',u.rolname,'select',has_table_privilege(u.oid,r.oid,'SELECT'),
      'insert',has_table_privilege(u.oid,r.oid,'INSERT'),
      'update',has_table_privilege(u.oid,r.oid,'UPDATE'),
      'delete',has_table_privilege(u.oid,r.oid,'DELETE'),
      'truncate',has_table_privilege(u.oid,r.oid,'TRUNCATE'),
      'column_write',has_any_column_privilege(u.oid,r.oid,'INSERT,UPDATE,REFERENCES'))
      ORDER BY r.name,u.rolname),'[]'::jsonb)
    FROM relations r CROSS JOIN pg_roles u
    WHERE r.oid IS NOT NULL AND u.rolname IN('anon','authenticated','service_role')),
  'triggers', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table',r.name,'name',t.tgname,'enabled',t.tgenabled,
      'definition',pg_get_triggerdef(t.oid)) ORDER BY r.name,t.tgname),'[]'::jsonb)
    FROM relations r JOIN pg_trigger t ON t.tgrelid=r.oid WHERE NOT t.tgisinternal),
  'incoming_dependencies', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table',r.name,'type',d.deptype,
      'dependent',pg_describe_object(d.classid,d.objid,d.objsubid))),'[]'::jsonb)
    FROM relations r JOIN pg_depend d ON d.refclassid='pg_class'::regclass AND d.refobjid=r.oid),
  'infra_phase1_and_candidates', (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb)
    FROM infra.schema_migrations m WHERE id IN(
      '20260430_marketing_layer_phase1','20261014010000_marketing_social_reviews',
      '20261014091855_marketing_publication_preparations','20261014172953_marketing_brief_social_link')),
  'supabase_phase1_and_candidates', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'version',version,'name',name) ORDER BY version),'[]'::jsonb)
    FROM supabase_migrations.schema_migrations WHERE version IN(
      '20260430','20261014010000','20261014091855','20261014172953')),
  'ledger_counts', jsonb_build_object(
    'infra',(SELECT count(*) FROM infra.schema_migrations),
    'supabase',(SELECT count(*) FROM supabase_migrations.schema_migrations)),
  'interpretation','Metadata is not approval or proof of activation; review differences before any DDL'
) AS phase1_inventory;
ROLLBACK;
