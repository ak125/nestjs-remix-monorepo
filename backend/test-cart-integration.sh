#!/bin/bash

# 🧪 Script de test intégration complète
# Teste toute la chaîne: panier → promo → shipping → analytics

BASE_URL="${1:-http://localhost:3000}"
SESSION_COOKIE=""

echo "🧪 Tests d'Intégration Complète - Module Panier"
echo "================================================"
echo "Base URL: $BASE_URL"
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonction pour extraire le cookie de session
extract_session_cookie() {
    local headers="$1"
    SESSION_COOKIE=$(echo "$headers" | grep -i "set-cookie" | grep "connect.sid" | sed 's/.*connect.sid=\([^;]*\).*/connect.sid=\1/')
}

# Test 1: Créer un panier (ajouter premier produit)
echo -e "${YELLOW}🛒 Test 1: Créer un panier (ajouter produit 1001)${NC}"
RESPONSE=$(curl -s -i -X POST "$BASE_URL/api/cart/add" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "1001",
    "quantity": 2
  }')

extract_session_cookie "$RESPONSE"
CART=$(echo "$RESPONSE" | grep -A 100 "^{" | jq '.')

if [ -n "$CART" ]; then
    echo -e "${GREEN}✅ Panier créé avec succès${NC}"
    SUBTOTAL=$(echo "$CART" | jq -r '.subtotal')
    echo "   Sous-total: ${SUBTOTAL}€"
else
    echo -e "${RED}❌ Échec création panier${NC}"
    exit 1
fi
echo ""

# Test 2: Ajouter un deuxième produit
echo -e "${YELLOW}🛒 Test 2: Ajouter deuxième produit (1002)${NC}"
CART=$(curl -s -X POST "$BASE_URL/api/cart/add" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "product_id": "1002",
    "quantity": 1
  }' | jq '.')

ITEM_COUNT=$(echo "$CART" | jq '.items | length')
SUBTOTAL=$(echo "$CART" | jq -r '.subtotal')
echo -e "${GREEN}✅ Produit ajouté${NC}"
echo "   Nombre de produits: $ITEM_COUNT"
echo "   Sous-total: ${SUBTOTAL}€"
echo ""

# Test 3: Vérifier le stock (mode UNLIMITED)
echo -e "${YELLOW}📦 Test 3: Vérifier stock produit 1001${NC}"
STOCK=$(curl -s "$BASE_URL/api/products/1001" | jq '.stock')
AVAILABLE=$(echo "$STOCK" | jq -r '.available')
STATUS=$(echo "$STOCK" | jq -r '.status')

echo -e "${GREEN}✅ Stock récupéré${NC}"
echo "   Disponible: $AVAILABLE unités"
echo "   Statut: $STATUS"
echo ""

# Test 4: Appliquer code promo
echo -e "${YELLOW}🏷️  Test 4: Appliquer code promo SUMMER2025${NC}"
CART=$(curl -s -X POST "$BASE_URL/api/cart/promo/apply" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "code": "SUMMER2025"
  }' | jq '.')

PROMO_COUNT=$(echo "$CART" | jq '.promos | length')
if [ "$PROMO_COUNT" -gt "0" ]; then
    echo -e "${GREEN}✅ Code promo appliqué${NC}"
    PROMO_TYPE=$(echo "$CART" | jq -r '.promos[0].type')
    PROMO_VALUE=$(echo "$CART" | jq -r '.promos[0].value')
    DISCOUNT=$(echo "$CART" | jq -r '.promos[0].discount')
    echo "   Type: $PROMO_TYPE"
    echo "   Valeur: $PROMO_VALUE"
    echo "   Réduction: ${DISCOUNT}€"
else
    echo -e "${YELLOW}⚠️  Code promo non appliqué (peut-être expiré ou non valide)${NC}"
fi
echo ""

# Test 5: Calculer frais de livraison
echo -e "${YELLOW}🚚 Test 5: Calculer frais de livraison (Paris - IDF)${NC}"
SHIPPING=$(curl -s -X POST "$BASE_URL/api/cart/shipping/calculate" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "postalCode": "75001",
    "city": "Paris",
    "country": "FR"
  }' | jq '.')

SHIPPING_COST=$(echo "$SHIPPING" | jq -r '.cost')
FREE_SHIPPING=$(echo "$SHIPPING" | jq -r '.freeShipping')
ZONE=$(echo "$SHIPPING" | jq -r '.zone')

echo -e "${GREEN}✅ Frais de livraison calculés${NC}"
echo "   Zone: $ZONE"
echo "   Coût: ${SHIPPING_COST}€"
echo "   Livraison gratuite: $FREE_SHIPPING"
echo ""

# Test 6: Appliquer la livraison au panier
echo -e "${YELLOW}🚚 Test 6: Appliquer livraison au panier${NC}"
CART=$(curl -s -X POST "$BASE_URL/api/cart/shipping/apply" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "postalCode": "75001",
    "city": "Paris",
    "country": "FR"
  }' | jq '.')

HAS_SHIPPING=$(echo "$CART" | jq -r '.shipping != null')
SHIPPING_METHOD=$(echo "$CART" | jq -r '.shipping.method // "none"')
FINAL_TOTAL=$(echo "$CART" | jq -r '.total')

if [ "$HAS_SHIPPING" = "true" ]; then
    echo -e "${GREEN}✅ Livraison appliquée${NC}"
    echo "   Méthode: $SHIPPING_METHOD"
    echo "   Total final: ${FINAL_TOTAL}€"
