#!/bin/bash

# Script de création de données de test pour monia123@gmail.com
# Date: 6 octobre 2025
# User ID: usr_1759774640723_njikmiz59

set -e  # Arrêter en cas d'erreur

# Configuration
BACKEND_URL="http://localhost:3000"
USER_EMAIL="monia123@gmail.com"
USER_ID="usr_1759774640723_njikmiz59"

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Création données test pour monia123@gmail.com ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Note importante
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "Vous devez être connecté avec monia123@gmail.com"
echo "Le script utilisera votre session cookie automatiquement"
echo ""
read -p "Appuyez sur Entrée pour continuer..."
echo ""

# Obtenir le cookie de session
echo -e "${BLUE}🔐 Récupération de la session...${NC}"
COOKIE_FILE="/tmp/monia_session_cookie.txt"

# Créer une session en se connectant
echo "Tentative de connexion..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST "$BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "monia123@gmail.com",
    "password": "votre_mot_de_passe_ici"
  }' || echo "ERROR")

if [[ "$LOGIN_RESPONSE" == "ERROR" ]]; then
  echo -e "${RED}❌ Erreur de connexion${NC}"
  echo "Assurez-vous que:"
  echo "  1. Le backend est démarré sur $BACKEND_URL"
  echo "  2. Le mot de passe est correct"
  echo "  3. L'utilisateur monia123@gmail.com existe"
  exit 1
fi

echo -e "${GREEN}✅ Session établie${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 1: CRÉER DES ADRESSES
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}📍 ÉTAPE 1: Création des adresses${NC}"
echo "════════════════════════════════════════"
echo ""

# Note: Les adresses sont normalement créées dans ___xtr_customer_billing_address
# et ___xtr_customer_delivery_address lors de la première commande
# Ici on va les créer via SQL direct car il n'y a pas d'endpoint dédié

echo -e "${YELLOW}Note: Les adresses seront créées automatiquement avec les commandes${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 2: CRÉER DES COMMANDES DE TEST
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}📦 ÉTAPE 2: Création des commandes${NC}"
echo "════════════════════════════════════════"
echo ""

# Fonction pour créer une commande
create_order() {
  local ORDER_NUM=$1
  local STATUS=$2
  local IS_PAID=$3
  local PARENT_ID=$4
  local DESCRIPTION=$5
  
  echo -e "${YELLOW}Création commande #${ORDER_NUM}: ${DESCRIPTION}${NC}"
  
  # Déterminer si c'est un supplément
  local IS_SUPPLEMENT="false"
  if [[ -n "$PARENT_ID" && "$PARENT_ID" != "0" ]]; then
    IS_SUPPLEMENT="true"
  fi
  
  # Créer la commande via l'API
  RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$BACKEND_URL/api/orders/test/create" \
    -H "Content-Type: application/json" \
    -d "{
      \"customerId\": \"$USER_ID\",
      \"orderLines\": [
        {
          \"productId\": \"PROD_${ORDER_NUM}_1\",
          \"productName\": \"Filtre à huile Bosch ${ORDER_NUM}\",
          \"productReference\": \"REF-${ORDER_NUM}-001\",
          \"quantity\": 2,
          \"unitPrice\": 15.90,
          \"vatRate\": 20,
          \"discount\": 0
        },
        {
          \"productId\": \"PROD_${ORDER_NUM}_2\",
          \"productName\": \"Plaquettes de frein avant ${ORDER_NUM}\",
          \"productReference\": \"REF-${ORDER_NUM}-002\",
          \"quantity\": 1,
          \"unitPrice\": 89.90,
          \"vatRate\": 20,
          \"discount\": 5
        }
      ],
      \"billingAddress\": {
        \"civility\": \"Mme\",
        \"firstName\": \"Monia\",
        \"lastName\": \"Test\",
        \"address\": \"123 Avenue des Tests\",
        \"zipCode\": \"75001\",
        \"city\": \"Paris\",
        \"country\": \"France\",
        \"phone\": \"0123456789\",
        \"email\": \"monia123@gmail.com\"
      },
      \"shippingAddress\": {
        \"civility\": \"Mme\",
        \"firstName\": \"Monia\",
        \"lastName\": \"Test\",
        \"address\": \"456 Rue de la Livraison\",
        \"zipCode\": \"75002\",
        \"city\": \"Paris\",
        \"country\": \"France\",
        \"phone\": \"0123456789\"
      },
      \"customerNote\": \"${DESCRIPTION}\",
      \"shippingMethod\": \"standard\",
      \"status\": ${STATUS},
      \"isPaid\": ${IS_PAID},
      \"parentOrderId\": \"${PARENT_ID}\"
    }" 2>&1)
  
  if echo "$RESPONSE" | grep -q "order"; then
    echo -e "${GREEN}  ✅ Commande #${ORDER_NUM} créée${NC}"
    # Extraire l'ID de la commande
    ORDER_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo "  ID: $ORDER_ID"
  else
    echo -e "${RED}  ❌ Échec création commande #${ORDER_NUM}${NC}"
    echo "  Réponse: $RESPONSE"
  fi
  
  echo ""
  sleep 1
}

