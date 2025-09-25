-- 🧪 TEST DE PERFORMANCE : Vérifier que les index fonctionnent
-- À exécuter APRÈS l'analyse finale
-- Teste la performance d'une requête simple avec les nouveaux index

EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) 
FROM pieces_relation_type 
WHERE rtp_type_id = 8408;

-- 📋 Vérifier que les index sont bien créés et utilisés
SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes 
WHERE indexname LIKE 'idx_pieces_%'
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- ✅ Message de test
SELECT 'TEST DE PERFORMANCE TERMINÉ!' as status,
       'Vérifiez que "Index Scan" apparaît dans le plan' as instruction,
       'Temps attendu: < 100ms au lieu de 8+ secondes' as expectation;