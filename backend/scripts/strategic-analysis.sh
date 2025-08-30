#!/bin/bash

# 🎯 Analyse stratégique pour déterminer la meilleure approche de nettoyage
# Objectif: Évaluer risques, impacts et priorités

set -e

echo "🎯 ANALYSE STRATÉGIQUE DE NETTOYAGE"
echo "==================================="
echo "📅 Date: $(date)"
echo ""

cd "$(dirname "$0")/.."

echo "1️⃣ ANALYSE DES RISQUES PAR MODULE"
echo "=================================="

# Fonction pour analyser un module
analyze_module() {
    local module_path="$1"
    local module_name=$(basename "$module_path")
    
    if [[ ! -d "$module_path" ]]; then
        return
    fi
    
    echo ""
    echo "📦 MODULE: $module_name"
    echo "$(printf '%.${#module_name}s' | tr ' ' '-')"
    
    # Compter les fichiers
    total_files=$(find "$module_path" -name "*.ts" | wc -l)
    controllers=$(find "$module_path" -name "*.controller.ts" | wc -l)
    services=$(find "$module_path" -name "*.service.ts" | wc -l)
    modules=$(find "$module_path" -name "*.module.ts" | wc -l)
    
    echo "📊 Fichiers: $total_files total ($controllers controllers, $services services, $modules modules)"
    
    # Identifier les redondances
    redundant_files=$(find "$module_path" -name "*test*.ts" -o -name "*debug*.ts" -o -name "*minimal*.ts" -o -name "*enhanced*.ts" -o -name "*simple*.ts" -o -name "*legacy*.ts" -o -name "*backup*.ts" | wc -l)
    
    if [[ $redundant_files -gt 0 ]]; then
        echo "⚠️  Fichiers potentiellement redondants: $redundant_files"
        
        # Détail des redondances
        find "$module_path" -name "*test*.ts" -o -name "*debug*.ts" -o -name "*minimal*.ts" -o -name "*enhanced*.ts" -o -name "*simple*.ts" -o -name "*legacy*.ts" -o -name "*backup*.ts" | sed 's|.*/||' | sort | while read file; do
            echo "   🔸 $file"
        done
        
        # Calculer le score de risque
        if [[ $redundant_files -gt 10 ]]; then
            echo "🚨 RISQUE: ÉLEVÉ (>10 fichiers redondants)"
        elif [[ $redundant_files -gt 5 ]]; then
            echo "⚠️  RISQUE: MOYEN (5-10 fichiers redondants)"
        else
            echo "✅ RISQUE: FAIBLE (<5 fichiers redondants)"
        fi
    else
        echo "✅ Aucun fichier redondant détecté"
    fi
    
    # Vérifier si le module est importé
    imports_count=$(grep -r "from.*$module_name" src/ 2>/dev/null | wc -l)
    echo "🔗 Utilisé dans: $imports_count imports"
    
    if [[ $imports_count -gt 20 ]]; then
        echo "🚨 IMPACT: CRITIQUE (>20 dépendances)"
    elif [[ $imports_count -gt 10 ]]; then
        echo "⚠️  IMPACT: ÉLEVÉ (10-20 dépendances)"
    elif [[ $imports_count -gt 5 ]]; then
        echo "✅ IMPACT: MOYEN (5-10 dépendances)"
    else
        echo "✅ IMPACT: FAIBLE (<5 dépendances)"
    fi
}

# Analyser les modules principaux
echo "Analyse des modules avec le plus de redondances détectées..."

analyze_module "src/modules/orders"
analyze_module "src/modules/search" 
analyze_module "src/modules/admin"
analyze_module "src/modules/vehicles"
analyze_module "src/modules/messages"
analyze_module "src/modules/shipping"
analyze_module "src/auth"

echo ""
echo "2️⃣ MATRICE RISQUE/IMPACT"
echo "========================"
echo ""
echo "┌─────────────────┬──────────┬────────┬────────────────┐"
echo "│ Module          │ Redond.  │ Impact │ Recommandation │"
echo "├─────────────────┼──────────┼────────┼────────────────┤"

