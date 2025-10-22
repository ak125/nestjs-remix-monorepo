#!/bin/bash
# 🔍 Script de validation de la configuration Caddy
# Date: 21 octobre 2025

set -e

echo "🔍 Validation de la configuration Caddy..."
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de validation
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
        return 1
    fi
}

# Fonction d'avertissement
warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Fonction d'info
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  VALIDATION DE LA SYNTAXE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier si Caddy est installé
if command -v caddy > /dev/null 2>&1; then
    info "Caddy installé : $(caddy version)"
    
    # Valider le Caddyfile principal
    if [ -f "Caddyfile" ]; then
        echo -n "Validation Caddyfile production... "
        if caddy validate --config Caddyfile 2>/dev/null; then
            check "Syntaxe Caddyfile valide"
        else
            check "ERREUR dans Caddyfile"
            echo ""
            echo "Détails de l'erreur:"
            caddy validate --config Caddyfile
            exit 1
        fi
    else
        warn "Caddyfile non trouvé"
    fi
    
    # Valider le Caddyfile dev
    if [ -f "Caddyfile.dev" ]; then
        echo -n "Validation Caddyfile.dev... "
        if caddy validate --config Caddyfile.dev 2>/dev/null; then
            check "Syntaxe Caddyfile.dev valide"
        else
            check "ERREUR dans Caddyfile.dev"
            echo ""
            echo "Détails de l'erreur:"
            caddy validate --config Caddyfile.dev
            exit 1
        fi
    else
        warn "Caddyfile.dev non trouvé"
    fi
else
    warn "Caddy non installé, validation syntaxique impossible"
    info "Pour installer : https://caddyserver.com/docs/install"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  VALIDATION DOCKER COMPOSE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier la syntaxe docker-compose
if [ -f "docker-compose.caddy.yml" ]; then
    echo -n "Validation docker-compose.caddy.yml... "
    if docker compose -f docker-compose.caddy.yml config > /dev/null 2>&1; then
        check "Syntaxe Docker Compose valide"
    else
        check "ERREUR dans docker-compose.caddy.yml"
        echo ""
        echo "Détails de l'erreur:"
        docker compose -f docker-compose.caddy.yml config
        exit 1
    fi
else
    warn "docker-compose.caddy.yml non trouvé"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  VÉRIFICATION DES FICHIERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier les fichiers requis
FILES=(
    "Caddyfile"
    "Caddyfile.dev"
    "docker-compose.caddy.yml"
    "docker-compose.prod.yml"
    "scripts/generate-caddy-config.sh"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        check "Fichier présent: $file"
    else
        warn "Fichier manquant: $file"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  ANALYSE DE LA CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier les noms de domaine à remplacer
if [ -f "Caddyfile" ]; then
    if grep -q "your-domain.com" Caddyfile; then
        warn "Remplacer 'your-domain.com' par votre vrai domaine"
    else
        check "Domaine configuré"
    fi
    
    if grep -q "admin@your-domain.com" Caddyfile; then
        warn "Remplacer 'admin@your-domain.com' par votre email"
    else
        check "Email Let's Encrypt configuré"
    fi
    
    # Vérifier les reverse_proxy
    if grep -q "monorepo_prod:3000" Caddyfile; then
        check "Reverse proxy vers monorepo_prod configuré"
    else
        warn "Aucun reverse_proxy vers monorepo_prod trouvé"
    fi
    
    # Vérifier le health check
    if grep -q "health_uri /health" Caddyfile; then
        check "Health check configuré sur /health"
    else
        warn "Health check non configuré"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  VÉRIFICATION DES PERMISSIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Créer le répertoire de logs si nécessaire
if [ ! -d "logs/caddy" ]; then
    mkdir -p logs/caddy
    check "Répertoire logs/caddy créé"
else
    check "Répertoire logs/caddy existe"
fi

# Vérifier les permissions
if [ -w "logs/caddy" ]; then
    check "Répertoire logs/caddy accessible en écriture"
else
    warn "Répertoire logs/caddy non accessible en écriture"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  CHECKLIST DÉPLOIEMENT PRODUCTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PROD_CHECKS=(
    "[ ] Remplacer 'your-domain.com' par votre domaine réel"
    "[ ] Configurer l'email Let's Encrypt"
    "[ ] Ports 80/443 ouverts sur le firewall"
    "[ ] DNS pointant vers le serveur"
    "[ ] Activer HSTS après validation SSL (décommenter dans Caddyfile)"
    "[ ] Tester les redirections SEO"
    "[ ] Configurer la rotation des logs"
    "[ ] Backup des certificats SSL (/data volume)"
)

echo ""
for check in "${PROD_CHECKS[@]}"; do
    echo "$check"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Validation terminée"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

info "Pour tester localement:"
echo "  docker compose -f docker-compose.dev.yml -f docker-compose.caddy.yml up -d"
echo ""
info "Pour déployer en production:"
echo "  docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d"
echo ""
