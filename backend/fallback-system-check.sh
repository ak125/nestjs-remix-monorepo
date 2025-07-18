#!/bin/bash

# Script de fallback - Test en mode local sans Supabase
echo "🔄 MODE FALLBACK - Test sans Supabase"
echo "===================================="

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${BLUE}🔍 1. Test du serveur Node.js:${NC}"
if pgrep -f "node.*main.js" > /dev/null; then
    echo -e "${GREEN}✅ Serveur Node.js en cours d'exécution${NC}"
else
    echo -e "${RED}❌ Serveur Node.js non trouvé${NC}"
    echo -e "${YELLOW}💡 Redémarrage nécessaire...${NC}"
fi

echo ""
echo -e "${BLUE}🔍 2. Test de l'API locale (sans Supabase):${NC}"
# Test très simple sans base de données
response=$(curl -s -w "%{http_code}" -m 3 "http://localhost:3000/" 2>/dev/null || echo "TIMEOUT")
echo "Page d'accueil: $response"

# Test d'un endpoint qui ne devrait pas dépendre de Supabase
response=$(curl -s -w "%{http_code}" -m 3 "http://localhost:3000/api/health" 2>/dev/null || echo "TIMEOUT")
echo "Health check: $response"

echo ""
echo -e "${BLUE}🔍 3. Test des ports:${NC}"
echo "Port 3000 (Node.js):"
netstat -tuln | grep :3000 || echo "Port 3000 non ouvert"

echo ""
echo -e "${BLUE}🔍 4. Processus actifs:${NC}"
echo "Processus Node.js actifs:"
ps aux | grep -E "(node|nest)" | grep -v grep | head -3

echo ""
echo -e "${BLUE}🔍 5. Mémoire disponible:${NC}"
free -h | head -2

echo ""
echo -e "${BLUE}🔍 6. Espace disque:${NC}"
df -h | head -2

echo ""
echo "===================================="
echo -e "${YELLOW}📋 ÉTAT DU SYSTÈME:${NC}"

if [[ "$response" == *"TIMEOUT"* ]]; then
    echo -e "${RED}❌ PROBLÈME SYSTÈME DÉTECTÉ${NC}"
    echo ""
    echo -e "${YELLOW}💡 Actions recommandées:${NC}"
    echo "1. Redémarrer le service Node.js"
    echo "2. Vérifier les logs d'erreur"
    echo "3. Libérer la mémoire si nécessaire"
    echo "4. Relancer en mode développement"
    echo ""
    echo -e "${BLUE}🔧 Commandes pour redémarrer:${NC}"
    echo "cd /workspaces/TEMPLATE_MCP_COMPLETE/nestjs-remix-monorepo/backend"
    echo "npm run start:dev"
else
    echo -e "${GREEN}✅ Système opérationnel${NC}"
    echo -e "${YELLOW}⚠️  Problème de connectivité Supabase uniquement${NC}"
fi
echo "===================================="
