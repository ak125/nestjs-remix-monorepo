-- 🚀 FIX URGENT: Index PostgreSQL pour pieces_relation_type
-- Date: 30 septembre 2025
-- Problème: Requêtes timeout après 8 secondes
-- Solution: Index composite sur rtp_type_id

-- ⚡ CRÉATION DE L'INDEX (sans CONCURRENTLY pour Supabase)
CREATE INDEX IF NOT EXISTS idx_pieces_relation_type_type_id_composite
ON pieces_relation_type (rtp_type_id, rtp_pg_id)
WHERE rtp_type_id IS NOT NULL;

-- 📊 ANALYSE DE LA TABLE (mise à jour des statistiques)
ANALYZE pieces_relation_type;

-- ✅ VÉRIFICATION
-- Cette requête devrait maintenant prendre <100ms au lieu de 8+ secondes
EXPLAIN ANALYZE 
SELECT rtp_pg_id, rtp_piece_id, rtp_pm_id 
FROM pieces_relation_type 
WHERE rtp_type_id = 59247
LIMIT 10000;

-- 📈 STATISTIQUES
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as "Nombre d'utilisations",
  idx_tup_read as "Lignes lues",
  idx_tup_fetch as "Lignes récupérées"
FROM pg_stat_user_indexes 
WHERE tablename = 'pieces_relation_type'
ORDER BY idx_scan DESC;