# Analyser chaque module pour la matrice
for module in orders search admin vehicles messages shipping auth; do
    if [[ -d "src/modules/$module" ]] || [[ -d "src/$module" ]]; then
        module_path="src/modules/$module"
        [[ ! -d "$module_path" ]] && module_path="src/$module"
        
        redundant=$(find "$module_path" -name "*test*.ts" -o -name "*debug*.ts" -o -name "*minimal*.ts" -o -name "*enhanced*.ts" -o -name "*simple*.ts" -o -name "*legacy*.ts" -o -name "*backup*.ts" 2>/dev/null | wc -l)
        imports=$(grep -r "from.*$module" src/ 2>/dev/null | wc -l)
        
        if [[ $redundant -gt 5 && $imports -gt 15 ]]; then
            priority="🚨 URGENT"
        elif [[ $redundant -gt 5 || $imports -gt 15 ]]; then
            priority="⚠️  ÉLEVÉ"
        elif [[ $redundant -gt 2 ]]; then
            priority="✅ MOYEN"
        else
            priority="✅ FAIBLE"
        fi
        
        printf "│ %-15s │ %8d │ %6d │ %-14s │\n" "$module" "$redundant" "$imports" "$priority"
    fi
done

echo "└─────────────────┴──────────┴────────┴────────────────┘"

echo ""
echo "3️⃣ RECOMMANDATION STRATÉGIQUE"
echo "============================="
echo ""

# Calculer la complexité totale
total_redundant=$(find src -name "*test*.ts" -o -name "*debug*.ts" -o -name "*minimal*.ts" -o -name "*enhanced*.ts" -o -name "*simple*.ts" -o -name "*legacy*.ts" -o -name "*backup*.ts" 2>/dev/null | wc -l)

if [[ $total_redundant -gt 50 ]]; then
    echo "🎯 STRATÉGIE RECOMMANDÉE: NETTOYAGE PAR PHASES"
    echo ""
    echo "Phase 1 (Immédiate) - Fichiers Legacy (Risque minimal):"
    echo "  • Supprimer tous les fichiers *legacy* et *backup*"
    echo "  • Impact: Minimal, Bénéfice: Immédiat"
    echo ""
    echo "Phase 2 (Court terme) - Module avec plus de redondances:"
    echo "  • Focus sur le module avec le plus de fichiers redondants"
    echo "  • Créer sauvegarde complète avant"
    echo ""
    echo "Phase 3 (Moyen terme) - Modules critiques:"
    echo "  • Nettoyer les modules avec beaucoup de dépendances"
    echo "  • Tests approfondis requis"
elif [[ $total_redundant -gt 20 ]]; then
    echo "🎯 STRATÉGIE RECOMMANDÉE: NETTOYAGE CIBLÉ"
    echo ""
    echo "• Focus sur 2-3 modules les plus problématiques"
    echo "• Sauvegarde + nettoyage + tests par module"
    echo "• Approche conservative"
else
    echo "🎯 STRATÉGIE RECOMMANDÉE: NETTOYAGE GLOBAL"
    echo ""
    echo "• Nettoyage en une seule phase"
    echo "• Sauvegarde globale + suppression + validation"
fi

echo ""
echo "4️⃣ PLAN D'EXÉCUTION OPTIMAL"
echo "==========================="
echo ""
echo "Basé sur l'analyse, voici le plan optimal:"
echo ""
echo "1. 🗄️  SAUVEGARDE PRÉVENTIVE (Obligatoire)"
echo "   ./scripts/backup-global-cleanup.sh"
echo ""
echo "2. 🧹 NETTOYAGE PHASE 1 - Legacy (Sans risque)"
echo "   ./scripts/cleanup-legacy-files.sh"
echo ""
echo "3. 🔍 ANALYSE POST-PHASE 1"
echo "   ./scripts/validate-phase1-cleanup.sh"
echo ""
echo "4. 🎯 NETTOYAGE PHASE 2 - Module prioritaire"
echo "   ./scripts/cleanup-priority-module.sh"
echo ""
echo "5. ✅ VALIDATION COMPLÈTE"
echo "   ./scripts/validate-complete-cleanup.sh"

echo ""
echo "💡 CONSEIL: Commencer par les fichiers legacy pour un succès rapide et sans risque !"
