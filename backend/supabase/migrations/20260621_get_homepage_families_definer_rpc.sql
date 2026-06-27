-- =====================================================
-- get_homepage_families() — fonction SECURITY DEFINER pour le menu "familles" de la home
-- Date: 2026-06-21
-- =====================================================
--
-- POURQUOI
-- Le menu "familles" de la page d'accueil (above-fold, `await` → bloque le SSR) lisait
-- catalog_family + catalog_gamme + pieces_gamme **en direct** (`.from()`). En READ_ONLY
-- (container PREPROD, ADR-028 Option D) le backend tourne en rôle `anon`, qui ne peut PAS
-- lire une table RLS en direct : le réglage base `row_security=off` fait que Postgres lève
-- `42501 query would be affected by row-level security policy` (au lieu de filtrer). La home
-- plantait donc sous anon → gate `e2e-smoke` rouge. (Les autres pages passent car elles
-- lisent le catalogue via des fonctions SECURITY DEFINER, qui bypassent la RLS.)
--
-- CORRECTIF
-- Une fonction SECURITY DEFINER (tourne en owner → RLS bypassée) qui fait ces 3 lectures et
-- renvoie EXACTEMENT la même forme JSON qu'avant ({ success, catalog: { families: [...] } }).
-- Le service `getHomepageFamilies()` appelle cette fonction au lieu des `.from()` directs.
--
-- SÛRETÉ : ne renvoie que des données publiques (taxonomie catalogue + gammes), aucune
-- écriture. EXECUTE accordé à anon/authenticated/service_role. Idempotent · réversible (DROP).
--
-- assume_in_transaction (squawk) : pas de BEGIN/COMMIT explicite. Timeouts requis
-- (squawk require-timeout-settings) avant l'opération CREATE FUNCTION.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.get_homepage_families()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'catalog', jsonb_build_object(
      'families', COALESCE(jsonb_agg(f_obj ORDER BY f_sort, f_id), '[]'::jsonb)
    )
  )
  FROM (
    SELECT
      CASE WHEN f.mf_sort ~ '^[0-9]+(\.[0-9]+)?$' THEN f.mf_sort::numeric ELSE 0 END AS f_sort,
      f.mf_id::text AS f_id,
      jsonb_build_object(
        'mf_id', f.mf_id,
        'mf_name', f.mf_name,
        'mf_pic', f.mf_pic,
        'mf_description', f.mf_description,
        'gammes', COALESCE(gg.gammes, '[]'::jsonb),
        'gammes_count', COALESCE(gg.cnt, 0)
      ) AS f_obj
    FROM catalog_family f
    LEFT JOIN LATERAL (
      SELECT
        jsonb_agg(
          jsonb_build_object('pg_id', pg.pg_id, 'pg_name', pg.pg_name, 'pg_alias', pg.pg_alias, 'pg_img', pg.pg_img)
          ORDER BY CASE WHEN cg.mc_sort ~ '^[0-9]+(\.[0-9]+)?$' THEN cg.mc_sort::numeric ELSE 0 END
        ) AS gammes,
        count(*) AS cnt
      FROM catalog_gamme cg
      JOIN pieces_gamme pg ON pg.pg_id::text = cg.mc_pg_id::text
      WHERE cg.mc_mf_prime::text = f.mf_id::text
    ) gg ON true
    WHERE f.mf_display = '1'
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION public.get_homepage_families() TO anon, authenticated, service_role;

-- ROLLBACK (manuel) :
--   DROP FUNCTION IF EXISTS public.get_homepage_families();
