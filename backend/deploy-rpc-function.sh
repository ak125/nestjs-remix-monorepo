#!/bin/bash

# Script pour déployer la fonction RPC sur Supabase via l'API SQL

set -e

# Vérifier les variables d'environnement
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Variables d'environnement manquantes: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

echo "🚀 Déploiement de la fonction RPC optimisée..."

# Lire le fichier SQL
SQL_FILE="prisma/supabase-functions/get_gamme_page_data_optimized.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "❌ Fichier SQL non trouvé: $SQL_FILE"
  exit 1
fi

echo "📄 Fichier: $SQL_FILE"
echo "📦 Taille: $(wc -c < "$SQL_FILE") octets"
echo ""

# Extraire l'hôte du projet depuis l'URL
PROJECT_REF=$(echo "$SUPABASE_URL" | sed -E 's/https:\/\/([^.]+).*/\1/')

echo "🔍 Référence du projet: $PROJECT_REF"
echo ""

# Construire l'URL de l'API SQL
SQL_API_URL="$SUPABASE_URL/rest/v1/rpc/exec"

echo "📡 URL API: $SQL_API_URL"
echo ""

# Lire le contenu SQL et l'échapper pour JSON
SQL_CONTENT=$(cat "$SQL_FILE" | jq -Rs .)

# Créer le payload JSON
PAYLOAD="{\"query\": $SQL_CONTENT}"

echo "🚀 Envoi de la requête..."

# Exécuter via curl
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$SQL_API_URL" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

# Extraire le code HTTP (dernière ligne)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extraire le body (tout sauf la dernière ligne)  
BODY=$(echo "$RESPONSE" | sed '$d')

echo ""
echo "📊 Code HTTP: $HTTP_CODE"

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
  echo "✅ Fonction RPC déployée avec succès!"
  echo "📋 Réponse: $BODY"
else
  echo "❌ Erreur lors du déploiement"
  echo "📋 Réponse: $BODY"
  exit 1
fi
