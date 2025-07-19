#!/bin/bash

# 🧪 Tests curl pour le module Users
# Validation complète des APIs avec les vraies tables Supabase

BASE_URL="http://localhost:3000"
API_BASE="$BASE_URL/api/users"

echo "🚀 Tests du Module Users - APIs REST"
echo "====================================="

# Colors pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les résultats
print_test() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# Variable pour stocker l'ID utilisateur créé
USER_ID=""
TEST_EMAIL="test-curl-$(date +%s)@example.com"

echo
print_test "1. Test de création d'utilisateur"
echo "=================================="

CREATE_RESPONSE=$(curl -s -X POST "$API_BASE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$TEST_EMAIL'",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "Curl",
    "isPro": false,
    "isActive": true
  }')

echo "Réponse création:"
echo "$CREATE_RESPONSE" | jq '.'

# Extraire l'ID utilisateur
USER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')

if [ -n "$USER_ID" ]; then
    print_success "Utilisateur créé avec l'ID: $USER_ID"
else
    print_error "Échec de création d'utilisateur"
    echo "Réponse: $CREATE_RESPONSE"
fi

echo
print_test "2. Test de récupération par ID"
echo "==============================="

if [ -n "$USER_ID" ]; then
    GET_RESPONSE=$(curl -s -X GET "$API_BASE/$USER_ID")
    echo "Réponse GET par ID:"
    echo "$GET_RESPONSE" | jq '.'
    
    # Vérifier que l'email correspond
    RETURNED_EMAIL=$(echo "$GET_RESPONSE" | jq -r '.email // empty')
    if [ "$RETURNED_EMAIL" = "$TEST_EMAIL" ]; then
        print_success "Récupération par ID réussie"
    else
        print_error "Email ne correspond pas: attendu $TEST_EMAIL, reçu $RETURNED_EMAIL"
    fi
else
    print_warning "Skip test GET by ID - pas d'utilisateur créé"
fi

echo
print_test "3. Test de récupération par email"
echo "=================================="

GET_EMAIL_RESPONSE=$(curl -s -X GET "$API_BASE/email/$TEST_EMAIL")
echo "Réponse GET par email:"
echo "$GET_EMAIL_RESPONSE" | jq '.'

# Vérifier que l'ID correspond
RETURNED_ID=$(echo "$GET_EMAIL_RESPONSE" | jq -r '.id // empty')
if [ "$RETURNED_ID" = "$USER_ID" ]; then
    print_success "Récupération par email réussie"
else
    print_error "ID ne correspond pas: attendu $USER_ID, reçu $RETURNED_ID"
fi

echo
print_test "4. Test de mise à jour utilisateur"
echo "==================================="

if [ -n "$USER_ID" ]; then
    UPDATE_RESPONSE=$(curl -s -X PUT "$API_BASE/$USER_ID" \
      -H "Content-Type: application/json" \
      -d '{
        "firstName": "TestModifié",
        "lastName": "CurlModifié",
        "tel": "+33123456789"
      }')
    
    echo "Réponse mise à jour:"
    echo "$UPDATE_RESPONSE" | jq '.'
    
    # Vérifier que le prénom a été modifié
    UPDATED_FIRSTNAME=$(echo "$UPDATE_RESPONSE" | jq -r '.firstName // empty')
    if [ "$UPDATED_FIRSTNAME" = "TestModifié" ]; then
        print_success "Mise à jour réussie"
    else
        print_error "Prénom non modifié: attendu TestModifié, reçu $UPDATED_FIRSTNAME"
    fi
else
    print_warning "Skip test UPDATE - pas d'utilisateur créé"
fi

echo
print_test "5. Test de liste des utilisateurs"
echo "=================================="

LIST_RESPONSE=$(curl -s -X GET "$API_BASE?page=1&limit=5")
echo "Réponse liste (5 premiers):"
echo "$LIST_RESPONSE" | jq '.'

# Vérifier la structure de réponse
USERS_COUNT=$(echo "$LIST_RESPONSE" | jq '.users | length')
if [ "$USERS_COUNT" -ge 0 ]; then
    print_success "Liste des utilisateurs récupérée: $USERS_COUNT utilisateurs"
else
    print_error "Structure de réponse invalide pour la liste"
fi

echo
print_test "6. Test de recherche d'utilisateurs"
echo "===================================="

SEARCH_RESPONSE=$(curl -s -X GET "$API_BASE?search=TestModifié")
echo "Réponse recherche:"
echo "$SEARCH_RESPONSE" | jq '.'

# Vérifier que notre utilisateur est dans les résultats
FOUND_USER=$(echo "$SEARCH_RESPONSE" | jq --arg email "$TEST_EMAIL" '.users[] | select(.email == $email) | .id')
if [ -n "$FOUND_USER" ]; then
    print_success "Recherche réussie - utilisateur trouvé"
