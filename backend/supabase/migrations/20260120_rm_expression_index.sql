-- =====================================================
-- MIGRATION: Index Expression pour RM API Performance
-- =====================================================
-- Objectif: Réduire cache MISS de 3s à <500ms
-- Cause: NULLIF(pri_piece_id, '')::INTEGER empêche l'utilisation de l'index TEXT
-- Solution: Créer un index expression qui matche le pattern exact de la RPC
--
-- Date: 2026-01-20
-- =====================================================

-- Index expression sur le casting INTEGER
-- Matche exactement: WHERE NULLIF(pri_piece_id, '')::INTEGER IN (...)
-- Partiel: seulement les lignes avec stock disponible
CREATE INDEX IF NOT EXISTS idx_pieces_price_piece_id_int_expr
ON pieces_price ((NULLIF(pri_piece_id, '')::INTEGER))
WHERE pri_dispo IN ('1', '2', '3');

-- Note: Pour exécuter avec CONCURRENTLY (sans lock):
-- DROP INDEX IF EXISTS idx_pieces_price_piece_id_int_expr;
-- CREATE INDEX CONCURRENTLY idx_pieces_price_piece_id_int_expr
-- ON pieces_price ((NULLIF(pri_piece_id, '')::INTEGER))
-- WHERE pri_dispo IN ('1', '2', '3');
