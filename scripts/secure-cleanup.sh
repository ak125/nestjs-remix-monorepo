#!/bin/bash

# Script principal de sécurisation et consolidation
# Orchestre tous les scripts de nettoyage

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

MONOREPO_ROOT="/workspaces/nestjs-remix-monorepo"
SCRIPTS_DIR="$MONOREPO_ROOT/scripts"

# Bannière
clear
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}║         🧹 NETTOYAGE ET SÉCURISATION DU MONOREPO 🔒         ║${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}║    Consolidation, élimination des doublons et robustesse     ║${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "$MONOREPO_ROOT/package.json" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du monorepo${NC}"
    exit 1
fi

# Rendre les scripts exécutables
echo -e "${BLUE}🔧 Préparation des scripts...${NC}"
chmod +x "$SCRIPTS_DIR"/*.sh
echo -e "${GREEN}✓ Scripts configurés${NC}\n"

# Menu interactif
show_menu() {
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}   MENU PRINCIPAL${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}1)${NC} 🧹 Nettoyage complet (fichiers compilés, caches, temp)"
    echo -e "${YELLOW}2)${NC} 📦 Nettoyage des dépendances (doublons, versions)"
    echo -e "${YELLOW}3)${NC} 📝 Mise à jour des package.json"
    echo -e "${YELLOW}4)${NC} 🔍 Audit de sécurité"
    echo -e "${YELLOW}5)${NC} 🚀 Tout exécuter (recommandé)"
    echo -e "${YELLOW}6)${NC} 📊 Rapport d'état"
    echo -e "${YELLOW}7)${NC} ❌ Quitter"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
}

# Fonction de nettoyage complet
run_cleanup() {
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}   Étape 1/4 : Nettoyage des fichiers${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    "$SCRIPTS_DIR/cleanup-consolidation.sh"
    
    echo -e "\n${GREEN}✅ Nettoyage des fichiers terminé${NC}"
    sleep 2
}

# Fonction de nettoyage des dépendances
run_deps_cleanup() {
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}   Étape 2/4 : Analyse des dépendances${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    "$SCRIPTS_DIR/cleanup-dependencies.sh"
    
    echo -e "\n${GREEN}✅ Analyse des dépendances terminée${NC}"
    sleep 2
}

# Fonction de mise à jour des package.json
run_package_update() {
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}   Étape 3/4 : Mise à jour des package.json${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    echo -e "${YELLOW}⚠️  Cette action va modifier vos package.json${NC}"
    echo -e "${YELLOW}   Un backup sera créé automatiquement${NC}\n"
    
    read -p "Continuer? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        "$SCRIPTS_DIR/update-package-json.sh"
        echo -e "\n${GREEN}✅ Mise à jour des package.json terminée${NC}"
    else
        echo -e "${YELLOW}⊘ Étape ignorée${NC}"
    fi
    sleep 2
}

# Fonction d'audit de sécurité
run_security_audit() {
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}   Étape 4/4 : Audit de sécurité${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    cd "$MONOREPO_ROOT"
    
    echo -e "${BLUE}🔍 Audit NPM...${NC}"
    npm audit --audit-level=moderate || true
    
    echo -e "\n${BLUE}🔍 Recherche de secrets exposés...${NC}"
    if grep -r "password\|secret\|api_key\|token" backend/src --include="*.ts" | grep -v "process.env" | head -5; then
        echo -e "${RED}⚠️  Secrets potentiels trouvés - Vérifiez le code${NC}"
    else
        echo -e "${GREEN}✓ Aucun secret exposé détecté${NC}"
    fi
    
    echo -e "\n${BLUE}🔍 Vérification des variables d'environnement...${NC}"
    if [ -f "$MONOREPO_ROOT/backend/.env" ]; then
        if grep -E "^(DATABASE_URL|JWT_SECRET|SUPABASE_KEY)=" backend/.env > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Variables essentielles présentes${NC}"
        else
            echo -e "${YELLOW}⚠️  Certaines variables d'environnement manquent${NC}"
        fi
    else
        echo -e "${RED}⚠️  Fichier .env manquant${NC}"
    fi
    
    echo -e "\n${GREEN}✅ Audit de sécurité terminé${NC}"
    sleep 2
}

# Fonction pour générer un rapport d'état
generate_report() {
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}   Rapport d'État du Monorepo${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    cd "$MONOREPO_ROOT"
    
    echo -e "${CYAN}📊 Structure du projet:${NC}"
    echo "  Workspaces: $(find . -name 'package.json' -not -path '*/node_modules/*' | wc -l) packages"
    
    echo -e "\n${CYAN}📦 Node modules:${NC}"
    if [ -d "node_modules" ]; then
        echo "  Taille: $(du -sh node_modules 2>/dev/null | cut -f1)"
    else
        echo "  Aucun (non installé)"
    fi
    
    echo -e "\n${CYAN}🗂️  Fichiers compilés:${NC}"
    if [ -d "backend/dist" ]; then
        echo "  backend/dist: $(du -sh backend/dist 2>/dev/null | cut -f1)"
    else
        echo "  Aucun (propre)"
    fi
    
    echo -e "\n${CYAN}📄 Documentation:${NC}"
    echo "  Fichiers MD: $(find docs -name '*.md' 2>/dev/null | wc -l)"
    
    echo -e "\n${CYAN}🧪 Scripts de test:${NC}"
    echo "  Total: $(find backend -name 'test-*.sh' -o -name 'test-*.js' 2>/dev/null | wc -l)"
    
    echo -e "\n${CYAN}🔧 Dossiers temporaires:${NC}"
    if [ -d "_temp" ] || [ -d "backend/_temp" ]; then
        echo "  ⚠️  Dossiers _temp détectés"
    else
        echo "  ✓ Aucun (propre)"
    fi
    
    echo -e "\n${CYAN}📋 Backups:${NC}"
    BACKUP_COUNT=$(find . -maxdepth 1 -name '.cleanup-backup-*' -o -name '.package-backup-*' 2>/dev/null | wc -l)
    echo "  $BACKUP_COUNT backup(s) trouvé(s)"
    
    echo ""
}

# Fonction pour tout exécuter
run_all() {
    echo -e "\n${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║   EXÉCUTION COMPLÈTE DE LA CONSOLIDATION                     ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"
    
    echo -e "${YELLOW}Cette opération va:${NC}"
    echo "  1. Nettoyer tous les fichiers temporaires et compilés"
    echo "  2. Analyser les dépendances"
    echo "  3. Mettre à jour les package.json"
    echo "  4. Effectuer un audit de sécurité"
    echo ""
    echo -e "${YELLOW}⚠️  Des backups seront créés automatiquement${NC}\n"
    
    read -p "Continuer avec le nettoyage complet? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_cleanup
        run_deps_cleanup
        run_package_update
        run_security_audit
        
        echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║   ✅ CONSOLIDATION COMPLÈTE TERMINÉE !                       ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"
        
        echo -e "${BLUE}📋 Prochaines étapes recommandées:${NC}"
        echo "  1. Réinstaller les dépendances: npm install"
        echo "  2. Mettre à jour les imports bcryptjs → bcrypt"
        echo "  3. Rebuild: npm run build"
        echo "  4. Tester: npm test"
        echo "  5. Consulter les rapports dans docs/"
    else
        echo -e "${YELLOW}⊘ Opération annulée${NC}"
    fi
}

# Boucle principale du menu
while true; do
    show_menu
    read -p "Choisissez une option (1-7): " choice
    
    case $choice in
        1)
            run_cleanup
            ;;
        2)
            run_deps_cleanup
            ;;
        3)
            run_package_update
            ;;
        4)
            run_security_audit
            ;;
        5)
            run_all
            ;;
        6)
            generate_report
            ;;
        7)
            echo -e "\n${GREEN}👋 Au revoir !${NC}\n"
            exit 0
            ;;
        *)
            echo -e "\n${RED}❌ Option invalide${NC}\n"
            sleep 1
            ;;
    esac
    
    echo ""
    read -p "Appuyez sur Entrée pour continuer..."
    clear
done
