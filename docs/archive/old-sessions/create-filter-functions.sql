-- Fonction SQL pour récupérer les gammes qui ont des pièces avec prix
-- Cette fonction est optimisée avec un JOIN et retourne uniquement les gammes pertinentes

CREATE OR REPLACE FUNCTION get_gammes_with_price()
RETURNS TABLE(pg_id TEXT, pg_name TEXT, pg_display TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    g.pg_id, 
    g.pg_name, 
    g.pg_display
  FROM pieces_gamme g
  INNER JOIN pieces p ON p.piece_pg_id = g.pg_id
  WHERE p.piece_price IS NOT NULL
  ORDER BY g.pg_display ASC, g.pg_name ASC
  LIMIT 10000;
END;
$$ LANGUAGE plpgsql STABLE;

-- Ajouter un commentaire pour documentation
COMMENT ON FUNCTION get_gammes_with_price() IS 
'Retourne les gammes de pièces qui ont au moins une pièce avec un prix défini. Optimisé avec JOIN et index.';


-- Fonction SQL pour récupérer les marques qui ont des pièces avec prix
-- Cette fonction est optimisée avec un JOIN et retourne uniquement les marques pertinentes

CREATE OR REPLACE FUNCTION get_brands_with_price()
RETURNS TABLE(pm_id TEXT, pm_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    m.pm_id, 
    m.pm_name
  FROM pieces_marque m
  INNER JOIN pieces p ON p.piece_marque_id = m.pm_id
  WHERE p.piece_price IS NOT NULL
  ORDER BY m.pm_name ASC
  LIMIT 10000;
END;
$$ LANGUAGE plpgsql STABLE;

-- Ajouter un commentaire pour documentation
COMMENT ON FUNCTION get_brands_with_price() IS 
'Retourne les marques de pièces qui ont au moins une pièce avec un prix défini. Optimisé avec JOIN et index.';


-- Créer des index pour optimiser les performances si nécessaire
-- (Ces index peuvent déjà exister, dans ce cas la commande échouera sans conséquence)

CREATE INDEX IF NOT EXISTS idx_pieces_price_not_null 
  ON pieces(piece_price) WHERE piece_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pieces_pg_id 
  ON pieces(piece_pg_id) WHERE piece_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pieces_marque_id 
  ON pieces(piece_marque_id) WHERE piece_price IS NOT NULL;

-- Afficher les résultats
SELECT 'Fonctions SQL créées avec succès!' AS status;
