#!/bin/bash

echo "=== Test POST Actions GLOBALES ==="
echo "Date: $(date)"
echo ""

# Nettoyer les cookies
rm -f /tmp/cookies.txt

echo "1. Test POST Login (qui marche)..."
curl -s -X POST http://localhost:3000/auth/login \
  -d "email=test2@example.com&password=test123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --cookie-jar /tmp/cookies.txt \
  -w "Statut POST Login: %{http_code} | Temps: %{time_total}s\n" \
  -o /tmp/login.txt

echo "Réponse login: $(head -c 200 /tmp/login.txt)..."
echo ""

echo "2. Test POST Profile (qui ne marche pas)..."
timeout 5 curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=updateProfile&firstName=Test" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut POST Profile: %{http_code} | Temps: %{time_total}s\n" \
  -o /tmp/profile.txt

echo "Réponse profile: $(head -c 200 /tmp/profile.txt)..."
echo ""

echo "3. Test POST Users (si disponible)..."
timeout 5 curl -s -X POST http://localhost:3000/users \
  -b /tmp/cookies.txt \
  -d "test=data" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut POST Users: %{http_code} | Temps: %{time_total}s\n" \
  -o /tmp/users.txt

echo "Réponse users: $(head -c 200 /tmp/users.txt)..."
echo ""

echo "4. Test POST Logout (si disponible)..."
timeout 5 curl -s -X POST http://localhost:3000/auth/logout \
  -b /tmp/cookies.txt \
  -d "" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut POST Logout: %{http_code} | Temps: %{time_total}s\n" \
  -o /tmp/logout.txt

echo "Réponse logout: $(head -c 200 /tmp/logout.txt)..."
echo ""

echo "=== Résumé des tests POST ==="
echo "✅ POST Login: $([ -s /tmp/login.txt ] && echo 'FONCTIONNE' || echo 'ÉCHEC')"
echo "❌ POST Profile: $([ -s /tmp/profile.txt ] && echo 'FONCTIONNE' || echo 'ÉCHEC')"
echo "📋 POST Users: $([ -s /tmp/users.txt ] && echo 'FONCTIONNE' || echo 'ÉCHEC')"
echo "📋 POST Logout: $([ -s /tmp/logout.txt ] && echo 'FONCTIONNE' || echo 'ÉCHEC')"
echo ""
echo "Test terminé: $(date)"