# Commande 1: En attente de paiement
create_order 1 1 "false" "0" "Commande en attente de paiement"

# Commande 2: Payée et en préparation
create_order 2 2 "true" "0" "Commande payée en préparation"

# Commande 3: Expédiée
create_order 3 4 "true" "0" "Commande expédiée"

# Commande 4: Livrée (facture disponible)
create_order 4 6 "true" "0" "Commande livrée avec facture"

# Commande 5: Supplément non payé
create_order 5 1 "false" "4" "Supplément non payé pour commande #4"

# Commande 6: Ancienne commande payée
create_order 6 6 "true" "0" "Ancienne commande 2024"

echo ""
echo -e "${GREEN}✅ Création des commandes terminée${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 3: CRÉER DES MESSAGES
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}💬 ÉTAPE 3: Création des messages${NC}"
echo "════════════════════════════════════════"
echo ""

# Fonction pour créer un message
create_message() {
  local MSG_NUM=$1
  local SUBJECT=$2
  local CONTENT=$3
  local IS_OPEN=$4
  local ORDER_ID=$5
  
  echo -e "${YELLOW}Création message #${MSG_NUM}: ${SUBJECT}${NC}"
  
  RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$BACKEND_URL/api/messages" \
    -H "Content-Type: application/json" \
    -d "{
      \"subject\": \"${SUBJECT}\",
      \"content\": \"${CONTENT}\",
      \"orderId\": \"${ORDER_ID}\",
      \"isOpen\": ${IS_OPEN}
    }" 2>&1 || echo "ERROR")
  
  if [[ "$RESPONSE" != "ERROR" ]] && echo "$RESPONSE" | grep -q "id"; then
    echo -e "${GREEN}  ✅ Message #${MSG_NUM} créé${NC}"
  else
    echo -e "${RED}  ❌ Échec création message #${MSG_NUM}${NC}"
  fi
  
  echo ""
  sleep 0.5
}

# Message 1: Non lu sur commande 2
create_message 1 "Confirmation de commande" "Votre commande a bien été reçue et est en cours de préparation." 0 2

# Message 2: Lu sur commande 3
create_message 2 "Expédition de votre commande" "Votre commande a été expédiée. Numéro de suivi: 123456789FR" 1 3

# Message 3: Non lu urgent
create_message 3 "URGENT: Complément d'information requis" "Nous avons besoin d'informations complémentaires concernant votre commande." 0 4

# Message 4: Message système
create_message 4 "Bienvenue sur AutoMecanik" "Merci de votre inscription. Profitez de vos achats!" 1 0

