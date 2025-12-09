#!/bin/bash

# Script pour dÃ©marrer le projet en mode Docker (simulation production)

set -e

echo "ðŸ³ DÃ©marrage du projet en mode Docker..."
echo ""

# ArrÃªter les processus locaux qui utilisent les ports
echo "ðŸ§¹ Nettoyage des ports..."

# Port 3000 (Backend)
if lsof -i :3000 > /dev/null 2>&1; then
    echo "   ArrÃªt du processus sur le port 3000..."
    PID=$(lsof -t -i :3000)
    kill -9 $PID 2>/dev/null || true
    sleep 2
fi

# Port 5173 (Frontend)
if lsof -i :5173 > /dev/null 2>&1; then
    echo "   ArrÃªt du processus sur le port 5173..."
    PID=$(lsof -t -i :5173)
    kill -9 $PID 2>/dev/null || true
fi

# Port 6379 (Redis)
if lsof -i :6379 > /dev/null 2>&1; then
    echo "   Port 6379 dÃ©jÃ  utilisÃ© (probablement un autre Redis)"
fi

echo ""
echo "ðŸ³ ArrÃªt des conteneurs existants..."
docker-compose -f docker-compose.dev.yml down 2>/dev/null || true

echo ""
echo "ðŸ—‘ï¸  Nettoyage des conteneurs orphelins..."
docker container prune -f > /dev/null 2>&1

echo ""
echo "ðŸš€ DÃ©marrage des conteneurs..."
docker-compose -f docker-compose.dev.yml up -d

echo ""
echo "âœ… Conteneurs dÃ©marrÃ©s !"
echo ""
echo "ðŸ“‹ Services disponibles :"
docker-compose -f docker-compose.dev.yml ps

echo ""
echo "ðŸ“ Logs en temps rÃ©el :"
echo "   docker-compose -f docker-compose.dev.yml logs -f"
echo ""
echo "ðŸ›‘ Pour arrÃªter :"
echo "   docker-compose -f docker-compose.dev.yml down"
echo ""
