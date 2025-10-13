#!/bin/bash

# Script pour redémarrer le backend et tester immédiatement la création de commande
# Date: 6 octobre 2025

echo "🚀 Démarrage du backend..."
echo ""

# Tuer les anciens processus npm
pkill -f "npm run dev" 2>/dev/null || true
sleep 2

# Démarrer le backend en arrière-plan
cd /workspaces/nestjs-remix-monorepo/backend
npm run dev > /tmp/backend-output.log 2>&1 &
BACKEND_PID=$!

echo "⏳ Attente du démarrage (15 secondes)..."
sleep 15

# Vérifier si le backend est démarré
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend démarré avec succès"
    echo ""
else
    echo "⚠️  Backend peut-être pas encore prêt, continuons quand même..."
    echo ""
fi

# Afficher les dernières lignes du log
echo "📋 Dernières lignes du log backend:"
echo "════════════════════════════════════"
tail -20 /tmp/backend-output.log
echo "════════════════════════════════════"
echo ""

# Lancer le test
echo "🧪 Test de création de commande..."
echo ""
cd /workspaces/nestjs-remix-monorepo
./test-order-simple.sh

# Afficher les logs d'erreur du backend après le test
echo ""
echo "📋 Logs backend après le test:"
echo "════════════════════════════════════"
tail -30 /tmp/backend-output.log | grep -A 10 "ERROR\|Error\|error" || echo "Aucune erreur visible"
echo "════════════════════════════════════"
echo ""

echo "ℹ️  Backend PID: $BACKEND_PID"
echo "ℹ️  Pour voir les logs complets: tail -f /tmp/backend-output.log"
echo "ℹ️  Pour arrêter le backend: kill $BACKEND_PID"
echo ""
