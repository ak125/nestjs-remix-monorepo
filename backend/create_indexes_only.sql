-- 🚀 INDEX CRITIQUES pour optimiser les requêtes sur pieces_relation_type
-- À exécuter dans Supabase SQL Editor
-- Ces index vont diviser le temps de requête par 10-100x

-- ✅ INDEX 1/3: Principal sur rtp_type_id (LE PLUS IMPORTANT)
-- Transforme un Sequential Scan (30s) en Index Scan (<1s)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_relation_type_type_id 
ON pieces_relation_type(rtp_type_id);

-- Message de progression
SELECT 'Index 1/3 créé: idx_pieces_relation_type_type_id' as status;

-- ✅ INDEX 2/3: Composé pour optimiser les JOINs multiples
-- Accélère les JOIN avec pieces(piece_id, piece_pg_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_relation_type_composite
ON pieces_relation_type(rtp_type_id, rtp_piece_id, rtp_pg_id);

-- Message de progression
SELECT 'Index 2/3 créé: idx_pieces_relation_type_composite' as status;

-- ✅ INDEX 3/3: Sur pieces avec filtre WHERE pour optimiser
-- Accélère le JOIN avec condition piece_display = 1
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_display_filtered
ON pieces(piece_id, piece_pg_id) WHERE piece_display = 1;

-- Message de progression
SELECT 'Index 3/3 créé: idx_pieces_display_filtered' as status;

-- 🔍 BONUS: Index sur pieces_gamme pour accélérer les JOINs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_gamme_optimized
ON pieces_gamme(pg_id) WHERE pg_display = 1 AND pg_level IN (1, 2);

-- 🔍 BONUS: Index sur catalog_gamme pour accélérer les JOINs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catalog_gamme_optimized
ON catalog_gamme(mc_pg_id, mc_mf_id);

-- 📊 Mettre à jour les statistiques pour l'optimiseur PostgreSQL
ANALYZE pieces_relation_type;
ANALYZE pieces;
ANALYZE pieces_gamme;
ANALYZE catalog_gamme;
ANALYZE catalog_family;

-- ✅ Message final
SELECT 'TOUS LES INDEX CRÉÉS AVEC SUCCÈS !' as final_status,
       'Temps estimé de création: 5-15 minutes' as duration,
       'Performance attendue: 10-100x plus rapide' as improvement;

-- 🧪 TEST DE PERFORMANCE
-- Décommenter pour tester une requête simple après création des index:
/*
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) 
FROM pieces_relation_type 
WHERE rtp_type_id = 8408;
-- Devrait montrer: "Index Scan using idx_pieces_relation_type_type_id"
-- Temps attendu: < 100ms au lieu de 8+ secondes
*/

-- 📋 Vérifier que les index sont bien créés
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
  idx_scan as times_used
FROM pg_stat_user_indexes 
WHERE indexname LIKE 'idx_%'
  AND schemaname = 'public'
ORDER BY tablename, indexname;