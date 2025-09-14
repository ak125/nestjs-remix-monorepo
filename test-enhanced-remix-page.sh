#!/bin/bash

echo "🧪 TEST DE LA PAGE REMIX ENHANCED VEHICLE CATALOG"
echo "================================================="
echo ""

BASE_URL="http://localhost:3001"  # Port frontend Remix par défaut

echo "� 1. VÉRIFICATION DU SERVEUR FRONTEND"
echo "======================================"

# Test si le serveur frontend répond
if curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo "✅ Frontend accessible sur $BASE_URL"
else
    echo "❌ Frontend non accessible sur $BASE_URL"
    echo "   Démarrez le frontend avec: cd frontend && npm run dev"
    exit 1
fi

echo ""
echo "� 2. TESTS DE LA ROUTE ENHANCED VEHICLE CATALOG"
echo "==============================================="

# Test URLs avec différents formats
URLS=(
    "$BASE_URL/enhanced-vehicle-catalog/peugeot/308/1-6-hdi"
    "$BASE_URL/enhanced-vehicle-catalog/alfa-romeo/giulia/2-9"
    "$BASE_URL/enhanced-vehicle-catalog/renault/clio/1-5-dci"
    "$BASE_URL/enhanced-vehicle-catalog/volkswagen/golf/2-0-tdi"
)

for url in "${URLS[@]}"; do
    echo ""
    echo "📋 Test URL: $url"
    
    # Test de l'accessibilité
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$status" = "200" ]; then
        echo "   ✅ Status: $status"
        
        # Test du contenu
        content=$(curl -s "$url")
        
        # Vérifier que c'est du HTML valide
        if echo "$content" | grep -q "<!DOCTYPE html>"; then
            echo "   ✅ HTML valide retourné"
        else
            echo "   ⚠️  Contenu non-HTML retourné"
        fi
        
        # Vérifier les composants
        if echo "$content" | grep -q "VehicleHeader\|vehicle-header"; then
            echo "   ✅ Composant VehicleHeader détecté"
        else
            echo "   ⚠️  VehicleHeader non détecté"
        fi
        
        # Vérifier les métadonnées
        if echo "$content" | grep -q "<title>.*Pièces"; then
            echo "   ✅ Titre SEO présent"
        else
            echo "   ⚠️  Titre SEO non détecté"
        fi
        
    elif [ "$status" = "404" ]; then
        echo "   ❌ Status: $status (Page non trouvée)"
    elif [ "$status" = "500" ]; then
        echo "   ❌ Status: $status (Erreur serveur)"
    else
        echo "   ⚠️  Status: $status"
    fi
    
    # Test du temps de réponse
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$url")
    echo "   ⏱️  Temps de réponse: ${response_time}s"
done

echo ""
echo "� 3. TEST DES COMPOSANTS VIA DEVTOOLS"
echo "====================================="

# Test JavaScript côté client
test_js_url="$BASE_URL/enhanced-vehicle-catalog/peugeot/308/1-6-hdi"
echo "📋 Test des composants React sur: $test_js_url"

content=$(curl -s "$test_js_url")

# Vérifier les imports de composants
if echo "$content" | grep -q "VehicleHeader\|VehicleInfo\|VehicleGallery"; then
    echo "   ✅ Composants Vehicle détectés dans le HTML"
else
    echo "   ❌ Composants Vehicle non détectés"
fi

# Vérifier le JSON-LD Schema
if echo "$content" | grep -q '"@type":"Product"'; then
    echo "   ✅ Schema.org JSON-LD présent"
else
    echo "   ⚠️  Schema.org JSON-LD non détecté"
fi

# Vérifier les données du véhicule
if echo "$content" | grep -q "Peugeot\|308"; then
    echo "   ✅ Données du véhicule présentes"
else
    echo "   ❌ Données du véhicule manquantes"
fi

echo ""
echo "📊 4. VÉRIFICATION DES ERREURS CONSOLE"
echo "======================================"

echo "📋 Pour vérifier les erreurs JavaScript:"
echo "   1. Ouvrez $test_js_url dans votre navigateur"
echo "   2. Ouvrez les DevTools (F12)"
echo "   3. Vérifiez l'onglet Console pour les erreurs"
echo "   4. Vérifiez l'onglet Network pour les requêtes échouées"

echo ""
echo "� 5. TESTS DE PERFORMANCE"
echo "=========================="

# Test de performance simple
echo "📊 Performance de base:"
start_time=$(date +%s%N)
curl -s "$test_js_url" > /dev/null
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 ))
echo "   Page complète: ${duration}ms"

echo ""
echo "✅ RÉSUMÉ DES TESTS"
echo "=================="
echo ""
echo "🎯 URLs testées:"
for url in "${URLS[@]}"; do
    echo "   - $url"
done
echo ""
echo "📋 Vérifications effectuées:"
echo "   - Accessibilité des routes"
echo "   - Validité du HTML retourné"
echo "   - Présence des composants Vehicle"
echo "   - Métadonnées SEO"
echo "   - Schema.org JSON-LD"
echo "   - Performance de base"
echo ""
echo "� Pour des tests plus approfondis:"
echo "   - Lighthouse pour la performance web"
echo "   - React DevTools pour les composants"
echo "   - Network tab pour les requêtes API"
echo ""
echo "🔧 Si des erreurs persistent:"
echo "   1. Vérifiez les logs du serveur Remix"
echo "   2. Vérifiez les imports des composants"
echo "   3. Vérifiez la syntaxe TypeScript"
echo "   4. Redémarrez le serveur de développement"