#!/bin/bash

# 🧪 Script de test du système de gestion de stock
# Mode UNLIMITED (flux tendu) et TRACKED (suivi réel)

BASE_URL="${1:-http://localhost:3000}"

echo "🧪 Tests du Système de Gestion de Stock"
echo "========================================"
echo "Base URL: $BASE_URL"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Vérifier le stock d'un produit
echo -e "${YELLOW}📦 Test 1: Vérifier le stock d'un produit${NC}"
echo "GET $BASE_URL/api/products/1001"
STOCK=$(curl -s "$BASE_URL/api/products/1001" | jq '.stock')
echo "$STOCK" | jq '.'
echo ""

# Déterminer le mode basé sur le stock disponible
AVAILABLE=$(echo "$STOCK" | jq -r '.available')
if [ "$AVAILABLE" == "999" ]; then
    MODE="UNLIMITED"
    echo -e "${GREEN}✅ Mode détecté: FLUX TENDU (UNLIMITED)${NC}"
else
    MODE="TRACKED"
    echo -e "${GREEN}✅ Mode détecté: SUIVI RÉEL (TRACKED)${NC}"
fi
echo ""

# Test 2: Liste de réapprovisionnement
echo -e "${YELLOW}📋 Test 2: Liste de réapprovisionnement${NC}"
echo "GET $BASE_URL/api/products/inventory/reorder-list"
REORDER=$(curl -s "$BASE_URL/api/products/inventory/reorder-list")
echo "$REORDER" | jq '{success, count}'
REORDER_COUNT=$(echo "$REORDER" | jq -r '.count')
if [ "$REORDER_COUNT" == "0" ]; then
    echo -e "${GREEN}✅ Aucun produit nécessitant un réapprovisionnement${NC}"
else
    echo -e "${YELLOW}⚠️  $REORDER_COUNT produit(s) nécessitent un réapprovisionnement${NC}"
    echo "$REORDER" | jq '.items[0:3]' # Afficher les 3 premiers
fi
echo ""

# Test 3: Rapport d'inventaire
echo -e "${YELLOW}📊 Test 3: Rapport d'inventaire global${NC}"
echo "GET $BASE_URL/api/products/inventory/report"
REPORT=$(curl -s "$BASE_URL/api/products/inventory/report" | jq '.report')
echo "$REPORT" | jq '.'
echo ""

# Test 4: Ajout au panier avec quantité normale
SESSION="test-stock-$(date +%s)"
echo -e "${YELLOW}🛒 Test 4: Ajout au panier - Quantité normale (10 unités)${NC}"
echo "POST $BASE_URL/api/cart/items"
ADD_NORMAL=$(curl -s -H "Cookie: userSession=$SESSION" \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/cart/items" \
  -d '{"productId": 1001, "quantity": 10}')
SUCCESS=$(echo "$ADD_NORMAL" | jq -r '.success // false')
if [ "$SUCCESS" == "true" ]; then
    echo -e "${GREEN}✅ Ajout réussi: 10 unités${NC}"
else
    echo -e "${RED}❌ Échec de l'ajout${NC}"
    echo "$ADD_NORMAL" | jq '.'
fi
echo ""

# Test 5: Ajout au panier avec grande quantité
SESSION2="test-stock-large-$(date +%s)"
LARGE_QTY=500
echo -e "${YELLOW}🛒 Test 5: Ajout au panier - Grande quantité ($LARGE_QTY unités)${NC}"
echo "POST $BASE_URL/api/cart/items"
ADD_LARGE=$(curl -s -H "Cookie: userSession=$SESSION2" \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/cart/items" \
  -d "{\"productId\": 1001, \"quantity\": $LARGE_QTY}")
SUCCESS_LARGE=$(echo "$ADD_LARGE" | jq -r '.success // false')
if [ "$SUCCESS_LARGE" == "true" ]; then
    echo -e "${GREEN}✅ Ajout réussi: $LARGE_QTY unités (mode $MODE permet les grandes quantités)${NC}"
else
    MESSAGE=$(echo "$ADD_LARGE" | jq -r '.message')
    echo -e "${YELLOW}⚠️  Ajout refusé: $MESSAGE${NC}"
    echo "   (Normal en mode TRACKED si stock insuffisant)"
fi
echo ""

# Test 6: Ajout au panier avec quantité excessive
if [ "$MODE" == "TRACKED" ]; then
    SESSION3="test-stock-excessive-$(date +%s)"
    EXCESSIVE_QTY=10000
    echo -e "${YELLOW}🛒 Test 6: Ajout au panier - Quantité excessive ($EXCESSIVE_QTY unités)${NC}"
    echo "POST $BASE_URL/api/cart/items"
    ADD_EXCESSIVE=$(curl -s -H "Cookie: userSession=$SESSION3" \
      -H "Content-Type: application/json" \
      -X POST "$BASE_URL/api/cart/items" \
      -d "{\"productId\": 1001, \"quantity\": $EXCESSIVE_QTY}")
    SUCCESS_EXCESSIVE=$(echo "$ADD_EXCESSIVE" | jq -r '.success // false')
    if [ "$SUCCESS_EXCESSIVE" == "false" ]; then
        MESSAGE=$(echo "$ADD_EXCESSIVE" | jq -r '.message')
        echo -e "${GREEN}✅ Validation correcte: $MESSAGE${NC}"
    else
        echo -e "${RED}❌ ERREUR: La validation du stock n'a pas fonctionné!${NC}"
    fi
    echo ""
fi

# Résumé
echo "========================================"
echo -e "${GREEN}✅ Tests terminés${NC}"
echo ""
echo "📊 Résumé:"
echo "  - Mode de stock: $MODE"
echo "  - Stock produit 1001: $AVAILABLE unités"
echo "  - Produits à réapprovisionner: $REORDER_COUNT"
echo ""

if [ "$MODE" == "UNLIMITED" ]; then
    echo -e "${GREEN}💡 Mode FLUX TENDU actif${NC}"
    echo "   ✅ Pas de limite de quantité"
    echo "   ✅ Commandes acceptées sans contrainte"
    echo "   ✅ Réapprovisionnement géré à la demande"
    echo ""
    echo "📝 Pour passer en mode SUIVI RÉEL:"
    echo "   1. Ajouter STOCK_MODE=TRACKED dans .env"
    echo "   2. Redémarrer le serveur"
else
    echo -e "${YELLOW}📊 Mode SUIVI RÉEL actif${NC}"
    echo "   ✅ Validation du stock en temps réel"
    echo "   ✅ Alertes de réapprovisionnement"
    echo "   ✅ Rapports d'inventaire détaillés"
    echo ""
    if [ "$REORDER_COUNT" != "0" ]; then
        echo -e "${YELLOW}⚠️  Actions recommandées:${NC}"
        echo "   - Consulter la liste de réapprovisionnement"
        echo "   - Passer commande aux fournisseurs"
        echo "   - Mettre à jour le stock après réception"
    fi
fi

echo ""
echo "🔗 Endpoints utiles:"
echo "   GET  $BASE_URL/api/products/:id                    (stock produit)"
echo "   GET  $BASE_URL/api/products/inventory/reorder-list  (liste réappro)"
echo "   GET  $BASE_URL/api/products/inventory/report        (rapport inventaire)"
echo "   POST $BASE_URL/api/products/inventory/restock/:id   (simuler réappro)"
echo ""
