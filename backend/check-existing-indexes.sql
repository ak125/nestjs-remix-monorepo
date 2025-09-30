-- 🔍 VÉRIFIER LES INDEX EXISTANTS sur pieces_relation_type

-- Liste TOUS les index sur la table
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'pieces_relation_type'
ORDER BY indexname;

-- Statistiques d'utilisation des index
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as "Utilisations",
  idx_tup_read as "Lignes lues",
  idx_tup_fetch as "Lignes récupérées"
FROM pg_stat_user_indexes 
WHERE tablename = 'pieces_relation_type'
ORDER BY idx_scan DESC;

-- Tester la requête problématique avec EXPLAIN
EXPLAIN ANALYZE 
SELECT rtp_pg_id, rtp_piece_id, rtp_pm_id 
FROM pieces_relation_type 
WHERE rtp_type_id = 59247
LIMIT 10000;
