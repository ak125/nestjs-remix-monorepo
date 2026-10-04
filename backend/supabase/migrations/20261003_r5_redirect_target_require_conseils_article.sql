-- ============================================================================
-- 20261003_r5_redirect_target_require_conseils_article.sql
-- ============================================================================
-- Contexte (audit outil diagnostic PROD 2026-10-03) :
--
-- get_r5_redirect_target envoie une sous-page R5 retirée (ADR-027) vers
-- /blog-pieces-auto/conseils/<alias> dès que l'observable a UNE gamme, sans
-- vérifier que la page conseils de cette gamme existe. La page conseils
-- n'existe que si la gamme a une ligne __blog_advice (même critère que
-- BlogArticleDataService.getArticleByGamme → 404 R3 sinon). Résultat mesuré
-- en PROD : 6 slugs publiés (bruit-/vibration- × injecteur, turbo,
-- volant-moteur) font 301 → 404.
--
-- Correction : même garde que R6 (R6GuideService.getRedirectTarget, ADR-103 —
-- « jamais de redirect-vers-404 ») : la cible conseils n'est retenue que si
-- la gamme a un article __blog_advice ; sinon repli hub /diagnostic-auto, la
-- branche « sans cible » déjà prévue par ADR-027. Dès qu'un article conseils
-- naît pour la gamme, la 301 vers conseils s'applique seule.
--
-- Effet mesuré avant migration (lecture seule, 2026-10-03) :
--   publiés     : 24 → 6 changent (conseils 404 → hub), 18 inchangés
--   non publiés : 1152 → 809 changent (conseils 404 → hub), 343 inchangés
--   aucune cible conseils VALIDE n'est retirée (le EXISTS ne retire que
--   les gammes à 0 article).
--
-- Corps, signature, STABLE, search_path épinglé (20260616_vague5) conservés ;
-- CREATE OR REPLACE conserve propriétaire et droits EXECUTE.
-- ba_pg_id est text, pg_id integer → cast explicite.
-- Rollback (manuel, forward-only) : .down.sql voisin.
-- ============================================================================

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
      WHEN array_length(so.related_gammes, 1) = 1
        AND pg.pg_alias IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM __blog_advice ba WHERE ba.ba_pg_id = pg.pg_id::text
        ) THEN
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
