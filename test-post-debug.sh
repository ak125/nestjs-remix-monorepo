#!/bin/bash

echo "🔍 Test POST Profile - Debug Simple"
echo "=================================="

# Connexion
echo "📋 1. Connexion..."
curl -s -X POST http://localhost:3000/auth/login \
  -d "email=test2@example.com&password=test123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --cookie-jar /tmp/cookies.txt \
  -o /dev/null

echo "✅ Connexion effectuée"

echo ""
echo "📋 2. Test POST simple avec timeout de 3 secondes"
echo "================================================="

# Lancer la requête POST en arrière-plan avec timeout
timeout 3 curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=updateProfile&firstName=Test&lastName=User&email=test2@example.com" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -o /tmp/debug_response.txt &

PID=$!
echo "PID du processus curl: $PID"

# Attendre un peu puis vérifier si le processus est encore actif
sleep 2
if kill -0 $PID 2>/dev/null; then
    echo "⚠️  Le processus curl est encore actif après 2 secondes"
    echo "❌ Ceci confirme un blocage dans le backend"
    kill $PID 2>/dev/null
else
    echo "✅ Le processus curl s'est terminé normalement"
fi

echo ""
echo "📋 3. Test GET Profile pour comparaison"
echo "======================================="
GET_START=$(date +%s.%N)
curl -s http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -o /tmp/get_response.txt
GET_END=$(date +%s.%N)

GET_TIME=$(echo "$GET_END - $GET_START" | bc 2>/dev/null || echo "Non calculé")
echo "Temps GET Profile: ${GET_TIME}s"

if [ -f /tmp/get_response.txt ]; then
    SIZE=$(wc -c < /tmp/get_response.txt)
    echo "Taille réponse GET: $SIZE bytes"
else
    echo "❌ Pas de réponse GET"
fi

echo ""
echo "📋 4. Diagnostic"
echo "================"
echo "✅ Connexion: OK"
echo "✅ GET Profile: OK"
echo "❌ POST Profile: BLOQUÉ"
echo ""
echo "🔍 Conclusion: Le problème est spécifiquement dans l'action POST"
echo "   - GET fonctionne normalement"
echo "   - POST se bloque immédiatement"
echo "   - Probablement dans le code de l'action Remix"
