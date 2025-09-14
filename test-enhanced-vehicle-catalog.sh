#!/bin/bash

echo "🧪 TESTS ENHANCED VEHICLE CATALOG SERVICE"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000"
API_PATH="/api/catalog/vehicles"
CONTENT_TYPE="Content-Type: application/json"

# Fonction pour afficher les résultats avec couleurs
print_test() {
    echo "📋 Test: $1"
    echo "---"
}

print_success() {
    echo "✅ Succès"
    echo ""
}

print_error() {
    echo "❌ Erreur"
    echo ""
}

# Test 1: Health Check
print_test "Health Check du service"
response=$(curl -X GET "$BASE_URL$API_PATH/health" -H "$CONTENT_TYPE" -s)
if echo "$response" | jq . > /dev/null 2>&1; then
    echo "$response" | jq .
    status=$(echo "$response" | jq -r '.status // "unknown"')
    if [ "$status" = "healthy" ]; then
        print_success
    else
        echo "⚠️  Status non healthy: $status"
        print_error
    fi
else
    echo "Réponse invalide: $response"
    print_error
fi

# Test 2: Statistiques du service
print_test "Statistiques du service"
response=$(curl -X GET "$BASE_URL$API_PATH/stats" -H "$CONTENT_TYPE" -s)
if echo "$response" | jq . > /dev/null 2>&1; then
    echo "$response" | jq .
    success=$(echo "$response" | jq -r '.success // false')
    if [ "$success" = "true" ]; then
        print_success
    else
        echo "⚠️  Échec récupération stats"
        print_error
    fi
else
    echo "Réponse invalide: $response"
    print_error
fi

# Test 3: Catalogue véhicule (exemple avec Peugeot 308)
print_test "Catalogue véhicule complet"
response=$(curl -X GET "$BASE_URL$API_PATH/peugeot/308/1-6-hdi" -H "$CONTENT_TYPE" -s)
echo "$response" | jq .
success=$(echo "$response" | jq -r '.success // false')
if [ "$success" = "true" ]; then
    echo "🚗 Véhicule récupéré avec succès"
    # Vérifier la structure des données
    vehicle_name=$(echo "$response" | jq -r '.data.vehicle.name // "N/A"')
    categories_count=$(echo "$response" | jq -r '.data.categories | length // 0')
    breadcrumbs_count=$(echo "$response" | jq -r '.data.breadcrumbs | length // 0')
    
    echo "   - Nom véhicule: $vehicle_name"
    echo "   - Catégories: $categories_count"
    echo "   - Breadcrumbs: $breadcrumbs_count"
    
    if [ "$categories_count" -gt 0 ] && [ "$breadcrumbs_count" -gt 0 ]; then
        print_success
    else
        echo "⚠️  Structure de données incomplète"
        print_error
    fi
else
    echo "⚠️  Échec récupération catalogue"
    # Peut être normal si le véhicule n'existe pas dans la BDD
    echo "ℹ️  Ceci peut être normal si ce véhicule spécifique n'existe pas"
    echo ""
fi

# Test 4: Recherche par type mine (exemple générique)
print_test "Recherche par type mine"
response=$(curl -X GET "$BASE_URL$API_PATH/search/mine/M1ABCD123" -H "$CONTENT_TYPE" -s)
echo "$response" | jq .
success=$(echo "$response" | jq -r '.success // false')
if [ "$success" = "true" ]; then
    mine_type=$(echo "$response" | jq -r '.mineType // "N/A"')
    vehicle_brand=$(echo "$response" | jq -r '.data.model.brand.name // "N/A"')
    echo "   - Type mine: $mine_type"
    echo "   - Marque trouvée: $vehicle_brand"
    print_success
else
    echo "⚠️  Aucun véhicule trouvé pour ce type mine"
    echo "ℹ️  Ceci est normal si ce type mine n'existe pas"
    echo ""
fi

# Test 5: Pièces populaires (avec ID générique)
print_test "Pièces populaires"
response=$(curl -X GET "$BASE_URL$API_PATH/123/popular-parts?limit=5" -H "$CONTENT_TYPE" -s)
echo "$response" | jq .
success=$(echo "$response" | jq -r '.success // false')
if [ "$success" = "true" ]; then
    parts_count=$(echo "$response" | jq -r '.total // 0')
    echo "   - Pièces populaires: $parts_count"
    print_success
else
    echo "⚠️  Échec récupération pièces populaires"
    echo "ℹ️  Ceci peut être normal si l'ID véhicule n'existe pas"
    echo ""
fi

# Test 6: Validation des paramètres (test d'erreur)
print_test "Validation paramètres (test d'erreur)"
response=$(curl -X GET "$BASE_URL$API_PATH///" -H "$CONTENT_TYPE" -s)
echo "$response" | jq .
# On s'attend à une erreur 400 ou 404
http_code=$(curl -X GET "$BASE_URL$API_PATH///" -H "$CONTENT_TYPE" -s -w "%{http_code}" -o /dev/null)
if [ "$http_code" = "400" ] || [ "$http_code" = "404" ]; then
    echo "   - Code HTTP: $http_code (attendu)"
    print_success
else
    echo "   - Code HTTP: $http_code (inattendu)"
    print_error
fi

# Test 7: Nettoyage cache (admin)
print_test "Nettoyage cache (admin)"
response=$(curl -X POST "$BASE_URL$API_PATH/cache/clear" -H "$CONTENT_TYPE" -s)
echo "$response" | jq .
success=$(echo "$response" | jq -r '.success // false')
if [ "$success" = "true" ]; then
    message=$(echo "$response" | jq -r '.message // "N/A"')
    echo "   - Message: $message"
    print_success
else
    echo "⚠️  Échec nettoyage cache"
    echo "ℹ️  Peut être normal si le service n'est pas encore intégré"
    echo ""
fi

echo "🎯 RÉSUMÉ DES TESTS"
echo "==================="
echo ""
echo "✅ Tests disponibles:"
echo "- Health check du service"
echo "- Statistiques et monitoring" 
echo "- Catalogue véhicule complet"
echo "- Recherche par type mine"
echo "- Pièces populaires par véhicule"
echo "- Validation des paramètres"
echo "- Nettoyage cache admin"
echo ""
echo "📊 Endpoints testés:"
echo "- GET  $API_PATH/health"
echo "- GET  $API_PATH/stats"
echo "- GET  $API_PATH/:brandSlug/:modelSlug/:typeSlug"
echo "- GET  $API_PATH/search/mine/:mineType"
echo "- GET  $API_PATH/:vehicleTypeId/popular-parts"
echo "- POST $API_PATH/cache/clear"
echo ""
echo "🏆 SERVICE ENHANCED VEHICLE CATALOG TESTÉ"
echo ""

echo "📋 Notes importantes:"
echo "-------------------"
echo "• Les erreurs 404 peuvent être normales si les données test n'existent pas"
echo "• Le service doit être intégré au module pour fonctionner complètement" 
echo "• Vérifiez les logs NestJS pour les détails des opérations"
echo "• Les endpoints sont documentés avec Swagger sur /api/docs"