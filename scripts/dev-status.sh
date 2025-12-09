#!/bin/bash

# Script de vÃ©rification de l'Ã©tat des services

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${NC}"
echo -e "${BLUE}    Ã‰TAT DES SERVICES - DEV${NC}"
echo -e "${BLUE}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${NC}"
echo ""

# VÃ©rifier Backend/Frontend (port 3000)
echo -e "${YELLOW}ðŸ” Backend + Frontend (port 3000)${NC}"
if lsof -i :3000 > /dev/null 2>&1; then
    PID=$(lsof -t -i :3000)
    CMD=$(ps -p $PID -o cmd= 2>/dev/null)
    echo -e "${GREEN}âœ… ACTIF${NC}"
    echo "   PID     : $PID"
    echo "   Commande: $CMD"
    echo "   URL     : http://localhost:3000"
else
    echo -e "${RED}âŒ NON ACTIF${NC}"
    echo "   DÃ©marrer avec: npm run dev"
fi
echo ""

# VÃ©rifier Redis (port 6379)
echo -e "${YELLOW}ðŸ” Redis (port 6379)${NC}"
if docker ps --filter "name=redis" --format "{{.Names}}" | grep -q redis; then
    CONTAINER=$(docker ps --filter "name=redis" --format "{{.Names}}" | head -1)
    STATUS=$(docker ps --filter "name=redis" --format "{{.Status}}" | head -1)
    echo -e "${GREEN}âœ… ACTIF (Docker)${NC}"
    echo "   Container: $CONTAINER"
    echo "   Status   : $STATUS"
    
    # Tester la connexion
    if docker exec $CONTAINER redis-cli ping > /dev/null 2>&1; then
        echo -e "   Connexion: ${GREEN}OK${NC}"
    else
        echo -e "   Connexion: ${RED}ERREUR${NC}"
    fi
else
    echo -e "${RED}âŒ NON ACTIF${NC}"
    echo "   DÃ©marrer avec: docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine"
fi
echo ""

# Processus Node.js actifs
echo -e "${YELLOW}ðŸ” Processus Node.js${NC}"
NODE_PROCESSES=$(ps aux | grep node | grep -v grep | grep -v "vscode" | grep -v "copilot" | wc -l)
if [ $NODE_PROCESSES -gt 0 ]; then
    echo -e "${GREEN}âœ… $NODE_PROCESSES processus actifs${NC}"
    ps aux | grep node | grep -v grep | grep -v "vscode" | grep -v "copilot" | head -5 | awk '{print "   PID "$2" - "$11" "$12" "$13}'
else
    echo -e "${YELLOW}âš ï¸  Aucun processus Node.js dÃ©tectÃ©${NC}"
fi
echo ""

# Conteneurs Docker actifs
echo -e "${YELLOW}ðŸ” Conteneurs Docker${NC}"
DOCKER_CONTAINERS=$(docker ps --format "{{.Names}}" | wc -l)
if [ $DOCKER_CONTAINERS -gt 0 ]; then
    echo -e "${GREEN}âœ… $DOCKER_CONTAINERS conteneur(s) actif(s)${NC}"
    docker ps --format "   {{.Names}} - {{.Status}}"
else
    echo -e "${YELLOW}âš ï¸  Aucun conteneur actif${NC}"
fi
echo ""

# RÃ©sumÃ©
echo -e "${BLUE}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${NC}"
echo -e "${BLUE}    RÃ‰SUMÃ‰${NC}"
echo -e "${BLUE}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${NC}"

# Calculer le score
SCORE=0
if lsof -i :3000 > /dev/null 2>&1; then ((SCORE++)); fi
if docker ps --filter "name=redis" --format "{{.Names}}" | grep -q redis; then ((SCORE++)); fi

if [ $SCORE -eq 2 ]; then
    echo -e "${GREEN}âœ… TOUS LES SERVICES SONT ACTIFS${NC}"
    echo ""
    echo "ðŸŒ Application disponible sur : http://localhost:3000"
    echo ""
elif [ $SCORE -eq 1 ]; then
    echo -e "${YELLOW}âš ï¸  SERVICES PARTIELLEMENT ACTIFS ($SCORE/2)${NC}"
    echo ""
    echo "ðŸ’¡ Commandes utiles :"
    if ! lsof -i :3000 > /dev/null 2>&1; then
        echo "   - DÃ©marrer le backend : npm run dev"
    fi
    if ! docker ps --filter "name=redis" --format "{{.Names}}" | grep -q redis; then
        echo "   - DÃ©marrer Redis     : docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine"
    fi
    echo ""
else
    echo -e "${RED}âŒ AUCUN SERVICE ACTIF${NC}"
    echo ""
    echo "ðŸš€ Pour dÃ©marrer :"
    echo "   1. Redis : docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine"
    echo "   2. App   : npm run dev"
    echo ""
    echo "   Ou utiliser: ./scripts/dev-start.sh"
    echo ""
fi

echo -e "${BLUE}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${NC}"
