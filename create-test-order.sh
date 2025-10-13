#!/bin/bash
# Script pour créer une commande de test avec supplément non payé
# Utilisation de l'API REST Supabase

SUPABASE_URL="https://cxpojprgwgubzjyqzmoq.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY"
CST_ID="usr_1759774640723_njikmiz59"

echo "🚀 Création des données de test pour monia123@gmail.com"
echo "=========================================="

# 1. Créer adresse de facturation
echo "📍 Création adresse facturation..."
BILLING_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/___xtr_customer_billing_address" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"cba_cst_id\": \"$CST_ID\",
    \"cba_civility\": \"Mme\",
    \"cba_name\": \"Test\",
    \"cba_fname\": \"Monia\",
    \"cba_address\": \"123 Avenue des Tests\",
    \"cba_zip_code\": \"75001\",
    \"cba_city\": \"Paris\",
    \"cba_country\": \"France\",
    \"cba_mail\": \"monia123@gmail.com\"
  }")

CBA_ID=$(echo $BILLING_RESPONSE | jq -r '.[0].cba_id')
echo "  ✅ Adresse facturation créée: ID=$CBA_ID"

# 2. Créer adresse de livraison
echo "📍 Création adresse livraison..."
DELIVERY_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/___xtr_customer_delivery_address" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"cda_cst_id\": \"$CST_ID\",
    \"cda_civility\": \"Mme\",
    \"cda_name\": \"Test\",
    \"cda_fname\": \"Monia\",
    \"cda_address\": \"456 Rue de la Livraison\",
    \"cda_zip_code\": \"75002\",
    \"cda_city\": \"Paris\",
    \"cda_country\": \"France\"
  }")

CDA_ID=$(echo $DELIVERY_RESPONSE | jq -r '.[0].cda_id')
echo "  ✅ Adresse livraison créée: ID=$CDA_ID"

# 3. Créer commande principale PAYÉE et LIVRÉE (pour avoir une facture)
echo "📦 Création commande principale payée..."
ORDER_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/___XTR_ORDER" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"ord_cst_id\": \"$CST_ID\",
    \"ord_date\": \"$(date -u -d '15 days ago' '+%Y-%m-%d %H:%M:%S')\",
    \"ord_parent\": \"0\",
    \"ord_is_pay\": 1,
    \"ord_date_pay\": \"$(date -u -d '15 days ago' '+%Y-%m-%d %H:%M:%S')\",
    \"ord_cba_id\": $CBA_ID,
    \"ord_cda_id\": $CDA_ID,
    \"ord_amount_ttc\": 478.90,
    \"ord_deposit_ttc\": 25.00,
    \"ord_shipping_fee_ttc\": 18.00,
    \"ord_total_ttc\": 521.90,
    \"ord_info\": \"Commande test - Kit embrayage complet\",
    \"ord_status\": 6
  }")

ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.[0].ord_id')
echo "  ✅ Commande principale créée: ID=$ORDER_ID (Statut 6: Livrée)"

# 4. Créer lignes de commande
echo "📝 Ajout lignes de commande..."
curl -s -X POST "$SUPABASE_URL/rest/v1/___XTR_ORDER_LINE" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "[
    {
      \"orl_ord_id\": $ORDER_ID,
      \"orl_pg_name\": \"Disques de frein avant Brembo (x2)\",
      \"orl_art_price_sell_unit_ttc\": 89.90,
      \"orl_art_quantity\": 1,
      \"orl_art_price_sell_ttc\": 89.90
    },
    {
      \"orl_ord_id\": $ORDER_ID,
      \"orl_pg_name\": \"Plaquettes de frein avant Ferodo\",
      \"orl_art_price_sell_unit_ttc\": 78.50,
      \"orl_art_quantity\": 1,
      \"orl_art_price_sell_ttc\": 78.50
    },
    {
      \"orl_ord_id\": $ORDER_ID,
      \"orl_pg_name\": \"Kit embrayage Valeo\",
      \"orl_art_price_sell_unit_ttc\": 285.00,
      \"orl_art_quantity\": 1,
      \"orl_art_price_sell_ttc\": 285.00
    },
    {
      \"orl_ord_id\": $ORDER_ID,
      \"orl_pg_name\": \"Consigne échange standard (embrayage)\",
      \"orl_art_price_sell_unit_ttc\": 25.00,
      \"orl_art_quantity\": 1,
      \"orl_art_price_sell_ttc\": 25.00
    }
  ]" > /dev/null

