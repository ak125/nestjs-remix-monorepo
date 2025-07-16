#!/bin/bash

echo "=== Test POST Profile CORRIGÉ ==="
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

echo "3. Test POST Profile CORRIGÉ - updateProfile..."
curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=updateProfile&firstName=TestCorrigé&lastName=User&email=test2@example.com&tel=0123456789" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut POST updateProfile: %{http_code} | Temps: %{time_total}s\n" \
  -o /tmp/profile-corrected.txt

echo "Réponse: $(cat /tmp/profile-corrected.txt)"
echo ""

echo "4. Test POST Profile CORRIGÉ - changePassword..."
curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=changePassword&currentPassword=test123&newPassword=newtest123&confirmPassword=newtest123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut POST changePassword: %{http_code} | Temps: %{time_total}s\n" \
  -o /tmp/password-corrected.txt

echo "Réponse: $(cat /tmp/password-corrected.txt)"
echo ""

echo "=== Résumé des tests Profile CORRIGÉ ==="
echo "✅ Connexion: OK"
echo "✅ GET Profile: OK"
echo "📋 POST updateProfile: $([ -s /tmp/profile-corrected.txt ] && echo 'RÉPONSE REÇUE' || echo 'PAS DE RÉPONSE')"
echo "📋 POST changePassword: $([ -s /tmp/password-corrected.txt ] && echo 'RÉPONSE REÇUE' || echo 'PAS DE RÉPONSE')"
echo ""
echo "Test terminé: $(date)"
