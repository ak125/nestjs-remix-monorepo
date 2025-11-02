#!/bin/bash

# Script pour démarrer le projet en mode développement LOCAL (sans Docker)

set -e

echo "🚀 Démarrage du projet en mode développement local..."
echo ""

# Vérifier si le backend tourne déjà
if lsof -i :3000 > /dev/null 2>&1; then
    echo "⚠️  Le port 3000 est déjà utilisé (backend probablement actif)"
    echo "   Processus en cours :"
    lsof -i :3000 | grep LISTEN
    echo ""
    read -p "Voulez-vous arrêter le processus existant ? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PID=$(lsof -t -i :3000)
        kill -9 $PID
        echo "✅ Processus arrêté"
    else
        echo "⏭️  Continuer avec le processus existant"
    fi
fi

# Vérifier si le frontend tourne déjà
if lsof -i :5173 > /dev/null 2>&1; then
    echo "⚠️  Le port 5173 est déjà utilisé (frontend probablement actif)"
    echo "   Processus en cours :"
    lsof -i :5173 | grep LISTEN
    echo ""
fi

echo ""
echo "📋 État actuel :"
echo "   Backend:  http://localhost:3000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "💡 Pour démarrer les services :"
echo ""
echo "   Terminal 1 (Backend):"
echo "   cd backend && npm run dev"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   cd frontend && npm run dev"
echo ""
echo "   Terminal 3 (Redis - optionnel):"
echo "   docker run -d -p 6379:6379 --name redis-dev redis:7-alpine"
echo ""
