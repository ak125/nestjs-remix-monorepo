#!/bin/bash

# 🧪 Script de test du flux complet : Panier → Connexion → Fusion
# Ce script teste le scénario suivant :
# 1. Créer une session invité
# 2. Ajouter des articles au panier
# 3. Se connecter
# 4. Vérifier que le panier est fusionné et que la redirection fonctionne

set -e  # Arrêter en cas d'erreur

BASE_URL="http://localhost:3000"
COOKIE_FILE="/tmp/cart-test-cookies.txt"
SESSION_FILE="/tmp/cart-test-session.txt"

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 Test du flux Panier → Connexion → Fusion${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Nettoyer les fichiers temporaires
rm -f "$COOKIE_FILE" "$SESSION_FILE"

echo -e "${YELLOW}📋 Étape 1/5 : Créer une session invité${NC}"
echo "GET $BASE_URL/api/cart"
RESPONSE=$(curl -s -c "$COOKIE_FILE" "$BASE_URL/api/cart")
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Extraire la session du cookie
if [ -f "$COOKIE_FILE" ]; then
    GUEST_SESSION=$(grep "connect.sid" "$COOKIE_FILE" | awk '{print $7}' | sed 's/s%3A//' | sed 's/\..*//')
    echo ""
    echo -e "${GREEN}✅ Session invité créée: ${GUEST_SESSION}${NC}"
    echo "$GUEST_SESSION" > "$SESSION_FILE"
else
    echo -e "${RED}❌ Erreur: Impossible de créer une session${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 Étape 2/5 : Ajouter des articles au panier${NC}"
echo "POST $BASE_URL/api/cart/items"

# Ajouter le premier produit
echo -e "${BLUE}  → Ajout produit 948921 (Plaquettes de frein)${NC}"
curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -X POST "$BASE_URL/api/cart/items" \
    -H "Content-Type: application/json" \
    -d '{"product_id": 948921, "quantity": 1}' \
    | jq '.summary' 2>/dev/null || echo "Erreur ajout produit 1"

# Ajouter le deuxième produit
echo -e "${BLUE}  → Ajout produit 5079541 (Accessoires plaquette)${NC}"
curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -X POST "$BASE_URL/api/cart/items" \
    -H "Content-Type: application/json" \
    -d '{"product_id": 5079541, "quantity": 2}' \
    | jq '.summary' 2>/dev/null || echo "Erreur ajout produit 2"

echo ""
echo -e "${YELLOW}📋 Étape 3/5 : Vérifier le contenu du panier invité${NC}"
CART_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/cart")
ITEM_COUNT=$(echo "$CART_RESPONSE" | jq -r '.totals.total_items // 0' 2>/dev/null || echo "0")
TOTAL_PRICE=$(echo "$CART_RESPONSE" | jq -r '.totals.total // 0' 2>/dev/null || echo "0")

echo -e "${GREEN}✅ Panier invité: ${ITEM_COUNT} articles - Total: ${TOTAL_PRICE}€${NC}"
echo "$CART_RESPONSE" | jq '.items[] | {product_name, quantity, price}' 2>/dev/null || echo "$CART_RESPONSE"

if [ "$ITEM_COUNT" -eq 0 ]; then
    echo -e "${RED}❌ ERREUR: Le panier est vide !${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 Étape 4/5 : Connexion avec fusion de panier${NC}"
echo "POST $BASE_URL/authenticate"
echo -e "${BLUE}  → Email: monia123@gmail.com${NC}"
echo -e "${BLUE}  → RedirectTo: /checkout${NC}"
echo -e "${BLUE}  → GuestSessionId: ${GUEST_SESSION}${NC}"

# Connexion avec les cookies et le guestSessionId
LOGIN_RESPONSE=$(curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -X POST "$BASE_URL/authenticate" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=monia123@gmail.com&password=321monia&redirectTo=/checkout&guestSessionId=$GUEST_SESSION" \
    -w "\n%{http_code}" \
    | tail -n 1)

if [ "$LOGIN_RESPONSE" = "302" ] || [ "$LOGIN_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Connexion réussie (HTTP $LOGIN_RESPONSE)${NC}"
else
    echo -e "${RED}❌ Erreur connexion (HTTP $LOGIN_RESPONSE)${NC}"
    exit 1
fi

# Extraire la nouvelle session
if [ -f "$COOKIE_FILE" ]; then
    NEW_SESSION=$(grep "connect.sid" "$COOKIE_FILE" | tail -n 1 | awk '{print $7}' | sed 's/s%3A//' | sed 's/\..*//')
    echo -e "${GREEN}✅ Nouvelle session: ${NEW_SESSION}${NC}"
fi

echo ""
echo -e "${YELLOW}📋 Étape 5/5 : Vérifier le panier après connexion${NC}"
sleep 1  # Attendre que la fusion soit terminée

CART_AFTER=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/cart")
ITEM_COUNT_AFTER=$(echo "$CART_AFTER" | jq -r '.totals.total_items // 0' 2>/dev/null || echo "0")
TOTAL_PRICE_AFTER=$(echo "$CART_AFTER" | jq -r '.totals.total // 0' 2>/dev/null || echo "0")

echo -e "${GREEN}✅ Panier après connexion: ${ITEM_COUNT_AFTER} articles - Total: ${TOTAL_PRICE_AFTER}€${NC}"
echo "$CART_AFTER" | jq '.items[] | {product_name, quantity, price}' 2>/dev/null || echo "$CART_AFTER"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Résumé du test${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Session invité      : ${GUEST_SESSION}"
echo -e "Session connectée   : ${NEW_SESSION}"
echo -e "Articles avant      : ${ITEM_COUNT}"
echo -e "Articles après      : ${ITEM_COUNT_AFTER}"
echo -e "Prix avant          : ${TOTAL_PRICE}€"
echo -e "Prix après          : ${TOTAL_PRICE_AFTER}€"
echo ""

# Vérification finale
if [ "$ITEM_COUNT_AFTER" -eq "$ITEM_COUNT" ] && [ "$ITEM_COUNT_AFTER" -gt 0 ]; then
    echo -e "${GREEN}✅ TEST RÉUSSI : Le panier a été correctement fusionné !${NC}"
    exit 0
else
    echo -e "${RED}❌ TEST ÉCHOUÉ : Le panier n'a pas été fusionné correctement${NC}"
    echo -e "${RED}   Attendu: ${ITEM_COUNT} articles${NC}"
    echo -e "${RED}   Obtenu : ${ITEM_COUNT_AFTER} articles${NC}"
    exit 1
fi
