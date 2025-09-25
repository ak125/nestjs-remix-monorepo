-- 🚀 INDEX 3/4 : Sur pieces avec filtre WHERE
-- À exécuter APRÈS que l'index 2 soit terminé
-- Optimise le JOIN avec condition piece_display = 1

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_display_filtered
ON pieces(piece_id, piece_pg_id) WHERE piece_display = 1;