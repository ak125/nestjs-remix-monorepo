#!/bin/bash

# =============================================================================
# 🧪 TESTS COMPLETS DU SYSTÈME
# =============================================================================

echo "🧪 Tests complets du système NestJS + Remix"
echo "==========================================="

BASE_URL="http://localhost:3000"
SESSION_FILE="/tmp/complete_session.txt"
RESET_TOKEN=""

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function print_error() {
    echo -e "${RED}❌ $1${NC}"
}

function print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

function print_info() {
    echo -e "${YELLOW}ℹ️ $1${NC}"
}

function test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo ""
    print_info "Test: $description"
    echo "Method: $method | Endpoint: $endpoint"
    
    if [ "$method" = "POST" ] && [ ! -z "$data" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -X $method \
            -H "Content-Type: application/x-www-form-urlencoded" \
            -d "$data" \
            -b $SESSION_FILE \
            -c $SESSION_FILE \
            $BASE_URL$endpoint)
    elif [ "$method" = "GET" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -X $method \
            -b $SESSION_FILE \
            $BASE_URL$endpoint)
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -X $method \
            -b $SESSION_FILE \
            $BASE_URL$endpoint)
    fi
    
    # Extraire le code de statut
    http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo $response | sed -e 's/HTTPSTATUS\:.*//g')
    
    # Vérifier le code de statut
    if [ "$http_code" -eq "$expected_status" ]; then
        print_success "Status: $http_code (attendu: $expected_status)"
    else
        print_error "Status: $http_code (attendu: $expected_status)"
    fi
    
    # Afficher le corps de la réponse si nécessaire
    if [ ! -z "$body" ] && [ "$body" != "null" ]; then
        echo "Response: $body"
    fi
    
    return $http_code
}

# =============================================================================
# DÉBUT DES TESTS
# =============================================================================

echo ""
echo "🚀 Démarrage des tests complets..."

# Test 1: Page d'accueil
test_endpoint "GET" "/" "" 200 "Accès à la page d'accueil"

# Test 2: Inscription d'un nouvel utilisateur
test_endpoint "POST" "/auth/register" "email=testuser@example.com&password=Test123456&firstName=Test&lastName=User" 302 "Inscription d'un nouvel utilisateur"

# Test 3: Connexion avec le compte créé
test_endpoint "POST" "/auth/login" "email=testuser@example.com&password=Test123456" 302 "Connexion avec le compte créé"

# Test 4: Accès au profil utilisateur
test_endpoint "GET" "/profile" "" 200 "Accès au profil utilisateur"

# Test 5: Mise à jour du profil
test_endpoint "POST" "/profile/update" "firstName=TestModified&lastName=UserModified&email=testuser@example.com" 200 "Mise à jour du profil"

# Test 6: Demande de réinitialisation de mot de passe
test_endpoint "POST" "/auth/forgot-password" "email=testuser@example.com" 200 "Demande de réinitialisation de mot de passe"

# Test 7: Changement de mot de passe
test_endpoint "POST" "/profile/change-password" "currentPassword=Test123456&newPassword=NewPassword123&confirmPassword=NewPassword123" 200 "Changement de mot de passe"

# Test 8: Déconnexion
test_endpoint "POST" "/auth/logout" "" 302 "Déconnexion"

# Test 9: Vérification que l'accès au profil est bloqué après déconnexion
test_endpoint "GET" "/profile" "" 302 "Vérification de la déconnexion"

# Test 10: Reconnexion avec nouveau mot de passe
test_endpoint "POST" "/auth/login" "email=testuser@example.com&password=NewPassword123" 302 "Reconnexion avec nouveau mot de passe"

# Test 11: Tests d'erreur - Connexion avec mot de passe incorrect
test_endpoint "POST" "/auth/login" "email=testuser@example.com&password=wrongpassword" 401 "Connexion avec mot de passe incorrect"

# Test 12: Tests d'erreur - Inscription avec email déjà utilisé
test_endpoint "POST" "/auth/register" "email=testuser@example.com&password=Test123456&firstName=Test&lastName=User" 400 "Inscription avec email déjà utilisé"

# Test 13: Tests d'erreur - Accès à un token de réinitialisation invalide
test_endpoint "GET" "/auth/reset-password/invalid-token" "" 400 "Token de réinitialisation invalide"

# Test 14: Tests d'erreur - Changement de mot de passe avec mot de passe actuel incorrect
test_endpoint "POST" "/auth/login" "email=testuser@example.com&password=NewPassword123" 302 "Reconnexion pour test changement mot de passe"
test_endpoint "POST" "/profile/change-password" "currentPassword=wrongpassword&newPassword=AnotherPassword123&confirmPassword=AnotherPassword123" 400 "Changement de mot de passe avec mot de passe actuel incorrect"

# Test 15: Tests d'erreur - Changement de mot de passe avec confirmation incorrecte
test_endpoint "POST" "/profile/change-password" "currentPassword=NewPassword123&newPassword=AnotherPassword123&confirmPassword=DifferentPassword123" 400 "Changement de mot de passe avec confirmation incorrecte"

# =============================================================================
# RÉSUMÉ DES TESTS
# =============================================================================

echo ""
echo "📊 Résumé des tests"
echo "==================="
echo "✅ Tests d'authentification: inscription, connexion, déconnexion"
echo "✅ Tests de gestion du profil: affichage, mise à jour, changement de mot de passe"
echo "✅ Tests de réinitialisation de mot de passe: demande de réinitialisation"
echo "✅ Tests d'erreur: gestion des cas d'erreur"
echo "✅ Tests de sécurité: vérification des autorisations"

echo ""
print_success "Tous les tests ont été exécutés!"
print_info "Vérifiez les résultats ci-dessus pour identifier d'éventuels problèmes"

# Nettoyer
rm -f $SESSION_FILE
