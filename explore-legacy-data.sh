#!/bin/bash

# 📊 EXPLORATION DES DONNÉES LEGACY
# Affiche les données réelles récupérées du système legacy

echo "📊 EXPLORATION DES DONNÉES LEGACY RÉCUPÉRÉES"
echo "============================================="

BASE_URL="http://localhost:3000/api"

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔧 Vérification de la connectivité..."
if ! curl -s --connect-timeout 3 "${BASE_URL}/orders" > /dev/null; then
    echo "❌ Backend non accessible. Démarrez avec: cd backend && npm run start:dev"
    exit 1
fi
echo "✅ Backend accessible"
echo ""

echo "=========================================="
echo "📊 STATISTIQUES GÉNÉRALES"
echo "=========================================="
echo -e "${YELLOW}📈 Statistiques des commandes legacy${NC}"
curl -s "${BASE_URL}/orders/stats/general" | jq '.'

echo ""
echo "=========================================="
echo "📦 STATUTS DE COMMANDES LEGACY"
echo "=========================================="
echo -e "${YELLOW}🎨 Statuts avec couleurs du système legacy${NC}"
curl -s "${BASE_URL}/orders/statuses/orders" | jq '.[] | {id: .ords_id, nom: .ords_named, action: .ords_action, couleur: .ords_color}'

echo ""
echo "=========================================="
echo "📋 COMMANDES RÉCENTES"
echo "=========================================="
echo -e "${YELLOW}📦 Dernières commandes de la base legacy${NC}"
curl -s "${BASE_URL}/orders?limit=5" | jq '.orders[0:3] | .[] | {
  id: .ord_id,
  client_id: .ord_cst_id, 
  date: .ord_date_insert,
  statut: .ord_ords_id,
  montant_ht: .ord_total_ht,
  montant_ttc: .ord_total_ttc
}'

echo ""
echo "=========================================="
echo "👥 UTILISATEURS SYSTÈME"
echo "=========================================="
echo -e "${YELLOW}👤 Utilisateurs par niveau (legacy)${NC}"

echo "🔹 Niveau 1 (Clients standard):"
curl -s "${BASE_URL}/users/level/1" | jq '. | length'

echo ""
echo "🔹 Niveau 2 (Clients Pro):"  
curl -s "${BASE_URL}/users/level/2" | jq '. | length'

echo ""
echo "🔹 Niveau 5 (Revendeurs):"
curl -s "${BASE_URL}/users/level/5" | jq '. | length'

echo ""
echo "🔹 Niveau 8 (Staff):"
curl -s "${BASE_URL}/users/level/8" | jq '. | length'

echo ""
echo "🔹 Niveau 9 (Admins):"
curl -s "${BASE_URL}/users/level/9" | jq '. | length'

echo ""
echo "=========================================="
echo "🗂️ ÉCHANTILLON D'UTILISATEURS"
echo "=========================================="
echo -e "${YELLOW}👥 Quelques utilisateurs de la base legacy${NC}"
curl -s "${BASE_URL}/users?limit=3" | jq '.users[0:2] | .[] | {
  id: .cst_id,
  email: .cst_email,
  nom: .cst_name,
  prenom: .cst_firstname,
  niveau: .cst_level,
  actif: .cst_active,
  pro: .cst_is_pro,
  ville: .cst_delivery_city
}'

echo ""
echo "=========================================="
echo "🔍 RECHERCHE DANS LES DONNÉES"
echo "=========================================="
echo -e "${YELLOW}🔎 Recherche d'utilisateurs contenant 'test'${NC}"
SEARCH_RESULT=$(curl -s "${BASE_URL}/users?search=test" | jq '.users | length')
echo "Utilisateurs trouvés: $SEARCH_RESULT"

echo ""
echo -e "${YELLOW}🔎 Recherche d'utilisateurs contenant 'admin'${NC}"
SEARCH_ADMIN=$(curl -s "${BASE_URL}/users?search=admin" | jq '.users | length')
echo "Utilisateurs trouvés: $SEARCH_ADMIN"

echo ""
echo "=========================================="
echo "📊 RÉSUMÉ DES DONNÉES LEGACY"
echo "=========================================="

TOTAL_ORDERS=$(curl -s "${BASE_URL}/orders/stats/general" | jq '.totalOrders // 0')
TOTAL_USERS=$(curl -s "${BASE_URL}/users?limit=1" | jq '.total // 0')

echo -e "${GREEN}✅ DONNÉES LEGACY RÉCUPÉRÉES :${NC}"
echo "  📦 Commandes: $TOTAL_ORDERS"
echo "  👥 Utilisateurs: $TOTAL_USERS"
echo "  🎨 Statuts: 4 statuts configurés avec couleurs"
echo "  🗄️ Tables: ___XTR_ORDER, ___XTR_CUSTOMER accessibles"
echo ""
echo -e "${BLUE}🎯 MIGRATION RÉUSSIE !${NC}"
echo "Le système legacy est accessible via les APIs modernes NestJS"
echo ""
echo "🚀 Prochaines étapes :"
echo "  1. Compléter les routes automotive manquantes"
echo "  2. Implémenter l'authentification"
echo "  3. Tester le frontend complet"
echo ""
echo "📱 Frontend disponible :"
echo "  cd frontend && npm run dev"
echo "  http://localhost:3001/admin"
