-- 🚀 INDEX 2/4 : Composé pour JOINs multiples
-- À exécuter APRÈS que l'index 1 soit terminé
-- Optimise les JOIN avec pieces(piece_id, piece_pg_id)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_relation_type_composite
ON pieces_relation_type(rtp_type_id, rtp_piece_id, rtp_pg_id);