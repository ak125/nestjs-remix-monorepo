-- 🚀 INDEX CRITIQUES pour optimiser les requêtes sur pieces_relation_type
-- À exécuter dans Supabase SQL Editor
-- IMPORTANT: Exécuter chaque commande CREATE INDEX une par une (pas en bloc)

-- ✅ INDEX 1/4: Principal sur rtp_type_id (LE PLUS IMPORTANT)
-- Transforme un Sequential Scan (30s) en Index Scan (<1s)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_relation_type_type_id 
ON pieces_relation_type(rtp_type_id);

-- ⏳ Attendez la fin de cette commande avant de passer à la suivante
-- Temps estimé: 3-8 minutes selon la taille des données

-- ✅ INDEX 2/4: Composé pour optimiser les JOINs multiples  
-- Exécuter SÉPARÉMENT après que l'index 1 soit fini
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_relation_type_composite
ON pieces_relation_type(rtp_type_id, rtp_piece_id, rtp_pg_id);

-- ⏳ Attendez la fin avant de continuer

-- ✅ INDEX 3/4: Sur pieces avec filtre WHERE
-- Exécuter SÉPARÉMENT
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_display_filtered
ON pieces(piece_id, piece_pg_id) WHERE piece_display = 1;

-- ✅ INDEX 4/4: Sur pieces_gamme pour accélérer les JOINs
-- Exécuter SÉPARÉMENT  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_gamme_optimized
ON pieces_gamme(pg_id) WHERE pg_display = 1 AND pg_level IN (1, 2);

-- 📊 APRÈS que TOUS les index sont créés, mettre à jour les statistiques
-- Exécuter ce bloc EN DERNIER
ANALYZE pieces_relation_type;
ANALYZE pieces;
ANALYZE pieces_gamme;
ANALYZE catalog_gamme;
ANALYZE catalog_family;

-- 🧪 TEST DE PERFORMANCE (à exécuter après TOUS les index)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) 
FROM pieces_relation_type 
WHERE rtp_type_id = 8408;

-- 📋 Vérifier que les index sont bien créés
SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes 
WHERE indexname LIKE 'idx_pieces_%'
  AND schemaname = 'public'
ORDER BY tablename, indexname;