echo "  ✅ 4 lignes ajoutées à la commande"

# 5. Créer SUPPLÉMENT NON PAYÉ (pour tester le paiement)
echo "💰 Création supplément NON PAYÉ..."
SUPPLEMENT_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/___XTR_ORDER" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"ord_cst_id\": \"$CST_ID\",
    \"ord_date\": \"$(date -u -d '10 days ago' '+%Y-%m-%d %H:%M:%S')\",
    \"ord_parent\": \"$ORDER_ID\",
    \"ord_is_pay\": 0,
    \"ord_date_pay\": null,
    \"ord_cba_id\": $CBA_ID,
    \"ord_cda_id\": $CDA_ID,
    \"ord_amount_ttc\": 45.90,
    \"ord_deposit_ttc\": 0,
    \"ord_shipping_fee_ttc\": 8.00,
    \"ord_total_ttc\": 53.90,
    \"ord_info\": \"Supplément - Butée embrayage manquante\",
    \"ord_status\": 1
  }")

SUPPLEMENT_ID=$(echo $SUPPLEMENT_RESPONSE | jq -r '.[0].ord_id')
echo "  ✅ Supplément créé: ID=$SUPPLEMENT_ID (NON PAYÉ)"

# 6. Créer ligne du supplément
echo "📝 Ajout ligne supplément..."
curl -s -X POST "$SUPABASE_URL/rest/v1/___XTR_ORDER_LINE" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "[
    {
      \"orl_ord_id\": $SUPPLEMENT_ID,
      \"orl_pg_name\": \"Butée embrayage hydraulique Valeo\",
      \"orl_art_price_sell_unit_ttc\": 45.90,
      \"orl_art_quantity\": 1,
      \"orl_art_price_sell_ttc\": 45.90
    }
  ]" > /dev/null

echo "  ✅ Ligne ajoutée au supplément"

# 7. Créer message urgent pour le supplément
echo "💬 Création message urgent..."
curl -s -X POST "$SUPABASE_URL/rest/v1/___xtr_msg" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"msg_cst_id\": \"$CST_ID\",
    \"msg_ord_id\": $ORDER_ID,
    \"msg_subject\": \"URGENT: Pièce manquante - Supplément à régler\",
    \"msg_content\": \"<p>Bonjour Monia,</p><p><strong style='color: red;'>Information importante</strong></p><p>Il manque la butée hydraulique pour compléter votre kit embrayage.</p><p>Un supplément de commande a été créé.</p><p><strong>Montant: 53.90€ TTC</strong> (livraison incluse)</p><p>Merci de procéder au règlement pour finaliser votre commande.</p><p>Cordialement,<br>L'équipe AutoMecanik</p>\",
    \"msg_open\": 0,
    \"msg_date\": \"$(date -u -d '10 days ago' '+%Y-%m-%d %H:%M:%S')\",
    \"msg_type\": \"system\"
  }" > /dev/null

echo "  ✅ Message créé"

echo ""
echo "=========================================="
echo "✅ DONNÉES DE TEST CRÉÉES AVEC SUCCÈS !"
echo "=========================================="
echo "📧 Client: monia123@gmail.com"
echo "🆔 CST_ID: $CST_ID"
echo "📦 Commande principale: #$ORDER_ID (PAYÉE et LIVRÉE - 521.90€)"
echo "💰 Supplément: #$SUPPLEMENT_ID (NON PAYÉ - 53.90€)"
echo ""
echo "🧪 TESTS À EFFECTUER:"
echo "1. Voir la facture: http://localhost:3000/account/orders/$ORDER_ID/invoice"
echo "2. Payer le supplément: http://localhost:3000/account/orders/$SUPPLEMENT_ID/invoice"
echo "3. Liste commandes: http://localhost:3000/account/orders"
echo "=========================================="
