#!/bin/bash

# 🧪 TEST DES REDIRECTIONS CADDY - IMAGES SUPABASE
# Vérifie que les anciennes URLs publiques redirigent correctement vers Supabase

echo "🧪 TEST DES REDIRECTIONS CADDY - IMAGES SUPABASE"
echo ""
echo "⚠️  Ce script teste les redirections 301 configurées dans Caddy"
echo "📍 Assurez-vous que Caddy est en cours d'exécution"
echo ""

# Configuration
DOMAIN="${DOMAIN:-http://localhost}"
EXPECTED_SUPABASE_URL="https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public"

# Compteurs
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Fonction de test
test_redirect() {
    local test_name="$1"
    local old_url="$2"
    local expected_bucket="$3"
    local expected_path="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo "[$TOTAL_TESTS] Testing: $test_name"
    echo "    URL: ${DOMAIN}${old_url}"
    
    # Faire une requête HEAD pour suivre la redirection
    local response=$(curl -sI -L "${DOMAIN}${old_url}" 2>&1)
    local http_code=$(echo "$response" | grep -i "HTTP/" | head -1 | awk '{print $2}')
    local location=$(echo "$response" | grep -i "Location:" | head -1 | awk '{print $2}' | tr -d '\r')
    
    # Vérifier la redirection 301
    if echo "$response" | grep -q "301"; then
        echo "    ✓ Code 301 Moved Permanently"
    else
        echo "    ✗ Pas de redirection 301 trouvée (code: $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo ""
        return
    fi
    
    # Vérifier l'URL de destination
    local expected_url="${EXPECTED_SUPABASE_URL}/${expected_bucket}/${expected_path}"
    if [ "$location" = "$expected_url" ]; then
        echo "    ✓ Redirige vers: $location"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "    ✗ URL incorrecte"
        echo "      Attendu: $expected_url"
        echo "      Reçu:    $location"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
}

echo "🔍 TEST 1: Images produits (/rack/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_redirect \
    "Image produit" \
    "/rack/101/34407_1.JPG" \
    "rack-images" \
    "101/34407_1.JPG"

echo "🔍 TEST 2: Images gammes produits (/upload/articles/gammes-produits/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_redirect \
    "Gamme - Filtre à huile" \
    "/upload/articles/gammes-produits/catalogue/filtre-a-huile.webp" \
    "uploads" \
    "articles/gammes-produits/catalogue/filtre-a-huile.webp"

echo "🔍 TEST 3: Images familles produits (/upload/articles/familles-produits/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_redirect \
    "Famille - Filtres" \
    "/upload/articles/familles-produits/Filtres.webp" \
    "uploads" \
    "articles/familles-produits/Filtres.webp"

echo "🔍 TEST 4: Logos constructeurs (/upload/constructeurs-automobiles/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_redirect \
    "Icon BMW" \
    "/upload/constructeurs-automobiles/icon/bmw.webp" \
    "uploads" \
    "constructeurs-automobiles/icon/bmw.webp"

test_redirect \
    "Icon 50px BMW" \
    "/upload/constructeurs-automobiles/icon-50/bmw.webp" \
    "uploads" \
    "constructeurs-automobiles/icon-50/bmw.webp"

test_redirect \
    "Logo BMW" \
    "/upload/constructeurs-automobiles/marques-logos/bmw.webp" \
    "uploads" \
    "constructeurs-automobiles/marques-logos/bmw.webp"

echo "🔍 TEST 5: Logos équipementiers (/upload/equipementiers-automobiles/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_redirect \
    "Logo Bosch" \
    "/upload/equipementiers-automobiles/bosch.webp" \
    "uploads" \
    "equipementiers-automobiles/bosch.webp"

echo "🔍 TEST 6: Blog/Conseils (/upload/blog/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_redirect \
    "Article blog" \
    "/upload/blog/conseils/20190819125821.jpg" \
    "uploads" \
    "blog/conseils/20190819125821.jpg"

echo "🔍 TEST 7: Assets/Favicon (/upload/upload/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_redirect \
    "Favicon 32x32" \
    "/upload/upload/favicon/favicon-32x32.png" \
    "uploads" \
    "upload/favicon/favicon-32x32.png"

# Résumé
echo "═══════════════════════════════════════════════════════════"
echo "📊 RÉSUMÉ DES TESTS"
echo "═══════════════════════════════════════════════════════════"
echo "Total:    $TOTAL_TESTS tests"
echo "✅ Réussis: $PASSED_TESTS"
echo "❌ Échoués:  $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 TOUS LES TESTS SONT PASSÉS !"
    echo ""
    echo "✨ Les redirections 301 fonctionnent correctement"
    echo "🔗 Les anciennes URLs publiques préservent le SEO"
    echo "📍 Toutes les images redirigent vers Supabase Storage"
    exit 0
else
    echo "⚠️  CERTAINS TESTS ONT ÉCHOUÉ"
    echo ""
    echo "🔧 Vérifiez la configuration Caddy:"
    echo "   - config/caddy/Caddyfile"
    echo "   - Les règles de redirection @rack_images et @upload_images"
    echo ""
    echo "🐳 Redémarrez Caddy si nécessaire:"
    echo "   docker-compose -f docker-compose.caddy.yml restart caddy"
    exit 1
fi
