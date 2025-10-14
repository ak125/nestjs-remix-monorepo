-- Supprimer les anciennes fonctions si elles existent
DROP FUNCTION IF EXISTS get_gammes_with_pieces();
DROP FUNCTION IF EXISTS get_brands_with_pieces();

-- Fonction PostgreSQL pour récupérer les gammes qui ont au moins une pièce ACTIVE avec PRIX
CREATE OR REPLACE FUNCTION get_gammes_with_pieces()
RETURNS TABLE(pg_id BIGINT, pg_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT g.pg_id::BIGINT, g.pg_name
  FROM pieces_gamme g
  WHERE EXISTS (
    SELECT 1 FROM pieces p 
    INNER JOIN pieces_price pp ON pp.pri_piece_id::TEXT = p.piece_id::TEXT
    WHERE p.piece_pg_id::TEXT = g.pg_id::TEXT 
    AND p.piece_display = true
  )
  ORDER BY g.pg_name ASC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_gammes_with_pieces() IS 
'Retourne toutes les gammes qui ont au moins une pièce active avec un prix (piece_display = true + pieces_price)';

-- Fonction PostgreSQL pour récupérer les marques qui ont au moins une pièce ACTIVE avec PRIX
CREATE OR REPLACE FUNCTION get_brands_with_pieces()
RETURNS TABLE(pm_id BIGINT, pm_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT m.pm_id::BIGINT, m.pm_name
  FROM pieces_marque m
  WHERE EXISTS (
    SELECT 1 FROM pieces p 
    INNER JOIN pieces_price pp ON pp.pri_piece_id::TEXT = p.piece_id::TEXT
    WHERE p.piece_pm_id::TEXT = m.pm_id::TEXT 
    AND p.piece_display = true
  )
  ORDER BY m.pm_name ASC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_brands_with_pieces() IS 
'Retourne toutes les marques qui ont au moins une pièce active avec un prix (piece_display = true + pieces_price)';

SELECT 'Fonctions RPC créées avec succès!' AS status;
