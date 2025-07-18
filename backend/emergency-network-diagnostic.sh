#!/bin/bash

# Script d'urgence - Diagnostic connectivité Supabase
echo "🚨 DIAGNOSTIC URGENCE - Connectivité Supabase"
echo "============================================"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

SUPABASE_URL="https://cxpojprgwgubzjyqzmoq.supabase.co"

echo -e "${BLUE}🔍 1. Test de connectivité réseau:${NC}"
echo "Ping vers Supabase..."
ping -c 3 cxpojprgwgubzjyqzmoq.supabase.co || echo -e "${RED}❌ Ping échoué${NC}"

echo ""
echo -e "${BLUE}🔍 2. Test de résolution DNS:${NC}"
nslookup cxpojprgwgubzjyqzmoq.supabase.co || echo -e "${RED}❌ DNS échoué${NC}"

echo ""
echo -e "${BLUE}🔍 3. Test de connectivité HTTP:${NC}"
response=$(curl -s -w "%{time_total}s - %{http_code}" -m 5 "$SUPABASE_URL/rest/v1/" 2>/dev/null || echo "TIMEOUT")
echo "Réponse: $response"

echo ""
echo -e "${BLUE}🔍 4. Test avec timeout court:${NC}"
response=$(curl -s -w "%{http_code}" -m 2 "$SUPABASE_URL/rest/v1/" 2>/dev/null || echo "TIMEOUT")
echo "Code de réponse: $response"

echo ""
echo -e "${BLUE}🔍 5. Test de l'API locale:${NC}"
local_response=$(curl -s -w "%{http_code}" -m 5 "http://localhost:3000/api/orders" 2>/dev/null || echo "TIMEOUT")
echo "API locale: $local_response"

echo ""
echo -e "${BLUE}🔍 6. Variables d'environnement:${NC}"
echo "NODE_ENV: ${NODE_ENV:-'non défini'}"
echo "SUPABASE_URL: ${SUPABASE_URL:-'non défini'}"
echo "SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:0:20}... (tronqué)"

echo ""
echo -e "${BLUE}🔍 7. Processus Node.js:${NC}"
ps aux | grep node | head -3

echo ""
echo "============================================"
echo -e "${YELLOW}📋 DIAGNOSTIC RÉSEAU TERMINÉ${NC}"

if [[ "$response" == *"TIMEOUT"* ]]; then
    echo -e "${RED}❌ PROBLÈME DE CONNECTIVITÉ DÉTECTÉ${NC}"
    echo ""
    echo -e "${YELLOW}💡 Solutions possibles:${NC}"
    echo "1. Vérifier la connexion internet"
    echo "2. Vérifier les firewall/proxy"
    echo "3. Redémarrer le service"
    echo "4. Utiliser un endpoint de fallback"
    echo ""
    echo -e "${BLUE}🔧 Redémarrage recommandé du service...${NC}"
else
    echo -e "${GREEN}✅ Connectivité OK${NC}"
fi
echo "============================================"
