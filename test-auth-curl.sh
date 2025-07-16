#!/bin/bash

# =============================================================================
# 🔐 TESTS SPÉCIFIQUES POUR L'AUTHENTIFICATION
# =============================================================================

echo "🔐 Tests d'authentification détaillés"
echo "======================================"

BASE_URL="http://localhost:3000"
SESSION_FILE="/tmp/auth_session.txt"

# Nettoyer les cookies
rm -f $SESSION_FILE

echo ""
echo "Test 1: Inscription d'un nouvel utilisateur"
echo "==========================================="
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=curl-test-$(date +%s)@example.com&firstname=Curl&lastname=Test&password=securepass123" \
  -c $SESSION_FILE \
  $BASE_URL/auth/register

echo ""
echo "Test 2: Connexion avec utilisateur existant"
echo "==========================================="
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=test@example.com&password=test123" \
  -c $SESSION_FILE \
  -b $SESSION_FILE \
  $BASE_URL/auth/login

echo ""
echo "Test 3: Vérification de la session"
echo "================================="
curl -v -X GET \
  -b $SESSION_FILE \
  $BASE_URL/

echo ""
echo "Test 4: Déconnexion"
echo "==================="
curl -v -X POST \
  -b $SESSION_FILE \
  $BASE_URL/auth/logout

echo ""
echo "Test 5: Vérification après déconnexion"
echo "====================================="
curl -v -X GET \
  -b $SESSION_FILE \
  $BASE_URL/profile

# Nettoyer
rm -f $SESSION_FILE
