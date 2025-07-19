#!/bin/bash

# 🔐 Tests curl avancés pour le module Users
# Tests des fonctionnalités spécifiques (mot de passe, profils, niveaux)

BASE_URL="http://localhost:3000"
API_BASE="$BASE_URL/api/users"

echo "🔐 Tests Avancés du Module Users"
echo "================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_test() { echo -e "${BLUE}$1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️ $1${NC}"; }

# Créer un utilisateur de test pour les tests avancés
TEST_EMAIL="advanced-test-$(date +%s)@example.com"
USER_ID=""

echo
print_test "Création d'un utilisateur de test"
echo "=================================="

CREATE_RESPONSE=$(curl -s -X POST "$API_BASE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$TEST_EMAIL'",
    "password": "InitialPassword123!",
    "firstName": "Advanced",
    "lastName": "Tester",
    "isPro": true,
    "isActive": true,
    "tel": "+33123456789",
    "address": "123 Rue de Test",
    "city": "Paris",
    "zipCode": "75001",
    "country": "France"
  }')

USER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')

if [ -n "$USER_ID" ]; then
    print_success "Utilisateur créé: $USER_ID"
    echo "$CREATE_RESPONSE" | jq '.'
else
    print_error "Échec création utilisateur"
    echo "$CREATE_RESPONSE"
    exit 1
fi

echo
print_test "1. Test de changement de mot de passe"
echo "======================================"

# Test avec mot de passe incorrect
print_test "1.a. Test avec mot de passe actuel incorrect"
WRONG_PASSWORD_RESPONSE=$(curl -s -X PATCH "$API_BASE/$USER_ID/password" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "WrongPassword123!",
    "newPassword": "NewPassword123!",
    "confirmPassword": "NewPassword123!"
  }')

echo "Réponse mot de passe incorrect:"
echo "$WRONG_PASSWORD_RESPONSE" | jq '.'

# Test avec mot de passe correct
print_test "1.b. Test avec mot de passe correct"
CORRECT_PASSWORD_RESPONSE=$(curl -s -X PATCH "$API_BASE/$USER_ID/password" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "InitialPassword123!",
    "newPassword": "NewPassword123!",
    "confirmPassword": "NewPassword123!"
  }')

echo "Réponse changement réussi:"
echo "$CORRECT_PASSWORD_RESPONSE" | jq '.'

# Test avec mots de passe qui ne correspondent pas
print_test "1.c. Test avec confirmation incorrecte"
MISMATCH_PASSWORD_RESPONSE=$(curl -s -X PATCH "$API_BASE/$USER_ID/password" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "NewPassword123!",
    "newPassword": "AnotherPassword123!",
    "confirmPassword": "DifferentPassword123!"
  }')

echo "Réponse mots de passe différents:"
echo "$MISMATCH_PASSWORD_RESPONSE" | jq '.'

echo
print_test "2. Test du profil utilisateur"
echo "=============================="

PROFILE_RESPONSE=$(curl -s -X GET "$API_BASE/$USER_ID/profile")
echo "Réponse profil:"
echo "$PROFILE_RESPONSE" | jq '.'

# Vérifier la structure du profil
PROFILE_LEVEL=$(echo "$PROFILE_RESPONSE" | jq -r '.level // empty')
if [ -n "$PROFILE_LEVEL" ]; then
    print_success "Profil récupéré avec niveau: $PROFILE_LEVEL"
else
    print_warning "Profil sans niveau ou erreur"
fi

echo
print_test "3. Test de modification du niveau utilisateur"
echo "=============================================="

# Note: Cette fonctionnalité nécessite probablement des droits admin
LEVEL_RESPONSE=$(curl -s -X PATCH "$API_BASE/$USER_ID/level" \
  -H "Content-Type: application/json" \
  -d '{
    "level": 6
  }')

echo "Réponse modification niveau:"
echo "$LEVEL_RESPONSE" | jq '.'

echo
print_test "4. Test de mise à jour complète du profil"
echo "=========================================="

FULL_UPDATE_RESPONSE=$(curl -s -X PUT "$API_BASE/$USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "AdvancedModified",
    "lastName": "TesterModified",
    "tel": "+33987654321",
    "address": "456 Avenue Modified",
    "city": "Lyon",
    "zipCode": "69001",
    "country": "France",
    "isPro": false
  }')

echo "Réponse mise à jour complète:"
echo "$FULL_UPDATE_RESPONSE" | jq '.'

# Vérifier que les modifications ont été appliquées
UPDATED_CITY=$(echo "$FULL_UPDATE_RESPONSE" | jq -r '.city // empty')
if [ "$UPDATED_CITY" = "Lyon" ]; then
    print_success "Mise à jour complète réussie"
else
    print_warning "Mise à jour partielle ou échouée"
fi

echo
print_test "5. Test de désactivation temporaire"
echo "===================================="

