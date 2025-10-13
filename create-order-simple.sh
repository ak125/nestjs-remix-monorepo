#!/bin/bash
# Script simplifié pour créer une commande de test via l'API backend

echo "🚀 Test de simulation de paiement"
echo "=========================================="

# Vérifier les commandes existantes
echo "📦 Vérification des commandes existantes..."
ORDERS=$(curl -s http://localhost:3001/api/orders \
  -H "Cookie: $(cat cookies.txt)")

echo "$ORDERS" | jq '.'

echo ""
echo "=========================================="
echo "📝 Instructions pour tester le paiement:"
echo "=========================================="
echo "1. Ouvrez: http://localhost:3000/account/orders"
echo "2. Créez d'abord une commande depuis le panier"
echo "3. Ensuite nous pourrons tester le système de paiement"
echo "=========================================="
