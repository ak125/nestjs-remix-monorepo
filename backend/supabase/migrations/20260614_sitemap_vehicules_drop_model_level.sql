-- =============================================================================
-- Migration : __sitemap_vehicules — retrait du niveau-modèle (URLs 2-segments)
-- Date      : 2026-06-14
-- Scope     : ADR-084 — suppression du niveau-modèle /constructeurs (HTTP 410 Gone)
-- Risque    : Bas (CREATE OR REPLACE VIEW — aucun lock data, réversible via .down.sql)
-- =============================================================================
--
-- Contexte
-- --------
-- Le niveau-modèle 2-segments (/constructeurs/{marque}-{id}/{modele}-{id}.html,
-- 973 URLs) est supprimé (HTTP 410 Gone — décision owner 2026-06-14, ADR-084).
-- Cette vue alimente sitemap-vehicules.xml (sitemap-v10-static.service.ts). On
-- retire la branche UNION ALL niveau-2 (FROM __sitemap_motorisation) pour ne plus
-- soumettre ces 973 URLs à Google ; le niveau-1 (marque, R7) est conservé.
-- Le niveau-3 (véhicule, R8) vient d'un autre canal (__sitemap_p_link) — intact.
--
-- Dépendances  : 0 objet DB dépendant (pg_depend, vérifié 2026-06-14).
-- Consommateur : sitemap-v10-static.service.ts (colonne `url`). Signature de
--                colonnes (niveau, url, priority, changefreq) INCHANGÉE.
-- Sécurité     : security_invoker=true + REVOKE anon/authenticated RÉ-ASSERTÉS
--                (cf. 20260422_views_invoker_special_cases.sql — ne pas régresser).
--
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
   FROM __sitemap_marque;

REVOKE ALL ON public.__sitemap_vehicules FROM anon, authenticated;

COMMENT ON VIEW public.__sitemap_vehicules IS
  'Sitemap véhicules — niveau-1 marque uniquement. Niveau-2 modèle (URLs 2-seg) retiré (ADR-084, 410 Gone). Niveau-3 véhicule via __sitemap_p_link.';

-- =============================================================================
-- Post-migration verification (à exécuter après application) :
--   SELECT niveau, count(*) FROM public.__sitemap_vehicules GROUP BY niveau;
--   -- attendu : niveau 1 = 35 (marques), AUCUNE ligne niveau 2.
--   SELECT grantee FROM information_schema.role_table_grants
--    WHERE table_name = '__sitemap_vehicules' AND grantee IN ('anon','authenticated');
--   -- attendu : 0 ligne (REVOKE préservé).
-- Puis régénérer le sitemap et vérifier sitemap-vehicules.xml (0 URL 2-seg) AVANT tag PROD.
-- =============================================================================
