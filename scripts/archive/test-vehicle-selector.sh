#!/bin/bash
# Script de test pour vérifier que les marques sont chargées correctement

echo "🚗 Test du sélecteur de véhicule - Vérification des marques"
echo "============================================================"

# Démarrer le serveur de développement en arrière-plan
cd /workspaces/nestjs-remix-monorepo
echo "📦 Installation des dépendances frontend..."
npm install --prefix frontend

echo "🚀 Démarrage du serveur de développement..."
npm run dev --prefix frontend &
SERVER_PID=$!

# Attendre que le serveur démarre
sleep 10

echo "🔍 Test de l'API des marques..."
curl -s http://localhost:3000/api/vehicles/brands | head -10

echo -e "\n📊 Test de la page d'accueil..."
curl -s http://localhost:3000 | grep -i "Sélectionnez\|marque\|brand" | head -5

# Nettoyer
kill $SERVER_PID 2>/dev/null

echo -e "\n✅ Test terminé - Vérifiez que les marques apparaissent dans le sélecteur"