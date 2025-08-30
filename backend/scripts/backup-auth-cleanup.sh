#!/bin/bash

# 🗄️ Script de sauvegarde avant nettoyage du système d'authentification
# Date: $(date)
# Objectif: Préserver l'historique des fichiers redondants avant suppression

set -e

# Configuration
BACKUP_DIR="../backup/auth-cleanup-$(date +%Y%m%d_%H%M%S)"
SOURCE_DIR="src/auth"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🗄️  SCRIPT DE SAUVEGARDE AUTHENTIFICATION"
echo "=========================================="
echo "📅 Date: $(date)"
echo "📁 Répertoire de sauvegarde: $BACKUP_DIR"
echo "📂 Source: $SOURCE_DIR"
echo ""

# Créer le répertoire de sauvegarde
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/auth"
mkdir -p "$BACKUP_DIR/metadata"

cd "$PROJECT_ROOT"

# Fonction pour sauvegarder un fichier avec métadonnées
backup_file() {
    local file_path="$1"
    local category="$2"
    local reason="$3"
    
    if [[ -f "$file_path" ]]; then
        echo "  📄 Sauvegarde: $file_path"
        
        # Copier le fichier
        cp "$file_path" "$BACKUP_DIR/auth/$(basename "$file_path")"
        
        # Créer les métadonnées
        cat >> "$BACKUP_DIR/metadata/$(basename "$file_path").meta" << EOF
Fichier: $file_path
Catégorie: $category
Raison de suppression: $reason
Date de sauvegarde: $(date)
Taille: $(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null || echo "N/A")
Checksum MD5: $(md5sum "$file_path" 2>/dev/null || md5 -q "$file_path" 2>/dev/null || echo "N/A")
Git commit: $(git rev-parse HEAD 2>/dev/null || echo "N/A")
Git branch: $(git branch --show-current 2>/dev/null || echo "N/A")

=== CONTENU ===
EOF
        cat "$file_path" >> "$BACKUP_DIR/metadata/$(basename "$file_path").meta"
    else
        echo "  ⚠️  Fichier non trouvé: $file_path"
    fi
}

echo "🔍 ANALYSE DES FICHIERS À SAUVEGARDER"
echo "======================================"

# Compter les fichiers trouvés
total_files=0

echo ""
echo "📊 MODULES REDONDANTS:"
echo "---------------------"
modules_redondants=(
    "src/auth/auth-minimal.module.ts"
    "src/auth/auth-clean.module.ts"
    "src/auth/simple-jwt.module.ts"
)

for file in "${modules_redondants[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  ✓ $file"
        total_files=$((total_files + 1))
    else
        echo "  ✗ $file (non trouvé)"
    fi
done

echo ""
echo "📊 CONTRÔLEURS REDONDANTS:"
echo "-------------------------"
controleurs_redondants=(
    "src/auth/auth-minimal.controller.ts"
    "src/auth/auth-clean-test.controller.ts"
    "src/auth/authenticate.controller.ts"
    "src/auth/auth-root.controller.ts"
    "src/auth/enhanced-auth.controller.ts"
    "src/auth/simple-enhanced-auth.controller.ts"
    "src/auth/simple-jwt.controller.ts"
)

for file in "${controleurs_redondants[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  ✓ $file"
        total_files=$((total_files + 1))
    else
        echo "  ✗ $file (non trouvé)"
    fi
done

echo ""
echo "📊 CONTRÔLEURS DE DEBUG/TEST:"
echo "----------------------------"
controleurs_debug=(
    "src/auth/jwt-test.controller.ts"
    "src/auth/jwt-fix.controller.ts"
    "src/auth/debug-jwt.controller.ts"
    "src/auth/test-jwt.controller.ts"
)

for file in "${controleurs_debug[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  ✓ $file"
        total_files=$((total_files + 1))
    else
        echo "  ✗ $file (non trouvé)"
    fi
done

echo ""
echo "📊 STRATÉGIES REDONDANTES:"
echo "-------------------------"
strategies_redondantes=(
    "src/auth/jwt-minimal.strategy.ts"
    "src/auth/jwt-clean.strategy.ts"
    "src/auth/strategies/jwt.strategy.ts"
)

for file in "${strategies_redondantes[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  ✓ $file"
        total_files=$((total_files + 1))
    else
        echo "  ✗ $file (non trouvé)"
    fi
done

echo ""
echo "📊 AUTRES FICHIERS DE TEST:"
echo "--------------------------"
autres_tests=(
    "src/auth/auth-clean-service.ts"
    "src/auth/simple-jwt.strategy.ts"
    "src/auth/test-auth.service.ts"
)

for file in "${autres_tests[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  ✓ $file"
        total_files=$((total_files + 1))
    else
        echo "  ✗ $file (non trouvé)"
    fi
done

