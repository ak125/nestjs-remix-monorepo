#!/bin/bash

# Script de nettoyage des routes dupliquées
# Date: 6 octobre 2025

cd /workspaces/nestjs-remix-monorepo/frontend/app/routes

echo "🧹 NETTOYAGE DES ROUTES FRONTEND"
echo "════════════════════════════════════"
echo ""

echo "📋 Fichiers à supprimer (doublons/obsolètes):"
echo ""

# Dashboards obsolètes (redirections uniquement)
echo "  ❌ account.dashboard.authenticated.tsx (redirection)"
echo "  ❌ account.dashboard.enhanced.tsx (redirection)"
echo "  ❌ account.dashboard.unified.tsx (vide)"
echo "  ❌ optimization-dashboard.tsx (obsolète)"

# Profiles de debug
echo "  ❌ profile-debug.tsx (debug)"
echo "  ❌ profile-super-debug.tsx (debug)"

# Ancien profile (garder account.profile.tsx)
echo "  ❌ profile.tsx (ancien - remplacé par account.profile.tsx)"
echo "  ❌ profile._index.tsx (ancien)"

echo ""
echo "✅ Fichiers à GARDER (versions consolidées):"
echo ""
echo "  ✓ account.dashboard.tsx (dashboard principal)"
echo "  ✓ account.profile.tsx (profil dans /account)"
echo "  ✓ account.profile.edit.tsx"
echo "  ✓ account.orders.tsx"
echo "  ✓ account_.orders.\$orderId.tsx (détail commande)"
echo "  ✓ account.security.tsx"
echo "  ✓ account.settings.tsx"
echo "  ✓ account.addresses.tsx"
echo "  ✓ account.messages.*"
echo "  ✓ admin.dashboard.tsx (admin séparé)"
echo ""

read -p "❓ Continuer avec la suppression ? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Annulé."
    exit 1
fi

echo ""
echo "🗑️  Suppression en cours..."
echo ""

# Supprimer les doublons
rm -fv account.dashboard.authenticated.tsx
rm -fv account.dashboard.enhanced.tsx
rm -fv account.dashboard.unified.tsx
rm -fv optimization-dashboard.tsx
rm -fv profile-debug.tsx
rm -fv profile-super-debug.tsx
rm -fv profile.tsx
rm -fv profile._index.tsx

echo ""
echo "✅ Nettoyage terminé !"
echo ""

echo "📊 Routes restantes :"
ls -1 | grep -E "account|profile|dashboard" | sort

echo ""
echo "🎯 Structure consolidée:"
echo "  /account"
echo "    ├─ /dashboard         ← Tableau de bord"
echo "    ├─ /profile          ← Profil utilisateur"
echo "    ├─ /profile/edit     ← Édition profil"
echo "    ├─ /orders           ← Liste commandes"
echo "    ├─ /orders/:id       ← Détail commande"
echo "    ├─ /addresses        ← Adresses"
echo "    ├─ /security         ← Sécurité"
echo "    ├─ /settings         ← Paramètres"
echo "    └─ /messages         ← Messagerie"
echo ""
echo "  /admin"
echo "    └─ /dashboard        ← Tableau de bord admin"
echo ""
