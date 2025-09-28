#!/bin/bash

# 🧹 Script de nettoyage des routes pièces obsolètes
# Supprime les fichiers de backup, temporaires et versions obsolètes

set -e

echo "🔍 Audit et nettoyage des routes pièces - Début"
echo "================================================"

ROUTES_DIR="/workspaces/nestjs-remix-monorepo/frontend/app/routes"
BACKUP_DIR="/tmp/pieces_routes_backup_$(date +%Y%m%d_%H%M%S)"

# Créer un backup de sécurité
echo "📦 Création backup de sécurité dans $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Lister tous les fichiers pieces à nettoyer
FILES_TO_REMOVE=(
    "pieces.\$gamme.\$marque.\$modele.\$type.tsx.v5-backup"
    "pieces.\$gamme.\$marque.\$modele.\$type[.]html.tsx.backup"
    "pieces.\$gamme.\$marque.\$modele.\$type[.]html.tsx.backup-20250927-222526" 
    "pieces.\$gamme.\$marque.\$modele.\$type[.]html.tsx.old"
    "pieces.\$gammeId.\$marqueId.\$modeleId.\$typeId.tsx.old"
    "pieces.\$gammeId.\$marqueId.\$modeleId.\$typeId.tsx.backup"
    "pieces.\$gammeId.\$marqueId.\$modeleId.\$typeId.tsx.v5-ultimate"
    "pieces-v52-modular-clean.tsx"
    "pieces-modular-demo.tsx" 
    "pieces.temp.tsx"
)

echo "🔍 Analyse des fichiers à supprimer :"
echo "===================================="

total_size=0
files_found=0

for file in "${FILES_TO_REMOVE[@]}"; do
    filepath="$ROUTES_DIR/$file"
    if [[ -f "$filepath" ]]; then
        size=$(stat -c%s "$filepath" 2>/dev/null || echo "0")
        size_kb=$((size / 1024))
        total_size=$((total_size + size))
        files_found=$((files_found + 1))
        
        echo "  ✅ $file (${size_kb}KB)"
        
        # Copier vers backup
        cp "$filepath" "$BACKUP_DIR/"
    else
        echo "  ❌ $file (non trouvé)"
    fi
done

total_size_kb=$((total_size / 1024))
total_size_mb=$((total_size_kb / 1024))

echo ""
echo "📊 STATISTIQUES :"
echo "  Fichiers trouvés : $files_found"
echo "  Taille totale : ${total_size_kb}KB (~${total_size_mb}MB)"

if [[ $files_found -eq 0 ]]; then
    echo "✅ Aucun fichier obsolète trouvé. Nettoyage déjà effectué."
    exit 0
fi

echo ""
read -p "🚨 Confirmer la suppression de $files_found fichiers ? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 Suppression en cours..."
    
    removed_count=0
    for file in "${FILES_TO_REMOVE[@]}"; do
        filepath="$ROUTES_DIR/$file"
        if [[ -f "$filepath" ]]; then
            rm "$filepath"
            echo "  🗑️  Supprimé : $file"
            removed_count=$((removed_count + 1))
        fi
    done
    
    echo ""
    echo "✅ Nettoyage terminé !"
    echo "  Fichiers supprimés : $removed_count"
    echo "  Espace libéré : ${total_size_kb}KB"
    echo "  Backup disponible : $BACKUP_DIR"
    
    # Lister les routes restantes
    echo ""
    echo "📁 Routes pièces restantes :"
    echo "=========================="
    ls -la "$ROUTES_DIR"/pieces*.tsx | grep -v "backup\|old\|temp\|demo\|v5-" || true
    
else
    echo "❌ Suppression annulée."
    echo "💾 Backup conservé dans : $BACKUP_DIR"
fi

echo ""
echo "🔍 Audit terminé - $(date)"
echo "================================================"