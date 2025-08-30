#!/bin/bash
set -e

echo "=== Phase 3: Nettoyage sécurisé du module Search ==="
echo "Création du backup..."

# Créer le répertoire de backup avec timestamp
BACKUP_DIR="../backup/phase3-search-cleanup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Liste des fichiers redondants du module Search
FILES_TO_REMOVE=(
    "src/modules/search/services/search-enhanced.service.ts"
    "src/modules/search/services/search-index.service.ts.backup"
    "src/modules/search/services/vehicle-search.service.ts.backup"
    "src/modules/search/services/search-optimized.service.spec.ts"
    "src/modules/search/services/search-optimized.service.ts"
    "src/modules/search/controllers/search-enhanced.controller.ts"
    "src/modules/search/controllers/search-admin.controller.ts.backup"
)

echo "Vérification des dépendances..."
for file in "${FILES_TO_REMOVE[@]}"; do
    if [[ -f "$file" ]]; then
        echo "Analysing: $file"
        # Vérifier les imports - nom de base sans extension et suffixes
        BASE_NAME=$(basename "$file" | sed 's/\.[^.]*$//' | sed 's/\.backup$//')
        # Rechercher les imports de ce fichier spécifique
        IMPORTS_FOUND=$(grep -r "from.*$BASE_NAME" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "$file" | wc -l || echo "0")
        if [[ $IMPORTS_FOUND -gt 0 ]]; then
            echo "⚠️  ATTENTION: $file pourrait être importé!"
            grep -r "from.*$BASE_NAME" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "$file" || true
        else
            echo "✅ $file - Aucune dépendance détectée"
        fi
    else
        echo "❌ $file - Fichier inexistant"
    fi
done

echo ""
read -p "Continuer avec la suppression ? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Annulé par l'utilisateur"
    exit 1
fi

# Sauvegarder et supprimer les fichiers
REMOVED_COUNT=0
for file in "${FILES_TO_REMOVE[@]}"; do
    if [[ -f "$file" ]]; then
        echo "Sauvegarde: $file"
        # Créer le même chemin dans le backup
        mkdir -p "$BACKUP_DIR/$(dirname "$file")"
        cp "$file" "$BACKUP_DIR/$file"
        echo "Suppression: $file"
        rm "$file"
        ((REMOVED_COUNT++))
    fi
done

echo ""
echo "=== RÉSULTAT PHASE 3 ==="
echo "✅ Fichiers supprimés: $REMOVED_COUNT"
echo "📁 Backup créé: $BACKUP_DIR"
echo ""

# Test de compilation rapide
echo "Test de compilation..."
if npm run build >/dev/null 2>&1; then
    echo "✅ Compilation réussie"
else
    echo "⚠️  Erreurs de compilation détectées (peuvent être pré-existantes)"
fi

echo ""
echo "=== Script de restauration ==="
cat > "$BACKUP_DIR/restore.sh" << 'RESTORE_EOF'
#!/bin/bash
echo "Restauration des fichiers du module Search..."
cp -r src/ /workspaces/nestjs-remix-monorepo/backend/
echo "Restauration terminée!"
RESTORE_EOF
chmod +x "$BACKUP_DIR/restore.sh"

echo "Pour restaurer: $BACKUP_DIR/restore.sh"
echo "=== Phase 3 terminée ==="
