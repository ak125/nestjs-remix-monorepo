#!/bin/bash

# Script de test pour l'authentification du Super Admin niveau 9
# À exécuter après avoir créé l'admin dans Supabase

echo "🚀 Test d'authentification Super Admin niveau 9"
echo "=============================================="
echo ""

# Variables
BASE_URL="http://localhost:3000"
EMAIL="superadmin@autoparts.com"
PASSWORD="SuperAdmin2025!"

echo "📧 Email: $EMAIL"
echo "🔑 Mot de passe: $PASSWORD"
echo "🎖️ Niveau: 9 (Super Admin)"
echo ""

# Test 1: Vérifier que le backend est en marche
echo "🔍 Test 1: Vérification du backend..."
if curl -s "$BASE_URL/api/health" > /dev/null; then
    echo "✅ Backend accessible"
else
    echo "❌ Backend non accessible. Assurez-vous qu'il est démarré sur le port 3000"
    exit 1
fi
echo ""

# Test 2: Test de connexion via API
echo "🔍 Test 2: Tentative de connexion..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    -c cookies.txt \
    -w "HTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "📊 Status HTTP: $HTTP_STATUS"
echo "📄 Réponse: $RESPONSE_BODY"

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "302" ]; then
    echo "✅ Connexion réussie!"
else
    echo "❌ Échec de la connexion"
fi
echo ""

# Test 3: Vérifier la session
echo "🔍 Test 3: Vérification de la session..."
SESSION_RESPONSE=$(curl -s "$BASE_URL/api/auth/me" \
    -b cookies.txt \
    -w "HTTP_STATUS:%{http_code}")

SESSION_HTTP_STATUS=$(echo "$SESSION_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
SESSION_BODY=$(echo "$SESSION_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "📊 Status HTTP: $SESSION_HTTP_STATUS"
echo "📄 Données utilisateur: $SESSION_BODY"

if [ "$SESSION_HTTP_STATUS" = "200" ]; then
    echo "✅ Session valide!"
else
    echo "❌ Session invalide"
fi
echo ""

# Test 4: Test d'accès admin
echo "🔍 Test 4: Test d'accès aux routes admin..."
ADMIN_RESPONSE=$(curl -s "$BASE_URL/api/admin/users" \
    -b cookies.txt \
    -w "HTTP_STATUS:%{http_code}")

ADMIN_HTTP_STATUS=$(echo "$ADMIN_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
ADMIN_BODY=$(echo "$ADMIN_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "📊 Status HTTP: $ADMIN_HTTP_STATUS"

if [ "$ADMIN_HTTP_STATUS" = "200" ]; then
    echo "✅ Accès admin autorisé!"
else
    echo "❌ Accès admin refusé"
fi
echo ""

# Test 5: Déconnexion
echo "🔍 Test 5: Test de déconnexion..."
LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/logout" \
    -b cookies.txt \
    -w "HTTP_STATUS:%{http_code}")

LOGOUT_HTTP_STATUS=$(echo "$LOGOUT_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)

echo "📊 Status HTTP: $LOGOUT_HTTP_STATUS"

if [ "$LOGOUT_HTTP_STATUS" = "200" ] || [ "$LOGOUT_HTTP_STATUS" = "302" ]; then
    echo "✅ Déconnexion réussie!"
else
    echo "❌ Échec de la déconnexion"
fi
echo ""

# Nettoyage
rm -f cookies.txt

echo "🏁 Tests terminés!"
echo ""
echo "📝 Résumé:"
echo "   - Backend: $([ "$HTTP_STATUS" != "" ] && echo "✅ OK" || echo "❌ KO")"
echo "   - Connexion: $([ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "302" ] && echo "✅ OK" || echo "❌ KO")"
echo "   - Session: $([ "$SESSION_HTTP_STATUS" = "200" ] && echo "✅ OK" || echo "❌ KO")"
echo "   - Accès admin: $([ "$ADMIN_HTTP_STATUS" = "200" ] && echo "✅ OK" || echo "❌ KO")"
echo "   - Déconnexion: $([ "$LOGOUT_HTTP_STATUS" = "200" ] || [ "$LOGOUT_HTTP_STATUS" = "302" ] && echo "✅ OK" || echo "❌ KO")"
