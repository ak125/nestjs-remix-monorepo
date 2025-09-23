#!/bin/bash
# 📁 serve-demo.sh
# 🌐 Serveur simple pour la démo Enhanced Vehicle Selector

echo "🚗 Démarrage du serveur de démonstration Enhanced Vehicle Selector"
echo "================================================================"

# Vérifier si Python est disponible
if command -v python3 &> /dev/null; then
    echo "✅ Python3 détecté - Démarrage serveur HTTP..."
    echo "🌐 URL: http://localhost:8000/test-enhanced-vehicle-selector.html"
    echo ""
    echo "💡 Instructions:"
    echo "   1. Cliquez sur l'URL ci-dessus ou naviguez manuellement"
    echo "   2. Testez la cascade Marque → Année → Modèle → Type"
    echo "   3. Testez la recherche par type mine"
    echo "   4. Vérifiez la responsivité mobile"
    echo ""
    echo "⌨️  Appuyez sur Ctrl+C pour arrêter le serveur"
    echo ""
    
    cd /workspaces/nestjs-remix-monorepo
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "✅ Python2 détecté - Démarrage serveur HTTP..."
    echo "🌐 URL: http://localhost:8000/test-enhanced-vehicle-selector.html"
    echo ""
    echo "⌨️  Appuyez sur Ctrl+C pour arrêter le serveur"
    echo ""
    
    cd /workspaces/nestjs-remix-monorepo
    python -m SimpleHTTPServer 8000
else
    echo "❌ Python non disponible"
    echo ""
    echo "💡 Alternatives:"
    echo "   1. Installez Python: apt-get install python3"
    echo "   2. Utilisez Node.js: npx serve ."
    echo "   3. Ouvrez directement test-enhanced-vehicle-selector.html dans un navigateur"
    exit 1
fi