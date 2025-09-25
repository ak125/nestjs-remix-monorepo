-- 🚀 INDEX 1/4 : Principal sur rtp_type_id (LE PLUS IMPORTANT)
-- À exécuter SEUL dans Supabase SQL Editor
-- Transforme un Sequential Scan (30s) en Index Scan (<1s)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_relation_type_type_id 
ON pieces_relation_type(rtp_type_id);