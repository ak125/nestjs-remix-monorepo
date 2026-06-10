-- ============================================================================
-- 20260610_fix_r5_redirect_target_align_reference_rpcs.sql
-- ============================================================================
-- Contexte (audit 2026-06-10, PR fix/r4-reference-list-rpc-gate) :
--
-- 1. get_r5_redirect_target (créée en Studio, jamais backportée au repo)
--    construisait une cible 404 : '/blog-pieces-auto/conseil-' || pg_alias
--    (route inexistante — la route R3 réelle est /blog-pieces-auto/conseils/).
--    Le bug n'a jamais été observé en PROD car le RPC était simultanément
--    bloqué par le RPC Gate (absent de rpc_allowlist.json) — deux bugs
--    empilés qui se masquaient. Corrigé ici + durci (pg_alias NULL → hub).
--
-- 2. get_all_seo_references : la version repo (20260125_create_seo_reference.sql)
--    référence une table inexistante `__products_gammes` (pg_label/pg_slug) ;
--    la version déployée a été corrigée en Studio (pieces_gamme, pg_name/pg_alias)
--    sans backport. Ce fichier aligne le repo sur la définition déployée
--    (idempotent — CREATE OR REPLACE de la même définition).
--
-- 3. GRANT EXECUTE explicites : la recréation Studio a perdu le grant anon de
--    get_all_seo_references (by_slug l'a, getAll non) — nécessaire pour le mode
--    PREPROD READ_ONLY anon (ADR-028 Option D). Idempotents.
--
-- Rollback : les définitions antérieures sont dans l'historique de cette PR
-- (pg_get_functiondef capturé) ; REVOKE EXECUTE pour annuler les grants.
-- ============================================================================

SET lock_timeout = '1s';
SET statement_timeout = '5s';

-- 1. Cible de redirection R5 → R3 corrigée (consolidation R5)
CREATE OR REPLACE FUNCTION public.get_r5_redirect_target(p_slug text)
RETURNS TABLE(redirect_to text, pg_alias text)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    CASE
      WHEN array_length(so.related_gammes, 1) = 1 AND pg.pg_alias IS NOT NULL THEN
        '/blog-pieces-auto/conseils/' || pg.pg_alias || '#diagnostic-rapide'
      ELSE
        '/diagnostic-auto'
    END AS redirect_to,
    pg.pg_alias
  FROM __seo_observable so
  LEFT JOIN pieces_gamme pg ON pg.pg_id = so.related_gammes[1]
  WHERE so.slug = p_slug
  LIMIT 1;
$function$;

-- 2. Alignement repo ↔ DB : définition déployée de get_all_seo_references
--    (remplace la version repo cassée qui joignait __products_gammes, table inexistante)
CREATE OR REPLACE FUNCTION public.get_all_seo_references()
RETURNS TABLE(id integer, slug character varying, title character varying, meta_description character varying, definition text, pg_id integer, gamme_name character varying, gamme_slug character varying)
LANGUAGE sql
STABLE
AS $function$
  SELECT
    r.id,
    r.slug,
    r.title,
    r.meta_description,
    LEFT(r.definition, 300) as definition,
    r.pg_id,
    g.pg_name as gamme_name,
    g.pg_alias as gamme_slug
  FROM __seo_reference r
  LEFT JOIN pieces_gamme g ON g.pg_id = r.pg_id
  WHERE r.is_published = true
  ORDER BY r.title ASC;
$function$;

-- 3. Grants explicites (parité avec get_seo_reference_by_slug ; PREPROD anon)
GRANT EXECUTE ON FUNCTION public.get_all_seo_references() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_r5_redirect_target(text) TO anon, authenticated, service_role;
