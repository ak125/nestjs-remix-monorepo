#!/bin/bash

# Script pour démarrer le projet en mode Docker (simulation production)

set -e

echo "🐳 Démarrage du projet en mode Docker..."
echo ""

# Arrêter les processus locaux qui utilisent les ports
echo "🧹 Nettoyage des ports..."

# Port 3000 (Backend)
if lsof -i :3000 > /dev/null 2>&1; then
    echo "   Arrêt du processus sur le port 3000..."
    PID=$(lsof -t -i :3000)
    kill -9 $PID 2>/dev/null || true
    sleep 2
fi

# Port 5173 (Frontend)
if lsof -i :5173 > /dev/null 2>&1; then
    echo "   Arrêt du processus sur le port 5173..."
    PID=$(lsof -t -i :5173)
    kill -9 $PID 2>/dev/null || true
fi

# Port 6379 (Redis)
if lsof -i :6379 > /dev/null 2>&1; then
    echo "   Port 6379 déjà utilisé (probablement un autre Redis)"
fi

echo ""
echo "🐳 Arrêt des conteneurs existants..."
docker-compose -f docker-compose.dev.yml down 2>/dev/null || true

echo ""
echo "🗑️  Nettoyage des conteneurs orphelins..."
docker container prune -f > /dev/null 2>&1

echo ""
echo "🚀 Démarrage des conteneurs..."
docker-compose -f docker-compose.dev.yml up -d

echo ""
echo "✅ Conteneurs démarrés !"
echo ""
echo "📋 Services disponibles :"
docker-compose -f docker-compose.dev.yml ps

echo ""
echo "📝 Logs en temps réel :"
echo "   docker-compose -f docker-compose.dev.yml logs -f"
echo ""
echo "🛑 Pour arrêter :"
echo "   docker-compose -f docker-compose.dev.yml down"
echo ""
