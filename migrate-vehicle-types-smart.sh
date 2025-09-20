#!/bin/bash

# 🚗 SCRIPT DE MIGRATION INTELLIGENT DES TYPES VÉHICULES
# Version corrigée qui évite les corruptions de fichiers

echo "🚗 Migration intelligente des types véhicules"
echo "=============================================="

FRONTEND_DIR="/workspaces/nestjs-remix-monorepo/frontend/app"
TYPES_FILE="$FRONTEND_DIR/types/vehicle.types.ts"

# Vérifier que le fichier de types existe
if [ ! -f "$TYPES_FILE" ]; then
    echo "❌ Erreur: Fichier de types centralisé non trouvé: $TYPES_FILE"
    exit 1
fi

echo "✅ Fichier de types centralisé trouvé"

# Créer un nouveau dossier de sauvegarde
BACKUP_DIR="/workspaces/nestjs-remix-monorepo/backup/vehicle-types-migration-manual-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "📁 Dossier de sauvegarde: $BACKUP_DIR"

# Fonction pour migrer manuellement un fichier
migrate_file_manual() {
    local file="$1"
    local filename=$(basename "$file")
    
    if [ ! -f "$file" ]; then
        echo "   ⚠️  Fichier non trouvé: $filename"
        return
    fi
    
    echo "   🔄 Migration manuelle: $filename"
    
    # Sauvegarde
    cp "$file" "$BACKUP_DIR/$filename"
    echo "   💾 Sauvegarde: $filename"
    
    # Migration en fonction du type de fichier
    case "$filename" in
        "ModelSelector.tsx")
            migrate_model_selector "$file"
            ;;
        "TypeSelector.tsx")
            migrate_type_selector "$file"
            ;;
        "VehicleSelector.tsx")
            migrate_vehicle_selector "$file"
            ;;
        "enhanced-vehicle.api.ts")
            migrate_enhanced_api "$file"
            ;;
        *.tsx)
            migrate_route_file "$file"
            ;;
        *)
            echo "   ℹ️  Type de fichier non reconnu, migration générique"
            ;;
    esac
    
    echo "   ✅ Migration terminée: $filename"
}

# Migration spécifique pour ModelSelector
migrate_model_selector() {
    local file="$1"
    
    # Créer un fichier temporaire avec la nouvelle version
    cat > "${file}.tmp" << 'EOF'
import { useFetcher } from "@remix-run/react";
import { useState, useEffect, useCallback } from "react";
import { Combobox, type ComboboxItem } from "../ui/combobox";
import type { VehicleModel, ModelSelectorProps } from "../types/vehicle.types";

// Garder la compatibilité avec l'ancienne interface Model
export type Model = VehicleModel;

export function ModelSelector({
EOF
    
    # Copier le reste du fichier en sautant les interfaces locales
    tail -n +25 "$file" | sed '/^export interface Model {/,/^}/d' | sed '/^interface VehicleModel {/,/^}/d' >> "${file}.tmp"
    
    # Remplacer le fichier original
    mv "${file}.tmp" "$file"
}

# Migration spécifique pour TypeSelector
migrate_type_selector() {
    local file="$1"
    
    # Créer un fichier temporaire avec la nouvelle version
    cat > "${file}.tmp" << 'EOF'
import { useFetcher } from "@remix-run/react";
import { useState, useEffect, useCallback } from "react";
import { Combobox, type ComboboxItem } from "../ui/combobox";
import type { VehicleType, TypeSelectorProps } from "../types/vehicle.types";

export function TypeSelector({
EOF
    
    # Copier le reste du fichier en sautant les interfaces locales
    tail -n +29 "$file" | sed '/^export interface VehicleType {/,/^}/d' | sed '/^interface VehicleType {/,/^}/d' | sed '/^export interface TypeSelectorProps {/,/^}/d' >> "${file}.tmp"
    
    # Remplacer le fichier original
    mv "${file}.tmp" "$file"
}

# Migration spécifique pour VehicleSelector
migrate_vehicle_selector() {
    local file="$1"
    
    # Ajouter l'import des types centralisés en haut du fichier
    sed -i '1i import type { VehicleBrand, VehicleModel, VehicleType } from "../types/vehicle.types";' "$file"
    
    # Supprimer les interfaces locales
    sed -i '/^interface VehicleBrand {/,/^}/d' "$file"
    sed -i '/^interface VehicleModel {/,/^}/d' "$file"
    sed -i '/^interface VehicleType {/,/^}/d' "$file"
}

# Migration spécifique pour enhanced-vehicle.api.ts
migrate_enhanced_api() {
    local file="$1"
    
    # Ajouter l'import des types centralisés
    sed -i '1i import type { VehicleBrand, VehicleModel, VehicleType } from "../types/vehicle.types";' "$file"
    
    # Supprimer les interfaces dupliquées
    sed -i '/^export interface VehicleModel {/,/^}/d' "$file"
    sed -i '/^export interface VehicleType {/,/^}/d' "$file"
    sed -i '/^export interface VehicleBrandComponent {/,/^}/d' "$file"
}

# Migration générique pour les fichiers de route
migrate_route_file() {
    local file="$1"
    
    # Ajouter l'import si pas déjà présent
    if ! grep -q "from.*types/vehicle.types" "$file"; then
        # Trouver la ligne avec les imports des composants vehicles
        local import_line=$(grep -n "from.*components/vehicles" "$file" | head -1 | cut -d: -f1)
        if [ -n "$import_line" ]; then
            sed -i "${import_line}i import type { VehicleModel, VehicleType } from \"../types/vehicle.types\";" "$file"
        fi
    fi
}

# Liste des fichiers à migrer manuellement
FILES_TO_MIGRATE=(
    "$FRONTEND_DIR/components/vehicles/ModelSelector.tsx"
    "$FRONTEND_DIR/components/vehicles/TypeSelector.tsx"
    "$FRONTEND_DIR/components/home/VehicleSelector.tsx"
    "$FRONTEND_DIR/services/api/enhanced-vehicle.api.ts"
)

echo ""
echo "🔄 Début de la migration manuelle..."

for file in "${FILES_TO_MIGRATE[@]}"; do
    migrate_file_manual "$file"
done

echo ""
echo "🔍 Validation des fichiers migrés..."

# Vérifier la compilation TypeScript
cd "$FRONTEND_DIR/../.."
if npx tsc --noEmit --project frontend/tsconfig.json 2>/dev/null; then
    echo "   ✅ Compilation TypeScript réussie"
    MIGRATION_SUCCESS=true
else
    echo "   ⚠️  Erreurs de compilation détectées"
    MIGRATION_SUCCESS=false
fi

echo ""
echo "📊 Résumé de la migration:"
echo "   📁 Fichiers traités: ${#FILES_TO_MIGRATE[@]}"
echo "   💾 Sauvegardes dans: $BACKUP_DIR"

if [ "$MIGRATION_SUCCESS" = true ]; then
    echo "   🎉 Migration réussie!"
    echo ""
    echo "🔧 Prochaines étapes:"
    echo "   1. Tester les sélecteurs de véhicules"
    echo "   2. Vérifier les API calls"
    echo "   3. Valider l'interface utilisateur"
else
    echo "   ⚠️  Migration avec avertissements"
    echo ""
    echo "🔧 Actions recommandées:"
    echo "   1. Exécuter 'npm run typecheck' pour voir les détails"
    echo "   2. Corriger manuellement les erreurs restantes"
    echo "   3. Relancer la validation"
fi

echo ""
echo "✅ Migration intelligente terminée!"