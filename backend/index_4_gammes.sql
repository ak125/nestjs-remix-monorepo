-- 🚀 INDEX 4/4 : Sur pieces_gamme pour JOINs rapides
-- À exécuter APRÈS que l'index 3 soit terminé
-- Optimise les JOIN avec pieces_gamme

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_gamme_optimized
ON pieces_gamme(pg_id) WHERE pg_display = 1 AND pg_level IN (1, 2);