#!/bin/bash

# Script de test pour la page détail commande enrichie
# Vérifie que toutes les données nécessaires sont présentes dans l'API

echo "======================================"
echo "🧪 TEST - Page Détail Commande"
echo "======================================"
echo ""

ORDER_ID="ORD-1759787157480-665"
API_URL="http://localhost:3000/api/legacy-orders/${ORDER_ID}"

echo "📋 Test de l'API: ${API_URL}"
echo ""

# Test 1: API accessible
echo "1️⃣ Test: API accessible..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}")
if [ "${HTTP_CODE}" = "200" ]; then
    echo "   ✅ API accessible (HTTP 200)"
else
    echo "   ❌ API non accessible (HTTP ${HTTP_CODE})"
    exit 1
fi
echo ""

# Test 2: Structure de base
echo "2️⃣ Test: Structure de base..."
RESPONSE=$(curl -s "${API_URL}")

# Vérifier success
SUCCESS=$(echo "${RESPONSE}" | jq -r '.success')
if [ "${SUCCESS}" = "true" ]; then
    echo "   ✅ success: true"
else
    echo "   ❌ success != true"
fi

# Vérifier data
DATA_EXISTS=$(echo "${RESPONSE}" | jq -r '.data | type')
if [ "${DATA_EXISTS}" = "object" ]; then
    echo "   ✅ data: object présent"
else
    echo "   ❌ data non présent"
fi
echo ""

# Test 3: Champs commande
echo "3️⃣ Test: Champs de commande..."
ORD_ID=$(echo "${RESPONSE}" | jq -r '.data.ord_id')
ORD_CST_ID=$(echo "${RESPONSE}" | jq -r '.data.ord_cst_id')
ORD_DATE=$(echo "${RESPONSE}" | jq -r '.data.ord_date')
ORD_TOTAL=$(echo "${RESPONSE}" | jq -r '.data.ord_total_ttc')
ORD_STATUS=$(echo "${RESPONSE}" | jq -r '.data.ord_ords_id')

echo "   ord_id: ${ORD_ID}"
echo "   ord_cst_id: ${ORD_CST_ID}"
echo "   ord_date: ${ORD_DATE}"
echo "   ord_total_ttc: ${ORD_TOTAL} €"
echo "   ord_ords_id: ${ORD_STATUS}"

if [ "${ORD_ID}" != "null" ] && [ "${ORD_CST_ID}" != "null" ]; then
    echo "   ✅ Champs commande OK"
else
    echo "   ❌ Champs commande manquants"
fi
echo ""

# Test 4: Client
echo "4️⃣ Test: Informations client..."
CUSTOMER_EXISTS=$(echo "${RESPONSE}" | jq -r '.data.customer | type')
if [ "${CUSTOMER_EXISTS}" = "object" ]; then
    CST_MAIL=$(echo "${RESPONSE}" | jq -r '.data.customer.cst_mail')
    CST_NAME=$(echo "${RESPONSE}" | jq -r '.data.customer.cst_name')
    CST_FNAME=$(echo "${RESPONSE}" | jq -r '.data.customer.cst_fname')
    echo "   ✅ Customer: ${CST_FNAME} ${CST_NAME} (${CST_MAIL})"
else
    echo "   ⚠️  Customer: null ou non disponible"
fi
echo ""

# Test 5: Adresses
echo "5️⃣ Test: Adresses..."
BILLING=$(echo "${RESPONSE}" | jq -r '.data.billingAddress | type')
DELIVERY=$(echo "${RESPONSE}" | jq -r '.data.deliveryAddress | type')

if [ "${BILLING}" = "object" ]; then
    echo "   ✅ billingAddress: présente"
elif [ "${BILLING}" = "null" ]; then
    echo "   ⚠️  billingAddress: null (normal si non renseignée)"
else
    echo "   ❌ billingAddress: erreur"
fi

if [ "${DELIVERY}" = "object" ]; then
    echo "   ✅ deliveryAddress: présente"
elif [ "${DELIVERY}" = "null" ]; then
    echo "   ⚠️  deliveryAddress: null (normal si non renseignée)"
else
    echo "   ❌ deliveryAddress: erreur"
fi
echo ""

# Test 6: Lignes de commande
echo "6️⃣ Test: Lignes de commande..."
ORDER_LINES=$(echo "${RESPONSE}" | jq -r '.data.orderLines | type')

