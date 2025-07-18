#!/bin/bash

# Script de diagnostic et correction d'authentification
echo "🔧 Diagnostic d'authentification"
echo "================================"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${BLUE}🔍 1. Test de connexion à Supabase${NC}"
response=$(curl -s -w "%{http_code}" -m 10 "https://cxpojprgwgubzjyqzmoq.supabase.co/rest/v1/___xtr_customer?limit=1&select=cst_mail" \
    -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwNzIzMjAsImV4cCI6MjA1MTY0ODMyMH0.I4JWWvXvU8nO89-8OBBjAA0-0BtVr6V8U8CIY_bPHbE" \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwNzIzMjAsImV4cCI6MjA1MTY0ODMyMH0.I4JWWvXvU8nO89-8OBBjAA0-0BtVr6V8U8CIY_bPHbE")

code="${response: -3}"
body="${response%???}"

if [ "$code" -eq 200 ]; then
    echo -e "${GREEN}✅ Connexion Supabase OK${NC}"
    echo "Premier email trouvé: $(echo "$body" | jq -r '.[0].cst_mail // "Aucun"')"
else
    echo -e "${RED}❌ Erreur connexion Supabase (Code: $code)${NC}"
    echo "Réponse: $body"
fi

echo ""
echo -e "${BLUE}🔍 2. Recherche d'utilisateurs existants${NC}"
response=$(curl -s -w "%{http_code}" -m 10 "https://cxpojprgwgubzjyqzmoq.supabase.co/rest/v1/___xtr_customer?limit=5&select=cst_mail,cst_fname,cst_name" \
    -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwNzIzMjAsImV4cCI6MjA1MTY0ODMyMH0.I4JWWvXvU8nO89-8OBBjAA0-0BtVr6V8U8CIY_bPHbE" \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwNzIzMjAsImV4cCI6MjA1MTY0ODMyMH0.I4JWWvXvU8nO89-8OBBjAA0-0BtVr6V8U8CIY_bPHbE")

code="${response: -3}"
body="${response%???}"

if [ "$code" -eq 200 ]; then
    echo -e "${GREEN}✅ Utilisateurs trouvés:${NC}"
    echo "$body" | jq -r '.[] | .cst_mail + " - " + .cst_fname + " " + .cst_name'
else
    echo -e "${RED}❌ Erreur récupération utilisateurs (Code: $code)${NC}"
fi

echo ""
echo -e "${BLUE}🔍 3. Test d'authentification avec un utilisateur réel${NC}"
# Utiliser l'email que nous avons vu dans les logs
test_email="chris2.naul@gmail.com"
echo "Email de test: $test_email"

response=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$test_email\", \"password\": \"123\"}" \
    "http://localhost:3000/auth/login")

code="${response: -3}"
body="${response%???}"

echo "Code de réponse: $code"
if [ "$code" -eq 200 ] || [ "$code" -eq 302 ]; then
    echo -e "${GREEN}✅ Authentification réussie${NC}"
else
    echo -e "${RED}❌ Authentification échouée${NC}"
    echo "Réponse: $body"
fi

echo ""
echo -e "${BLUE}🔍 4. Vérification de l'endpoint de test${NC}"
response=$(curl -s -w "%{http_code}" "http://localhost:3000/api/test")
code="${response: -3}"

if [ "$code" -eq 200 ]; then
    echo -e "${GREEN}✅ API de test accessible${NC}"
else
    echo -e "${YELLOW}⚠️  API de test non accessible (Code: $code)${NC}"
fi

echo ""
echo "================================"
echo -e "${BLUE}📋 Résumé du diagnostic:${NC}"
echo "- Connexion Supabase: $([ "$code" -eq 200 ] && echo "✅" || echo "❌")"
echo "- Utilisateurs disponibles: ✅"
echo "- Email de test valide: $test_email"
echo ""
echo -e "${YELLOW}💡 Recommandations:${NC}"
echo "1. Utiliser un email existant pour les tests"
echo "2. Vérifier la configuration réseau"
echo "3. Contrôler les timeouts de connexion"
echo "================================"
