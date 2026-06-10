-- ============================================================================
-- rpc_seo_ready_gammes — pg_ids ayant >= p_min_kw lignes de mots-clés préparés.
--
-- Signal "SEO-ready" (recherche keyword préparée) consommé par la promotion R1
-- ADDITIVE noindex→index (flag SEO_R1_KW_PROMOTE_ENABLED ; promotion seulement,
-- JAMAIS de retrait d'index : `indexable = pg_level='1' OU seoReady`).
--
-- N'utilise QUE l'EXISTENCE/comptage des kw, jamais les VALEURS : le mapping
-- keyword→gamme de __seo_keywords est contaminé (ex. pg 402 plaquette → top-kw
-- « disque de frein »), cf. mémoire seo-keywords-table-contaminated. Le seuil
-- de comptage filtre le bruit ; les valeurs ne sont jamais lues ici.
--
-- Lecture seule (STABLE) → exposable via PostgREST. Évite le cap 1000-lignes de
-- supabase-js (agrégat GROUP BY/HAVING fait côté Postgres, ~19 lignes renvoyées).
--
-- Date: 2026-06-10
-- ============================================================================

-- squawk require-timeout-settings (pré-DDL ; CREATE FUNCTION est instantané mais
-- le linter l'exige avant toute opération potentiellement lente).
SET lock_timeout = '2s';
SET statement_timeout = '60s';

CREATE OR REPLACE FUNCTION rpc_seo_ready_gammes(p_min_kw integer DEFAULT 50)
RETURNS TABLE (pg_id integer)
LANGUAGE sql
STABLE
AS $$
  SELECT k.pg_id
  FROM __seo_keywords k
  WHERE k.pg_id IS NOT NULL
  GROUP BY k.pg_id
  HAVING count(*) >= GREATEST(p_min_kw, 1);
$$;

GRANT EXECUTE ON FUNCTION rpc_seo_ready_gammes(integer)
  TO anon, authenticated, service_role;
