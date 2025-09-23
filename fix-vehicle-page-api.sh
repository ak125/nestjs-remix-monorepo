#!/bin/bash

# 🔧 Script de réparation rapide du fichier vehicle page
echo "🔧 Réparation du fichier vehicle page avec vraies données API"
echo "============================================================"

# Copie de sauvegarde
cp /workspaces/nestjs-remix-monorepo/frontend/app/routes/vehicle.\$brand.\$model.\$type.tsx /workspaces/nestjs-remix-monorepo/frontend/app/routes/vehicle.\$brand.\$model.\$type.backup.tsx

echo "✅ Sauvegarde créée"

# Remplacement par version fonctionnelle
cp /workspaces/nestjs-remix-monorepo/frontend/app/routes/vehicle.\$brand.\$model.\$type.real-api.tsx /workspaces/nestjs-remix-monorepo/frontend/app/routes/vehicle.\$brand.\$model.\$type.tsx

echo "✅ Fichier remplacé par version avec vraies données API"

# Test de la page
echo ""
echo "🧪 Test de la page réparée..."
curl -s "http://localhost:3000/vehicle/bmw-33/serie-3-e46-33027/2-0-320-d-16201.html" | head -5

echo ""
echo "✅ Réparation terminée - La page utilise maintenant les vraies données API backend"