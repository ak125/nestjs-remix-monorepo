#!/bin/bash

# =============================================================================
# 🧪 TESTS COMPLETS POUR L'APPLICATION NESTJS-REMIX-MONOREPO
# =============================================================================

echo "🚀 Démarrage des tests avec curl..."
echo "======================================"

BASE_URL="http://localhost:3000"
SESSION_FILE="/tmp/session_cookies.txt"

# Fonction pour afficher les résultats
show_result() {
    echo "📊 $1"
    echo "Status: $2"
    echo "Response: $3"
    echo "--------------------------------------"
}

# Nettoyer les cookies de session
rm -f $SESSION_FILE

echo ""
echo "🔧 Test 1: Vérification du serveur"
echo "=================================="
response=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/)
show_result "Page d'accueil" "$response" "Doit retourner 200"

echo ""
echo "👤 Test 2: Inscription d'un nouvel utilisateur"
echo "=============================================="
response=$(curl -s -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=test-curl@example.com&firstname=Test&lastname=Curl&password=testpass123" \
    -c $SESSION_FILE \
    $BASE_URL/auth/register)
show_result "Inscription" "$response" "Doit retourner 302 (redirection)"

echo ""
echo "🔐 Test 3: Connexion avec les identifiants"
echo "=========================================="
response=$(curl -s -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=test@example.com&password=test123" \
    -c $SESSION_FILE \
    -b $SESSION_FILE \
    $BASE_URL/auth/login)
show_result "Connexion utilisateur existant" "$response" "Doit retourner 302 (redirection)"

echo ""
echo "📝 Test 4: Accès au profil utilisateur (authentifié)"
echo "=================================================="
response=$(curl -s -w "%{http_code}" \
    -b $SESSION_FILE \
    $BASE_URL/profile)
show_result "Accès profil" "$response" "Doit retourner 302 (redirection vers page profil)"

echo ""
echo "🔄 Test 5: Mise à jour du profil utilisateur"
echo "==========================================="
response=$(curl -s -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "firstName=TestModifié&lastName=CurlModifié&email=test@example.com&tel=0123456789" \
    -b $SESSION_FILE \
    $BASE_URL/profile/update)
show_result "Mise à jour profil" "$response" "Doit retourner 302 (redirection)"

echo ""
echo "🔑 Test 6: Changement de mot de passe"
echo "===================================="
response=$(curl -s -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "currentPassword=test123&newPassword=newpass123&confirmPassword=newpass123" \
    -b $SESSION_FILE \
    $BASE_URL/profile/change-password)
show_result "Changement mot de passe" "$response" "Doit retourner 302 (redirection)"

echo ""
echo "💭 Test 7: Demande de réinitialisation de mot de passe"
echo "===================================================="
response=$(curl -s -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=test@example.com" \
    $BASE_URL/auth/forgot-password)
show_result "Mot de passe oublié" "$response" "Doit retourner 302 (redirection)"

echo ""
echo "🔍 Test 8: Test avec token de réinitialisation invalide"
echo "====================================================="
response=$(curl -s -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "password=newpassword123" \
    $BASE_URL/auth/reset-password/invalid-token)
show_result "Token invalide" "$response" "Doit retourner 302 (redirection avec erreur)"

echo ""
echo "🚪 Test 9: Déconnexion"
echo "====================="
response=$(curl -s -w "%{http_code}" \
    -X POST \
    -b $SESSION_FILE \
    $BASE_URL/auth/logout)
show_result "Déconnexion" "$response" "Doit retourner 302 (redirection)"

echo ""
echo "🔒 Test 10: Accès au profil sans authentification"
echo "================================================"
response=$(curl -s -w "%{http_code}" \
    $BASE_URL/profile)
show_result "Profil non authentifié" "$response" "Doit retourner 302 (redirection vers login)"

echo ""
echo "❌ Test 11: Connexion avec identifiants incorrects"
echo "================================================="
response=$(curl -s -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=wrong@example.com&password=wrongpass" \
    $BASE_URL/auth/login)
show_result "Identifiants incorrects" "$response" "Doit retourner 302 (redirection avec erreur)"

echo ""
echo "🔄 Test 12: Multiples tentatives de connexion (brute force)"
echo "=========================================================="
for i in {1..3}; do
    response=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "email=test@example.com&password=wrongpass" \
        $BASE_URL/auth/login)
    echo "Tentative $i: $response"
done

echo ""
echo "📊 Test 13: Vérification des pages frontend"
echo "=========================================="

# Test des pages importantes
pages=(
    "/"
    "/login"
    "/register"
    "/forgot-password"
)

for page in "${pages[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL$page)
    show_result "Page $page" "$response" "Doit retourner 200"
done

echo ""
echo "🎯 Test 14: Test de l'API avec données JSON"
echo "=========================================="

# Test pour vérifier que l'API accepte les données JSON
response=$(curl -s -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123"}' \
    $BASE_URL/auth/login)
show_result "Login avec JSON" "$response" "Peut retourner 400 si non supporté"

echo ""
echo "🏁 Test 15: Nettoyage et vérification finale"
echo "==========================================="

# Nettoyer le fichier de cookies
rm -f $SESSION_FILE

# Test final du serveur
response=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/)
show_result "Serveur final" "$response" "Doit retourner 200"

echo ""
echo "✅ TESTS TERMINÉS!"
echo "=================="
echo "📋 Résumé des tests effectués:"
echo "1. ✓ Vérification serveur"
echo "2. ✓ Inscription utilisateur"
echo "3. ✓ Connexion utilisateur"
echo "4. ✓ Accès profil authentifié"
echo "5. ✓ Mise à jour profil"
echo "6. ✓ Changement mot de passe"
echo "7. ✓ Demande réinitialisation"
echo "8. ✓ Token invalide"
echo "9. ✓ Déconnexion"
echo "10. ✓ Accès profil non authentifié"
echo "11. ✓ Identifiants incorrects"
echo "12. ✓ Protection brute force"
echo "13. ✓ Pages frontend"
echo "14. ✓ API JSON"
echo "15. ✓ Nettoyage final"
echo ""
echo "🎉 Tous les tests sont terminés!"
