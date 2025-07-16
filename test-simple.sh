#!/bin/bash

echo "🔧 Test simple des actions POST"
echo "==============================="

# Test direct avec curl
echo "📋 Test action POST profil..."
RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=updateProfile&firstName=Test2&lastName=User2&email=test2@example.com" \
  -H "Content-Type: application/x-www-form-urlencoded")

if [ $? -eq 0 ]; then
    echo "✅ Requête réussie"
    echo "Réponse: $RESPONSE"
else
    echo "❌ Erreur dans la requête"
fi

echo ""
echo "📋 Test accès GET profil..."
GET_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/profile -b /tmp/cookies.txt)

if [ $? -eq 0 ]; then
    echo "✅ Accès GET réussi"
    echo "Status: $(echo $GET_RESPONSE | grep -o '[0-9]\{3\}$')"
else
    echo "❌ Erreur dans l'accès GET"
fi
