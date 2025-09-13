#!/bin/bash

# Script de test cURL pour l'API Layout Test
# Usage: ./test-layout-api-working.sh

BASE_URL="http://localhost:3000/api/layout-test"

echo "🧪 Tests des endpoints Layout API (Working)"
echo "============================================="
echo ""

# Fonction pour faire un test avec gestion d'erreur
test_endpoint() {
    local name="$1"
    local url="$2"
    echo "🔍 Test: $name"
    echo "URL: $url"
    echo "---"
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$url")
    http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$http_code" -eq 200 ]; then
        echo "✅ SUCCESS ($http_code)"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    else
        echo "❌ FAILED ($http_code)"
        echo "$body"
    fi
    echo ""
    echo ""
}

# Test 1: Health Check
test_endpoint "Health Check" "$BASE_URL/health"

# Test 2: Header Simple (Public)
test_endpoint "Header Simple (Public)" "$BASE_URL/header-simple"

# Test 3: Header Simple (Admin)
test_endpoint "Header Simple (Admin)" "$BASE_URL/header-simple?context=admin"

# Test 4: Footer Simple
test_endpoint "Footer Simple" "$BASE_URL/footer-simple"

# Test 5: Search Simple (Sans requête)
test_endpoint "Search Simple (Sans requête)" "$BASE_URL/search-simple"

# Test 6: Search Simple (Avec requête)
test_endpoint "Search Simple (Avec requête)" "$BASE_URL/search-simple?q=test"

# Test 7: Meta Simple (Page par défaut)
test_endpoint "Meta Simple (Page par défaut)" "$BASE_URL/meta-simple"

# Test 8: Meta Simple (Page contact)
test_endpoint "Meta Simple (Page contact)" "$BASE_URL/meta-simple?page=contact"

echo "✅ Tests terminés !"
echo ""
echo "📋 Résumé des endpoints fonctionnels :"
echo "- GET $BASE_URL/health - Statut du service"
echo "- GET $BASE_URL/header-simple[?context=admin] - Configuration header"
echo "- GET $BASE_URL/footer-simple - Informations footer"
echo "- GET $BASE_URL/search-simple[?q=query] - Recherche simple"
echo "- GET $BASE_URL/meta-simple[?page=name] - Méta-données SEO"
echo ""
echo "🎯 Prochaines étapes :"
echo "- Développer les endpoints complets (/api/layout)"
echo "- Intégrer avec les vrais services (ProductsService, UsersService)"
echo "- Ajouter l'authentification et la gestion des rôles"
