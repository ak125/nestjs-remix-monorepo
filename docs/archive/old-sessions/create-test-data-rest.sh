#!/bin/bash

# Script de création de données de test via API REST Supabase
# Date: 6 octobre 2025
# Pour: monia123@gmail.com

set -e

# Configuration
SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SUPABASE_KEY="${SUPABASE_ANON_KEY:-your_anon_key}"
USER_EMAIL="monia123@gmail.com"

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Création données test via REST API pour monia123@gmail.com ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 0: Récupérer le CST_ID
# ═══════════════════════════════════════════════════════════════

echo -e "${YELLOW}🔍 Recherche de l'utilisateur...${NC}"

CST_RESPONSE=$(curl -s -G "$SUPABASE_URL/rest/v1/___xtr_customer" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  --data-urlencode "cst_mail=eq.$USER_EMAIL" \
  --data-urlencode "select=cst_id,cst_mail,cst_name,cst_fname")

CST_ID=$(echo "$CST_RESPONSE" | grep -o '"cst_id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$CST_ID" ]; then
  echo -e "${RED}❌ Utilisateur $USER_EMAIL non trouvé${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Utilisateur trouvé: CST_ID=$CST_ID${NC}"
echo "$CST_RESPONSE" | jq '.'
echo ""

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 1: Inspecter les structures de tables
# ═══════════════════════════════════════════════════════════════

echo -e "${YELLOW}🔍 Inspection structure table adresse facturation...${NC}"

# Récupérer un exemple d'adresse pour voir la structure
SAMPLE_BILLING=$(curl -s -G "$SUPABASE_URL/rest/v1/___xtr_customer_billing_address" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  --data-urlencode "limit=1")

echo "Structure détectée:"
echo "$SAMPLE_BILLING" | jq 'if length > 0 then .[0] | keys else [] end'
echo ""

echo -e "${YELLOW}🔍 Inspection structure table adresse livraison...${NC}"

SAMPLE_DELIVERY=$(curl -s -G "$SUPABASE_URL/rest/v1/___xtr_customer_delivery_address" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  --data-urlencode "limit=1")

echo "Structure détectée:"
echo "$SAMPLE_DELIVERY" | jq 'if length > 0 then .[0] | keys else [] end'
echo ""

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 2: Créer les adresses
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}📍 Création des adresses...${NC}"

# Adresse de facturation
echo "  → Adresse de facturation..."
BILLING_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/___xtr_customer_billing_address" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"cba_cst_id\": $CST_ID,
    \"cba_civility\": \"Mme\",
    \"cba_name\": \"Test\",
    \"cba_fname\": \"Monia\",
    \"cba_address\": \"123 Avenue des Tests\",
    \"cba_zip_code\": \"75001\",
    \"cba_city\": \"Paris\",
    \"cba_country\": \"France\",
    \"cba_mail\": \"$USER_EMAIL\"
  }")

CBA_ID=$(echo "$BILLING_RESPONSE" | jq -r '.[0].cba_id // empty')

if [ -z "$CBA_ID" ]; then
  echo -e "${RED}❌ Échec création adresse facturation${NC}"
  echo "$BILLING_RESPONSE" | jq '.'
  exit 1
fi

echo -e "${GREEN}  ✅ Adresse facturation: ID=$CBA_ID${NC}"

# Adresse de livraison
echo "  → Adresse de livraison..."
DELIVERY_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/___xtr_customer_delivery_address" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"cda_cst_id\": $CST_ID,
    \"cda_civility\": \"Mme\",
    \"cda_name\": \"Test\",
    \"cda_fname\": \"Monia\",
    \"cda_address\": \"456 Rue de la Livraison\",
    \"cda_zip_code\": \"75002\",
    \"cda_city\": \"Paris\",
    \"cda_country\": \"France\"
  }")

CDA_ID=$(echo "$DELIVERY_RESPONSE" | jq -r '.[0].cda_id // empty')

if [ -z "$CDA_ID" ]; then
  echo -e "${RED}❌ Échec création adresse livraison${NC}"
  echo "$DELIVERY_RESPONSE" | jq '.'
  exit 1
fi

echo -e "${GREEN}  ✅ Adresse livraison: ID=$CDA_ID${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# FONCTION: Créer une commande
# ═══════════════════════════════════════════════════════════════

