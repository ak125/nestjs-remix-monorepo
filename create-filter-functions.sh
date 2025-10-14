#!/bin/bash

# Script pour créer les fonctions SQL optimisées dans Supabase
# Ces fonctions retournent uniquement les gammes/marques avec des pièces ayant un prix

echo "🚀 Création des fonctions SQL pour les filtres de produits..."

# Fonction 1: get_gammes_with_price
cat <<'SQL' | PGPASSWORD='monia-2025-postgres!' psql -h aws-0-eu-central-1.pooler.supabase.com -p 6543 -U postgres.tyyqbgvxnlqqgjfasbpa -d postgres
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
SQL

echo "✅ Fonction get_gammes_with_price créée"

# Fonction 2: get_brands_with_price
cat <<'SQL' | PGPASSWORD='monia-2025-postgres!' psql -h aws-0-eu-central-1.pooler.supabase.com -p 6543 -U postgres.tyyqbgvxnlqqgjfasbpa -d postgres
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
SQL

echo "✅ Fonction get_brands_with_price créée"

# Créer les index pour optimisation
cat <<'SQL' | PGPASSWORD='monia-2025-postgres!' psql -h aws-0-eu-central-1.pooler.supabase.com -p 6543 -U postgres.tyyqbgvxnlqqgjfasbpa -d postgres
CREATE INDEX IF NOT EXISTS idx_pieces_price_not_null 
  ON pieces(piece_price) WHERE piece_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pieces_pg_id 
  ON pieces(piece_pg_id) WHERE piece_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pieces_marque_id 
  ON pieces(piece_marque_id) WHERE piece_price IS NOT NULL;
SQL

echo "✅ Index créés"

# Tester les fonctions
echo ""
echo "📊 Test des fonctions:"
echo ""
echo "=== Gammes avec prix ==="
PGPASSWORD='monia-2025-postgres!' psql -h aws-0-eu-central-1.pooler.supabase.com -p 6543 -U postgres.tyyqbgvxnlqqgjfasbpa -d postgres -c "SELECT COUNT(*) as total_gammes FROM get_gammes_with_price();"

echo ""
echo "=== Marques avec prix ==="
PGPASSWORD='monia-2025-postgres!' psql -h aws-0-eu-central-1.pooler.supabase.com -p 6543 -U postgres.tyyqbgvxnlqqgjfasbpa -d postgres -c "SELECT COUNT(*) as total_marques FROM get_brands_with_price();"

echo ""
echo "=== Exemples de gammes ==="
PGPASSWORD='monia-2025-postgres!' psql -h aws-0-eu-central-1.pooler.supabase.com -p 6543 -U postgres.tyyqbgvxnlqqgjfasbpa -d postgres -c "SELECT * FROM get_gammes_with_price() LIMIT 10;"

echo ""
echo "✅ Fonctions SQL créées et testées avec succès!"
