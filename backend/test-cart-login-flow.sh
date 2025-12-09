#!/bin/bash

# ðŸ§ª Script de test du flux complet : Panier â†’ Connexion â†’ Fusion
# Ce script teste le scÃ©nario suivant :
# 1. CrÃ©er une session invitÃ©
# 2. Ajouter des articles au panier
# 3. Se connecter
# 4. VÃ©rifier que le panier est fusionnÃ© et que la redirection fonctionne

set -e  # ArrÃªter en cas d'erreur

BASE_URL="http://localhost:3000"
COOKIE_FILE="/tmp/cart-test-cookies.txt"
SESSION_FILE="/tmp/cart-test-session.txt"

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BLUE}ðŸ§ª Test du flux Panier â†’ Connexion â†’ Fusion${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo ""

# Nettoyer les fichiers temporaires
rm -f "$COOKIE_FILE" "$SESSION_FILE"

echo -e "${YELLOW}ðŸ“‹ Ã‰tape 1/5 : CrÃ©er une session invitÃ©${NC}"
echo "GET $BASE_URL/api/cart"
RESPONSE=$(curl -s -c "$COOKIE_FILE" "$BASE_URL/api/cart")
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Extraire la session du cookie
if [ -f "$COOKIE_FILE" ]; then
    GUEST_SESSION=$(grep "connect.sid" "$COOKIE_FILE" | awk '{print $7}' | sed 's/s%3A//' | sed 's/\..*//')
    echo ""
    echo -e "${GREEN}âœ… Session invitÃ© crÃ©Ã©e: ${GUEST_SESSION}${NC}"
    echo "$GUEST_SESSION" > "$SESSION_FILE"
else
    echo -e "${RED}âŒ Erreur: Impossible de crÃ©er une session${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}ðŸ“‹ Ã‰tape 2/5 : Ajouter des articles au panier${NC}"
echo "POST $BASE_URL/api/cart/items"

# Ajouter le premier produit
echo -e "${BLUE}  â†’ Ajout produit 948921 (Plaquettes de frein)${NC}"
curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -X POST "$BASE_URL/api/cart/items" \
    -H "Content-Type: application/json" \
    -d '{"product_id": 948921, "quantity": 1}' \
    | jq '.summary' 2>/dev/null || echo "Erreur ajout produit 1"

# Ajouter le deuxiÃ¨me produit
echo -e "${BLUE}  â†’ Ajout produit 5079541 (Accessoires plaquette)${NC}"
curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -X POST "$BASE_URL/api/cart/items" \
    -H "Content-Type: application/json" \
    -d '{"product_id": 5079541, "quantity": 2}' \
    | jq '.summary' 2>/dev/null || echo "Erreur ajout produit 2"

echo ""
echo -e "${YELLOW}ðŸ“‹ Ã‰tape 3/5 : VÃ©rifier le contenu du panier invitÃ©${NC}"
CART_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/cart")
ITEM_COUNT=$(echo "$CART_RESPONSE" | jq -r '.totals.total_items // 0' 2>/dev/null || echo "0")
TOTAL_PRICE=$(echo "$CART_RESPONSE" | jq -r '.totals.total // 0' 2>/dev/null || echo "0")

echo -e "${GREEN}âœ… Panier invitÃ©: ${ITEM_COUNT} articles - Total: ${TOTAL_PRICE}â‚¬${NC}"
echo "$CART_RESPONSE" | jq '.items[] | {product_name, quantity, price}' 2>/dev/null || echo "$CART_RESPONSE"

if [ "$ITEM_COUNT" -eq 0 ]; then
    echo -e "${RED}âŒ ERREUR: Le panier est vide !${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}ðŸ“‹ Ã‰tape 4/5 : Connexion avec fusion de panier${NC}"
echo "POST $BASE_URL/authenticate"
echo -e "${BLUE}  â†’ Email: monia123@gmail.com${NC}"
echo -e "${BLUE}  â†’ RedirectTo: /checkout${NC}"
echo -e "${BLUE}  â†’ GuestSessionId: ${GUEST_SESSION}${NC}"

# Connexion avec les cookies et le guestSessionId
LOGIN_RESPONSE=$(curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -X POST "$BASE_URL/authenticate" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=monia123@gmail.com&password=321monia&redirectTo=/checkout&guestSessionId=$GUEST_SESSION" \
    -w "\n%{http_code}" \
    | tail -n 1)

if [ "$LOGIN_RESPONSE" = "302" ] || [ "$LOGIN_RESPONSE" = "200" ]; then
    echo -e "${GREEN}âœ… Connexion rÃ©ussie (HTTP $LOGIN_RESPONSE)${NC}"
else
    echo -e "${RED}âŒ Erreur connexion (HTTP $LOGIN_RESPONSE)${NC}"
    exit 1
fi

# Extraire la nouvelle session
if [ -f "$COOKIE_FILE" ]; then
    NEW_SESSION=$(grep "connect.sid" "$COOKIE_FILE" | tail -n 1 | awk '{print $7}' | sed 's/s%3A//' | sed 's/\..*//')
    echo -e "${GREEN}âœ… Nouvelle session: ${NEW_SESSION}${NC}"
fi

echo ""
echo -e "${YELLOW}ðŸ“‹ Ã‰tape 5/5 : VÃ©rifier le panier aprÃ¨s connexion${NC}"
sleep 1  # Attendre que la fusion soit terminÃ©e

CART_AFTER=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/cart")
ITEM_COUNT_AFTER=$(echo "$CART_AFTER" | jq -r '.totals.total_items // 0' 2>/dev/null || echo "0")
TOTAL_PRICE_AFTER=$(echo "$CART_AFTER" | jq -r '.totals.total // 0' 2>/dev/null || echo "0")

echo -e "${GREEN}âœ… Panier aprÃ¨s connexion: ${ITEM_COUNT_AFTER} articles - Total: ${TOTAL_PRICE_AFTER}â‚¬${NC}"
echo "$CART_AFTER" | jq '.items[] | {product_name, quantity, price}' 2>/dev/null || echo "$CART_AFTER"

echo ""
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "${BLUE}ðŸ“Š RÃ©sumÃ© du test${NC}"
echo -e "${BLUE}â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”${NC}"
echo -e "Session invitÃ©      : ${GUEST_SESSION}"
echo -e "Session connectÃ©e   : ${NEW_SESSION}"
echo -e "Articles avant      : ${ITEM_COUNT}"
echo -e "Articles aprÃ¨s      : ${ITEM_COUNT_AFTER}"
echo -e "Prix avant          : ${TOTAL_PRICE}â‚¬"
echo -e "Prix aprÃ¨s          : ${TOTAL_PRICE_AFTER}â‚¬"
echo ""

# VÃ©rification finale
if [ "$ITEM_COUNT_AFTER" -eq "$ITEM_COUNT" ] && [ "$ITEM_COUNT_AFTER" -gt 0 ]; then
    echo -e "${GREEN}âœ… TEST RÃ‰USSI : Le panier a Ã©tÃ© correctement fusionnÃ© !${NC}"
    exit 0
else
    echo -e "${RED}âŒ TEST Ã‰CHOUÃ‰ : Le panier n'a pas Ã©tÃ© fusionnÃ© correctement${NC}"
    echo -e "${RED}   Attendu: ${ITEM_COUNT} articles${NC}"
    echo -e "${RED}   Obtenu : ${ITEM_COUNT_AFTER} articles${NC}"
    exit 1
fi
