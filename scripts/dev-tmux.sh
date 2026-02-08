#!/bin/bash
# =============================================================================
# dev-tmux.sh - Environnement de développement isolé dans tmux
# =============================================================================
# Ce script sépare les processus de développement de VS Code pour éviter
# les freezes et crashes lors de l'utilisation de plusieurs agents Claude Code.
#
# Usage:
#   ./scripts/dev-tmux.sh        # Démarrer l'environnement
#   tmux attach -t automecanik   # Attacher à la session
#   Ctrl+B puis D                # Détacher (processus continuent)
#   tmux kill-session -t automecanik  # Arrêter tout
#
# Windows:
#   0: tsc     - TypeScript compiler watch (backend)
#   1: server  - Nodemon serveur NestJS
#   2: vite    - Frontend Remix/Vite dev
#   3: htop    - Monitoring système
#   4: test    - Terminal pour tests curl
# =============================================================================

set -e

SESSION="automecanik"
PROJECT_DIR="/opt/automecanik/app"

# Couleurs pour output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Démarrage environnement de développement...${NC}"

# Kill session existante si elle existe
tmux kill-session -t $SESSION 2>/dev/null || true

# Vérifier que Redis tourne
if ! docker ps | grep -q redis; then
    echo -e "${YELLOW}📦 Démarrage de Redis...${NC}"
    docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine 2>/dev/null || true
fi

# Window 0: TypeScript compiler watch (mémoire réduite à 2GB)
echo -e "${GREEN}[0/4] Création window tsc...${NC}"
tmux new-session -d -s $SESSION -n 'tsc' -c "$PROJECT_DIR/backend"
tmux send-keys -t $SESSION:0 'echo "🔧 TypeScript Compiler Watch (2GB max)"' C-m
tmux send-keys -t $SESSION:0 'NODE_OPTIONS="--max-old-space-size=2048" npm run dev:compile' C-m

# Window 1: Nodemon serveur (attend que tsc soit prêt)
echo -e "${GREEN}[1/4] Création window server...${NC}"
tmux new-window -t $SESSION -n 'server' -c "$PROJECT_DIR/backend"
tmux send-keys -t $SESSION:1 'echo "⏳ Attente compilation TypeScript (5s)..."' C-m
tmux send-keys -t $SESSION:1 'sleep 5 && npm run dev:watch' C-m

# Window 2: Frontend Vite
echo -e "${GREEN}[2/4] Création window vite...${NC}"
tmux new-window -t $SESSION -n 'vite' -c "$PROJECT_DIR/frontend"
tmux send-keys -t $SESSION:2 'echo "⚡ Frontend Vite Dev Server"' C-m
tmux send-keys -t $SESSION:2 'npm run dev' C-m

# Window 3: Monitoring htop
echo -e "${GREEN}[3/4] Création window htop...${NC}"
tmux new-window -t $SESSION -n 'htop' -c "$PROJECT_DIR"
tmux send-keys -t $SESSION:3 'htop' C-m

# Window 4: Terminal pour tests
echo -e "${GREEN}[4/4] Création window test...${NC}"
tmux new-window -t $SESSION -n 'test' -c "$PROJECT_DIR"
tmux send-keys -t $SESSION:4 'echo "🧪 Terminal de test - Exemples:"' C-m
tmux send-keys -t $SESSION:4 'echo "  curl http://localhost:3000/health"' C-m
tmux send-keys -t $SESSION:4 'echo "  curl -s http://localhost:3000/api/catalog/families | jq .data[:3]"' C-m
tmux send-keys -t $SESSION:4 'echo ""' C-m

# Sélectionner la première window
tmux select-window -t $SESSION:0

echo ""
echo -e "${GREEN}✅ Environnement de développement démarré !${NC}"
echo ""
echo "📋 Commandes utiles:"
echo "   tmux attach -t $SESSION       # Attacher à la session"
echo "   Ctrl+B puis 0-4               # Changer de window"
echo "   Ctrl+B puis D                 # Détacher (garde les processus)"
echo "   tmux kill-session -t $SESSION # Tout arrêter"
echo ""
echo "🪟 Windows disponibles:"
echo "   0: tsc    - TypeScript compiler"
echo "   1: server - Nodemon NestJS"
echo "   2: vite   - Frontend Remix"
echo "   3: htop   - Monitoring"
echo "   4: test   - Tests curl"
echo ""
echo -e "${GREEN}✅ Dev en cours en arrière-plan. Vous pouvez rester dans VS Code.${NC}"
echo ""
echo -e "${YELLOW}Pour voir les logs si besoin : tmux attach -t automecanik${NC}"
