#!/bin/bash

# Script pour dÃ©ployer la fonction RPC sur Supabase via l'API SQL

set -e

# VÃ©rifier les variables d'environnement
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "âŒ Variables d'environnement manquantes: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

echo "ðŸš€ DÃ©ploiement de la fonction RPC optimisÃ©e..."

# Lire le fichier SQL
SQL_FILE="prisma/supabase-functions/get_gamme_page_data_optimized.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "âŒ Fichier SQL non trouvÃ©: $SQL_FILE"
  exit 1
fi

echo "ðŸ“„ Fichier: $SQL_FILE"
echo "ðŸ“¦ Taille: $(wc -c < "$SQL_FILE") octets"
echo ""

# Extraire l'hÃ´te du projet depuis l'URL
PROJECT_REF=$(echo "$SUPABASE_URL" | sed -E 's/https:\/\/([^.]+).*/\1/')

echo "ðŸ” RÃ©fÃ©rence du projet: $PROJECT_REF"
echo ""

# Construire l'URL de l'API SQL
SQL_API_URL="$SUPABASE_URL/rest/v1/rpc/exec"

echo "ðŸ“¡ URL API: $SQL_API_URL"
echo ""

# Lire le contenu SQL et l'Ã©chapper pour JSON
SQL_CONTENT=$(cat "$SQL_FILE" | jq -Rs .)

# CrÃ©er le payload JSON
PAYLOAD="{\"query\": $SQL_CONTENT}"

echo "ðŸš€ Envoi de la requÃªte..."

# ExÃ©cuter via curl
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$SQL_API_URL" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

# Extraire le code HTTP (derniÃ¨re ligne)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extraire le body (tout sauf la derniÃ¨re ligne)  
BODY=$(echo "$RESPONSE" | sed '$d')

echo ""
echo "ðŸ“Š Code HTTP: $HTTP_CODE"

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
  echo "âœ… Fonction RPC dÃ©ployÃ©e avec succÃ¨s!"
  echo "ðŸ“‹ RÃ©ponse: $BODY"
else
  echo "âŒ Erreur lors du dÃ©ploiement"
  echo "ðŸ“‹ RÃ©ponse: $BODY"
  exit 1
fi
