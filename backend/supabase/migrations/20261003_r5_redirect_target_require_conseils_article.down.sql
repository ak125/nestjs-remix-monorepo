-- Rollback: 20261003_r5_redirect_target_require_conseils_article
-- Remet la définition mesurée avant la migration (pg_get_functiondef, 2026-10-03) :
-- cible conseils dès qu'une seule gamme, sans vérifier l'article __blog_advice.
-- L'engine est forward-only : ce fichier se lance à la main.

SET lock_timeout = '1s';
SET statement_timeout = '5s';

CREATE OR REPLACE FUNCTION public.get_r5_redirect_target(p_slug text)
RETURNS TABLE(redirect_to text, pg_alias text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
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
