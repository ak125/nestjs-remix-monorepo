#!/bin/bash

# 🔍 SCRIPT DE DEBUG POUR L'AUTHENTIFICATION
echo "🔍 DIAGNOSTIC DE L'AUTHENTIFICATION"
echo "===================================="

# Test 1: Vérifier l'utilisateur par ID
echo "1. Test getUserById..."
curl -s "http://localhost:3000/api/users/test-user-456" | jq -r '.cst_mail' 2>/dev/null || echo "Erreur"

# Test 2: Essayer l'authentification avec différents emails
echo ""
echo "2. Test authentification avec test2@example.com..."
curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test2@example.com","password":"password123"}' \
    "http://localhost:3000/auth/login" | jq . 2>/dev/null || echo "Erreur ou pas de JSON"

echo ""
echo "3. Test authentification avec test456@example.com..."
curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test456@example.com","password":"password123"}' \
    "http://localhost:3000/auth/login" | jq . 2>/dev/null || echo "Erreur ou pas de JSON"

echo ""
echo "4. Afficher les logs récents..."
echo "Vérifier les logs du serveur pour voir les messages de debug"
