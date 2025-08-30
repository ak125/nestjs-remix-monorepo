#!/bin/bash

# 🧹 Script de nettoyage du système d'authentification
# Date: $(date)
# Objectif: Supprimer les fichiers redondants après sauvegarde

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-auth-cleanup.sh"

echo "🧹 NETTOYAGE DU SYSTÈME D'AUTHENTIFICATION"
echo "==========================================="
echo "📅 Date: $(date)"
echo "📂 Projet: $PROJECT_ROOT"
echo ""

# Vérifier que la sauvegarde existe
if [[ ! -f "$BACKUP_SCRIPT" ]]; then
    echo "❌ Script de sauvegarde non trouvé: $BACKUP_SCRIPT"
    echo "   Veuillez d'abord créer le script de sauvegarde."
    exit 1
fi

echo "🔍 Vérification des prérequis..."

# Vérifier que nous sommes dans le bon répertoire
if [[ ! -d "$PROJECT_ROOT/src/auth" ]]; then
    echo "❌ Répertoire src/auth non trouvé."
    echo "   Assurez-vous d'être dans le bon projet."
    exit 1
fi

# Vérifier que Git est propre (optionnel)
cd "$PROJECT_ROOT"
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "⚠️  Attention: Des modifications Git non commitées détectées."
    echo "   Il est recommandé de committer vos changements avant le nettoyage."
    read -p "   Continuer quand même ? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Nettoyage annulé."
        exit 1
    fi
fi

echo ""
echo "1️⃣ ÉTAPE 1: SAUVEGARDE"
echo "======================"
echo "🗄️  Exécution du script de sauvegarde..."

# Exécuter la sauvegarde
chmod +x "$BACKUP_SCRIPT"
if ! "$BACKUP_SCRIPT"; then
    echo "❌ Échec de la sauvegarde."
    exit 1
fi

echo ""
echo "2️⃣ ÉTAPE 2: NETTOYAGE"
echo "====================="

# Fonction pour supprimer un fichier avec vérification
safe_remove() {
    local file_path="$1"
    local description="$2"
    
    if [[ -f "$file_path" ]]; then
        echo "  🗑️  Suppression: $file_path"
        rm -f "$file_path"
        return 0
    else
        echo "  ⚠️  Déjà supprimé: $file_path"
        return 1
    fi
}

# Supprimer les modules redondants
echo ""
echo "🗑️  Suppression des modules redondants..."
safe_remove "src/auth/auth-minimal.module.ts" "Module minimal redondant"
safe_remove "src/auth/auth-clean.module.ts" "Module clean redondant"
safe_remove "src/auth/simple-jwt.module.ts" "Module simple JWT redondant"

# Supprimer les contrôleurs redondants
echo ""
echo "🗑️  Suppression des contrôleurs redondants..."
safe_remove "src/auth/auth-minimal.controller.ts" "Contrôleur minimal redondant"
safe_remove "src/auth/auth-clean-test.controller.ts" "Contrôleur clean test redondant"
safe_remove "src/auth/authenticate.controller.ts" "Contrôleur authenticate redondant"
safe_remove "src/auth/auth-root.controller.ts" "Contrôleur root redondant"
safe_remove "src/auth/enhanced-auth.controller.ts" "Contrôleur enhanced redondant"
safe_remove "src/auth/simple-enhanced-auth.controller.ts" "Contrôleur simple enhanced redondant"
safe_remove "src/auth/simple-jwt.controller.ts" "Contrôleur simple JWT redondant"

# Supprimer les contrôleurs de debug/test
echo ""
echo "🗑️  Suppression des contrôleurs de debug/test..."
safe_remove "src/auth/jwt-test.controller.ts" "Contrôleur de test JWT"
safe_remove "src/auth/jwt-fix.controller.ts" "Contrôleur de fix JWT"
safe_remove "src/auth/debug-jwt.controller.ts" "Contrôleur de debug JWT"
safe_remove "src/auth/test-jwt.controller.ts" "Contrôleur de test JWT"

# Supprimer les stratégies redondantes
echo ""
echo "🗑️  Suppression des stratégies redondantes..."
safe_remove "src/auth/jwt-minimal.strategy.ts" "Stratégie JWT minimale"
safe_remove "src/auth/jwt-clean.strategy.ts" "Stratégie JWT clean"
safe_remove "src/auth/strategies/jwt.strategy.ts" "Stratégie JWT dupliquée"

# Supprimer les autres fichiers de test
echo ""
echo "🗑️  Suppression des autres fichiers de test..."
safe_remove "src/auth/auth-clean-service.ts" "Service clean de test"
safe_remove "src/auth/simple-jwt.strategy.ts" "Stratégie simple JWT"
safe_remove "src/auth/test-auth.service.ts" "Service de test auth"

# Supprimer le répertoire strategies s'il est vide
echo ""
echo "🗑️  Nettoyage des répertoires vides..."
if [[ -d "src/auth/strategies" ]] && [[ ! "$(ls -A src/auth/strategies)" ]]; then
    echo "  🗑️  Suppression du répertoire vide: src/auth/strategies"
    rmdir "src/auth/strategies"
fi

# Supprimer le répertoire controllers s'il contient seulement des fichiers de test
if [[ -d "src/auth/controllers" ]]; then
    remaining_files=$(find "src/auth/controllers" -name "*.ts" -not -name "*demo*" -not -name "*test*" | wc -l)
    if [[ $remaining_files -eq 0 ]]; then
        echo "  🗑️  Suppression des contrôleurs de demo/test..."
        rm -rf "src/auth/controllers"
    fi
fi

echo ""
echo "3️⃣ ÉTAPE 3: VÉRIFICATION"
echo "========================"

# Vérifier la structure finale
echo "📁 Structure finale du répertoire auth:"
tree src/auth/ 2>/dev/null || find src/auth -type f -name "*.ts" | sort

echo ""
echo "🔍 Fichiers principaux restants:"
principal_files=(
    "src/auth/auth.module.ts"
    "src/auth/auth.controller.ts"
    "src/auth/auth.service.ts"
    "src/auth/jwt.strategy.ts"
    "src/auth/local.strategy.ts"
    "src/auth/local-auth.guard.ts"
    "src/auth/jwt-auth.guard.ts"
)

for file in "${principal_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  ✅ $file"
    else
        echo "  ❌ MANQUANT: $file"
    fi
done

echo ""
echo "4️⃣ ÉTAPE 4: TEST DE COMPILATION"
echo "==============================="

echo "🔧 Test de compilation TypeScript..."
if npm run build > /dev/null 2>&1; then
    echo "✅ Compilation réussie - Le nettoyage n'a pas cassé le build"
else
    echo "❌ Erreur de compilation détectée"
    echo "🔧 Exécution du build pour voir les erreurs..."
    npm run build
    echo ""
    echo "⚠️  Des erreurs de compilation ont été détectées."
    echo "   Vérifiez les imports dans les fichiers restants."
    echo "   Utilisez le script de restauration si nécessaire."
fi

echo ""
echo "✅ NETTOYAGE TERMINÉ"
echo "==================="
echo "🧹 Fichiers redondants supprimés"
echo "📁 Structure simplifiée"
echo "🗄️  Sauvegarde disponible dans ../backup/"
echo ""
echo "💡 En cas de problème:"
echo "   1. Vérifiez les erreurs de compilation avec: npm run build"
echo "   2. Utilisez le script de restauration dans le dossier backup/"
echo "   3. Vérifiez les imports dans les fichiers restants"
echo ""
echo "🚀 Système d'authentification nettoyé et optimisé !"
