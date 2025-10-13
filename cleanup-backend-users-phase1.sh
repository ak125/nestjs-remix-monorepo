#!/bin/bash

# Script de nettoyage PHASE 1 - Contrôleurs Utilisateurs Backend
# Date: 6 octobre 2025
# PHASE 1 = Suppression des fichiers NON ENREGISTRÉS (sans risque)

set -e

USERS_DIR="/workspaces/nestjs-remix-monorepo/backend/src/modules/users"
BACKUP_DIR="/workspaces/nestjs-remix-monorepo/_backup_backend_users_$(date +%Y%m%d_%H%M%S)"

echo "🧹 NETTOYAGE BACKEND - CONTRÔLEURS UTILISATEURS (PHASE 1)"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "⚠️  PHASE 1 = Suppression fichiers NON ENREGISTRÉS (SÉCURISÉ)"
echo ""

# Créer le dossier de sauvegarde
echo "📦 Création de la sauvegarde dans: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
echo ""

# Fonction pour sauvegarder et supprimer
backup_and_remove() {
    local file=$1
    local reason=$2
    
    if [ -f "$file" ]; then
        echo "  📄 $(basename $file)"
        echo "     Raison: $reason"
        echo "     Lignes: $(wc -l < "$file")"
        cp "$file" "$BACKUP_DIR/"
        rm "$file"
        echo "     ✅ Supprimé (sauvegardé)"
    else
        echo "  ⏭️  $(basename $file) (n'existe pas)"
    fi
    echo ""
}

echo "🗑️  SUPPRESSION DES CONTRÔLEURS INACTIFS"
echo "───────────────────────────────────────────────────────────────"
echo ""

backup_and_remove \
    "$USERS_DIR/users.controller.ts" \
    "Doublon - pas enregistré dans UsersModule (1091 lignes de code mort)"

backup_and_remove \
    "$USERS_DIR/users-consolidated.controller.ts" \
    "Version intermédiaire - route /api/users-v2 non utilisée (348 lignes)"

backup_and_remove \
    "$USERS_DIR/users-consolidated.service.ts" \
    "Service du contrôleur consolidé non utilisé"

echo "═══════════════════════════════════════════════════════════════"
echo "✅ Nettoyage Phase 1 terminé !"
echo ""
echo "📊 RÉSUMÉ:"
echo "  Sauvegarde: $BACKUP_DIR"
echo "  Fichiers supprimés: $(ls -1 "$BACKUP_DIR" 2>/dev/null | wc -l)"
echo "  Lignes supprimées: ~1 500 lignes"
echo ""
echo "📁 STRUCTURE ACTUELLE (Contrôleurs Utilisateurs):"
echo ""
echo "  ✅ ACTIFS (enregistrés dans modules):"
echo "    • users-final.controller.ts        → /api/users"
echo "    • addresses.controller.ts          → /api/users/addresses"
echo "    • password.controller.ts           → /api/users/password"
echo "    • user-shipment.controller.ts      → /api/users"
echo "    • user-management.controller.ts    → /api/admin/users"
echo ""
echo "  ✅ LEGACY (toujours utilisé par frontend):"
echo "    • controllers/users.controller.ts  → /api/legacy-users"
echo ""
echo "  ⚠️  À MIGRER (Phase 2):"
echo "    • users.service.ts → Migration AuthModule nécessaire"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "🎯 PROCHAINES ÉTAPES:"
echo ""
echo "  1. ✅ Vérifier que le backend démarre sans erreur"
echo "     → cd backend && npm run dev"
echo ""
echo "  2. ✅ Tester les endpoints utilisateurs"
echo "     → curl http://localhost:3001/api/users/test"
echo "     → curl http://localhost:3001/api/legacy-users"
echo ""
echo "  3. ⏳ PHASE 2 (séparée):"
echo "     → Migrer AuthModule de UsersService vers UsersFinalService"
echo "     → Supprimer users.service.ts après migration"
echo ""
echo "💡 Pour restaurer un fichier:"
echo "   cp $BACKUP_DIR/[filename] $USERS_DIR/"
echo ""
