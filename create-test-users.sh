#!/bin/bash

# 🧪 SCRIPT DE CRÉATION COMPTES TEST
# Crée 4 utilisateurs de test avec différents niveaux pour tester l'interface unifiée

echo "🧪 ================================================"
echo "   CRÉATION COMPTES TEST - INTERFACE UNIFIÉE"
echo "================================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Ce script va créer 4 comptes utilisateurs test :${NC}"
echo ""
echo -e "  ${GREEN}1.${NC} 👔 Commercial     (niveau 3)"
echo -e "  ${GREEN}2.${NC} 📊 Responsable    (niveau 5)"
echo -e "  ${GREEN}3.${NC} 🔑 Administrateur (niveau 7)"
echo -e "  ${GREEN}4.${NC} 👑 Super Admin    (niveau 9)"
echo ""

# Demander confirmation
read -p "$(echo -e ${YELLOW}Voulez-vous continuer ? [Y/n] ${NC})" -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ ! -z $REPLY ]]; then
    echo -e "${RED}❌ Annulé${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔧 Configuration requise :${NC}"
echo "  - Backend NestJS doit tourner sur http://localhost:3000"
echo "  - Endpoint /api/admin/users/create doit exister"
echo "  - Vous devez être authentifié comme admin"
echo ""

# Demander le cookie de session admin
echo -e "${YELLOW}🔑 Cookie de session administrateur${NC}"
echo "  1. Connectez-vous en tant qu'admin sur le frontend"
echo "  2. Ouvrez DevTools (F12) → Onglet Application → Cookies"
echo "  3. Copiez la valeur du cookie de session"
echo ""
read -p "$(echo -e ${YELLOW}Collez votre cookie de session : ${NC})" SESSION_COOKIE

if [[ -z "$SESSION_COOKIE" ]]; then
    echo -e "${RED}❌ Cookie requis${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Cookie reçu${NC}"
echo ""

# Base API URL
API_URL="http://localhost:3000/api/admin/users"

# Fonction de création utilisateur
create_user() {
    local email=$1
    local password=$2
    local level=$3
    local role=$4
    local emoji=$5
    
    echo -e "${BLUE}Création : $emoji $role ($email)...${NC}"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/create" \
        -H "Content-Type: application/json" \
        -H "Cookie: $SESSION_COOKIE" \
        -d "{
            \"email\": \"$email\",
            \"password\": \"$password\",
            \"level\": $level,
            \"cst_fname\": \"Test\",
            \"cst_name\": \"$role\"
        }")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 201 ] || [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}  ✅ Créé avec succès (niveau $level)${NC}"
        return 0
    elif [ "$http_code" -eq 409 ]; then
        echo -e "${YELLOW}  ⚠️  Déjà existant${NC}"
        return 0
    else
        echo -e "${RED}  ❌ Erreur HTTP $http_code${NC}"
        echo -e "${RED}  Response: $body${NC}"
        return 1
    fi
}

echo -e "${BLUE}🚀 Création des comptes...${NC}"
echo ""

# Créer les 4 comptes
create_user "commercial@test.com" "Test1234!" 3 "Commercial" "👔"
create_user "responsable@test.com" "Test1234!" 5 "Responsable" "📊"
create_user "admin@test.com" "Test1234!" 7 "Administrateur" "🔑"
create_user "superadmin@test.com" "Test1234!" 9 "Super Admin" "👑"

echo ""
echo -e "${GREEN}✅ ================================================${NC}"
echo -e "${GREEN}   COMPTES TEST CRÉÉS${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}📝 Identifiants de connexion :${NC}"
echo ""
echo -e "${YELLOW}👔 Commercial (niveau 3)${NC}"
echo "   Email    : commercial@test.com"
echo "   Password : Test1234!"
echo ""
echo -e "${YELLOW}📊 Responsable (niveau 5)${NC}"
echo "   Email    : responsable@test.com"
echo "   Password : Test1234!"
echo ""
echo -e "${YELLOW}🔑 Administrateur (niveau 7)${NC}"
echo "   Email    : admin@test.com"
echo "   Password : Test1234!"
echo ""
echo -e "${YELLOW}👑 Super Admin (niveau 9)${NC}"
echo "   Email    : superadmin@test.com"
echo "   Password : Test1234!"
echo ""
echo -e "${BLUE}🧪 Prochaine étape :${NC}"
echo "   1. Déconnectez-vous de votre compte actuel"
echo "   2. Connectez-vous avec un des comptes ci-dessus"
echo "   3. Accédez à /orders"
echo "   4. Suivez le guide : GUIDE-TEST-INTERFACE-UNIFIEE.md"
echo ""
echo -e "${GREEN}🎉 Bonne chance pour les tests !${NC}"
echo ""
