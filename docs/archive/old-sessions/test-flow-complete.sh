#!/bin/bash

# Test complet du flux utilisateur : liste + détail commande
# Date: 6 octobre 2025

BACKEND_URL="http://localhost:3000"
USER_EMAIL="monia123@gmail.com"
PASSWORD="321monia"

echo "🧪 TEST FLUX COMPLET - LISTE + DÉTAIL COMMANDES"
echo "═══════════════════════════════════════════════"
echo ""

# 1. Connexion
echo "🔐 Étape 1: Connexion..."
LOGIN_RESPONSE=$(curl -s -c /tmp/flow_cookie.txt -X POST "$BACKEND_URL/auth/login" \
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
  exit 1
fi

# 2. Récupérer la liste des commandes
echo "📦 Étape 2: Récupération de la liste des commandes..."
ORDERS_RESPONSE=$(curl -s -b /tmp/flow_cookie.txt "$BACKEND_URL/api/orders?limit=5")

# Extraire le premier ord_id
FIRST_ORDER_ID=$(echo "$ORDERS_RESPONSE" | jq -r '.data[0].ord_id' 2>/dev/null)

if [ -n "$FIRST_ORDER_ID" ] && [ "$FIRST_ORDER_ID" != "null" ]; then
  echo "✅ Liste récupérée"
  echo "   Premier ID: $FIRST_ORDER_ID"
  echo ""
else
  echo "❌ Aucune commande trouvée"
  exit 1
fi

# 3. Récupérer le détail de la première commande
echo "🔍 Étape 3: Récupération du détail de la commande..."
DETAIL_RESPONSE=$(curl -s -b /tmp/flow_cookie.txt "$BACKEND_URL/api/orders/$FIRST_ORDER_ID")

echo "$DETAIL_RESPONSE" | jq '.' 2>/dev/null || echo "$DETAIL_RESPONSE"
echo ""

# Vérifier le résultat
if echo "$DETAIL_RESPONSE" | grep -q "success.*true"; then
  echo "✅ Détail récupéré avec succès"
  echo ""
  
  # Extraire quelques infos
  TOTAL=$(echo "$DETAIL_RESPONSE" | jq -r '.data.ord_total_ttc' 2>/dev/null)
  NB_LINES=$(echo "$DETAIL_RESPONSE" | jq '.data.lines | length' 2>/dev/null)
  
  echo "📊 Résumé de la commande:"
  echo "   ID: $FIRST_ORDER_ID"
  echo "   Total: $TOTAL €"
  echo "   Nombre de lignes: $NB_LINES"
  echo ""
else
  echo "❌ Échec récupération détail"
  echo ""
fi

# 4. Tester avec un ID invalide
echo "🧪 Étape 4: Test avec ID invalide..."
INVALID_RESPONSE=$(curl -s -b /tmp/flow_cookie.txt "$BACKEND_URL/api/orders/INVALID-ID-123")

if echo "$INVALID_RESPONSE" | grep -q "404\|not found\|introuvable"; then
  echo "✅ Gestion d'erreur correcte (404)"
  echo ""
else
  echo "⚠️  Réponse inattendue pour ID invalide"
  echo "$INVALID_RESPONSE" | head -5
  echo ""
fi

# Nettoyage
rm -f /tmp/flow_cookie.txt

echo "═══════════════════════════════════════════════"
echo "✅ Test flux complet terminé"
echo ""

echo "📋 Prochaine étape:"
echo "   → Rafraîchir la page web"
echo "   → Cliquer sur 'Voir le détail' d'une commande"
echo "   → Vérifier que la page de détail s'affiche"
echo ""
