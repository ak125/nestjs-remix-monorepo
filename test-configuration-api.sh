#!/bin/bash

echo "🧪 Test complet de l'API Configuration"
echo "====================================="
echo ""

BASE_URL="http://localhost:3000"
API_PATH="/api/admin/configuration"
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

# Test 1: Récupérer toutes les configurations
print_test "Récupération de toutes les configurations"
response=$(curl -X GET "$BASE_URL$API_PATH" -H "$CONTENT_TYPE" -s)
if echo "$response" | jq . > /dev/null 2>&1; then
    echo "$response" | jq .
    print_success
else
    echo "Réponse invalide: $response"
    print_error
fi

# Test 2: Récupérer une configuration spécifique
print_test "Récupération d'une configuration spécifique (app.debug)"
response=$(curl -X GET "$BASE_URL$API_PATH/app.debug" -H "$CONTENT_TYPE" -s)
if echo "$response" | jq . > /dev/null 2>&1; then
    echo "$response" | jq .
    print_success
else
    echo "Réponse invalide: $response"
    print_error
fi

# Test 3: Créer une nouvelle configuration
print_test "Création d'une nouvelle configuration"
response=$(curl -X POST "$BASE_URL$API_PATH" -H "$CONTENT_TYPE" -d '{
  "key": "test.api.timestamp",
  "value": "'$(date +%s)'",
  "category": "test",
  "description": "Configuration créée par test automatique",
  "type": "string",
  "isSensitive": false
}' -s)
if echo "$response" | jq . > /dev/null 2>&1; then
    echo "$response" | jq .
    print_success
else
    echo "Réponse invalide: $response"
    print_error
fi

# Test 4: Mettre à jour la configuration créée
print_test "Mise à jour de la configuration créée"
response=$(curl -X PUT "$BASE_URL$API_PATH/test.api.timestamp" -H "$CONTENT_TYPE" -d '{
  "value": "'$(date +%s)'_updated",
  "description": "Configuration mise à jour par test automatique"
}' -s)
if echo "$response" | jq . > /dev/null 2>&1; then
    echo "$response" | jq .
    print_success
else
    echo "Réponse invalide: $response"
    print_error
fi

# Test 5: Vérifier la mise à jour
print_test "Vérification de la mise à jour"
response=$(curl -X GET "$BASE_URL$API_PATH/test.api.timestamp" -H "$CONTENT_TYPE" -s)
if echo "$response" | jq . > /dev/null 2>&1; then
    echo "$response" | jq .
    print_success
else
    echo "Réponse invalide: $response"
    print_error
fi

# Test 6: Test de validation - type incorrect
print_test "Test de validation avec type incorrect"
response=$(curl -X POST "$BASE_URL$API_PATH" -H "$CONTENT_TYPE" -d '{
  "key": "test.validation.fail",
  "value": "not_a_number",
  "category": "test",
  "description": "Test de validation qui devrait échouer",
  "type": "number",
  "isSensitive": false
}' -s)
echo "$response" | jq .
if echo "$response" | jq -e '.success == false' > /dev/null 2>&1; then
    print_success
else
    echo "⚠️  La validation devrait échouer mais n'a pas échoué"
    print_error
fi

# Test 7: Test avec clé manquante
print_test "Test avec données manquantes"
response=$(curl -X POST "$BASE_URL$API_PATH" -H "$CONTENT_TYPE" -d '{
  "value": "valeur_sans_cle",
  "category": "test"
}' -s)
echo "$response" | jq .
if echo "$response" | jq -e '.success == false' > /dev/null 2>&1; then
    print_success
else
    echo "⚠️  La requête devrait échouer mais n'a pas échoué"
    print_error
fi

# Test 8: Suppression de la configuration de test
print_test "Suppression de la configuration de test"
response=$(curl -X DELETE "$BASE_URL$API_PATH/test.api.timestamp" -H "$CONTENT_TYPE" -s)
if echo "$response" | jq . > /dev/null 2>&1; then
    echo "$response" | jq .
    print_success
else
    echo "Réponse invalide: $response"
    print_error
fi

# Test 9: Vérifier que la configuration a été supprimée
print_test "Vérification de la suppression"
response=$(curl -X GET "$BASE_URL$API_PATH/test.api.timestamp" -H "$CONTENT_TYPE" -s)
echo "$response" | jq .
if echo "$response" | jq -e '.success == false' > /dev/null 2>&1; then
    print_success
else
    echo "⚠️  La configuration devrait être introuvable"
    print_error
fi

# Test 10: Test des endpoints non disponibles
print_test "Test des endpoints non disponibles (stats)"
response=$(curl -X GET "$BASE_URL$API_PATH/stats" -H "$CONTENT_Type" -s)
echo "$response" | jq .
if echo "$response" | jq -e '.statusCode == 404' > /dev/null 2>&1; then
    echo "✅ Endpoint stats non disponible (attendu)"
else
    echo "⚠️  Réponse inattendue pour endpoint stats"
fi
echo ""

print_test "Test des endpoints non disponibles (cache)"
response=$(curl -X GET "$BASE_URL$API_PATH/cache" -H "$CONTENT_Type" -s)
echo "$response" | jq .
if echo "$response" | jq -e '.statusCode == 404' > /dev/null 2>&1; then
    echo "✅ Endpoint cache non disponible (attendu)"
else
    echo "⚠️  Réponse inattendue pour endpoint cache"
fi
echo ""

echo "🎯 Tests terminés!"
echo "==================="
echo ""
echo "📊 Résumé des endpoints disponibles:"
echo "- GET    $API_PATH                 → Liste toutes les configurations"
echo "- GET    $API_PATH/{key}           → Récupère une configuration"
echo "- POST   $API_PATH                 → Crée une nouvelle configuration"
echo "- PUT    $API_PATH/{key}           → Met à jour une configuration"
echo "- DELETE $API_PATH/{key}           → Supprime une configuration"
echo ""
echo "❌ Endpoints non disponibles:"
echo "- GET    $API_PATH/stats           → Statistiques (404)"
echo "- GET    $API_PATH/cache           → État du cache (404)"
echo ""