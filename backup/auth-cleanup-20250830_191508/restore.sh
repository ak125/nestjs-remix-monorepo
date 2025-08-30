#!/bin/bash

# 🔄 Script de restauration des fichiers d'authentification
# Usage: ./restore.sh [nom-fichier] ou ./restore.sh --all

set -e

BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="../../src/auth"

if [[ "$1" == "--all" ]]; then
    echo "🔄 Restauration de tous les fichiers..."
    for file in "$BACKUP_DIR/auth"/*; do
        if [[ -f "$file" ]]; then
            filename=$(basename "$file")
            echo "  📄 Restauration: $filename"
            cp "$file" "$TARGET_DIR/$filename"
        fi
    done
    echo "✅ Tous les fichiers restaurés"
elif [[ -n "$1" ]]; then
    if [[ -f "$BACKUP_DIR/auth/$1" ]]; then
        echo "🔄 Restauration: $1"
        cp "$BACKUP_DIR/auth/$1" "$TARGET_DIR/$1"
        echo "✅ Fichier restauré: $TARGET_DIR/$1"
    else
        echo "❌ Fichier non trouvé: $1"
        echo "📁 Fichiers disponibles:"
        ls -1 "$BACKUP_DIR/auth/"
    fi
else
    echo "Usage: $0 [nom-fichier] ou $0 --all"
    echo ""
    echo "📁 Fichiers disponibles:"
    ls -1 "$BACKUP_DIR/auth/"
fi
