#!/bin/bash

echo "🚀 Tests API complets - Système de commandes"
echo "============================================="

BASE_URL="http://localhost:3000"

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\n${BLUE}📊 1. Test API Orders - Informations générales${NC}"
echo "=================================================="

echo -e "\n${YELLOW}Total des commandes:${NC}"
curl -s -X GET "${BASE_URL}/api/orders" | jq -r '.total'

echo -e "\n${YELLOW}Nombre de commandes retournées (limite par défaut):${NC}"
curl -s -X GET "${BASE_URL}/api/orders" | jq -r '.orders | length'

echo -e "\n${BLUE}📈 2. Analyse des données${NC}"
echo "=========================="

echo -e "\n${YELLOW}Première commande:${NC}"
curl -s -X GET "${BASE_URL}/api/orders" | jq '.orders[0] | {
  id: .ord_id,
  client: (.customer.cst_name + " " + .customer.cst_fname),
  email: .customer.cst_mail,
  total: .ord_total_ttc,
  paid: (.ord_is_pay == "1" or .ord_is_pay == 1),
  date: .ord_date
}'

echo -e "\n${YELLOW}Commandes par statut de paiement:${NC}"
echo -n "Non payées: "
curl -s -X GET "${BASE_URL}/api/orders" | jq '.orders | map(select(.ord_is_pay == "0" or .ord_is_pay == 0)) | length'
echo -n "Payées: "
curl -s -X GET "${BASE_URL}/api/orders" | jq '.orders | map(select(.ord_is_pay == "1" or .ord_is_pay == 1)) | length'

echo -e "\n${YELLOW}Chiffre d'affaires des 10 premières commandes:${NC}"
curl -s -X GET "${BASE_URL}/api/orders" | jq '.orders | map(.ord_total_ttc | tonumber) | add'

echo -e "\n${YELLOW}Nombre de clients uniques:${NC}"
curl -s -X GET "${BASE_URL}/api/orders" | jq '.orders | map(.customer.cst_name) | unique | length'

echo -e "\n${BLUE}🔄 3. Test de pagination${NC}"
echo "=========================="

echo -e "\n${YELLOW}Page 1 (5 commandes):${NC}"
curl -s -X GET "${BASE_URL}/api/orders?page=1&limit=5" | jq '{
  total: .total,
  returned: (.orders | length),
  first_id: .orders[0].ord_id,
  last_id: .orders[-1].ord_id
}'

echo -e "\n${YELLOW}Page 2 (5 commandes):${NC}"
curl -s -X GET "${BASE_URL}/api/orders?page=2&limit=5" | jq '{
  total: .total,
  returned: (.orders | length),
  first_id: .orders[0].ord_id,
  last_id: .orders[-1].ord_id
}'

echo -e "\n${BLUE}⚡ 4. Test de performance${NC}"
echo "========================="

echo -e "\n${YELLOW}Temps de réponse pour 50 commandes:${NC}"
time curl -s -X GET "${BASE_URL}/api/orders?limit=50" > /dev/null

echo -e "\n${BLUE}🧪 5. Test d'erreurs${NC}"
echo "===================="

echo -e "\n${YELLOW}Route inexistante:${NC}"
curl -s -X GET "${BASE_URL}/api/nonexistent" | jq -r '.statusCode // "Pas de statusCode"'

echo -e "\n${YELLOW}Paramètres invalides:${NC}"
curl -s -X GET "${BASE_URL}/api/orders?page=-1&limit=0" | jq -r '.orders | length // "Erreur"'

echo -e "\n${BLUE}📋 6. Résumé des tests${NC}"
echo "======================"

# Compter les succès/échecs
TOTAL_ORDERS=$(curl -s -X GET "${BASE_URL}/api/orders" | jq -r '.total')
RETURNED_ORDERS=$(curl -s -X GET "${BASE_URL}/api/orders" | jq -r '.orders | length')

if [ "$TOTAL_ORDERS" -gt 1000 ]; then
    echo -e "${GREEN}✅ Base de données: ${TOTAL_ORDERS} commandes (OK)${NC}"
else
    echo -e "${RED}❌ Base de données: ${TOTAL_ORDERS} commandes (Problème)${NC}"
fi

if [ "$RETURNED_ORDERS" -gt 0 ]; then
    echo -e "${GREEN}✅ API Orders: ${RETURNED_ORDERS} commandes retournées (OK)${NC}"
else
    echo -e "${RED}❌ API Orders: ${RETURNED_ORDERS} commandes retournées (Problème)${NC}"
fi

echo -e "\n${GREEN}🎉 Tests terminés !${NC}"
echo "==================="
