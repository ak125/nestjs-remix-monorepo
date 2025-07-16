#!/bin/bash

# Script de test pour le profil avec timeout
# Teste la version corrigée du profil

echo "=== Test POST Profile avec timeout interne ==="
echo "Date: $(date)"
echo

# Configuration
BASE_URL="http://localhost:3000"
TIMEOUT=10
TEST_USER_EMAIL="test@example.com"
TEST_USER_PASSWORD="test123"

# Cookie jar pour maintenir les sessions
COOKIE_JAR="/tmp/profile_cookies.txt"
rm -f "$COOKIE_JAR"

echo "1. Test de connexion..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=$TEST_USER_EMAIL&password=$TEST_USER_PASSWORD" \
  --connect-timeout $TIMEOUT \
  --max-time $TIMEOUT \
  "$BASE_URL/auth/login")

LOGIN_STATUS=$(echo "$LOGIN_RESPONSE" | tail -n 1)
echo "Statut de connexion: $LOGIN_STATUS"

if [ "$LOGIN_STATUS" = "302" ]; then
    echo "✅ Connexion réussie"
else
    echo "❌ Échec de la connexion"
    exit 1
fi

echo
echo "2. Test GET Profile-fixed..."
GET_RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" \
  --connect-timeout $TIMEOUT \
  --max-time $TIMEOUT \
  "$BASE_URL/profile-fixed")

GET_STATUS=$(echo "$GET_RESPONSE" | tail -n 1)
echo "Statut GET: $GET_STATUS"

if [ "$GET_STATUS" = "200" ]; then
    echo "✅ GET Profile-fixed réussi"
else
    echo "❌ Échec GET Profile-fixed"
    exit 1
fi

echo
echo "3. Test POST Profile-fixed - updateProfile..."
POST_RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "_action=updateProfile&firstName=TestPOST&lastName=FixedRoute&email=test@example.com&tel=0123456789&address=123 Test Street&city=TestCity&zipCode=12345&country=France" \
  --connect-timeout $TIMEOUT \
  --max-time $TIMEOUT \
  "$BASE_URL/profile-fixed")

POST_STATUS=$(echo "$POST_RESPONSE" | tail -n 1)
echo "Statut POST updateProfile: $POST_STATUS"
echo "Réponse: $(echo "$POST_RESPONSE" | head -n -1)"

if [ "$POST_STATUS" = "200" ]; then
    echo "✅ POST updateProfile réussi"
else
    echo "❌ Échec POST updateProfile"
fi

echo
echo "4. Test POST Profile-fixed - changePassword..."
POST_PWD_RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "_action=changePassword&currentPassword=test123&newPassword=newpassword&confirmPassword=newpassword" \
  --connect-timeout $TIMEOUT \
  --max-time $TIMEOUT \
  "$BASE_URL/profile-fixed")

POST_PWD_STATUS=$(echo "$POST_PWD_RESPONSE" | tail -n 1)
echo "Statut POST changePassword: $POST_PWD_STATUS"
echo "Réponse: $(echo "$POST_PWD_RESPONSE" | head -n -1)"

if [ "$POST_PWD_STATUS" = "200" ]; then
    echo "✅ POST changePassword réussi"
else
    echo "❌ Échec POST changePassword"
fi

echo
echo "5. Test POST Profile-fixed - action inconnue..."
POST_UNKNOWN_RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "_action=unknownAction&data=test" \
  --connect-timeout $TIMEOUT \
  --max-time $TIMEOUT \
  "$BASE_URL/profile-fixed")

POST_UNKNOWN_STATUS=$(echo "$POST_UNKNOWN_RESPONSE" | tail -n 1)
echo "Statut POST action inconnue: $POST_UNKNOWN_STATUS"
echo "Réponse: $(echo "$POST_UNKNOWN_RESPONSE" | head -n -1)"

if [ "$POST_UNKNOWN_STATUS" = "400" ]; then
    echo "✅ POST action inconnue gérée correctement"
else
    echo "❌ Échec POST action inconnue"
fi

echo
echo "6. Test POST Profile-fixed - sans action..."
POST_NOACTION_RESPONSE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "data=test" \
  --connect-timeout $TIMEOUT \
  --max-time $TIMEOUT \
  "$BASE_URL/profile-fixed")

POST_NOACTION_STATUS=$(echo "$POST_NOACTION_RESPONSE" | tail -n 1)
echo "Statut POST sans action: $POST_NOACTION_STATUS"
echo "Réponse: $(echo "$POST_NOACTION_RESPONSE" | head -n -1)"

if [ "$POST_NOACTION_STATUS" = "400" ]; then
    echo "✅ POST sans action gérée correctement"
else
    echo "❌ Échec POST sans action"
fi

# Nettoyage
rm -f "$COOKIE_JAR"

echo
echo "=== Résumé des tests Profile-fixed ==="
echo "1. Connexion: $LOGIN_STATUS"
echo "2. GET Profile-fixed: $GET_STATUS"
echo "3. POST updateProfile: $POST_STATUS"
echo "4. POST changePassword: $POST_PWD_STATUS"
echo "5. POST action inconnue: $POST_UNKNOWN_STATUS"
echo "6. POST sans action: $POST_NOACTION_STATUS"
echo
echo "Test terminé: $(date)"
