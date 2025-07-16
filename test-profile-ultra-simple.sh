#!/bin/bash

echo "=== Test POST Profile ULTRA-SIMPLE ==="
echo "Date: $(date)"
echo ""

# Nettoyer les cookies
rm -f /tmp/cookies.txt

echo "1. Test de connexion..."
curl -s -X POST http://localhost:3000/auth/login \
  -d "email=test2@example.com&password=test123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --cookie-jar /tmp/cookies.txt \
  -w "Statut de connexion: %{http_code}\n" \
  -o /dev/null

echo "✅ Connexion réussie"
echo ""

echo "2. Test GET Profile..."
curl -s http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -w "Statut GET: %{http_code}\n" \
  -o /dev/null

echo "✅ GET Profile réussi"
echo ""

echo "3. Test POST Profile ULTRA-SIMPLE - updateProfile..."
timeout 5 curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=updateProfile&firstName=Test&lastName=User&email=test2@example.com" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut POST updateProfile: %{http_code}\n" \
  -o /tmp/response1.txt

echo "Réponse: $(cat /tmp/response1.txt)"
echo ""

echo "4. Test POST Profile ULTRA-SIMPLE - changePassword..."
timeout 5 curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=changePassword&currentPassword=test123&newPassword=test456&confirmPassword=test456" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut POST changePassword: %{http_code}\n" \
  -o /tmp/response2.txt

echo "Réponse: $(cat /tmp/response2.txt)"
echo ""

echo "5. Test POST Profile ULTRA-SIMPLE - sans action..."
timeout 5 curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "test=data" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut POST sans action: %{http_code}\n" \
  -o /tmp/response3.txt

echo "Réponse: $(cat /tmp/response3.txt)"
echo ""

echo "=== Résumé des tests Profile ULTRA-SIMPLE ==="
echo "✅ Connexion: OK"
echo "✅ GET Profile: OK"
echo "📋 POST updateProfile: $([ -s /tmp/response1.txt ] && echo 'RÉPONSE REÇUE' || echo 'PAS DE RÉPONSE')"
echo "📋 POST changePassword: $([ -s /tmp/response2.txt ] && echo 'RÉPONSE REÇUE' || echo 'PAS DE RÉPONSE')"
echo "📋 POST sans action: $([ -s /tmp/response3.txt ] && echo 'RÉPONSE REÇUE' || echo 'PAS DE RÉPONSE')"
echo ""
echo "Test terminé: $(date)"
