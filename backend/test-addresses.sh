#!/bin/bash

# Test de récupération des adresses de facturation et de livraison
echo "🎯 Test des adresses de facturation et de livraison"
echo "================================================="

BASE_URL="http://localhost:3000/api/orders"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test 1: Récupérer une commande avec toutes les relations
echo -e "${BLUE}🔍 Test 1: Commande avec toutes les relations${NC}"
response=$(curl -s "${BASE_URL}/admin/all-relations?limit=1")
echo "$response" | jq '.orders[0] | {ord_id, customer, billingAddress, deliveryAddress}' 2>/dev/null || echo "Erreur lors du parsing JSON"

echo ""

# Test 2: Vérifier qu'une commande spécifique a des adresses
echo -e "${BLUE}🔍 Test 2: Commande spécifique avec adresses${NC}"
order_id="280042"
response=$(curl -s "${BASE_URL}/${order_id}")
echo "$response" | jq '{ord_id, billingAddress, deliveryAddress}' 2>/dev/null || echo "Pas d'adresses trouvées"

echo ""

# Test 3: Vérifier les tables d'adresses directement
echo -e "${BLUE}🔍 Test 3: Tables d'adresses directement${NC}"
echo "Adresses de facturation disponibles:"
curl -s "http://localhost:3000/api/supabase/direct-query?table=___xtr_customer_billing_address&limit=3" | jq '.[] | {cba_id, cba_firstname, cba_lastname, cba_city}' 2>/dev/null || echo "Erreur table facturation"

echo ""
echo "Adresses de livraison disponibles:"
curl -s "http://localhost:3000/api/supabase/direct-query?table=___xtr_customer_delivery_address&limit=3" | jq '.[] | {cda_id, cda_firstname, cda_lastname, cda_city}' 2>/dev/null || echo "Erreur table livraison"

echo ""
echo "================================================="
echo -e "${GREEN}✅ Test terminé${NC}"
