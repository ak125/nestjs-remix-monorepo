#!/bin/bash

# =============================================================================
# 👤 TESTS POUR LA GESTION DU PROFIL UTILISATEUR
# =============================================================================

echo "👤 Tests de gestion du profil utilisateur"
echo "========================================"

BASE_URL="http://localhost:3000"
SESSION_FILE="/tmp/profile_session.txt"

# Nettoyer les cookies
rm -f $SESSION_FILE

echo ""
echo "Étape préliminaire: Connexion"
echo "============================"
curl -s -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=test@example.com&password=test123" \
  -c $SESSION_FILE \
  $BASE_URL/auth/login

echo ""
echo "Test 1: Accès au profil utilisateur"
echo "=================================="
curl -v -X GET \
  -b $SESSION_FILE \
  $BASE_URL/profile

echo ""
echo "Test 2: Mise à jour des informations personnelles"
echo "================================================="
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "firstName=TestModifié&lastName=CurlModifié&email=test@example.com&tel=0123456789&address=123 Rue de Test&city=Paris&zipCode=75001&country=France" \
  -b $SESSION_FILE \
  $BASE_URL/profile/update

echo ""
echo "Test 3: Changement de mot de passe valide"
echo "========================================="
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "currentPassword=test123&newPassword=newpass123&confirmPassword=newpass123" \
  -b $SESSION_FILE \
  $BASE_URL/profile/change-password

echo ""
echo "Test 4: Changement de mot de passe avec confirmation incorrecte"
echo "=============================================================="
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "currentPassword=newpass123&newPassword=anotherpass123&confirmPassword=differentpass123" \
  -b $SESSION_FILE \
  $BASE_URL/profile/change-password

echo ""
echo "Test 5: Changement de mot de passe trop court"
echo "============================================="
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "currentPassword=newpass123&newPassword=123&confirmPassword=123" \
  -b $SESSION_FILE \
  $BASE_URL/profile/change-password

echo ""
echo "Test 6: Accès au profil sans authentification"
echo "============================================="
curl -v -X GET \
  $BASE_URL/profile

echo ""
echo "Test 7: Mise à jour du profil sans authentification"
echo "=================================================="
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "firstName=Hacker&lastName=Attempt" \
  $BASE_URL/profile/update

# Nettoyer
rm -f $SESSION_FILE
