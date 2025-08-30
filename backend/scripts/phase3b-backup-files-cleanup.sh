#!/bin/bash
set -e

echo "=== Phase 3B: Nettoyage ultra-prudent des fichiers .backup ==="
echo "Création du backup..."

# Créer le répertoire de backup avec timestamp
BACKUP_DIR="../backup/phase3b-backup-files-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Liste UNIQUEMENT des fichiers .backup (copies évidentes)
FILES_TO_REMOVE=(
    "src/modules/search/services/search-index.service.ts.backup"
    "src/modules/search/services/vehicle-search.service.ts.backup"
    "src/modules/search/controllers/search-admin.controller.ts.backup"
)

echo "Vérification ultra-prudente des fichiers .backup..."
for file in "${FILES_TO_REMOVE[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file - Fichier backup identifié (suppression sûre)"
    else
        echo "❌ $file - Fichier inexistant"
    fi
done

echo ""
read -p "Continuer avec la suppression des .backup uniquement ? (y/N): " -n 1 -r
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
        mkdir -p "$BACKUP_DIR/$(dirname "$file")"
        cp "$file" "$BACKUP_DIR/$file"
        echo "Suppression: $file"
        rm "$file"
        ((REMOVED_COUNT++))
    fi
done

echo ""
echo "=== RÉSULTAT PHASE 3B ==="
echo "✅ Fichiers .backup supprimés: $REMOVED_COUNT"
echo "📁 Backup créé: $BACKUP_DIR"
echo ""

echo "=== Script de restauration ==="
cat > "$BACKUP_DIR/restore.sh" << 'RESTORE_EOF'
#!/bin/bash
echo "Restauration des fichiers .backup..."
cp -r src/ /workspaces/nestjs-remix-monorepo/backend/
echo "Restauration terminée!"
RESTORE_EOF
chmod +x "$BACKUP_DIR/restore.sh"

echo "Pour restaurer: $BACKUP_DIR/restore.sh"
echo "=== Phase 3B terminée - Approche ultra-prudente accomplie ==="