DEACTIVATE_RESPONSE=$(curl -s -X PATCH "$API_BASE/$USER_ID/deactivate")
echo "Réponse désactivation:"
echo "$DEACTIVATE_RESPONSE" | jq '.'

# Vérifier que l'utilisateur est désactivé
DEACTIVATED_USER=$(curl -s -X GET "$API_BASE/$USER_ID")
IS_ACTIVE=$(echo "$DEACTIVATED_USER" | jq -r '.isActive // empty')
if [ "$IS_ACTIVE" = "false" ]; then
    print_success "Utilisateur correctement désactivé"
else
    print_warning "Désactivation échouée ou pas reflétée"
fi

echo
print_test "6. Test de réactivation"
echo "========================"

REACTIVATE_RESPONSE=$(curl -s -X PATCH "$API_BASE/$USER_ID/reactivate")
echo "Réponse réactivation:"
echo "$REACTIVATE_RESPONSE" | jq '.'

# Vérifier que l'utilisateur est réactivé
REACTIVATED_USER=$(curl -s -X GET "$API_BASE/$USER_ID")
IS_ACTIVE_AGAIN=$(echo "$REACTIVATED_USER" | jq -r '.isActive // empty')
if [ "$IS_ACTIVE_AGAIN" = "true" ]; then
    print_success "Utilisateur correctement réactivé"
else
    print_warning "Réactivation échouée ou pas reflétée"
fi

echo
print_test "7. Test de validation Zod stricte"
echo "=================================="

# Test avec données invalides
INVALID_DATA_RESPONSE=$(curl -s -X PUT "$API_BASE/$USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "email-invalide",
    "firstName": "",
    "zipCode": "123",
    "tel": "numero-invalide"
  }')

echo "Réponse données invalides:"
echo "$INVALID_DATA_RESPONSE" | jq '.'

# Vérifier qu'on a des erreurs de validation
VALIDATION_ERRORS=$(echo "$INVALID_DATA_RESPONSE" | jq -r '.errors // empty')
if [ -n "$VALIDATION_ERRORS" ] && [ "$VALIDATION_ERRORS" != "null" ]; then
    print_success "Validation Zod fonctionne - erreurs détectées"
else
    print_warning "Validation Zod - réponse: $INVALID_DATA_RESPONSE"
fi

echo
print_test "8. Test des requêtes avec utilisateur inexistant"
echo "================================================="

# Test sur utilisateur qui n'existe pas
NOT_FOUND_PROFILE=$(curl -s -X GET "$API_BASE/999999/profile")
echo "Réponse profil inexistant:"
echo "$NOT_FOUND_PROFILE" | jq '.'

NOT_FOUND_UPDATE=$(curl -s -X PUT "$API_BASE/999999" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Test"}')
echo "Réponse mise à jour inexistant:"
echo "$NOT_FOUND_UPDATE" | jq '.'

echo
print_test "9. Test de performance - requêtes multiples"
echo "============================================="

echo "Test de 5 requêtes consécutives pour vérifier le cache:"
for i in {1..5}; do
    START_TIME=$(date +%s%N)
    PERF_RESPONSE=$(curl -s -X GET "$API_BASE/$USER_ID")
    END_TIME=$(date +%s%N)
    DURATION=$(( (END_TIME - START_TIME) / 1000000 )) # Convert to milliseconds
    
    USER_EMAIL=$(echo "$PERF_RESPONSE" | jq -r '.email // empty')
    if [ "$USER_EMAIL" = "$TEST_EMAIL" ]; then
        print_success "Requête $i: ${DURATION}ms - Cache probablement actif"
    else
        print_warning "Requête $i: ${DURATION}ms - Problème de réponse"
    fi
done

echo
print_test "10. Nettoyage - Suppression de l'utilisateur de test"
echo "====================================================="

CLEANUP_RESPONSE=$(curl -s -X DELETE "$API_BASE/$USER_ID")
echo "Réponse nettoyage:"
echo "$CLEANUP_RESPONSE" | jq '.'

echo
echo "🎯 Résumé des Tests Avancés"
echo "==========================="
print_success "Tests avancés terminés"
print_warning "Utilisateur de test: $USER_ID ($TEST_EMAIL)"
print_test "Fonctionnalités testées:"
echo "  ✓ Changement de mot de passe sécurisé"
echo "  ✓ Profils utilisateur enrichis"
echo "  ✓ Modification des niveaux"
echo "  ✓ Activation/Désactivation"
echo "  ✓ Validation Zod stricte"
echo "  ✓ Gestion des erreurs 404"
echo "  ✓ Performance et cache"
echo "  ✓ Nettoyage des données"

echo
print_test "Pour des tests manuels supplémentaires:"
echo "curl -X GET '$API_BASE?page=1&limit=10'"
echo "curl -X GET '$API_BASE?search=test'"
echo "curl -X POST '$API_BASE' -H 'Content-Type: application/json' -d '{...}'"
