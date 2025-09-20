#!/bin/bash
# Script de nettoyage des fichiers obsolètes et doublons
# Date: 2025-08-14

echo "🧹 NETTOYAGE DES FICHIERS OBSOLÈTES ET DOUBLONS"
echo "================================================="

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de confirmation
confirm() {
    read -p "Voulez-vous supprimer ces fichiers ? (y/N): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Fonction pour supprimer un fichier
remove_file() {
    local file="$1"
    local reason="$2"
    if [ -f "$file" ]; then
        echo -e "${RED}❌ SUPPRESSION:${NC} $file"
        echo -e "   ${YELLOW}Raison:${NC} $reason"
        rm "$file"
        echo -e "   ${GREEN}✅ Supprimé${NC}"
    else
        echo -e "${YELLOW}⚠️  Fichier déjà supprimé:${NC} $file"
    fi
}

echo -e "${BLUE}📋 ANALYSE DES FICHIERS DOUBLONS ET OBSOLÈTES...${NC}"
echo

# 1. FICHIERS DASHBOARD ADMIN DOUBLONS
echo -e "${YELLOW}🔍 1. DASHBOARDS ADMIN DOUBLONS${NC}"
echo "   - admin._index.tsx (NOUVEAU - à garder)"
echo "   - admin.dashboard._index.tsx (ANCIEN - à supprimer)"
echo "   - admin.dashboard.improved.tsx (TEST - à supprimer)"

# 2. FICHIERS DE CONFIGURATION ET SCRIPTS OBSOLÈTES
echo -e "${YELLOW}🔍 2. SCRIPTS ET CONFIGURATIONS OBSOLÈTES${NC}"
echo "   - create-super-admin.js (remplacé par fix-admin-password.js)"
echo "   - cookies.txt (fichiers de session temporaires)"
echo "   - cache/dump.rdb (cache Redis temporaire)"

# 3. FICHIERS VITE TIMESTAMP
echo -e "${YELLOW}🔍 3. ARTEFACTS VITE TEMPORAIRES${NC}"
echo "   - frontend/vite.config.ts.timestamp-* (artefacts temporaires)"

# 4. FICHIERS DE TEST ET DÉVELOPPEMENT
echo -e "${YELLOW}🔍 4. FICHIERS DE TEST OBSOLÈTES${NC}"
echo "   - admin.test.tsx (fichier de test obsolète)"
echo "   - admin.simple.tsx (fichier de dev/test obsolète)"

# 5. STORES ET SERVICES OBSOLÈTES
echo -e "${YELLOW}🔍 5. STORES ET SERVICES NON UTILISÉS${NC}"
echo "   - frontend/app/lib/stores/admin-store.ts (non utilisé)"
echo "   - backend/src/modules/admin/schemas/legacy-staff.schemas.ts (legacy)"

echo
echo -e "${BLUE}🚀 DÉBUT DU NETTOYAGE${NC}"
echo

if confirm; then
    echo
    echo -e "${GREEN}✅ Nettoyage confirmé, suppression en cours...${NC}"
    echo

    # Supprimer les dashboards doublons
    remove_file "frontend/app/routes/admin.dashboard._index.tsx" "Dashboard admin obsolète - remplacé par admin._index.tsx"
    remove_file "frontend/app/routes/admin.dashboard.improved.tsx" "Fichier de test de dashboard"

    # Supprimer les scripts obsolètes
    remove_file "create-super-admin.js" "Script obsolète - remplacé par fix-admin-password.js"
    remove_file "cookies.txt" "Fichier de session temporaire"
    remove_file "cache/dump.rdb" "Cache Redis temporaire"

    # Supprimer les artefacts Vite
    find frontend/ -name "vite.config.ts.timestamp-*" -type f -exec rm {} \; 2>/dev/null || true
    echo -e "${RED}❌ SUPPRESSION:${NC} frontend/vite.config.ts.timestamp-*"
    echo -e "   ${YELLOW}Raison:${NC} Artefacts Vite temporaires"
    echo -e "   ${GREEN}✅ Supprimés${NC}"

    # Supprimer les fichiers de test obsolètes
    remove_file "frontend/app/routes/admin.test.tsx" "Fichier de test obsolète"
    remove_file "frontend/app/routes/admin.simple.tsx" "Fichier de développement obsolète"

    # Supprimer les stores non utilisés
    remove_file "frontend/app/lib/stores/admin-store.ts" "Store Zustand non utilisé"
    remove_file "backend/src/modules/admin/schemas/legacy-staff.schemas.ts" "Schémas legacy non utilisés"

    echo
    echo -e "${GREEN}🎉 NETTOYAGE TERMINÉ !${NC}"
    echo -e "${BLUE}📊 RÉSUMÉ:${NC}"
    echo "   ✅ Fichiers dashboard doublons supprimés"
    echo "   ✅ Scripts obsolètes nettoyés"
    echo "   ✅ Artefacts temporaires supprimés"
    echo "   ✅ Fichiers de test obsolètes supprimés"
    echo "   ✅ Stores et schémas non utilisés supprimés"
    echo
    echo -e "${YELLOW}⚠️  N'oubliez pas de tester l'application après le nettoyage !${NC}"

else
    echo -e "${YELLOW}❌ Nettoyage annulé.${NC}"
fi

echo
echo "🏁 Script terminé."

# Fichiers à supprimer car obsolètes ou doublons
OBSOLETE_FILES=(
    # Ancien index admin payment (remplacé par dashboard)
    "frontend/app/routes/admin.payments._index.tsx"
    
    # Ancienne page transactions (remplacée par dashboard avec filtres)
    "frontend/app/routes/admin.payments.transactions.tsx"
    
    # Page de test Cyberplus (plus nécessaire en production)
    "frontend/app/routes/admin.payments.cyberplus-test.tsx"
    
    # Fichier mock orders si pas utilisé
    "frontend/app/utils/mock-orders.ts"
)

echo "📁 Fichiers à supprimer :"
for file in "${OBSOLETE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ❌ $file (existe)"
    else
        echo "  ⚠️  $file (introuvable)"
    fi
done

echo ""
read -p "🤔 Voulez-vous procéder à la suppression ? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Suppression en cours..."
    
    for file in "${OBSOLETE_FILES[@]}"; do
        if [ -f "$file" ]; then
            rm "$file"
            echo "  ✅ Supprimé: $file"
        fi
    done
    
    echo ""
    echo "✅ Nettoyage terminé !"
    echo ""
    echo "📋 Fichiers conservés (architecture finale):"
    echo "  ✅ frontend/app/routes/checkout.payment.tsx (page utilisateur)"
    echo "  ✅ frontend/app/routes/admin.payments.dashboard.tsx (dashboard admin)"
    echo "  ✅ frontend/app/routes/admin.payments.\$paymentId.tsx (détails)"
    echo "  ✅ frontend/app/routes/admin.payments.tsx (layout)"
    echo "  ✅ frontend/app/services/payment.server.ts (service utilisateur)"
    echo "  ✅ frontend/app/services/payment-admin.server.ts (service admin)"
    echo "  ✅ frontend/app/types/payment.ts (types TypeScript)"
    
else
    echo "❌ Annulé - Aucun fichier supprimé"
fi

echo ""
echo "🎯 Architecture finale optimisée et propre !"
