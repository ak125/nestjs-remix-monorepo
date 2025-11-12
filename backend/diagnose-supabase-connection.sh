#!/bin/bash

# 🔍 Script de diagnostic Supabase
# Teste la connectivité et la latence vers Supabase

set -e

echo "🔍 ===== DIAGNOSTIC SUPABASE ====="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SUPABASE_URL="${SUPABASE_URL:-https://cxpojprgwgubzjyqzmoq.supabase.co}"
SUPABASE_HOST=$(echo "$SUPABASE_URL" | sed -e 's|^https\?://||' -e 's|/.*||')

echo -e "${BLUE}📍 Supabase URL: ${NC}$SUPABASE_URL"
echo -e "${BLUE}📍 Supabase Host: ${NC}$SUPABASE_HOST"
echo ""

# 1. Test DNS
echo -e "${YELLOW}1. Test DNS...${NC}"
if nslookup "$SUPABASE_HOST" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ DNS résolu${NC}"
    nslookup "$SUPABASE_HOST" | grep "Address:" | tail -n1
else
    echo -e "${RED}❌ Échec résolution DNS${NC}"
    exit 1
fi
echo ""

# 2. Test Ping
echo -e "${YELLOW}2. Test Ping (5 packets)...${NC}"
if ping -c 5 "$SUPABASE_HOST" 2>&1 | tee /tmp/ping_result.txt; then
    echo -e "${GREEN}✅ Ping réussi${NC}"
    # Extraire le temps moyen
    avg_time=$(grep "avg" /tmp/ping_result.txt | awk -F'/' '{print $5}' || echo "N/A")
    echo -e "${BLUE}⏱️  Latence moyenne: ${avg_time}ms${NC}"
else
    echo -e "${YELLOW}⚠️  Ping échoué (normal si ICMP bloqué)${NC}"
fi
echo ""

# 3. Test traceroute
echo -e "${YELLOW}3. Traceroute (premiers 10 hops)...${NC}"
if command -v traceroute > /dev/null; then
    traceroute -m 10 "$SUPABASE_HOST" 2>&1 || echo "Traceroute partiel"
else
    echo -e "${YELLOW}⚠️  traceroute non disponible${NC}"
fi
echo ""

# 4. Test HTTPS
echo -e "${YELLOW}4. Test connexion HTTPS...${NC}"
start_time=$(date +%s%N)
if curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$SUPABASE_URL/rest/v1/" > /tmp/http_code.txt 2>&1; then
    end_time=$(date +%s%N)
    elapsed_ms=$(( (end_time - start_time) / 1000000 ))
    http_code=$(cat /tmp/http_code.txt)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "401" ] || [ "$http_code" = "404" ]; then
        echo -e "${GREEN}✅ HTTPS connexion OK (HTTP $http_code)${NC}"
        echo -e "${BLUE}⏱️  Temps de réponse: ${elapsed_ms}ms${NC}"
    else
        echo -e "${RED}❌ HTTPS erreur (HTTP $http_code)${NC}"
    fi
else
    echo -e "${RED}❌ Échec connexion HTTPS${NC}"
fi
echo ""

# 5. Test avec timeout progressif
echo -e "${YELLOW}5. Test timeouts (5s, 10s, 30s)...${NC}"
for timeout in 5 10 30; do
    echo -n "  Timeout ${timeout}s: "
    start=$(date +%s%N)
    if curl -s -o /dev/null --max-time "$timeout" "$SUPABASE_URL/rest/v1/" 2>&1; then
        end=$(date +%s%N)
        elapsed=$(( (end - start) / 1000000 ))
        echo -e "${GREEN}✅ Réussi en ${elapsed}ms${NC}"
    else
        echo -e "${RED}❌ Timeout${NC}"
    fi
done
echo ""

# 6. Test avec headers API
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}6. Test API avec authentification...${NC}"
    start_time=$(date +%s%N)
    response=$(curl -s -w "\n%{http_code}" --max-time 10 \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        "$SUPABASE_URL/rest/v1/catalog_family?select=count&limit=1" 2>&1)
    end_time=$(date +%s%N)
    elapsed_ms=$(( (end_time - start_time) / 1000000 ))
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ API accessible${NC}"
        echo -e "${BLUE}⏱️  Temps: ${elapsed_ms}ms${NC}"
        echo -e "${BLUE}📦 Response: ${body}${NC}"
    else
        echo -e "${RED}❌ API erreur (HTTP $http_code)${NC}"
        echo "$body"
    fi
else
    echo -e "${YELLOW}⚠️  SUPABASE_SERVICE_ROLE_KEY non défini, skip test API${NC}"
fi
echo ""

# 7. Test multiple (10 requêtes)
echo -e "${YELLOW}7. Test de charge (10 requêtes séquentielles)...${NC}"
success=0
failed=0
total_time=0

for i in {1..10}; do
    start=$(date +%s%N)
    if curl -s -o /dev/null --max-time 10 "$SUPABASE_URL/rest/v1/" 2>&1; then
        end=$(date +%s%N)
        elapsed=$(( (end - start) / 1000000 ))
        total_time=$((total_time + elapsed))
        success=$((success + 1))
        echo -n "."
    else
        failed=$((failed + 1))
        echo -n "x"
    fi
done
echo ""

if [ $success -gt 0 ]; then
    avg_time=$((total_time / success))
    echo -e "${GREEN}✅ $success/10 requêtes réussies${NC}"
    echo -e "${BLUE}⏱️  Temps moyen: ${avg_time}ms${NC}"
else
    echo -e "${RED}❌ Toutes les requêtes ont échoué${NC}"
fi

if [ $failed -gt 0 ]; then
    echo -e "${RED}❌ $failed/10 requêtes échouées${NC}"
fi
echo ""

# Résumé
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RÉSUMÉ:${NC}"
if [ $success -ge 8 ]; then
    echo -e "${GREEN}✅ Connexion Supabase STABLE${NC}"
elif [ $success -ge 5 ]; then
    echo -e "${YELLOW}⚠️  Connexion Supabase INSTABLE (timeouts fréquents)${NC}"
    echo -e "${YELLOW}💡 Recommandation: Augmenter timeout à 30s + activer retry${NC}"
else
    echo -e "${RED}❌ Connexion Supabase PROBLÉMATIQUE${NC}"
    echo -e "${RED}💡 Vérifier: Réseau, Firewall, Quotas Supabase${NC}"
fi
echo -e "${BLUE}========================================${NC}"
