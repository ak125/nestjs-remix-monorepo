#!/bin/bash

# Script pour corriger automatiquement les imports d'authentification

echo "Correction des imports d'authentification..."

# Fonction pour déterminer le bon chemin relatif vers unified.server.ts
get_relative_path() {
    local file_path="$1"
    local target="auth/unified.server"
    
    # Compter les niveaux de répertoire depuis app/
    local depth=$(echo "$file_path" | sed 's|frontend/app/||' | tr '/' '\n' | wc -l)
    depth=$((depth - 1))  # Soustraire 1 car le fichier lui-même n'est pas un niveau
    
    # Construire le chemin relatif
    local relative_path=""
    for ((i=0; i<depth; i++)); do
        relative_path="../$relative_path"
    done
    
    echo "${relative_path}${target}"
}

# Trouver tous les fichiers avec les anciens imports
files=$(grep -r -l "server/auth\.server\|lib/auth\.server" frontend/app/ | grep -v ".backup\|.old")

for file in $files; do
    echo "Traitement de $file..."
    
    # Déterminer le bon chemin relatif
    relative_path=$(get_relative_path "$file")
    
    # Remplacer les imports
    sed -i "s|from ['\"]~/server/auth\.server['\"]|from \"$relative_path\"|g" "$file"
    sed -i "s|from ['\"][\.\/]*server/auth\.server['\"]|from \"$relative_path\"|g" "$file"
    sed -i "s|from ['\"][\.\/]*lib/auth\.server['\"]|from \"$relative_path\"|g" "$file"
    
    echo "  ✓ $file corrigé"
done

echo "Tous les imports d'authentification ont été corrigés !"