echo ""
echo -e "${GREEN}✅ Création des messages terminée${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# RÉSUMÉ
# ═══════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║            RÉCAPITULATIF DES DONNÉES           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}👤 Utilisateur:${NC} monia123@gmail.com"
echo -e "${GREEN}🆔 ID:${NC} $USER_ID"
echo ""

echo -e "${YELLOW}📦 Commandes créées:${NC}"
echo "  1. Commande en attente de paiement (Status 1)"
echo "  2. Commande payée en préparation (Status 2)"
echo "  3. Commande expédiée (Status 4)"
echo "  4. Commande livrée avec facture (Status 6)"
echo "  5. Supplément non payé rattaché à #4"
echo "  6. Ancienne commande payée 2024"
echo ""

echo -e "${YELLOW}💬 Messages créés:${NC}"
echo "  1. Message non lu sur commande #2"
echo "  2. Message lu sur commande #3"
echo "  3. Message urgent non lu sur commande #4"
echo "  4. Message système de bienvenue"
echo ""

echo -e "${YELLOW}📍 Adresses:${NC}"
echo "  Facturation: 123 Avenue des Tests, 75001 Paris"
echo "  Livraison: 456 Rue de la Livraison, 75002 Paris"
echo ""

# ═══════════════════════════════════════════════════════════════
# TESTS SUGGÉRÉS
# ═══════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}🧪 TESTS À EFFECTUER${NC}"
echo "════════════════════════════════════════"
echo ""

echo "1️⃣  Liste des commandes:"
echo "   http://localhost:3001/account/orders"
echo ""

echo "2️⃣  Facture commande livrée (#4):"
echo "   http://localhost:3001/account/orders/4/invoice"
echo "   → Doit afficher 'Facture n° 4/F'"
echo ""

echo "3️⃣  Supplément à payer (#5):"
echo "   http://localhost:3001/account/orders/5/invoice"
echo "   → Doit afficher formulaire de paiement Paybox/PayPal"
echo ""

echo "4️⃣  Bon de commande non payé (#1):"
echo "   http://localhost:3001/account/orders/1/invoice"
echo "   → Doit afficher 'Bon de commande n° 1/A'"
echo ""

echo "5️⃣  Messages non lus:"
echo "   http://localhost:3001/account/messages"
echo "   → Doit afficher 2 messages non lus"
echo ""

echo "6️⃣  Détail d'un message:"
echo "   http://localhost:3001/account/messages/1"
echo "   → Message doit être marqué comme lu automatiquement"
echo ""

echo "7️⃣  Dashboard profil:"
echo "   http://localhost:3001/account/dashboard"
echo "   → Doit afficher statistiques des commandes et messages"
echo ""

# ═══════════════════════════════════════════════════════════════
# COMMANDES CURL POUR TESTS MANUELS
# ═══════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}📝 COMMANDES CURL UTILES${NC}"
echo "════════════════════════════════════════"
echo ""

echo "# Lister toutes les commandes"
echo "curl -b '$COOKIE_FILE' '$BACKEND_URL/api/orders'"
echo ""

echo "# Obtenir détails commande #4"
echo "curl -b '$COOKIE_FILE' '$BACKEND_URL/api/orders/4'"
echo ""

echo "# Lister tous les messages"
echo "curl -b '$COOKIE_FILE' '$BACKEND_URL/api/messages'"
echo ""

echo "# Marquer message comme lu"
echo "curl -b '$COOKIE_FILE' -X PATCH '$BACKEND_URL/api/messages/1/read'"
echo ""

echo "# Tester paiement supplément"
echo "curl -b '$COOKIE_FILE' -X POST '$BACKEND_URL/api/payments/proceed-supplement' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"orderId\": \"5\", \"paymentMethod\": \"PAYBOX\"}'"
echo ""

# Nettoyage
rm -f "$COOKIE_FILE"

echo ""
echo -e "${GREEN}🎉 Script terminé avec succès !${NC}"
echo ""
