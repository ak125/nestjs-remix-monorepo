-- =============================================================================
-- Fixture — état PROD AVANT les migrations 20260911_seo_gsc_multilevel_page_totals*
--
-- Pas une copie des données : reproduction de ce qui décide du comportement des
-- deux migrations — rôles API, privilèges par défaut Supabase, row_security,
-- tables GSC partitionnées verrouillées (RLS + policy service_role), et les
-- fonctions dont elles dépendent. Définitions recopiées depuis la base live
-- (pg_get_functiondef / pg_attribute / pg_constraint / pg_default_acl /
-- obj_description), lecture seule, 2026-09-11.
--
-- S'applique sur un PostgreSQL jetable. Ne cible JAMAIS une base persistante.
-- =============================================================================

-- --- Rôles API (mêmes noms et attributs qu'en Supabase) ------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')          THEN CREATE ROLE anon NOLOGIN;                   END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN;          END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role')  THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dev_readonly')  THEN CREATE ROLE dev_readonly NOLOGIN;          END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, dev_readonly;
-- PROD : aucun rôle API n'a CREATE sur public (has_schema_privilege = false).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- PROD : row_security = off (une requête filtrée par RLS lève une erreur) ; TimeZone = UTC.
DO $$ BEGIN
  EXECUTE format('ALTER DATABASE %I SET row_security = off', current_database());
  EXECUTE format('ALTER DATABASE %I SET TimeZone = %L', current_database(), 'UTC');
END $$;

-- --- Privilèges par défaut de postgres sur public (pg_default_acl, verbatim) ---
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT ON TABLES TO dev_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO anon, authenticated, service_role;

-- --- Helper vague 5 (verbatim) : REVOKE anon/authenticated + RLS + policy ------
CREATE OR REPLACE FUNCTION public.__rls_lock_internal_table(p_relname text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_policy text := p_relname || '_service_role_all';
BEGIN
  -- bound the ENABLE RLS (ACCESS EXCLUSIVE) lock wait so the hourly reconcile never
  -- queues behind a long-running on-demand import on the same table.
  SET LOCAL lock_timeout = '3s';

  -- operate only on an existing public base/partition table
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = p_relname AND c.relkind IN ('r','p')
  ) THEN
    RETURN;
  END IF;

  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', p_relname);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_relname);

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_relname AND policyname = v_policy
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)',
      v_policy, p_relname);
  END IF;
END;
$function$;
-- PROD acl : {postgres=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.__rls_lock_internal_table(text) FROM PUBLIC, anon, authenticated;

-- --- Tables GSC (colonnes, contraintes, index verbatim) ------------------------
CREATE TABLE public.__seo_gsc_daily_property_total (
  date date NOT NULL,
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  impressions bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  ctr real NOT NULL DEFAULT 0 CHECK (ctr >= (0)::double precision AND ctr <= (1)::double precision),
  position real NOT NULL DEFAULT 0 CHECK (position >= (0)::double precision),
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (date)
) PARTITION BY RANGE (date);

CREATE TABLE public.__seo_gsc_daily_pages (
  date date NOT NULL,
  page text NOT NULL,
  country text NOT NULL DEFAULT 'zzz'::text,
  device text NOT NULL DEFAULT 'all'::text CHECK (device = ANY (ARRAY['all'::text, 'mobile'::text, 'desktop'::text, 'tablet'::text])),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  impressions bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  ctr real NOT NULL DEFAULT 0 CHECK (ctr >= (0)::double precision AND ctr <= (1)::double precision),
  position real NOT NULL DEFAULT 0 CHECK (position >= (0)::double precision),
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (date, page, country, device)
) PARTITION BY RANGE (date);
CREATE INDEX idx_gsc_pages_cd_date ON ONLY public.__seo_gsc_daily_pages USING btree (country, device, date DESC);
CREATE INDEX idx_gsc_pages_page_date ON ONLY public.__seo_gsc_daily_pages USING btree (page, date DESC);

COMMENT ON TABLE public.__seo_gsc_daily_pages IS
  'GSC Search Analytics — performance par URL (date+page+country+device, sans query). Source des réactions/opportunités par page. Partitionné mensuel.';
COMMENT ON TABLE public.__seo_gsc_daily_property_total IS
  'GSC Search Analytics — total GLOBAL quotidien (date seule, aucune dimension = volume le plus complet). Source de vérité des totaux. Partitionné mensuel.';

-- Partitions présentes en PROD : 2026_06 .. 2026_12, toutes verrouillées.
DO $$
DECLARE m date; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['__seo_gsc_daily_property_total', '__seo_gsc_daily_pages'] LOOP
    FOR m IN SELECT generate_series(DATE '2026-06-01', DATE '2026-12-01', INTERVAL '1 month')::date LOOP
      EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        t || '_' || to_char(m, 'YYYY_MM'), t, m, (m + INTERVAL '1 month')::date);
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
             AND (c.relname LIKE '\_\_seo\_gsc\_daily\_property\_total%' OR c.relname LIKE '\_\_seo\_gsc\_daily\_pages%')
  LOOP
    PERFORM public.__rls_lock_internal_table(r.relname);
  END LOOP;