create_order() {
  local DESC="$1"
  local DAYS_AGO="$2"
  local IS_PAID="$3"
  local STATUS="$4"
  local PARENT="$5"
  local AMOUNT="$6"
  local SHIPPING="$7"
  
  local ORDER_DATE
  if [ "$DAYS_AGO" = "0" ]; then
    ORDER_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  else
    ORDER_DATE=$(date -u -d "$DAYS_AGO days ago" +"%Y-%m-%dT%H:%M:%SZ")
  fi
  
  local PAY_DATE="null"
  if [ "$IS_PAID" = "1" ]; then
    PAY_DATE="\"$ORDER_DATE\""
  fi
  
  local TOTAL=$(echo "$AMOUNT + $SHIPPING" | bc)
  
  echo "  → $DESC..."
  
  ORDER_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/___xtr_order" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{
      \"ord_cst_id\": $CST_ID,
      \"ord_date\": \"$ORDER_DATE\",
      \"ord_parent\": \"$PARENT\",
      \"ord_is_pay\": $IS_PAID,
      \"ord_date_pay\": $PAY_DATE,
      \"ord_cba_id\": $CBA_ID,
      \"ord_cda_id\": $CDA_ID,
      \"ord_amount_ttc\": $AMOUNT,
      \"ord_deposit_ttc\": 0,
      \"ord_shipping_fee_ttc\": $SHIPPING,
      \"ord_total_ttc\": $TOTAL,
      \"ord_info\": \"$DESC\",
      \"ord_status\": $STATUS
    }")
  
  ORD_ID=$(echo "$ORDER_RESPONSE" | jq -r '.[0].ord_id // empty')
  
  if [ -z "$ORD_ID" ]; then
    echo -e "${RED}    ❌ Échec création commande${NC}"
    echo "$ORDER_RESPONSE" | jq '.'
    return 1
  fi
  
  echo -e "${GREEN}    ✅ Commande créée: ID=$ORD_ID${NC}"
  echo "$ORD_ID"
}

# Fonction: Ajouter lignes de commande
add_order_lines() {
  local ORDER_ID="$1"
  shift
  local LINES=("$@")
  
  for LINE in "${LINES[@]}"; do
    IFS='|' read -r NAME UNIT_PRICE QTY TOTAL <<< "$LINE"
    
    curl -s -X POST "$SUPABASE_URL/rest/v1/___xtr_order_line" \
      -H "apikey: $SUPABASE_KEY" \
      -H "Authorization: Bearer $SUPABASE_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"orl_ord_id\": $ORDER_ID,
        \"orl_pg_name\": \"$NAME\",
        \"orl_art_price_sell_unit_ttc\": $UNIT_PRICE,
        \"orl_art_quantity\": $QTY,
        \"orl_art_price_sell_ttc\": $TOTAL
      }" > /dev/null
  done
}

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 3: Créer les commandes
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}📦 Création des commandes...${NC}"

# Commande 1: En attente
ORDER1_ID=$(create_order "Commande en attente de paiement" 0 0 1 "0" 121.70 15.00)
add_order_lines "$ORDER1_ID" \
  "Filtre à huile Bosch Premium|15.90|2|31.80" \
  "Plaquettes de frein avant Brembo|89.90|1|89.90"

# Commande 2: Payée en préparation
ORDER2_ID=$(create_order "Commande payée en préparation" 3 1 2 "0" 245.80 15.00)
add_order_lines "$ORDER2_ID" \
  "Kit distribution Bosch|189.90|1|189.90" \
  "Huile moteur 5W30 Castrol 5L|27.95|2|55.90"

# Commande 3: Expédiée
ORDER3_ID=$(create_order "Commande expédiée - Tracking: 3S123456789FR" 7 1 4 "0" 156.50 12.00)
add_order_lines "$ORDER3_ID" \
  "Balai d'essuie-glace Bosch Aerotwin 650mm|28.90|2|57.80" \
  "Ampoules H7 Philips WhiteVision|24.90|4|99.60"