if [ "${ORDER_LINES}" = "array" ]; then
    LINES_COUNT=$(echo "${RESPONSE}" | jq -r '.data.orderLines | length')
    echo "   ✅ orderLines: array avec ${LINES_COUNT} ligne(s)"
    
    if [ "${LINES_COUNT}" -gt 0 ]; then
        echo ""
        echo "   📦 Première ligne:"
        FIRST_LINE=$(echo "${RESPONSE}" | jq -r '.data.orderLines[0]')
        
        ORL_ID=$(echo "${FIRST_LINE}" | jq -r '.orl_id')
        ORL_NAME=$(echo "${FIRST_LINE}" | jq -r '.orl_pg_name')
        ORL_QTY=$(echo "${FIRST_LINE}" | jq -r '.orl_art_quantity')
        ORL_PRICE_UNIT=$(echo "${FIRST_LINE}" | jq -r '.orl_art_price_sell_unit_ttc')
        ORL_PRICE_TOTAL=$(echo "${FIRST_LINE}" | jq -r '.orl_art_price_sell_ttc')
        ORL_STATUS=$(echo "${FIRST_LINE}" | jq -r '.orl_orls_id')
        LINE_STATUS=$(echo "${FIRST_LINE}" | jq -r '.lineStatus | type')
        
        echo "      - ID: ${ORL_ID}"
        echo "      - Produit: ${ORL_NAME}"
        echo "      - Quantité: ${ORL_QTY}"
        echo "      - Prix unitaire: ${ORL_PRICE_UNIT} €"
        echo "      - Prix total: ${ORL_PRICE_TOTAL} €"
        echo "      - Statut ID: ${ORL_STATUS}"
        echo "      - lineStatus enrichi: ${LINE_STATUS}"
        
        if [ "${LINE_STATUS}" = "object" ] || [ "${LINE_STATUS}" = "null" ]; then
            echo "      ✅ Structure ligne OK"
        else
            echo "      ❌ Structure ligne incorrecte"
        fi
    fi
else
    echo "   ❌ orderLines: pas un array"
fi
echo ""

# Test 7: Statut global
echo "7️⃣ Test: Statut de commande..."
STATUS_DETAILS=$(echo "${RESPONSE}" | jq -r '.data.statusDetails | type')

if [ "${STATUS_DETAILS}" = "object" ]; then
    STATUS_NAME=$(echo "${RESPONSE}" | jq -r '.data.statusDetails.ords_named')
    STATUS_ACTION=$(echo "${RESPONSE}" | jq -r '.data.statusDetails.ords_action')
    echo "   ✅ statusDetails: ${STATUS_NAME}"
    echo "      Action: ${STATUS_ACTION}"
elif [ "${STATUS_DETAILS}" = "null" ]; then
    echo "   ⚠️  statusDetails: null"
else
    echo "   ❌ statusDetails: erreur"
fi
echo ""

# Résumé
echo "======================================"
echo "📊 RÉSUMÉ DES TESTS"
echo "======================================"
echo ""
echo "Commande ID: ${ORD_ID}"
echo "Client: ${CST_FNAME} ${CST_NAME}"
echo "Total TTC: ${ORD_TOTAL} €"
echo "Lignes: ${LINES_COUNT}"
echo "Statut: ${STATUS_NAME}"
echo ""

# Test structure complète
COMPLETE=$(echo "${RESPONSE}" | jq -r '
  if (.success == true and
      .data.ord_id != null and
      .data.customer != null and
      (.data.orderLines | type) == "array" and
      (.data.statusDetails | type) == "object")
  then "COMPLETE"
  else "INCOMPLETE"
  end
')

if [ "${COMPLETE}" = "COMPLETE" ]; then
    echo "✅ Structure API COMPLÈTE - Toutes les données nécessaires sont présentes"
    echo ""
    echo "🎉 La page de détail peut afficher:"
    echo "   - Informations commande"
    echo "   - Informations client"
    echo "   - Adresses (si renseignées)"
    echo "   - Liste des articles"
    echo "   - Actions de traitement"
    echo "   - Statut global"
else
    echo "⚠️  Structure API INCOMPLÈTE - Certaines données manquent"
fi

echo ""
echo "======================================"
echo "Frontend URL: http://localhost:5173/admin/orders/${ORDER_ID}"
echo "======================================"
