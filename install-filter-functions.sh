#!/bin/bash

echo "🔧 Création des fonctions PostgreSQL pour les filtres..."

# Lire les variables d'environnement
if [ -f "backend/.env" ]; then
  export $(cat backend/.env | grep -v '^#' | xargs)
fi

# Extraire l'URL PostgreSQL de SUPABASE_URL
SUPABASE_URL="https://fvkyfrcdjhtvhkgkiknm.supabase.co"
POSTGRES_URL="postgresql://postgres.fvkyfrcdjhtvhkgkiknm:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# Exécuter le SQL avec psql
echo "📡 Connexion à la base de données..."
psql "$POSTGRES_URL" -f create-filter-rpc.sql

if [ $? -eq 0 ]; then
  echo "✅ Fonctions créées avec succès!"
else
  echo "❌ Erreur lors de la création des fonctions"
  exit 1
fi
