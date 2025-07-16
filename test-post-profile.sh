#!/bin/bash

echo "🧪 Test POST Profile - Version Simple"
echo "====================================="

# Nettoyer les cookies
rm -f /tmp/cookies.txt

echo ""
echo "📋 1. Connexion rapide"
echo "====================="
curl -s -X POST http://localhost:3000/auth/login \
  -d "email=test2@example.com&password=test123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --cookie-jar /tmp/cookies.txt \
  -w "Status: %{http_code}\n" \
  -o /dev/null

echo ""
echo "📋 2. Vérification accès profil"
echo "==============================="
curl -s http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -w "Status: %{http_code}\n" \
  -o /dev/null

echo ""
echo "📋 3. Test POST Profile avec timeout"
echo "===================================="
echo "Tentative de mise à jour profil..."

timeout 10 curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=updateProfile&firstName=TestUpdated&lastName=UserUpdated&email=test2@example.com" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Status: %{http_code}\n" \
  -o /tmp/profile_response.txt

CURL_EXIT_CODE=$?

if [ $CURL_EXIT_CODE -eq 124 ]; then
    echo "❌ Timeout - La requête a pris plus de 10 secondes"
    echo "⚠️  Problème potentiel avec l'action updateProfile"
elif [ $CURL_EXIT_CODE -eq 0 ]; then
    echo "✅ Requête terminée dans les temps"
    echo "Réponse:"
    cat /tmp/profile_response.txt
else
    echo "❌ Erreur curl (code: $CURL_EXIT_CODE)"
fi

echo ""
echo "📋 4. Test POST Profile - Action différente"
echo "==========================================="
echo "Test avec action changePassword..."

timeout 5 curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=changePassword&currentPassword=test123&newPassword=test123&confirmPassword=test123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Status: %{http_code}\n" \
  -o /tmp/password_response.txt

CURL_EXIT_CODE2=$?

if [ $CURL_EXIT_CODE2 -eq 124 ]; then
    echo "❌ Timeout - La requête changePassword a pris plus de 5 secondes"
elif [ $CURL_EXIT_CODE2 -eq 0 ]; then
    echo "✅ Requête changePassword terminée"
    echo "Réponse:"
    cat /tmp/password_response.txt
else
    echo "❌ Erreur curl changePassword (code: $CURL_EXIT_CODE2)"
fi

echo ""
echo "📋 5. Analyse des problèmes"
echo "=========================="
if [ $CURL_EXIT_CODE -eq 124 ] || [ $CURL_EXIT_CODE2 -eq 124 ]; then
    echo "❌ PROBLÈME IDENTIFIÉ: Les actions POST se bloquent"
    echo "🔍 Causes possibles:"
    echo "   - Boucle infinie dans le code backend"
    echo "   - Problème avec la méthode updateProfile ou changePassword"
    echo "   - Problème avec la gestion des sessions"
    echo "   - Problème avec la base de données Supabase"
else
    echo "✅ Aucun problème de timeout détecté"
fi

echo ""
echo "🎯 RÉSUMÉ DU TEST"
echo "================="
echo "Status updateProfile: $([ $CURL_EXIT_CODE -eq 0 ] && echo '✅ OK' || echo '❌ PROBLÈME')"
echo "Status changePassword: $([ $CURL_EXIT_CODE2 -eq 0 ] && echo '✅ OK' || echo '❌ PROBLÈME')"
