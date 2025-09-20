#!/bin/bash

# 🚗 SCRIPT DE MIGRATION DES TYPES VÉHICULES
# Automatise la migration vers les types centralisés

echo "🚗 Migration des types véhicules vers le fichier centralisé"
echo "============================================================"

FRONTEND_DIR="/workspaces/nestjs-remix-monorepo/frontend/app"
TYPES_FILE="$FRONTEND_DIR/types/vehicle.types.ts"

# Vérifier que le fichier de types existe
if [ ! -f "$TYPES_FILE" ]; then
    echo "❌ Erreur: Fichier de types centralisé non trouvé: $TYPES_FILE"
    exit 1
fi

echo "✅ Fichier de types centralisé trouvé"

# Liste des fichiers à migrer
FILES_TO_MIGRATE=(
    "$FRONTEND_DIR/components/vehicles/ModelSelector.tsx"
    "$FRONTEND_DIR/components/vehicles/TypeSelector.tsx"
    "$FRONTEND_DIR/components/vehicles/YearSelector.tsx"
    "$FRONTEND_DIR/components/vehicles/YearSelectorSimple.tsx"
    "$FRONTEND_DIR/components/home/VehicleSelector.tsx"
    "$FRONTEND_DIR/services/api/enhanced-vehicle.api.ts"
    "$FRONTEND_DIR/routes/commercial.vehicles.model-selector-demo.tsx"
    "$FRONTEND_DIR/routes/commercial.vehicles.type-selector-demo.tsx"
    "$FRONTEND_DIR/routes/commercial.vehicles.year-selector-demo.tsx"
    "$FRONTEND_DIR/routes/commercial.vehicles.type-selector-comparison.tsx"
)

BACKUP_DIR="/workspaces/nestjs-remix-monorepo/backup/vehicle-types-migration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📁 Dossier de sauvegarde: $BACKUP_DIR"

# Fonction pour créer une sauvegarde
backup_file() {
    local file="$1"
    if [ -f "$file" ]; then
        local backup_path="$BACKUP_DIR/$(basename "$file")"
        cp "$file" "$backup_path"
        echo "   💾 Sauvegarde: $(basename "$file")"
    fi
}

# Fonction pour migrer un fichier
migrate_file() {
    local file="$1"
    
    if [ ! -f "$file" ]; then
        echo "   ⚠️  Fichier non trouvé: $(basename "$file")"
        return
    fi
    
    echo "   🔄 Migration: $(basename "$file")"
    
    # Sauvegarde
    backup_file "$file"
    
    # Remplacements dans le fichier
    sed -i.tmp '
        # Supprimer les interfaces locales VehicleModel/Model
        /^export interface Model {/,/^}$/d
        /^interface VehicleModel {/,/^}$/d
        /^export interface VehicleModel {/,/^}$/d
        /^interface VehicleType {/,/^}$/d
        /^export interface VehicleType {/,/^}$/d
        /^interface VehicleBrand {/,/^}$/d
        /^export interface VehicleBrand {/,/^}$/d
        
        # Ajouter l'\''import des types centralisés si pas déjà présent
        1i\
import type {\
  VehicleBrand,\
  VehicleModel,\
  VehicleType,\
  ModelSelectorProps,\
  TypeSelectorProps,\
  BrandSelectorProps\
} from "../types/vehicle.types";
        
        # Remplacer les imports spécifiques
        s/import.*VehicleModel.*from.*enhanced-vehicle\.api.*;//g
        s/import.*VehicleType.*from.*enhanced-vehicle\.api.*;//g
        s/import.*VehicleBrand.*from.*enhanced-vehicle\.api.*;//g
        
        # Corriger les références Model -> VehicleModel
        s/: Model/: VehicleModel/g
        s/<Model>/<VehicleModel>/g
        s/Model\|/VehicleModel|/g
        s/Model \&/VehicleModel \&/g
        
    ' "$file"
    
    # Supprimer le fichier temporaire
    rm -f "$file.tmp"
    
    echo "   ✅ Migration terminée"
}

# Migration des fichiers
echo ""
echo "🔄 Début de la migration..."
echo ""

for file in "${FILES_TO_MIGRATE[@]}"; do
    migrate_file "$file"
done

echo ""
echo "🧹 Nettoyage des doublons d'imports..."

# Nettoyer les doublons d'imports dans chaque fichier
for file in "${FILES_TO_MIGRATE[@]}"; do
    if [ -f "$file" ]; then
        # Supprimer les lignes d'import en double
        awk '!seen[$0]++' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    fi
done

echo ""
echo "🔍 Vérification des fichiers migrés..."

# Vérifier que les imports sont corrects
ERRORS=0

for file in "${FILES_TO_MIGRATE[@]}"; do
    if [ -f "$file" ]; then
        # Vérifier s'il y a encore des interfaces locales
        if grep -q "^interface Vehicle" "$file" || grep -q "^export interface Vehicle" "$file"; then
            echo "   ⚠️  $(basename "$file"): Interfaces locales toujours présentes"
            ERRORS=$((ERRORS + 1))
        fi
        
        # Vérifier l'import des types centralisés
        if ! grep -q "from.*types/vehicle.types" "$file"; then
            echo "   ⚠️  $(basename "$file"): Import des types centralisés manquant"
            ERRORS=$((ERRORS + 1))
        fi
        
        if [ $ERRORS -eq 0 ]; then
            echo "   ✅ $(basename "$file"): Migration OK"
        fi
    fi
done

echo ""
echo "📊 Résumé de la migration:"
echo "   📁 Fichiers traités: ${#FILES_TO_MIGRATE[@]}"
echo "   💾 Sauvegardes dans: $BACKUP_DIR"

if [ $ERRORS -eq 0 ]; then
    echo "   🎉 Migration réussie sans erreurs!"
else
    echo "   ⚠️  Migration avec $ERRORS erreurs détectées"
fi

echo ""
echo "🔧 Prochaines étapes:"
echo "   1. Vérifier que l'application compile sans erreurs"
echo "   2. Tester les sélecteurs de véhicules"
echo "   3. Corriger manuellement les erreurs restantes si nécessaire"
echo "   4. Supprimer les sauvegardes si tout fonctionne"

echo ""
echo "✅ Migration terminée!"