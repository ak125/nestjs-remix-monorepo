#!/bin/bash

# Script de démarrage simplifié pour le développement

set -e

echo "🚀 Démarrage de l'environnement de développement..."
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier si Redis tourne
echo "🔍 Vérification de Redis..."
if docker ps | grep -q redis-dev; then
    echo -e "${GREEN}✅ Redis déjà actif${NC}"
else
    echo -e "${YELLOW}⚠️  Redis non détecté, démarrage...${NC}"
    
    # Nettoyer les anciens conteneurs Redis
    docker ps -a | grep redis | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true
    
    # Démarrer Redis
    docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Redis démarré avec succès${NC}"
    else
        echo -e "${RED}❌ Erreur lors du démarrage de Redis${NC}"
        exit 1
    fi
fi

echo ""
echo "🔍 Vérification des ports..."

# Vérifier le port 3000
if lsof -i :3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 3000 déjà utilisé${NC}"
    PID=$(lsof -t -i :3000)
    echo "   Processus : PID $PID"
    ps -p $PID -o cmd= 2>/dev/null || echo "   (détails non disponibles)"
    echo ""
    read -p "Voulez-vous arrêter ce processus ? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill -9 $PID
        echo -e "${GREEN}✅ Processus arrêté${NC}"
    else
        echo -e "${YELLOW}⏭️  Continuer avec le processus existant${NC}"
    fi
fi

echo ""
echo "📊 État des services :"
echo ""
echo "   Backend + Frontend : http://localhost:3000"
echo "   Redis             : localhost:6379"
echo ""
echo -e "${GREEN}✅ Environnement prêt !${NC}"
echo ""
echo "💡 Pour démarrer le serveur :"
echo "   npm run dev"
echo ""
echo "🔍 Pour vérifier l'état :"
echo "   ./scripts/dev-status.sh"
echo ""