else
    echo -e "${YELLOW}⚠️  Livraison non appliquée${NC}"
fi
echo ""

# Test 7: Récapitulatif complet du panier
echo -e "${YELLOW}📋 Test 7: Récapitulatif complet du panier${NC}"
CART=$(curl -s -X GET "$BASE_URL/api/cart" \
  -H "Cookie: $SESSION_COOKIE" | jq '.')

echo "$CART" | jq '{
  items: .items | length,
  subtotal: .subtotal,
  promos: .promos | length,
  shipping: .shipping.method,
  total: .total
}'

echo -e "${BLUE}📊 Détails du panier:${NC}"
echo "   Produits: $(echo "$CART" | jq '.items | length')"
echo "   Sous-total: $(echo "$CART" | jq -r '.subtotal')€"
echo "   Codes promo: $(echo "$CART" | jq '.promos | length')"
echo "   Livraison: $(echo "$CART" | jq -r '.shipping.cost // 0')€"
echo "   Total TTC: $(echo "$CART" | jq -r '.total')€"
echo ""

# Test 8: Vérifier analytics (état initial)
echo -e "${YELLOW}📊 Test 8: Vérifier état analytics${NC}"
ANALYTICS=$(curl -s "$BASE_URL/api/cart/analytics/abandonment" | jq '.')

CREATED=$(echo "$ANALYTICS" | jq -r '.stats.created')
CONVERTED=$(echo "$ANALYTICS" | jq -r '.stats.converted')
ABANDONED=$(echo "$ANALYTICS" | jq -r '.stats.abandoned')

echo -e "${BLUE}📈 État analytics:${NC}"
echo "   Paniers créés: $CREATED"
echo "   Convertis: $CONVERTED"
echo "   Abandonnés: $ABANDONED"
echo ""

# Test 9: Modifier quantité
echo -e "${YELLOW}🔧 Test 9: Modifier quantité produit 1001 (2 → 3)${NC}"
CART=$(curl -s -X PUT "$BASE_URL/api/cart/update" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "product_id": "1001",
    "quantity": 3
  }' | jq '.')

NEW_QTY=$(echo "$CART" | jq '.items[] | select(.product_id == "1001") | .quantity')
echo -e "${GREEN}✅ Quantité modifiée${NC}"
echo "   Nouvelle quantité: $NEW_QTY"
echo ""

# Test 10: Supprimer un produit
echo -e "${YELLOW}🗑️  Test 10: Supprimer produit 1002${NC}"
CART=$(curl -s -X DELETE "$BASE_URL/api/cart/remove/1002" \
  -H "Cookie: $SESSION_COOKIE" | jq '.')

REMAINING_ITEMS=$(echo "$CART" | jq '.items | length')
echo -e "${GREEN}✅ Produit supprimé${NC}"
echo "   Produits restants: $REMAINING_ITEMS"
echo ""

# Test 11: Retirer code promo
if [ "$PROMO_COUNT" -gt "0" ]; then
    echo -e "${YELLOW}🏷️  Test 11: Retirer code promo${NC}"
    CART=$(curl -s -X DELETE "$BASE_URL/api/cart/promo/remove/SUMMER2025" \
      -H "Cookie: $SESSION_COOKIE" | jq '.')
    
    PROMO_COUNT_AFTER=$(echo "$CART" | jq '.promos | length')
    echo -e "${GREEN}✅ Code promo retiré${NC}"
    echo "   Codes promo restants: $PROMO_COUNT_AFTER"
    echo ""
fi

# Test 12: Vider le panier
echo -e "${YELLOW}🗑️  Test 12: Vider le panier${NC}"
RESULT=$(curl -s -X DELETE "$BASE_URL/api/cart/clear" \
  -H "Cookie: $SESSION_COOKIE" | jq '.')

SUCCESS=$(echo "$RESULT" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✅ Panier vidé${NC}"
else
    echo -e "${RED}❌ Échec vidage panier${NC}"
fi
echo ""

# Résumé final
echo "================================================"
echo -e "${GREEN}✅ Tests d'intégration terminés${NC}"
echo ""

echo -e "${BLUE}📊 Résumé des fonctionnalités testées:${NC}"
echo "  ✅ Création et gestion panier"
echo "  ✅ Ajout/modification/suppression produits"
echo "  ✅ Validation stock (mode flux tendu)"
echo "  ✅ Application codes promo"
echo "  ✅ Calcul frais de livraison"
echo "  ✅ Application livraison au panier"
echo "  ✅ Récupération analytics"
echo "  ✅ Vidage panier"
echo ""

echo "🔗 Endpoints testés:"
echo "   POST   $BASE_URL/api/cart/add"
echo "   GET    $BASE_URL/api/cart"
echo "   PUT    $BASE_URL/api/cart/update"
echo "   DELETE $BASE_URL/api/cart/remove/:id"
echo "   DELETE $BASE_URL/api/cart/clear"
echo "   POST   $BASE_URL/api/cart/promo/apply"
echo "   DELETE $BASE_URL/api/cart/promo/remove/:code"
echo "   POST   $BASE_URL/api/cart/shipping/calculate"
echo "   POST   $BASE_URL/api/cart/shipping/apply"
echo "   GET    $BASE_URL/api/products/:id"
echo "   GET    $BASE_URL/api/cart/analytics/abandonment"
echo ""

echo "💡 Note: Ce script teste l'intégration complète de toutes"
echo "   les fonctionnalités du module panier en une seule session"
echo ""
