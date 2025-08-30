#!/bin/bash

# 📊 Script d'analyse des performances après nettoyage
# Objectif: Mesurer l'impact du nettoyage

set -e

echo "📊 ANALYSE DES PERFORMANCES POST-NETTOYAGE"
echo "=========================================="
echo "📅 Date: $(date)"
echo ""

# Compter les fichiers
echo "📁 STATISTIQUES DE FICHIERS"
echo "============================"
echo "TypeScript (.ts): $(find src -name "*.ts" | wc -l) fichiers"
echo "Contrôleurs: $(find src -name "*.controller.ts" | wc -l) fichiers"
echo "Services: $(find src -name "*.service.ts" | wc -l) fichiers" 
echo "Modules: $(find src -name "*.module.ts" | wc -l) fichiers"
echo "Guards: $(find src -name "*.guard.ts" | wc -l) fichiers"
echo "Stratégies: $(find src -name "*.strategy.ts" | wc -l) fichiers"
echo ""

# Taille du projet
echo "💾 TAILLE DU PROJET"
echo "=================="
echo "Taille totale src/: $(du -sh src 2>/dev/null || echo "N/A")"
echo "Taille auth/: $(du -sh src/auth 2>/dev/null || echo "N/A")"
echo ""

# Test de build
echo "🔧 TEST DE COMPILATION"
echo "====================="
if npm run build > /dev/null 2>&1; then
    echo "✅ Compilation réussie"
else
    echo "❌ Erreurs de compilation"
fi

echo ""
echo "🚀 Test de démarrage rapide..."
timeout 30s npm run dev > /dev/null 2>&1 &
server_pid=$!
sleep 10

if kill -0 $server_pid 2>/dev/null; then
    echo "✅ Serveur démarre correctement"
    kill $server_pid 2>/dev/null || true
else
    echo "⚠️  Problème de démarrage détecté"
fi

echo ""
echo "🎯 RECOMMANDATIONS SUIVANTES"
echo "============================"
echo "1. 🧹 Continuer le nettoyage des autres modules"
echo "2. 📊 Optimiser les services avec multiples versions"
echo "3. 🔧 Corriger les erreurs de compilation restantes"
echo "4. 📚 Documenter l'architecture simplifiée"
