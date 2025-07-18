#!/bin/bash

# Script pour créer un utilisateur de test et tester la connexion
echo "🔐 Test et création d'utilisateur de test"
echo "========================================"

BASE_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Créer un utilisateur de test
echo -e "${BLUE}🏗️ Création d'un utilisateur de test${NC}"
create_response=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@example.com",
        "password": "password123",
        "firstName": "Test",
        "lastName": "User",
        "civility": "Mr.",
        "address": "123 Test Street",
        "zipCode": "12345",
        "city": "Test City",
        "country": "France",
        "tel": "0123456789",
        "isPro": "0",
        "isActive": "1"
    }' \
    "$BASE_URL/api/users")

create_code="${create_response: -3}"
create_body="${create_response%???}"

if [ "$create_code" -eq 201 ] || [ "$create_code" -eq 200 ]; then
    echo -e "${GREEN}✅ Utilisateur créé avec succès${NC}"
    echo "$create_body" | jq '.' 2>/dev/null || echo "$create_body"
else
    echo -e "${RED}❌ Erreur lors de la création (Code: $create_code)${NC}"
    echo "$create_body"
fi

echo ""
echo -e "${BLUE}🔍 Vérification des utilisateurs existants${NC}"
users_response=$(curl -s "$BASE_URL/api/users?limit=5")
echo "$users_response" | jq '.users[] | {email: .cst_mail, name: .cst_fname + " " + .cst_name, active: .cst_activ}' 2>/dev/null || echo "Erreur récupération utilisateurs"

echo ""
echo -e "${BLUE}🧪 Test de connexion avec différents comptes${NC}"

# Test 1: Avec le compte créé
echo -e "${BLUE}Test 1: test@example.com / password123${NC}"
login_response=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=test@example.com&password=password123" \
    "$BASE_URL/auth/login")
login_code="${login_response: -3}"
echo "Code de réponse: $login_code"

# Test 2: Avec un compte existant visible dans les logs
echo -e "${BLUE}Test 2: Compte existant${NC}"
# Récupérer un vrai utilisateur de la base
real_user=$(curl -s "$BASE_URL/api/users?limit=1" | jq -r '.users[0].cst_mail // "N/A"')
echo "Email trouvé: $real_user"

if [ "$real_user" != "N/A" ] && [ "$real_user" != "null" ]; then
    # Tester avec le mot de passe par défaut
    login_response2=$(curl -s -w "%{http_code}" -X POST \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "email=$real_user&password=123" \
        "$BASE_URL/auth/login")
    login_code2="${login_response2: -3}"
    echo "Code de réponse pour $real_user: $login_code2"
fi

echo ""
echo -e "${BLUE}🔧 Diagnostic des erreurs d'authentification${NC}"
echo "Codes de réponse courants:"
echo "  200 - Connexion réussie"
echo "  302 - Redirection (connexion réussie)"
echo "  400 - Erreur de validation"
echo "  401 - Identifiants incorrects"
echo "  429 - Trop de tentatives"

echo ""
echo -e "${BLUE}📊 Résumé des tests${NC}"
echo "Utilisateur créé: $create_code"
echo "Test connexion 1: $login_code"
echo "Test connexion 2: ${login_code2:-'N/A'}"
echo "========================================"
