#!/bin/bash

# 🧪 Lanceur de tests pour le module Users

echo "🚀 Lancement des tests du module Users"
echo "======================================"

# Vérifier que l'application est démarrée
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ L'application n'est pas démarrée sur localhost:3000"
    echo "Démarrez l'application avec: npm run start:dev"
    exit 1
fi

echo "✅ Application détectée sur localhost:3000"
echo

# Vérifier que jq est installé pour formater le JSON
if ! command -v jq &> /dev/null; then
    echo "⚠️ jq n'est pas installé - les réponses JSON ne seront pas formatées"
    echo "Installez jq avec: sudo apt-get install jq"
    echo
fi

echo "Choisissez le type de test à exécuter:"
echo "1. Tests de base (CRUD, validation, erreurs)"
echo "2. Tests avancés (mot de passe, profils, niveaux)"
echo "3. Les deux (recommandé)"
echo "4. Test rapide (création + récupération)"
echo

read -p "Votre choix (1-4): " choice

case $choice in
    1)
        echo "🧪 Exécution des tests de base..."
        ./test-users-api.sh
        ;;
    2)
        echo "🔐 Exécution des tests avancés..."
        ./test-users-advanced.sh
        ;;
    3)
        echo "🚀 Exécution de tous les tests..."
        echo
        echo "========== TESTS DE BASE =========="
        ./test-users-api.sh
        echo
        echo "======== TESTS AVANCÉS ========"
        ./test-users-advanced.sh
        ;;
    4)
        echo "⚡ Test rapide..."
        BASE_URL="http://localhost:3000"
        API_BASE="$BASE_URL/api/users"
        TEST_EMAIL="quick-test-$(date +%s)@example.com"
        
        echo "Création d'utilisateur:"
        CREATE_RESPONSE=$(curl -s -X POST "$API_BASE" \
          -H "Content-Type: application/json" \
          -d '{
            "email": "'$TEST_EMAIL'",
            "password": "TestPassword123!",
            "firstName": "Quick",
            "lastName": "Test",
            "isPro": false,
            "isActive": true
          }')
        
        echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"
        
        USER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty' 2>/dev/null)
        
        if [ -n "$USER_ID" ]; then
            echo
            echo "Récupération de l'utilisateur créé:"
            GET_RESPONSE=$(curl -s -X GET "$API_BASE/$USER_ID")
            echo "$GET_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_RESPONSE"
            echo
            echo "✅ Test rapide réussi - Utilisateur ID: $USER_ID"
        else
            echo "❌ Échec du test rapide"
        fi
        ;;
    *)
        echo "❌ Choix invalide"
        exit 1
        ;;
esac

echo
echo "🎯 Tests terminés!"
echo "Pour des tests manuels, utilisez les URLs suivantes:"
echo "  GET    http://localhost:3000/api/users"
echo "  POST   http://localhost:3000/api/users"
echo "  GET    http://localhost:3000/api/users/{id}"
echo "  PUT    http://localhost:3000/api/users/{id}"
echo "  DELETE http://localhost:3000/api/users/{id}"