# Commande 4: Livrée
ORDER4_ID=$(create_order "Commande livrée avec succès" 15 1 6 "0" 478.90 18.00)
add_order_lines "$ORDER4_ID" \
  "Disques de frein avant Brembo (x2)|89.90|1|89.90" \
  "Plaquettes de frein avant Ferodo|78.50|1|78.50" \
  "Kit embrayage Valeo|285.00|1|285.00" \
  "Consigne échange standard (embrayage)|25.00|1|25.00"

# Commande 5: Supplément non payé
ORDER5_ID=$(create_order "Supplément pièce manquante - Butée embrayage" 10 0 1 "$ORDER4_ID" 45.90 8.00)
add_order_lines "$ORDER5_ID" \
  "Butée embrayage hydraulique Valeo|45.90|1|45.90"

# Commande 6: Ancienne 2024
ORDER6_ID=$(create_order "Ancienne commande 2024" 365 1 6 "0" 312.50 15.00)
add_order_lines "$ORDER6_ID" \
  "Filtre à air Mann Filter|18.90|2|37.80" \
  "Filtre habitacle charbon actif|24.90|1|24.90" \
  "Kit courroie accessoires Gates|124.90|2|249.80"

echo ""

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 4: Créer les messages
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}💬 Création des messages...${NC}"

create_message() {
  local ORDER_ID="$1"
  local SUBJECT="$2"
  local CONTENT="$3"
  local IS_OPEN="$4"
  local DAYS_AGO="$5"
  local TYPE="$6"
  
  local MSG_DATE
  if [ "$DAYS_AGO" = "0" ]; then
    MSG_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  else
    MSG_DATE=$(date -u -d "$DAYS_AGO days ago" +"%Y-%m-%dT%H:%M:%SZ")
  fi
  
  local ORD_ID_VALUE="$ORDER_ID"
  if [ "$ORDER_ID" = "null" ]; then
    ORD_ID_VALUE="null"
  fi
  
  curl -s -X POST "$SUPABASE_URL/rest/v1/___xtr_msg" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"msg_cst_id\": $CST_ID,
      \"msg_ord_id\": $ORD_ID_VALUE,
      \"msg_subject\": \"$SUBJECT\",
      \"msg_content\": \"$CONTENT\",
      \"msg_open\": $IS_OPEN,
      \"msg_date\": \"$MSG_DATE\",
      \"msg_type\": \"$TYPE\"
    }" > /dev/null
}

echo "  → Messages sur commandes..."
create_message "$ORDER2_ID" "Confirmation de commande" "<p>Bonjour Monia,</p><p>Votre commande a bien été reçue.</p>" 0 3 "order"
create_message "$ORDER3_ID" "Expédition" "<p>Votre commande a été expédiée. Tracking: 3S123456789FR</p>" 1 5 "shipping"
create_message "$ORDER4_ID" "URGENT: Complément requis" "<p>Il manque la butée hydraulique. Supplément créé.</p>" 0 10 "system"
create_message "null" "Bienvenue" "<p>Bienvenue sur AutoMecanik!</p>" 1 30 "system"
create_message "$ORDER4_ID" "Retour consigne" "<p>Vous pouvez retourner votre pièce d'échange.</p>" 0 12 "system"

echo -e "${GREEN}  ✅ 5 messages créés${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# RÉSUMÉ FINAL
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              ✅ CRÉATION TERMINÉE AVEC SUCCÈS              ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Utilisateur:${NC} $USER_EMAIL (ID: $CST_ID)"
echo -e "${GREEN}Adresses:${NC} Facturation=$CBA_ID, Livraison=$CDA_ID"
echo ""
echo -e "${GREEN}Commandes créées:${NC}"
echo "  1. En attente: $ORDER1_ID"
echo "  2. Payée/Préparation: $ORDER2_ID"
echo "  3. Expédiée: $ORDER3_ID"
echo "  4. Livrée/Facture: $ORDER4_ID"
echo "  5. Supplément NON PAYÉ (de #$ORDER4_ID): $ORDER5_ID"
echo "  6. Ancienne 2024: $ORDER6_ID"
echo ""
echo -e "${GREEN}5 messages créés${NC}"
echo ""
echo -e "${YELLOW}🧪 Tests suggérés:${NC}"
echo "  → /account/orders"
echo "  → /account/orders/$ORDER4_ID/invoice"
echo "  → /account/orders/$ORDER5_ID/invoice (avec paiement)"
echo "  → /account/messages"
echo ""
