-- ============================================================================
-- Script d'optimisation: Indexes pour réduire les 19.6s de requêtes parallèles
-- ============================================================================
-- 
-- Problème: Promise.all() avec 7 requêtes prend 19.6s → AbortError timeout
-- Solution: Indexes composés sur colonnes filtrées et ORDER BY
-- 
-- IMPORTANT: Exécuter les commandes UNE PAR UNE dans l'éditeur SQL de Supabase
-- (CREATE INDEX CONCURRENTLY ne fonctionne pas dans un bloc de transaction)
-- ============================================================================

-- ============================================================================
-- 1. __cross_gamme_car_new (66 rows, filtre cgc_pg_id + level + ORDER BY)
-- ============================================================================
-- Requête actuelle: .select('*').eq('cgc_pg_id', pgId).eq('cgc_level', 0).order('cgc_id')
-- Colonnes: cgc_id, cgc_pg_id, cgc_level, cgc_type_id, cgc_modele_id, cgc_marque_id
-- Bénéfice estimé: Réduction de 50-70% du temps de cette requête

CREATE INDEX IF NOT EXISTS idx_cross_gamme_car_pg_level_id 
  ON public.__cross_gamme_car_new (cgc_pg_id, cgc_level, cgc_id);


-- ============================================================================
-- 2. __seo_gamme_conseil (filtre sgc_pg_id + ORDER BY sgc_id)
-- ============================================================================
-- Requête actuelle: .select('*').eq('sgc_pg_id', pgId).order('sgc_id')
-- Colonnes: sgc_id, sgc_pg_id, sgc_title, sgc_contenu, ...
-- Bénéfice estimé: Réduction de 40-60% du temps de cette requête

CREATE INDEX IF NOT EXISTS idx_seo_gamme_conseil_pg_id 
  ON public.__seo_gamme_conseil (sgc_pg_id, sgc_id);


-- ============================================================================
-- 3. __seo_gamme_info (filtre sgi_pg_id + ORDER BY sgi_id)
-- ============================================================================
-- Requête actuelle: .select('*').eq('sgi_pg_id', pgId).order('sgi_id')
-- Colonnes: sgi_id, sgi_pg_id, sgi_title, sgi_content, ...
-- Bénéfice estimé: Réduction de 40-60% du temps de cette requête

CREATE INDEX IF NOT EXISTS idx_seo_gamme_info_pg_id 
  ON public.__seo_gamme_info (sgi_pg_id, sgi_id);


-- ============================================================================
-- 4. __seo_equip_gamme (filtre seg_pg_id + ORDER BY seg_id + LIMIT 4)
-- ============================================================================
-- Requête actuelle: .select('*').eq('seg_pg_id', pgId).order('seg_id').limit(4)
-- Colonnes: seg_id, seg_pg_id, seg_title, seg_content, ...
-- Bénéfice estimé: Réduction de 50-70% du temps de cette requête (LIMIT bénéficie le plus)

CREATE INDEX IF NOT EXISTS idx_seo_equip_gamme_pg_id 
  ON public.__seo_equip_gamme (seg_pg_id, seg_id);


-- ============================================================================
-- 5. __blog_advice (filtre ba_pg_id)
-- ============================================================================
-- Requête actuelle: .select('*').eq('ba_pg_id', pgId)
-- Colonnes: ba_id, ba_pg_id, ba_title, ba_descrip, ba_content, ...
-- Bénéfice estimé: Réduction de 30-50% du temps de cette requête

CREATE INDEX IF NOT EXISTS idx_blog_advice_pg_id 
  ON public.__blog_advice (ba_pg_id);


-- ============================================================================
-- 6. catalog_gamme (filtre mc_pg_id - déjà optimisé probablement)
-- ============================================================================
-- Requête actuelle: .select('*').eq('mc_pg_id', pgId).limit(1)
-- Colonnes: mc_id, mc_pg_id, mc_name, mc_mf_prime, mc_description, ...
-- Note: LIMIT 1 indique requête rapide, probablement déjà indexé

CREATE INDEX IF NOT EXISTS idx_catalog_gamme_pg_id 
  ON public.catalog_gamme (mc_pg_id);


-- ============================================================================
-- 7. __seo_gamme (filtre sg_pg_id)
-- ============================================================================
-- Requête actuelle: .select('*').eq('sg_pg_id', pgId).limit(1)
-- Colonnes: sg_id, sg_pg_id, sg_title, sg_description, sg_image, ...
-- Note: LIMIT 1 indique requête rapide, probablement déjà indexé

CREATE INDEX IF NOT EXISTS idx_seo_gamme_pg_id 
  ON public.__seo_gamme (sg_pg_id);


-- ============================================================================
-- VÉRIFICATION POST-CRÉATION
-- ============================================================================
-- Vérifier tous les indexes créés:
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN (
    '__cross_gamme_car_new',
    '__seo_gamme_conseil', 
    '__seo_gamme_info',
    '__seo_equip_gamme',
    '__blog_advice',
    'catalog_gamme',
    '__seo_gamme'
)
ORDER BY tablename, indexname;


-- ============================================================================
-- ANALYSE DES PERFORMANCES (après création)
-- ============================================================================
-- Analyser les statistiques des nouvelles tables:
ANALYZE public.__cross_gamme_car_new;
ANALYZE public.__seo_gamme_conseil;
ANALYZE public.__seo_gamme_info;
ANALYZE public.__seo_equip_gamme;
ANALYZE public.__blog_advice;
ANALYZE public.catalog_gamme;
ANALYZE public.__seo_gamme;


-- ============================================================================
-- RÉSULTAT ATTENDU
-- ============================================================================
-- Avant: Promise.all() 19.6s → AbortError timeout
-- Après: Promise.all() estimé < 1s (réduction 90-95%)
-- 
-- Métriques à surveiller:
-- - ⚡ Requêtes parallèles: devrait passer de 19675ms à <1000ms
-- - Total temps réponse: devrait rester ~700-800ms
-- - 17 motorisations: toujours affiché (pas de régression)
-- ============================================================================

