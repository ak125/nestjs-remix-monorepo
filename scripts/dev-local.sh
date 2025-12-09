#!/bin/bash

# Script pour dÃ©marrer le projet en mode dÃ©veloppement LOCAL (sans Docker)

set -e

echo "ðŸš€ DÃ©marrage du projet en mode dÃ©veloppement local..."
echo ""

# VÃ©rifier si le backend tourne dÃ©jÃ 
if lsof -i :3000 > /dev/null 2>&1; then
    echo "âš ï¸  Le port 3000 est dÃ©jÃ  utilisÃ© (backend probablement actif)"
    echo "   Processus en cours :"
    lsof -i :3000 | grep LISTEN
    echo ""
    read -p "Voulez-vous arrÃªter le processus existant ? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PID=$(lsof -t -i :3000)
        kill -9 $PID
        echo "âœ… Processus arrÃªtÃ©"
    else
        echo "â­ï¸  Continuer avec le processus existant"
    fi
fi

# VÃ©rifier si le frontend tourne dÃ©jÃ 
if lsof -i :5173 > /dev/null 2>&1; then
    echo "âš ï¸  Le port 5173 est dÃ©jÃ  utilisÃ© (frontend probablement actif)"
    echo "   Processus en cours :"
    lsof -i :5173 | grep LISTEN
    echo ""
fi

echo ""
echo "ðŸ“‹ Ã‰tat actuel :"
echo "   Backend:  http://localhost:3000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "ðŸ’¡ Pour dÃ©marrer les services :"
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
