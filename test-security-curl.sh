#!/bin/bash

# =============================================================================
# 🛡️ TESTS DE SÉCURITÉ ET PERFORMANCE
# =============================================================================

echo "🛡️ Tests de sécurité et performance"
echo "=================================="

BASE_URL="http://localhost:3000"
SESSION_FILE="/tmp/security_session.txt"

echo ""
echo "Test 1: Protection contre le brute force"
echo "======================================="
echo "Tentatives de connexion multiples avec mot de passe incorrect..."

for i in {1..8}; do
    echo "Tentative $i:"
    response=$(curl -s -w "Status: %{http_code}, Time: %{time_total}s" \
        -X POST \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "email=test@example.com&password=wrongpassword$i" \
        $BASE_URL/auth/login)
    echo "$response"
    sleep 1
done

echo ""
echo "Test 2: Vérification du cache utilisateur"
echo "========================================"
# Connexion valide
curl -s -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=test@example.com&password=test123" \
  -c $SESSION_FILE \
  $BASE_URL/auth/login

# Mesure du temps de réponse pour les accès profil
echo "Premier accès au profil (cache miss):"
curl -w "Time: %{time_total}s, Status: %{http_code}\n" \
  -s -o /dev/null \
  -b $SESSION_FILE \
  $BASE_URL/profile

echo "Deuxième accès au profil (cache hit):"
curl -w "Time: %{time_total}s, Status: %{http_code}\n" \
  -s -o /dev/null \
  -b $SESSION_FILE \
  $BASE_URL/profile

echo ""
echo "Test 3: Injection SQL dans les formulaires"
echo "========================================="
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=test@example.com'; DROP TABLE users; --&password=test123" \
  $BASE_URL/auth/login

echo ""
echo "Test 4: Tentative d'injection XSS"
echo "================================="
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=<script>alert('XSS')</script>&password=test123" \
  $BASE_URL/auth/login

echo ""
echo "Test 5: Vérification des headers de sécurité"
echo "==========================================="
curl -I $BASE_URL/

echo ""
echo "Test 6: Test de charge basique"
echo "=============================="
echo "Envoi de 10 requêtes simultanées..."

for i in {1..10}; do
    (curl -s -w "Request $i: %{http_code} in %{time_total}s\n" \
        -o /dev/null \
        $BASE_URL/) &
done
wait

echo ""
echo "Test 7: Vérification de la gestion des sessions"
echo "=============================================="
# Créer une session
curl -s -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=test@example.com&password=test123" \
  -c $SESSION_FILE \
  $BASE_URL/auth/login

# Vérifier que la session est active
echo "Session active:"
curl -s -w "Status: %{http_code}\n" \
  -b $SESSION_FILE \
  $BASE_URL/profile

# Déconnecter
curl -s -X POST \
  -b $SESSION_FILE \
  $BASE_URL/auth/logout

# Vérifier que la session est inactive
echo "Session après déconnexion:"
curl -s -w "Status: %{http_code}\n" \
  -b $SESSION_FILE \
  $BASE_URL/profile

echo ""
echo "Test 8: Vérification des limites de taille"
echo "========================================="
# Test avec des données très longues
LONG_STRING=$(printf 'a%.0s' {1..5000})
curl -v -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=test@example.com&password=test123&firstName=$LONG_STRING" \
  $BASE_URL/auth/register

# Nettoyer
rm -f $SESSION_FILE