echo ""
echo "📈 TOTAL: $total_files fichiers trouvés à sauvegarder"
echo ""

if [[ $total_files -eq 0 ]]; then
    echo "⚠️  Aucun fichier à sauvegarder trouvé."
    echo "   Les fichiers ont peut-être déjà été supprimés ou déplacés."
    exit 0
fi

echo "🚀 DÉBUT DE LA SAUVEGARDE"
echo "=========================="

# Sauvegarder les modules redondants
echo ""
echo "💾 Sauvegarde des modules redondants..."
for file in "${modules_redondants[@]}"; do
    backup_file "$file" "Module redondant" "Multiples modules d'authentification créent de la confusion"
done

# Sauvegarder les contrôleurs redondants
echo ""
echo "💾 Sauvegarde des contrôleurs redondants..."
for file in "${controleurs_redondants[@]}"; do
    backup_file "$file" "Contrôleur redondant" "Fonctionnalités dupliquées dans le contrôleur principal"
done

# Sauvegarder les contrôleurs de debug
echo ""
echo "💾 Sauvegarde des contrôleurs de debug/test..."
for file in "${controleurs_debug[@]}"; do
    backup_file "$file" "Contrôleur de debug/test" "Utilisé uniquement pour le débogage, fonctionnalité intégrée ailleurs"
done

# Sauvegarder les stratégies redondantes
echo ""
echo "💾 Sauvegarde des stratégies redondantes..."
for file in "${strategies_redondantes[@]}"; do
    backup_file "$file" "Stratégie redondante" "Stratégie JWT principale suffit"
done

# Sauvegarder les autres fichiers de test
echo ""
echo "💾 Sauvegarde des autres fichiers de test..."
for file in "${autres_tests[@]}"; do
    backup_file "$file" "Fichier de test" "Code de test/debug obsolète"
done

# Créer un index des fichiers sauvegardés
echo ""
echo "📋 Création de l'index de sauvegarde..."
cat > "$BACKUP_DIR/INDEX.md" << EOF
# 🗄️ Archive des fichiers d'authentification

**Date de création:** $(date)  
**Répertoire source:** \`$SOURCE_DIR\`  
**Total de fichiers:** $total_files  
**Raison:** Nettoyage des fichiers redondants et de debug  

## 📁 Structure de l'archive

\`\`\`
$BACKUP_DIR/
├── auth/                    # Fichiers source sauvegardés
├── metadata/                # Métadonnées et contenu détaillé
└── INDEX.md                # Ce fichier
\`\`\`

## 📊 Catégories de fichiers

### Modules redondants
$(for file in "${modules_redondants[@]}"; do echo "- \`$(basename "$file")\`"; done)

### Contrôleurs redondants  
$(for file in "${controleurs_redondants[@]}"; do echo "- \`$(basename "$file")\`"; done)

### Contrôleurs de debug/test
$(for file in "${controleurs_debug[@]}"; do echo "- \`$(basename "$file")\`"; done)

### Stratégies redondantes
$(for file in "${strategies_redondantes[@]}"; do echo "- \`$(basename "$file")\`"; done)

### Autres fichiers de test
$(for file in "${autres_tests[@]}"; do echo "- \`$(basename "$file")\`"; done)

## 🔄 Restauration

Pour restaurer un fichier :
\`\`\`bash
cp $BACKUP_DIR/auth/[nom-fichier] $SOURCE_DIR/
\`\`\`

Pour voir les métadonnées d'un fichier :
\`\`\`bash
cat $BACKUP_DIR/metadata/[nom-fichier].meta
\`\`\`

## ℹ️ Informations Git

**Commit:** $(git rev-parse HEAD 2>/dev/null || echo "N/A")  
**Branche:** $(git branch --show-current 2>/dev/null || echo "N/A")  
**Statut:** $(git status --porcelain | wc -l) fichiers modifiés  
EOF

# Créer un script de restauration
echo ""
echo "🔧 Création du script de restauration..."
cat > "$BACKUP_DIR/restore.sh" << 'EOF'
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
EOF

chmod +x "$BACKUP_DIR/restore.sh"

# Résumé final
echo ""
echo "✅ SAUVEGARDE TERMINÉE"
echo "====================="
echo "📁 Archive créée: $BACKUP_DIR"
echo "📊 Fichiers sauvegardés: $total_files"
echo "📋 Index: $BACKUP_DIR/INDEX.md"
echo "🔄 Restauration: $BACKUP_DIR/restore.sh"
echo ""
echo "💡 Commandes utiles:"
echo "   Voir l'index:     cat '$BACKUP_DIR/INDEX.md'"
echo "   Restaurer un fichier:  '$BACKUP_DIR/restore.sh nom-fichier'"
echo "   Restaurer tout:        '$BACKUP_DIR/restore.sh --all'"
echo ""
echo "🚀 Prêt pour le nettoyage !"
