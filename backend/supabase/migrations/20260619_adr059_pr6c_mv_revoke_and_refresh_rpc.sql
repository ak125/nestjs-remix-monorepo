-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ADR-059 PR-6c — SEO projection : lock-down anon des MV + RPC refresh gouvernée
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Canon : ADR-059 (accepted) + ADR-090 §C4 (forward-writer). Suite de la migration
--   20260619_adr059_pr6_seo_projection_schema.sql (7 tables + 2 MV créées, write-side).
--
-- CE FICHIER (PR-6c) fait deux choses :
--   1. REVOKE anon/authenticated sur les 2 MV — corrige le finding advisor
--      `materialized_view_in_api` (les default-privileges Supabase exposent les MV
--      publiques neuves à anon, ce qui CONTREDIT l'invariant « aucun accès anon direct »
--      de la PR-6 ; lecture = via RPC SECURITY DEFINER en PR-7, jamais SELECT direct table/MV).
--      Pattern canon = `REVOKE ALL ON <matview> FROM anon, authenticated`
--      (cf. 20260422_views_invoker_gamme_kw_r5.sql §B — les matviews ne supportent pas
--      security_invoker, REVOKE est la seule défense ; le SELECT sur MV = lecture table normale).
--   2. CREATE FUNCTION refresh_seo_projection_mvs() (SECURITY DEFINER, service_role only) —
--      appelée par le worker refresh (SeoProjectionRefreshProcessor → writer.refreshViews()
--      via callRpc gouverné). Branche le no-op stub de PR-6b.
--
-- Pourquoi REFRESH NON-CONCURRENT (et pas CONCURRENTLY) :
--   - `REFRESH MATERIALIZED VIEW CONCURRENTLY` est INTERDIT dans une transaction / depuis une
--     fonction plpgsql, et PostgREST exécute tout appel RPC DANS une transaction → un
--     refresh CONCURRENTLY via .rpc() échouerait ("cannot be executed from a function").
--   - CONCURRENTLY exige aussi que la MV ait déjà été peuplée au moins une fois ; or les 2 MV
--     sont créées `WITH NO DATA` (jamais peuplées) → le 1er CONCURRENTLY échouerait de toute façon.
--   - Le REFRESH non-concurrent prend un lock ACCESS EXCLUSIVE bref ; acceptable ici car le
--     read-path est DARK (flag seo_projection_read_v1 OFF, RPC read = PR-7) et les MV sont petites.
--   - Les index UNIQUE posés en PR-6 restent valides : ils permettront de basculer en CONCURRENTLY
--     plus tard via un worker à connexion directe (hors PostgREST) si le besoin de zéro-lock apparaît.
--
-- Risque : BAS — REVOKE idempotent (no-op si déjà révoqué), CREATE OR REPLACE idempotent.
--   Réversible (rollback en pied). NON auto-appliquée (deployment.md axe 4) : revue owner + apply manuel.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Transaction gérée par l'outil de migration (assume_in_transaction=true, .squawk.toml).
-- Timeouts requis (require-timeout-settings) :
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Lock-down anon/authenticated sur les MV (finding materialized_view_in_api)║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
REVOKE ALL ON public.mv_seo_entity_facts_current   FROM anon, authenticated;
REVOKE ALL ON public.mv_seo_content_blocks_current FROM anon, authenticated;

COMMENT ON MATERIALIZED VIEW public.mv_seo_entity_facts_current IS
  'ADR-059 PR-6c : snapshot facts courants. SELECT anon/authenticated REVOQUÉ 2026-06-19 (read-path = RPC PR-7). Refresh via refresh_seo_projection_mvs().';
COMMENT ON MATERIALIZED VIEW public.mv_seo_content_blocks_current IS
  'ADR-059 PR-6c : snapshot blocks rôle-aware courants. SELECT anon/authenticated REVOQUÉ 2026-06-19. Refresh via refresh_seo_projection_mvs().';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. RPC refresh gouvernée (SECURITY DEFINER, service_role only)              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE OR REPLACE FUNCTION public.refresh_seo_projection_mvs()
RETURNS TABLE(view_name text, refreshed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
BEGIN
  -- REFRESH non-concurrent (cf. en-tête) : légal dans la transaction PostgREST + sur MV WITH NO DATA.
  REFRESH MATERIALIZED VIEW public.mv_seo_entity_facts_current;
  view_name := 'mv_seo_entity_facts_current';
  refreshed := true;
  RETURN NEXT;

  REFRESH MATERIALIZED VIEW public.mv_seo_content_blocks_current;
  view_name := 'mv_seo_content_blocks_current';
  refreshed := true;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.refresh_seo_projection_mvs() IS
  'ADR-059/090 PR-6c — Refresh les 2 MV de projection SEO (facts + blocks). SECURITY DEFINER, service_role only. Appelée par SeoProjectionRefreshProcessor via callRpc gouverné (source=internal). REFRESH non-concurrent (PostgREST tx).';

-- EXECUTE : verrouiller. CREATE FUNCTION grant EXECUTE à PUBLIC, ET les default-privileges
-- Supabase grant EXECUTE à anon/authenticated/service_role sur toute fonction public neuve.
-- → REVOKE FROM PUBLIC ne suffit PAS (les grants anon/authenticated sont explicites) : il faut
-- les révoquer nominativement, sinon anon pourrait déclencher ce refresh SECURITY DEFINER via PostgREST.
REVOKE ALL ON FUNCTION public.refresh_seo_projection_mvs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_seo_projection_mvs() TO service_role;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ROLLBACK (down) — réversible (aucune donnée applicative touchée).
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN;
--   DROP FUNCTION IF EXISTS public.refresh_seo_projection_mvs();
--   -- Restaurer l'exposition anon n'est PAS souhaitable (c'était un défaut) → pas de re-GRANT.
-- COMMIT;
