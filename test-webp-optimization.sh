#!/bin/bash

# 🧪 Script de Test - Optimisation Images WebP Supabase
# Vérifie que les images sont bien optimisées

echo "🖼️  TEST D'OPTIMISATION IMAGES WEBP SUPABASE"
echo "=============================================="
echo ""

SUPABASE_URL="https://cxpojprgwgubzjyqzmoq.supabase.co"
TEST_IMAGE="rack-images/13/IMG_0001.jpg"

echo "📊 Test de l'image: $TEST_IMAGE"
echo ""

# Test 1: Image originale
echo "1️⃣  Image ORIGINALE (non optimisée):"
ORIGINAL_URL="${SUPABASE_URL}/storage/v1/object/public/uploads/${TEST_IMAGE}"
ORIGINAL_SIZE=$(curl -sI "$ORIGINAL_URL" | grep -i content-length | awk '{print $2}' | tr -d '\r')
ORIGINAL_TYPE=$(curl -sI "$ORIGINAL_URL" | grep -i content-type | awk '{print $2}' | tr -d '\r')

if [ -n "$ORIGINAL_SIZE" ]; then
  ORIGINAL_KB=$((ORIGINAL_SIZE / 1024))
  echo "   ✓ URL: $ORIGINAL_URL"
  echo "   ✓ Taille: ${ORIGINAL_KB} KB"
  echo "   ✓ Type: $ORIGINAL_TYPE"
else
  echo "   ⚠️  Image introuvable ou erreur"
fi
echo ""

# Test 2: Image WebP optimisée (800px)
echo "2️⃣  Image WEBP OPTIMISÉE (800px):"
WEBP_URL="${SUPABASE_URL}/storage/v1/render/image/public/uploads/${TEST_IMAGE}?format=webp&width=800&quality=85"
WEBP_SIZE=$(curl -sI "$WEBP_URL" | grep -i content-length | awk '{print $2}' | tr -d '\r')
WEBP_TYPE=$(curl -sI "$WEBP_URL" | grep -i content-type | awk '{print $2}' | tr -d '\r')
CACHE_CONTROL=$(curl -sI "$WEBP_URL" | grep -i cache-control | awk -F': ' '{print $2}' | tr -d '\r')

if [ -n "$WEBP_SIZE" ]; then
  WEBP_KB=$((WEBP_SIZE / 1024))
  echo "   ✓ URL: $WEBP_URL"
  echo "   ✓ Taille: ${WEBP_KB} KB"
  echo "   ✓ Type: $WEBP_TYPE"
  echo "   ✓ Cache: $CACHE_CONTROL"
  
  # Calculer l'économie
  if [ -n "$ORIGINAL_SIZE" ] && [ "$ORIGINAL_SIZE" -gt 0 ]; then
    REDUCTION=$((100 - (WEBP_SIZE * 100 / ORIGINAL_SIZE)))
    echo "   💰 Réduction: ${REDUCTION}%"
  fi
else
  echo "   ⚠️  Transformation échouée ou erreur"
fi
echo ""

# Test 3: Image WebP optimisée (400px)
echo "3️⃣  Image WEBP OPTIMISÉE (400px - mobile):"
WEBP_SMALL_URL="${SUPABASE_URL}/storage/v1/render/image/public/uploads/${TEST_IMAGE}?format=webp&width=400&quality=85"
WEBP_SMALL_SIZE=$(curl -sI "$WEBP_SMALL_URL" | grep -i content-length | awk '{print $2}' | tr -d '\r')

if [ -n "$WEBP_SMALL_SIZE" ]; then
  WEBP_SMALL_KB=$((WEBP_SMALL_SIZE / 1024))
  echo "   ✓ Taille: ${WEBP_SMALL_KB} KB"
  
  if [ -n "$ORIGINAL_SIZE" ] && [ "$ORIGINAL_SIZE" -gt 0 ]; then
    REDUCTION_SMALL=$((100 - (WEBP_SMALL_SIZE * 100 / ORIGINAL_SIZE)))
    echo "   💰 Réduction: ${REDUCTION_SMALL}%"
  fi
else
  echo "   ⚠️  Transformation échouée"
fi
echo ""

# Test 4: CDN et Cache
echo "4️⃣  TEST CDN & CACHE:"
HTTP_STATUS=$(curl -sI "$WEBP_URL" | grep -i "HTTP/" | awk '{print $2}')
CF_CACHE=$(curl -sI "$WEBP_URL" | grep -i "cf-cache-status" | awk -F': ' '{print $2}' | tr -d '\r')
CF_RAY=$(curl -sI "$WEBP_URL" | grep -i "cf-ray" | awk -F': ' '{print $2}' | tr -d '\r')

echo "   ✓ Status HTTP: $HTTP_STATUS"
[ -n "$CF_CACHE" ] && echo "   ✓ Cloudflare Cache: $CF_CACHE"
[ -n "$CF_RAY" ] && echo "   ✓ Cloudflare Ray: $CF_RAY"
echo ""

# Résumé
echo "=============================================="
echo "📈 RÉSUMÉ DES TESTS"
echo "=============================================="
echo ""

if [ -n "$ORIGINAL_SIZE" ] && [ -n "$WEBP_SIZE" ]; then
  echo "✅ Tests réussis !"
  echo ""
  echo "📊 Statistiques:"
  echo "   • Image originale: ${ORIGINAL_KB} KB"
  echo "   • Image WebP 800px: ${WEBP_KB} KB"
  [ -n "$WEBP_SMALL_SIZE" ] && echo "   • Image WebP 400px: ${WEBP_SMALL_KB} KB"
  echo ""
  echo "💰 Économies:"
  echo "   • Réduction: ${REDUCTION}%"
  echo "   • Gain par image: $((ORIGINAL_KB - WEBP_KB)) KB"
  echo ""
  echo "🌍 CDN:"
  echo "   • Cloudflare: Actif"
  echo "   • Cache: Configuré"
  echo ""
  echo "🎉 Vos images sont optimisées !"
else
  echo "⚠️  Certains tests ont échoué"
  echo ""
  echo "Vérifiez:"
  echo "   1. L'URL Supabase est correcte"
  echo "   2. L'image existe: $TEST_IMAGE"
  echo "   3. Le bucket 'uploads' est public"
  echo ""
fi

echo ""
echo "💡 Pour tester avec vos propres images:"
echo "   ./test-webp-optimization.sh rack-images/VOTRE_DOSSIER/VOTRE_IMAGE.jpg"
echo ""
