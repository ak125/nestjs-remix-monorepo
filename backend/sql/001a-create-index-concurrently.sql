-- ========================================
-- PHASE 1: INDEX COMPOSITE (VERSION CONCURRENTLY)
-- ========================================
-- ⚠️ EXÉCUTER CETTE COMMANDE SEULE dans Supabase SQL Editor
-- CREATE INDEX CONCURRENTLY ne peut pas s'exécuter dans un bloc de transaction
-- ========================================

-- Créer l'index composite SANS bloquer la table
-- Durée: 5-10 minutes
-- Avantage: Production continue pendant la création
CREATE INDEX CONCURRENTLY idx_pieces_relation_type_vehicle 
ON pieces_relation_type (rtp_type_id, rtp_pg_id);

-- ========================================
-- VÉRIFICATION (exécuter APRÈS la création de l'index)
-- ========================================

-- Vérifier la création de l'index
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_indexes 
JOIN pg_class ON pg_indexes.indexname = pg_class.relname
WHERE tablename = 'pieces_relation_type'
AND indexname = 'idx_pieces_relation_type_vehicle';

-- Test de performance
EXPLAIN ANALYZE
SELECT DISTINCT rtp_pg_id 
FROM pieces_relation_type
WHERE rtp_type_id = 30764
LIMIT 50000;
