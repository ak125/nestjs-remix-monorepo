#!/bin/bash
set -e

echo "=== Phase 2: Nettoyage sécurisé du module Orders ==="
echo "Création du backup..."

# Créer le répertoire de backup avec timestamp
BACKUP_DIR="../backup/phase2-orders-cleanup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Liste des fichiers du module Orders à nettoyer
FILES_TO_REMOVE=(
    "src/orders/orders-minimal.service.ts"
    "src/orders/orders-enhanced.service.ts"
    "src/orders/orders-legacy.service.ts"
    "src/orders/orders-test.service.ts"
    "src/orders/orders-backup.service.ts"
    "src/orders/orders-simplified.service.ts"
    "src/orders/orders-optimized.service.ts"
    "src/orders/orders-clean.service.ts"
    "src/orders/orders-final.service.ts"
)

echo "Vérification des dépendances..."
for file in "${FILES_TO_REMOVE[@]}"; do
    if [[ -f "$file" ]]; then
        echo "Analysing: $file"
        # Vérifier les imports de ce fichier dans d'autres fichiers
        IMPORTS_FOUND=$(grep -r "from.*$(basename "$file" .ts)" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "$file" | wc -l || echo "0")
        if [[ $IMPORTS_FOUND -gt 0 ]]; then
            echo "⚠️  ATTENTION: $file est importé dans d'autres fichiers!"
            grep -r "from.*$(basename "$file" .ts)" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "$file" || true
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
        cp "$file" "$BACKUP_DIR/"
        echo "Suppression: $file"
        rm "$file"
        ((REMOVED_COUNT++))
    fi
done

echo ""
echo "=== RÉSULTAT PHASE 2 ==="
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
echo "Restauration des fichiers du module Orders..."
cp -v * /workspaces/nestjs-remix-monorepo/backend/src/orders/
echo "Restauration terminée!"
RESTORE_EOF
chmod +x "$BACKUP_DIR/restore.sh"

echo "Pour restaurer: $BACKUP_DIR/restore.sh"
echo "=== Phase 2 terminée ==="
