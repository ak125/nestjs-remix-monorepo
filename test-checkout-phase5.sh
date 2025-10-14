#!/bin/bash

# 🧪 Test Phase 5: Checkout avec consignes
# Ce script teste le flux complet de création de commande avec consignes

echo "🧪 Test Phase 5: Checkout avec consignes"
echo "=========================================="
echo ""

COOKIES_FILE="/workspaces/nestjs-remix-monorepo/cookies.txt"
BASE_URL="http://localhost:3000"

# 1. Vider le panier
echo "1️⃣ Nettoyage du panier..."
curl -s -X DELETE "$BASE_URL/api/cart/items/all" \
  -b "$COOKIES_FILE" > /dev/null

# 2. Ajouter alternateur avec consigne
echo "2️⃣ Ajout alternateur (168.59€ + 72€ consigne)..."
curl -s -X POST "$BASE_URL/api/cart/items" \
  -H "Content-Type: application/json" \
  -b "$COOKIES_FILE" \
  -d '{
    "productId": "3047339",
    "quantity": 2,
    "replace": true
  }' | jq -r '.message'

# 3. Vérifier le panier
echo ""
echo "3️⃣ Vérification du panier:"
CART_DATA=$(curl -s -b "$COOKIES_FILE" "$BASE_URL/api/cart")
echo "$CART_DATA" | jq '{
  items: .items | length,
  subtotal: .totals.subtotal,
  consigne_total: .totals.consigne_total,
  total: .totals.total,
  item: .items[0] | {
    name: .product_name,
    quantity,
    price,
    consigne_unit,
    has_consigne
  }
}'

# 4. Créer la commande via l'API orders
echo ""
echo "4️⃣ Création de la commande..."

# Extraire les données du panier
ITEMS=$(echo "$CART_DATA" | jq '.items')

# Construire le payload de commande
ORDER_PAYLOAD=$(cat <<EOF
{
  "customerId": "usr_1759774640723_njikmiz59",
  "orderLines": $(echo "$ITEMS" | jq 'map({
    productId: .product_id | tostring,
    productName: .product_name,
    productReference: .product_sku,
    quantity: .quantity,
    unitPrice: .price,
    vatRate: 0,
    discount: 0,
    consigne_unit: .consigne_unit,
    has_consigne: .has_consigne
  })'),
  "billingAddress": {
    "firstName": "Test",
    "lastName": "Phase5",
    "address": "123 rue Consignes",
    "zipCode": "75001",
    "city": "Paris",
    "country": "France"
  },
  "shippingAddress": {
    "firstName": "Test",
    "lastName": "Phase5",
    "address": "123 rue Consignes",
    "zipCode": "75001",
    "city": "Paris",
    "country": "France"
  },
  "customerNote": "✅ Phase 5: Test checkout avec consignes depuis panier réel",
  "shippingMethod": "standard"
}
EOF
)

# Créer la commande
ORDER_RESULT=$(curl -s -X POST "$BASE_URL/api/orders/test/create-with-consignes" \
  -H "Content-Type: application/json" \
  -b "$COOKIES_FILE" \
  -d "$ORDER_PAYLOAD")

echo ""
echo "5️⃣ Résultat de la commande:"
echo "$ORDER_RESULT" | jq '{
  message,
  order_id: .order.ord_id,
  montants: {
    produits: .order.ord_amount_ttc,
    consignes: .order.ord_deposit_ttc,
    port: .order.ord_shipping_fee_ttc,
    total: .order.ord_total_ttc
  },
  consignes_info: .consignes_info
}'

echo ""
echo "✅ Test terminé!"
