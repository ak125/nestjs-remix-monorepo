#!/bin/bash
set -e

echo "🚀 Déploiement de la fonction RPC get_gamme_page_data_optimized via psql..."

# Lire les variables d'environnement
source .env

# Construire l'URL de connexion PostgreSQL
DB_URL="postgresql://postgres.cxpojprgwgubzjyqzmoq:${SUPABASE_DB_PASSWORD}@${SUPABASE_DB_HOST}:6543/postgres"

# Chemin du fichier SQL
SQL_FILE="prisma/supabase-functions/DROP_AND_CREATE_get_gamme_page_data_optimized.sql"

echo "📄 Exécution de: $SQL_FILE"
echo "🔗 Sur: $SUPABASE_DB_HOST"

# Exécuter le SQL via psql
PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h "${SUPABASE_DB_HOST}" \
  -p 6543 \
  -U "postgres.cxpojprgwgubzjyqzmoq" \
  -d "postgres" \
  -f "$SQL_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Fonction déployée avec succès!"
  echo ""
  echo "🧪 Test de la fonction..."
  sleep 2
  curl -s http://localhost:3000/api/gamme-rest-optimized/10/page-data-rpc-v2 | jq -c 'if .error then {error, message} else {success: true, has_data: (.data != null)} end'
else
  echo "❌ Erreur lors du déploiement"
  exit 1
fi
