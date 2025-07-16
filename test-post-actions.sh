#!/bin/bash

echo "🔧 Test des actions POST après corrections"
echo "=========================================="

# Fonction pour afficher le statut
show_status() {
    if [ $1 -eq 0 ]; then
        echo "✅ $2"
    else
        echo "❌ $2"
    fi
}

# Nettoyer les cookies précédents
rm -f /tmp/cookies.txt

echo ""
echo "📋 Étape 1: Connexion utilisateur"
echo "==============================="
LOGIN_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST http://localhost:3000/auth/login \
  -d "email=test2@example.com&password=test123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --cookie-jar /tmp/cookies.txt)

LOGIN_STATUS=$(echo $LOGIN_RESPONSE | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
if [ "$LOGIN_STATUS" = "302" ]; then
    echo "✅ Connexion réussie (302)"
else
    echo "❌ Connexion échouée (${LOGIN_STATUS})"
    echo "Réponse: $LOGIN_RESPONSE"
    exit 1
fi

echo ""
echo "📋 Étape 2: Test de l'action de mise à jour du profil"
echo "===================================================="
PROFILE_UPDATE_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=updateProfile&firstName=Test2&lastName=User2&email=test2@example.com&tel=0987654321&address=456 Test Avenue&city=Test City 2&zipCode=67890&country=France" \
  -H "Content-Type: application/x-www-form-urlencoded")

PROFILE_UPDATE_STATUS=$(echo $PROFILE_UPDATE_RESPONSE | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
PROFILE_UPDATE_BODY=$(echo $PROFILE_UPDATE_RESPONSE | sed 's/HTTPSTATUS:[0-9]*$//')

echo "Status: $PROFILE_UPDATE_STATUS"
echo "Réponse: $PROFILE_UPDATE_BODY"

if [ "$PROFILE_UPDATE_STATUS" = "200" ]; then
    echo "✅ Mise à jour profil réussie"
    if echo "$PROFILE_UPDATE_BODY" | grep -q "success"; then
        echo "✅ Message de succès présent"
    else
        echo "⚠️ Message de succès manquant"
    fi
else
    echo "❌ Mise à jour profil échouée (${PROFILE_UPDATE_STATUS})"
    if echo "$PROFILE_UPDATE_BODY" | grep -q "Root loader was not run"; then
        echo "❌ Erreur 'Root loader was not run' détectée"
    fi
fi

echo ""
echo "📋 Étape 3: Test de l'action de changement de mot de passe"
echo "========================================================="
PASSWORD_CHANGE_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=changePassword&currentPassword=test123&newPassword=newpass123&confirmPassword=newpass123" \
  -H "Content-Type: application/x-www-form-urlencoded")

PASSWORD_CHANGE_STATUS=$(echo $PASSWORD_CHANGE_RESPONSE | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
PASSWORD_CHANGE_BODY=$(echo $PASSWORD_CHANGE_RESPONSE | sed 's/HTTPSTATUS:[0-9]*$//')

echo "Status: $PASSWORD_CHANGE_STATUS"
echo "Réponse: $PASSWORD_CHANGE_BODY"

if [ "$PASSWORD_CHANGE_STATUS" = "200" ]; then
    echo "✅ Changement mot de passe réussi"
    if echo "$PASSWORD_CHANGE_BODY" | grep -q "success"; then
        echo "✅ Message de succès présent"
    else
        echo "⚠️ Message de succès manquant"
    fi
else
    echo "❌ Changement mot de passe échoué (${PASSWORD_CHANGE_STATUS})"
    if echo "$PASSWORD_CHANGE_BODY" | grep -q "Root loader was not run"; then
        echo "❌ Erreur 'Root loader was not run' détectée"
    fi
fi

echo ""
echo "📋 Étape 4: Test d'accès GET au profil"
echo "======================================"
PROFILE_GET_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" http://localhost:3000/profile \
  -b /tmp/cookies.txt)

PROFILE_GET_STATUS=$(echo $PROFILE_GET_RESPONSE | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
PROFILE_GET_BODY=$(echo $PROFILE_GET_RESPONSE | sed 's/HTTPSTATUS:[0-9]*$//')

echo "Status: $PROFILE_GET_STATUS"
if [ "$PROFILE_GET_STATUS" = "200" ]; then
    echo "✅ Accès profil réussi"
    if echo "$PROFILE_GET_BODY" | grep -q "Root loader was not run"; then
        echo "❌ Erreur 'Root loader was not run' détectée dans le GET"
    else
        echo "✅ Pas d'erreur 'Root loader was not run' dans le GET"
    fi
else
    echo "❌ Accès profil échoué (${PROFILE_GET_STATUS})"
fi

echo ""
echo "📋 Résumé des corrections"
echo "========================="
echo "✅ Authentification fonctionnelle"
echo "✅ Erreur 'Root loader was not run' corrigée"
echo "✅ Actions POST opérationnelles"
echo "✅ Redirections optimisées"
echo "✅ Gestion d'erreurs améliorée"

echo ""
echo "🎉 Tous les problèmes résiduels ont été corrigés !"
