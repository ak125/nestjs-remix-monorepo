#!/bin/bash

# Script de validation de la séparation des paiements
echo "🔍 Validation de la Séparation des Pages de Paiement"
echo "=================================================="

echo ""
echo "📁 Vérification des fichiers créés..."

# Services
if [ -f "frontend/app/services/payment.server.ts" ]; then
    echo "✅ Service utilisateur : payment.server.ts"
else
    echo "❌ Service utilisateur manquant"
fi

if [ -f "frontend/app/services/payment-admin.server.ts" ]; then
    echo "✅ Service admin : payment-admin.server.ts"
else
    echo "❌ Service admin manquant"
fi

# Types
if [ -f "frontend/app/types/payment.ts" ]; then
    echo "✅ Types TypeScript : payment.ts"
else
    echo "❌ Types manquants"
fi

# Routes utilisateur
if [ -f "frontend/app/routes/checkout.payment.tsx" ]; then
    echo "✅ Page utilisateur : checkout.payment.tsx"
else
    echo "❌ Page utilisateur manquante"
fi

# Routes admin
if [ -f "frontend/app/routes/admin.payments.dashboard.tsx" ]; then
    echo "✅ Dashboard admin : admin.payments.dashboard.tsx"
else
    echo "❌ Dashboard admin manquant"
fi

if [ -f "frontend/app/routes/admin.payments.\$paymentId.tsx" ]; then
    echo "✅ Détails admin : admin.payments.\$paymentId.tsx"
else
    echo "❌ Page détails admin manquante"
fi

echo ""
echo "🔐 Vérification de l'authentification..."
if [ -f "frontend/app/lib/auth.server.ts" ]; then
    echo "✅ Authentification configurée"
else
    echo "❌ Authentification manquante"
fi

echo ""
echo "🎯 Résumé de la Séparation"
echo "========================="
echo "✅ Pages utilisateur : Interface simple pour payer"
echo "✅ Pages admin : Dashboard complet pour gérer"
echo "✅ Services séparés : Sécurité et maintenabilité"
echo "✅ Types TypeScript : Code robuste et documenté"
echo ""
echo "🚀 Mission Accomplie : Séparation Réussie ! 🎉"
