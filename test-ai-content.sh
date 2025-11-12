#!/bin/bash

# Script de test complet du système de génération de contenu IA

echo "🧪 Test du Système de Génération de Contenu IA"
echo "=============================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="http://localhost:5001"
TESTS_PASSED=0
TESTS_FAILED=0

# Fonction de test
test_endpoint() {
    local name=$1
    local endpoint=$2
    local data=$3
    
    echo -e "${BLUE}Test: $name${NC}"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL$endpoint" \
        -H "Content-Type: application/json" \
        -d "$data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        echo "Réponse: ${body:0:100}..."
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL (HTTP $http_code)${NC}"
        echo "Erreur: $body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

# Vérifier que le backend est en ligne
echo -e "${YELLOW}Vérification du backend...${NC}"
if ! curl -s "$API_URL/api/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Backend non accessible sur $API_URL${NC}"
    echo "Assurez-vous que le backend est démarré: cd backend && npm run dev"
    exit 1
fi
echo -e "${GREEN}✅ Backend accessible${NC}"
echo ""

# Test 1: Génération description produit
test_endpoint \
    "Description de produit" \
    "/api/ai-content/generate/product-description" \
    '{
        "productName": "Vanne papillon motorisée DN50",
        "category": "Vannes",
        "features": ["Corps fonte GGG40", "Motorisation 24V"],
        "tone": "professional",
        "length": "medium"
    }'

# Test 2: Génération SEO meta
test_endpoint \
    "Méta description SEO" \
    "/api/ai-content/generate/seo-meta" \
    '{
        "pageTitle": "Vannes papillon motorisées - Catalogue 2025",
        "targetKeyword": "vanne papillon motorisée",
        "keywords": ["automatisation", "robinet industriel"]
    }'

# Test 3: Génération contenu générique
test_endpoint \
    "Contenu marketing" \
    "/api/ai-content/generate" \
    '{
        "type": "marketing_copy",
        "prompt": "Créer un texte marketing pour promouvoir nos vannes papillon motorisées auprès des professionnels",
        "tone": "persuasive",
        "maxLength": 300
    }'

# Test 4: Génération post réseaux sociaux
test_endpoint \
    "Post réseaux sociaux" \
    "/api/ai-content/generate" \
    '{
        "type": "social_media",
        "prompt": "Post LinkedIn pour annoncer notre nouvelle gamme de vannes",
        "tone": "professional",
        "context": {
            "platform": "LinkedIn",
            "message": "Nouvelle gamme de vannes papillon"
        }
    }'

# Test 5: Génération par lots (batch)
test_endpoint \
    "Génération par lots" \
    "/api/ai-content/generate/batch" \
    '{
        "requests": [
            {
                "type": "product_description",
                "prompt": "Vanne DN25",
                "tone": "professional"
            },
            {
                "type": "seo_meta",
                "prompt": "Page catalogue",
                "tone": "professional"
            }
        ]
    }'

# Vérifier Ollama si configuré
echo -e "${YELLOW}Vérification d'Ollama...${NC}"
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama est actif${NC}"
    ollama_models=$(curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    echo "Modèles installés: $ollama_models"
else
    echo -e "${YELLOW}⚠️  Ollama non détecté${NC}"
    echo "Pour installer: curl -fsSL https://ollama.com/install.sh | sh"
fi
echo ""

# Vérifier Redis si configuré
echo -e "${YELLOW}Vérification de Redis (cache)...${NC}"
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis est actif${NC}"
    cache_keys=$(redis-cli keys "ai-content:*" | wc -l)
    echo "Éléments en cache: $cache_keys"
else
    echo -e "${YELLOW}⚠️  Redis non actif (cache désactivé)${NC}"
    echo "Pour activer: docker-compose -f docker-compose.redis.yml up -d"
fi
echo ""

# Résumé
echo "=============================================="
echo -e "${BLUE}RÉSUMÉ DES TESTS${NC}"
echo "=============================================="
echo -e "${GREEN}Tests réussis: $TESTS_PASSED${NC}"
echo -e "${RED}Tests échoués: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Tous les tests sont passés !${NC}"
    echo "Le système de génération de contenu IA fonctionne correctement."
    exit 0
else
    echo -e "${RED}❌ Certains tests ont échoué${NC}"
    echo "Vérifiez les logs du backend pour plus de détails."
    exit 1
fi