END $$;

-- --- Fonction de partitions (verbatim, 6 tables) -------------------------------
CREATE OR REPLACE FUNCTION public.__seo_ensure_monthly_partitions(p_months_ahead integer DEFAULT 3)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_tables TEXT[] := ARRAY[
        '__seo_gsc_daily',
        '__seo_ga4_daily',
        '__seo_cwv_daily',
        '__seo_gsc_daily_property_total',
        '__seo_gsc_daily_totals',
        '__seo_gsc_daily_pages'
    ];
    v_tbl TEXT;
    v_i INT;
    v_start DATE;
    v_end DATE;
    v_pname TEXT;
    v_created INT := 0;
BEGIN
    FOREACH v_tbl IN ARRAY v_tables LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_partitioned_table pt
            JOIN pg_class c ON c.oid = pt.partrelid
            WHERE c.relname = v_tbl
        ) THEN
            CONTINUE;
        END IF;
        FOR v_i IN 0..p_months_ahead LOOP
            v_start := date_trunc('month', CURRENT_DATE)::DATE + (v_i || ' month')::INTERVAL;
            v_end := (v_start + INTERVAL '1 month')::DATE;
            v_pname := v_tbl || '_' || to_char(v_start, 'YYYY_MM');
            IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = v_pname) THEN
                EXECUTE format(
                    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                    v_pname, v_tbl, v_start, v_end
                );
                v_created := v_created + 1;
            END IF;
        END LOOP;
    END LOOP;
    RETURN v_created;
END;
$function$;

