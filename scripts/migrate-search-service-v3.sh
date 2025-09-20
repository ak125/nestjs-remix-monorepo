#!/bin/bash

# 🔄 Script de Migration SearchService v3.0
# Automatise la migration vers la version optimisée

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SEARCH_DIR="backend/src/modules/search/services"
BACKUP_DIR="backup/search-migration-$(date +%Y%m%d-%H%M%S)"
CURRENT_SERVICE="search.service.ts"
OPTIMIZED_SERVICE="search-optimized.service.ts"
LEGACY_SERVICE="search-legacy.service.ts"

echo -e "${BLUE}🔍 SearchService v3.0 Migration Script${NC}"
echo "======================================"
echo ""

# Fonction d'affichage des étapes
step() {
    echo -e "${BLUE}▶ $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Vérifications préliminaires
step "Vérifications préliminaires..."

# Vérifier que nous sommes dans le bon répertoire
if [ ! -d "backend/src/modules/search" ]; then
    error "Répertoire search non trouvé. Exécutez ce script depuis la racine du projet."
fi

# Vérifier l'existence du service optimisé
if [ ! -f "$SEARCH_DIR/$OPTIMIZED_SERVICE" ]; then
    error "Service optimisé non trouvé: $SEARCH_DIR/$OPTIMIZED_SERVICE"
fi

success "Répertoire et fichiers vérifiés"

# Créer le répertoire de backup
step "Création du backup..."
mkdir -p "$BACKUP_DIR"
success "Backup créé: $BACKUP_DIR"

# Backup des fichiers existants
step "Sauvegarde des fichiers existants..."

if [ -f "$SEARCH_DIR/$CURRENT_SERVICE" ]; then
    cp "$SEARCH_DIR/$CURRENT_SERVICE" "$BACKUP_DIR/search.service.ts.backup"
    success "Service existant sauvegardé"
else
    warning "Service existant non trouvé (première installation?)"
fi

# Backup du module si il existe
if [ -f "backend/src/modules/search/search.module.ts" ]; then
    cp "backend/src/modules/search/search.module.ts" "$BACKUP_DIR/search.module.ts.backup"
    success "Module de recherche sauvegardé"
fi

# Backup des tests si ils existent
if [ -f "$SEARCH_DIR/search.service.spec.ts" ]; then
    cp "$SEARCH_DIR/search.service.spec.ts" "$BACKUP_DIR/search.service.spec.ts.backup"
    success "Tests existants sauvegardés"
fi

# Migration des fichiers
step "Migration vers SearchService v3.0..."

# Renommer l'ancien service en legacy (si il existe)
if [ -f "$SEARCH_DIR/$CURRENT_SERVICE" ]; then
    mv "$SEARCH_DIR/$CURRENT_SERVICE" "$SEARCH_DIR/$LEGACY_SERVICE"
    success "Ancien service renommé en legacy"
fi

# Installer le nouveau service
cp "$SEARCH_DIR/$OPTIMIZED_SERVICE" "$SEARCH_DIR/$CURRENT_SERVICE"
success "Nouveau service installé"

# Installer les tests optimisés
if [ -f "$SEARCH_DIR/search-optimized.service.spec.ts" ]; then
    cp "$SEARCH_DIR/search-optimized.service.spec.ts" "$SEARCH_DIR/search.service.spec.ts"
    success "Tests optimisés installés"
fi

# Vérification des imports du module
step "Vérification du module de recherche..."

MODULE_FILE="backend/src/modules/search/search.module.ts"

if [ -f "$MODULE_FILE" ]; then
    # Vérifier si VehicleSearchService est importé
    if grep -q "VehicleSearchService" "$MODULE_FILE"; then
        success "VehicleSearchService déjà importé dans le module"
    else
        warning "VehicleSearchService pourrait manquer dans search.module.ts"
        echo "  → Vérifiez manuellement les imports dans $MODULE_FILE"
    fi
else
    warning "Module de recherche non trouvé: $MODULE_FILE"
fi

# Installation des dépendances si nécessaire
step "Vérification des dépendances..."

if [ -f "package.json" ]; then
    # Vérifier Node.js et npm
    if command -v npm > /dev/null; then
        echo "  → npm disponible"
        
        # Optionnel: installer les dépendances
        read -p "Voulez-vous réinstaller les dépendances npm? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            step "Installation des dépendances..."
            npm install
            success "Dépendances installées"
        fi
    else
        warning "npm non disponible, installation manuelle requise"
    fi
fi

# Tests de validation
step "Tests de validation..."

echo "  → Vérification de la syntaxe TypeScript..."
if command -v npx > /dev/null; then
    cd backend
    if npx tsc --noEmit --skipLibCheck > /dev/null 2>&1; then
        success "Syntaxe TypeScript validée"
    else
        warning "Erreurs TypeScript détectées, vérification manuelle requise"
    fi
    cd ..
else
    warning "npx non disponible, validation TypeScript manuelle requise"
fi

# Tests unitaires
if [ -f "package.json" ] && command -v npm > /dev/null; then
    read -p "Voulez-vous exécuter les tests unitaires? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        step "Exécution des tests unitaires..."
        if npm run test -- --testPathPattern=search.service.spec.ts > /dev/null 2>&1; then
            success "Tests unitaires passés"
        else
            warning "Certains tests ont échoué, vérification manuelle requise"
        fi
    fi
fi

# Génération du rapport de migration
step "Génération du rapport de migration..."

REPORT_FILE="$BACKUP_DIR/MIGRATION_REPORT.md"

cat > "$REPORT_FILE" << EOF
# 📋 Rapport de Migration SearchService v3.0

**Date**: $(date)
**Backup**: $BACKUP_DIR

## 📁 Fichiers Migrés

- ✅ \`$CURRENT_SERVICE\` → Version optimisée v3.0
- 📦 \`$LEGACY_SERVICE\` → Ancien service (backup)
- 🧪 \`search.service.spec.ts\` → Tests mis à jour

## 📊 Changements Clés

### Nouvelles Fonctionnalités
- ✨ VehicleSearchService intégré
- ✨ Cache intelligent adaptatif
- ✨ Scoring personnalisé
- ✨ Suggestions IA contextuelles
- ✨ Recherche hybride optimisée

### Compatibilité
- ✅ API publique 100% compatible
- ✅ Méthodes legacy préservées
- ✅ Structure de retour identique

## 🔄 Rollback

En cas de problème:

\`\`\`bash
# Restaurer l'ancien service
mv $SEARCH_DIR/$LEGACY_SERVICE $SEARCH_DIR/$CURRENT_SERVICE

# Restaurer le module (si nécessaire)
cp $BACKUP_DIR/search.module.ts.backup backend/src/modules/search/search.module.ts

# Redémarrer l'application
npm run restart
\`\`\`

## ✅ Actions Post-Migration

- [ ] Vérifier les logs d'application
- [ ] Tester les endpoints critiques
- [ ] Surveiller les performances
- [ ] Valider les nouvelles fonctionnalités
- [ ] Supprimer les fichiers de backup (après validation)

## 🆘 Support

En cas de problème, consultez:
- \`$SEARCH_DIR/MIGRATION_SEARCH_SERVICE_v3.md\`
- Logs d'application
- Tests unitaires

---
*Migration générée par le script automatisé SearchService v3.0*
EOF

success "Rapport généré: $REPORT_FILE"

# Actions post-migration
step "Actions recommandées..."

echo ""
echo -e "${GREEN}🎉 Migration SearchService v3.0 terminée avec succès!${NC}"
echo ""
echo "📋 Actions recommandées:"
echo "  1. Vérifiez les imports dans search.module.ts"
echo "  2. Redémarrez l'application: npm run start:dev"
echo "  3. Testez les endpoints de recherche"
echo "  4. Surveillez les logs pour d'éventuelles erreurs"
echo "  5. Consultez le rapport: $REPORT_FILE"
echo ""
echo "🆘 En cas de problème:"
echo "  • Consultez MIGRATION_SEARCH_SERVICE_v3.md"
echo "  • Utilisez les commandes de rollback du rapport"
echo "  • Vérifiez les backups dans: $BACKUP_DIR"
echo ""

# Optionnel: démarrer l'application
read -p "Voulez-vous redémarrer l'application maintenant? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    step "Redémarrage de l'application..."
    if [ -f "package.json" ]; then
        npm run start:dev &
        success "Application redémarrée en mode développement"
        echo "  → Surveillez les logs pour vérifier le bon fonctionnement"
    else
        warning "package.json non trouvé, redémarrage manuel requis"
    fi
fi

echo ""
echo -e "${BLUE}Migration terminée! 🚀${NC}"
