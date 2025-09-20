#!/bin/bash
# 📁 backend/run-gamme-test.sh
# 🔍 Script pour tester les tables gammes avec les bonnes variables d'environnement

echo "🔍 Test des tables gammes avec variables d'environnement..."
echo "==========================================================="

# Source du .env si il existe
if [ -f .env ]; then
  echo "📄 Chargement des variables d'environnement depuis .env"
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
else
  echo "⚠️ Fichier .env non trouvé, utilisation des variables par défaut"
fi

# Afficher les variables (sans les clés sensibles)
echo "🔧 Configuration Supabase:"
echo "   URL: ${SUPABASE_URL:-'Non définie'}"
echo "   KEY: ${SUPABASE_ANON_KEY:0:20}... (tronquée)"

# Exécuter le test TypeScript
echo ""
echo "🚀 Exécution du test..."
cd /workspaces/nestjs-remix-monorepo/backend
npx ts-node src/scripts/test-gamme-tables.ts