-- --- Résolution surface (verbatim) ---------------------------------------------
CREATE OR REPLACE FUNCTION public._seo_resolve_surface_key(p_url text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_url IS NULL OR p_url = '' THEN 'unknown'
    WHEN p_url = '/' OR p_url = '/index' THEN 'R0'
    -- R8 : véhicule (longue forme /pieces/gamme/marque/modele/type)
    WHEN p_url ~ '^/pieces/[^/]+/[^/]+/[^/]+/[^/]+' THEN 'R8'
    -- R8 : véhicule via constructeurs
    WHEN p_url ~ '^/constructeurs/[^/]+/[^/]+/[^/]+' THEN 'R8'
    -- R8 : véhicule via blog-pieces-auto/auto/marque/modele
    WHEN p_url ~ '^/blog-pieces-auto/auto/[^/]+/[^/]+' THEN 'R8'
    -- R7 : hub marque constructeurs
    WHEN p_url ~ '^/constructeurs/[^/]+' THEN 'R7'
    WHEN p_url ~ '^/blog-pieces-auto/auto/[^/]+' THEN 'R7'
    WHEN p_url ~ '^/blog-pieces-auto/auto(/?$|/_index)' THEN 'R7'
    -- R6 : blog article
    WHEN p_url ~ '^/blog-pieces-auto/article/' THEN 'R6'
    -- R3 : conseils gamme (advice gamme = R3 mapping canon)
    WHEN p_url ~ '^/blog-pieces-auto/conseils/' THEN 'R3'
    -- R1 : listing pieces (fiche simple ou listing slug)
    WHEN p_url ~ '^/pieces/' THEN 'R1'
    -- admin (exclus SEO public — tier excluded)
    WHEN p_url ~ '^/admin' THEN 'admin'
    WHEN p_url ~ '^/account' THEN 'admin'
    WHEN p_url ~ '^/auth' THEN 'admin'
    -- Fallback
    ELSE 'unknown'
  END;
$function$;

-- --- rpc_seo_low_ctr_v3 (verbatim) : consommateur de l'ancien code ---------------
CREATE OR REPLACE FUNCTION public.rpc_seo_low_ctr_v3(p_window_days integer, p_now timestamp with time zone DEFAULT now(), p_min_impressions integer DEFAULT 100, p_max_ctr numeric DEFAULT 0.01, p_limit integer DEFAULT 50, p_coverage_min_ratio numeric DEFAULT 0.3)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH bounds AS (
    SELECT (p_now::DATE - p_window_days) AS from_d, p_now::DATE AS to_d
  ),
  agg AS (
    SELECT
      page,
      SUM(impressions)::BIGINT AS impressions,
      SUM(clicks)::BIGINT AS clicks,
      ROUND((SUM(clicks)::NUMERIC / NULLIF(SUM(impressions), 0)), 4)::FLOAT8 AS ctr,
      ROUND(AVG(position)::NUMERIC, 2)::FLOAT8 AS avg_position
    FROM __seo_gsc_daily_pages, bounds
    WHERE date >= bounds.from_d AND date < bounds.to_d
    GROUP BY page
    HAVING SUM(impressions) >= p_min_impressions
       AND (SUM(clicks)::NUMERIC / NULLIF(SUM(impressions), 0)) <= p_max_ctr
  ),
  scored AS (
    SELECT
      page,
      _seo_resolve_surface_key(page) AS surface_key,
      impressions, clicks, ctr, avg_position,
      CASE
        WHEN avg_position <= 5 THEN 'top5'
        WHEN avg_position <= 15 THEN 'top15'
        ELSE 'beyond' END AS position_band,
      ROUND(
        (impressions::NUMERIC
        * GREATEST(0::NUMERIC, (CASE
            WHEN avg_position <= 5 THEN 0.05
            WHEN avg_position <= 15 THEN 0.02
            ELSE 0.005 END)::NUMERIC - ctr::NUMERIC))::NUMERIC,
        2
      )::FLOAT8 AS business_impact_score,
      CASE
        WHEN avg_position <= 5 AND ctr < 0.005 THEN 'critical'
        WHEN avg_position <= 15 AND ctr < 0.005 THEN 'high'
        ELSE 'medium' END AS severity
    FROM agg
  ),
  coverage_dim AS (
    SELECT MIN(date) AS data_from, MAX(date) AS data_to
    FROM __seo_gsc_daily_pages, bounds
    WHERE date >= bounds.from_d AND date < bounds.to_d
  ),
  cov AS (
    SELECT
      COALESCE((
        SELECT SUM(impressions) FROM __seo_gsc_daily_pages, bounds
        WHERE date >= bounds.from_d AND date < bounds.to_d
      ), 0)::BIGINT AS pages_impr,
      COALESCE((
        SELECT SUM(impressions) FROM __seo_gsc_daily_property_total, bounds
        WHERE date >= bounds.from_d AND date < bounds.to_d
      ), 0)::BIGINT AS prop_impr
  )
  SELECT jsonb_build_object(
    'rows', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'page', s.page,
          'surface_key', s.surface_key,
          'impressions', s.impressions,
          'clicks', s.clicks,
          'ctr', s.ctr,
          'avg_position', s.avg_position,
          'position_band', s.position_band,
          'business_impact_score', s.business_impact_score,
          'impact_score_version', 'v1',
          'severity', s.severity
        )
        ORDER BY s.business_impact_score DESC
      )
      FROM (SELECT * FROM scored ORDER BY business_impact_score DESC LIMIT p_limit) s),
      '[]'::jsonb
    ),
    'total_qualifying', (SELECT COUNT(*) FROM agg),
    'data_from', (SELECT data_from FROM coverage_dim),
    'data_to', (SELECT data_to FROM coverage_dim),
    'last_data_date', (
      SELECT MAX(date) FROM __seo_gsc_daily_pages, bounds
      WHERE date >= bounds.from_d AND date < bounds.to_d
    ),
    'impact_score_version', 'v1',
    'coverage_ratio', (
      SELECT CASE WHEN prop_impr > 0
        THEN ROUND((pages_impr::NUMERIC / prop_impr), 4)::FLOAT8
        ELSE NULL END FROM cov
    ),
    'coverage_status', (
      SELECT CASE
        WHEN prop_impr <= 0 THEN 'insufficient_data'
        WHEN (pages_impr::NUMERIC / prop_impr) < p_coverage_min_ratio THEN 'coverage_gap'
        ELSE 'ok' END FROM cov
    )
  );
$function$;

-- --- Données legacy (état actuel : lignes sans marqueur de commit) --------------
INSERT INTO public.__seo_gsc_daily_property_total (date, clicks, impressions, ctr, position)
SELECT d::date, 80, 5500, 0.0145, 11.2
FROM generate_series(DATE '2026-08-20', DATE '2026-08-31', INTERVAL '1 day') d;
INSERT INTO public.__seo_gsc_daily_pages (date, page, country, device, clicks, impressions, ctr, position)
SELECT d::date, 'https://www.automecanik.com/pieces/filtre-a-huile-7.html', 'fra', 'mobile', 0, 400, 0, 6
FROM generate_series(DATE '2026-08-20', DATE '2026-08-31', INTERVAL '1 day') d;