else
    print_warning "Utilisateur non trouvé dans la recherche (peut être normal)"
fi

echo
print_test "7. Test de validation des erreurs"
echo "=================================="

# Test création avec email invalide
ERROR_RESPONSE=$(curl -s -X POST "$API_BASE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "email-invalide",
    "password": "123",
    "firstName": "",
    "lastName": ""
  }')

echo "Réponse erreur validation:"
echo "$ERROR_RESPONSE" | jq '.'

# Vérifier qu'on a bien une erreur
STATUS_MESSAGE=$(echo "$ERROR_RESPONSE" | jq -r '.message // empty')
if [[ "$STATUS_MESSAGE" == *"validation"* ]] || [[ "$STATUS_MESSAGE" == *"Erreur"* ]]; then
    print_success "Validation des erreurs fonctionne"
else
    print_warning "Validation des erreurs - réponse: $ERROR_RESPONSE"
fi

echo
print_test "8. Test de création d'utilisateur en double"
echo "============================================"

DUPLICATE_RESPONSE=$(curl -s -X POST "$API_BASE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$TEST_EMAIL'",
    "password": "TestPassword123!",
    "firstName": "Duplicate",
    "lastName": "User",
    "isPro": false,
    "isActive": true
  }')

echo "Réponse création en double:"
echo "$DUPLICATE_RESPONSE" | jq '.'

# Vérifier qu'on a une erreur de conflit
DUPLICATE_MESSAGE=$(echo "$DUPLICATE_RESPONSE" | jq -r '.message // empty')
if [[ "$DUPLICATE_MESSAGE" == *"existe"* ]] || [[ "$DUPLICATE_MESSAGE" == *"Conflict"* ]]; then
    print_success "Détection d'utilisateur en double fonctionne"
else
    print_warning "Pas de détection de doublon - message: $DUPLICATE_MESSAGE"
fi

echo
print_test "9. Test de suppression (désactivation)"
echo "======================================="

if [ -n "$USER_ID" ]; then
    DELETE_RESPONSE=$(curl -s -X DELETE "$API_BASE/$USER_ID")
    echo "Réponse suppression:"
    echo "$DELETE_RESPONSE" | jq '.'
    
    # Vérifier que l'utilisateur est désactivé
    DELETE_SUCCESS=$(echo "$DELETE_RESPONSE" | jq -r '.success // empty')
    if [ "$DELETE_SUCCESS" = "true" ]; then
        print_success "Suppression (désactivation) réussie"
        
        # Vérifier que l'utilisateur existe toujours mais est désactivé
        echo
        print_test "Vérification que l'utilisateur est désactivé:"
        DEACTIVATED_USER=$(curl -s -X GET "$API_BASE/$USER_ID")
        echo "$DEACTIVATED_USER" | jq '.'
        
        IS_ACTIVE=$(echo "$DEACTIVATED_USER" | jq -r '.isActive // empty')
        if [ "$IS_ACTIVE" = "false" ]; then
            print_success "Utilisateur correctement désactivé"
        else
            print_warning "Utilisateur pas désactivé ou pas trouvé"
        fi
    else
        print_error "Échec de suppression"
    fi
else
    print_warning "Skip test DELETE - pas d'utilisateur créé"
fi

echo
print_test "10. Test d'utilisateur non existant"
echo "===================================="

NOT_FOUND_RESPONSE=$(curl -s -X GET "$API_BASE/999999")
echo "Réponse utilisateur non existant:"
echo "$NOT_FOUND_RESPONSE" | jq '.'

# Vérifier qu'on a bien une erreur 404
NOT_FOUND_MESSAGE=$(echo "$NOT_FOUND_RESPONSE" | jq -r '.message // empty')
if [[ "$NOT_FOUND_MESSAGE" == *"non trouvé"* ]] || [[ "$NOT_FOUND_RESPONSE" == *"404"* ]]; then
    print_success "Gestion utilisateur non existant fonctionne"
else
    print_warning "Gestion 404 - réponse: $NOT_FOUND_RESPONSE"
fi

echo
echo "🎯 Résumé des Tests"
echo "==================="
print_success "Tests terminés pour le module Users"
print_warning "Vérifiez les logs ci-dessus pour les détails"

if [ -n "$USER_ID" ]; then
    echo
    print_test "Utilisateur de test créé: $USER_ID ($TEST_EMAIL)"
    print_warning "Note: L'utilisateur a été désactivé mais pas supprimé de la DB"
fi

echo
print_test "Pour tester d'autres fonctionnalités:"
echo "- Changement de mot de passe: PATCH $API_BASE/{id}/password"
echo "- Profil utilisateur: GET $API_BASE/{id}/profile"
echo "- Gestion des niveaux: PATCH $API_BASE/{id}/level"
echo "- Réactivation: PATCH $API_BASE/{id}/reactivate"
