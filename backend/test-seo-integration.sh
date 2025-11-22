#!/bin/bash
# 🧪 Test complet intégration SEO marque

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🧪 TEST COMPLET - INTÉGRATION SEO MARQUE               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Variables
API_URL="http://localhost:3000"
BRANDS=("renault" "peugeot" "volkswagen" "bmw")

# Check serveur
echo "🔍 Vérification serveur..."
if ! curl -s "$API_URL/api/health" > /dev/null 2>&1; then
  echo "❌ Serveur non disponible sur $API_URL"
  echo "💡 Lancer: cd backend && npm run dev"
  exit 1
fi
echo "✅ Serveur disponible"
echo ""

# Test chaque marque
TOTAL=0
SUCCESS=0
FAILED=0

for brand in "${BRANDS[@]}"; do
  ((TOTAL++))
  echo "─────────────────────────────────────────────────────────"
  echo "📦 Test marque: $brand"
  echo ""
  
  RESPONSE=$(curl -s "$API_URL/api/brands/brand/$brand")
  
  if [ -z "$RESPONSE" ]; then
    echo "❌ Pas de réponse"
    ((FAILED++))
    continue
  fi
  
  # Parse JSON
  SUCCESS_STATUS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)
  
  if [ "$SUCCESS_STATUS" != "true" ]; then
    echo "❌ Marque non trouvée"
    ((FAILED++))
    continue
  fi
  
  # Extraire SEO
  HAS_SEO=$(echo "$RESPONSE" | jq -r '.data.seo != null' 2>/dev/null)
  
  if [ "$HAS_SEO" == "true" ]; then
    TITLE=$(echo "$RESPONSE" | jq -r '.data.seo.title' 2>/dev/null)
    CONTENT_HTML=$(echo "$RESPONSE" | jq -r '.data.seo.content[:80]' 2>/dev/null)
    CONTENT_TEXT=$(echo "$RESPONSE" | jq -r '.data.seo.contentText[:80]' 2>/dev/null)
    
    echo "✅ SEO trouvé"
    echo ""
    echo "📋 Title:"
    echo "   $TITLE"
    echo ""
    echo "📝 Content HTML (80 car):"
    echo "   $CONTENT_HTML..."
    echo ""
    echo "📄 Content Text (80 car):"
    echo "   $CONTENT_TEXT..."
    echo ""
    
    # Vérifications
    CHECKS_OK=true
    
    # Check 1: Variables remplacées
    if echo "$TITLE" | grep -q "#"; then
      echo "⚠️  Variables non remplacées dans title"
      CHECKS_OK=false
    fi
    
    # Check 2: contentText sans HTML
    if echo "$CONTENT_TEXT" | grep -qE "<|>"; then
      echo "⚠️  Balises HTML dans contentText"
      CHECKS_OK=false
    fi
    
    # Check 3: content avec HTML
    if ! echo "$CONTENT_HTML" | grep -qE "<b>|<strong>"; then
      echo "ℹ️  Pas de balises HTML dans content (normal si SEO par défaut)"
    fi
    
    if [ "$CHECKS_OK" == "true" ]; then
      echo "✅ Toutes les vérifications OK"
      ((SUCCESS++))
    else
      ((FAILED++))
    fi
  else
    echo "ℹ️  Pas de SEO custom (utilise fallback)"
    ((SUCCESS++))
  fi
  echo ""
done

# Résumé
echo "═══════════════════════════════════════════════════════════"
echo "📊 RÉSUMÉ"
echo "═══════════════════════════════════════════════════════════"
echo "Total tests:   $TOTAL"
echo "✅ Réussis:    $SUCCESS"
echo "❌ Échoués:    $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 Tous les tests sont passés !"
  exit 0
else
  echo "⚠️  Certains tests ont échoué"
  exit 1
fi
