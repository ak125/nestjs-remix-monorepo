-- =============================================================================
-- Rollback : __sitemap_vehicules — restaure la branche niveau-2 (modèles)
-- Pour     : 20260614_sitemap_vehicules_drop_model_level.sql (ADR-084)
-- =============================================================================
-- Restaure la définition d'origine (UNION ALL niveau-1 marque + niveau-2 modèle).
-- assume_in_transaction = true (.squawk.toml) → pas de BEGIN/COMMIT explicite.
-- =============================================================================

set lock_timeout = '2s';
set statement_timeout = '5s';

CREATE OR REPLACE VIEW public.__sitemap_vehicules
  WITH (security_invoker = true) AS
 SELECT 1 AS niveau,
    concat('/constructeurs/', __sitemap_marque.map_marque_alias, '-', __sitemap_marque.map_marque_id, '.html') AS url,
    0.8 AS priority,
    'monthly'::text AS changefreq
   FROM __sitemap_marque
UNION ALL
 SELECT DISTINCT ON (__sitemap_motorisation.map_marque_id, __sitemap_motorisation.map_modele_id)
    2 AS niveau,
    concat('/constructeurs/', __sitemap_motorisation.map_marque_alias, '-', __sitemap_motorisation.map_marque_id, '/', __sitemap_motorisation.map_modele_alias, '-', __sitemap_motorisation.map_modele_id, '.html') AS url,
    0.7 AS priority,
    'monthly'::text AS changefreq
   FROM __sitemap_motorisation
  ORDER BY 1, 2;

REVOKE ALL ON public.__sitemap_vehicules FROM anon, authenticated;

COMMENT ON VIEW public.__sitemap_vehicules IS NULL;
