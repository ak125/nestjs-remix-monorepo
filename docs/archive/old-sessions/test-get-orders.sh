#!/bin/bash

# Test de récupération des commandes pour monia via l'API
# Date: 6 octobre 2025

BACKEND_URL="http://localhost:3000"
USER_EMAIL="monia123@gmail.com"
PASSWORD="321monia"

echo "🧪 TEST DE RÉCUPÉRATION DES COMMANDES"
echo "═════════════════════════════════════"
echo ""

# 1. Connexion
echo "🔐 Connexion..."
LOGIN_RESPONSE=$(curl -s -c /tmp/monia_cookie.txt -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$USER_EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

if echo "$LOGIN_RESPONSE" | grep -q "success.*true\|user\|token"; then
  echo "✅ Connexion réussie"
  echo ""
else
  echo "❌ Échec connexion"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

# 2. Récupérer les commandes
echo "📦 Récupération des commandes..."
echo ""

ORDERS_RESPONSE=$(curl -s -b /tmp/monia_cookie.txt "$BACKEND_URL/api/orders")

echo "Réponse:"
echo "$ORDERS_RESPONSE" | jq '.' 2>/dev/null || echo "$ORDERS_RESPONSE"
echo ""

# Vérifier le résultat
if echo "$ORDERS_RESPONSE" | grep -q "ord_id\|orders"; then
  echo "✅ Commandes récupérées"
  echo ""
  
  # Compter les commandes
  ORDER_COUNT=$(echo "$ORDERS_RESPONSE" | jq '.orders | length' 2>/dev/null || echo "?")
  echo "📊 Nombre de commandes: $ORDER_COUNT"
  echo ""
else
  echo "⚠️  Aucune commande ou erreur"
  echo ""
fi

# Nettoyage
rm -f /tmp/monia_cookie.txt

echo "═════════════════════════════════════"
echo "✅ Test terminé"
echo ""
