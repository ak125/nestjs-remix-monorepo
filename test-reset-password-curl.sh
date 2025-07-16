#!/bin/bash

# =============================================================================
# 🔄 TESTS POUR LA RÉINITIALISATION DE MOT DE PASSE
# =============================================================================

echo "🔄 Tests de réinitialisation de mot de passe"
echo "==========================================="

BASE_URL="http://localhost:3000"

echo ""
echo "Test 1: Demande de réinitialisation avec email valide"
echo "===================================================="
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=test@example.com" \
  $BASE_URL/auth/forgot-password

echo ""
echo "Test 2: Demande de réinitialisation avec email invalide"
echo "======================================================="
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=inexistant@example.com" \
  $BASE_URL/auth/forgot-password

echo ""
echo "Test 3: Tentative de réinitialisation avec token invalide"
echo "========================================================="
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "password=nouveaumotdepasse123" \
  $BASE_URL/auth/reset-password/invalid-token-12345

echo ""
echo "Test 4: Accès à la page de réinitialisation"
echo "==========================================="
curl -v -X GET \
  $BASE_URL/reset-password/test-token

echo ""
echo "Test 5: Accès à la page mot de passe oublié"
echo "=========================================="
curl -v -X GET \
  $BASE_URL/forgot-password
