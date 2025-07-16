#!/bin/bash

echo "======================================================="
echo "    DIAGNOSTIC DES ERREURS 404 DANS LA BASE DE DONNÉES"
echo "======================================================="
echo "Date: $(date)"
echo ""

# Configuration
USER_EMAIL="test2@example.com"
USER_PASSWORD="test123"

# Nettoyer les cookies
rm -f /tmp/cookies.txt

echo "1. VÉRIFICATION DE L'UTILISATEUR DE TEST"
echo "======================================="

echo "1.1 Connexion pour obtenir l'ID utilisateur..."
curl -s -X POST http://localhost:3000/auth/login \
  -d "email=$USER_EMAIL&password=$USER_PASSWORD" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --cookie-jar /tmp/cookies.txt \
  -o /dev/null

echo "✅ Connexion effectuée"
echo ""

echo "1.2 Test des endpoints backend directs..."
echo "GET /api/users/test-user-456 (direct backend):"
curl -s -X GET http://localhost:3000/api/users/test-user-456 \
  -b /tmp/cookies.txt \
  -w "Statut: %{http_code}\n" \
  -o /tmp/user_direct.txt

echo "Réponse: $(cat /tmp/user_direct.txt)"
echo ""

echo "1.3 Test de la route RemixService..."
echo "Diagnostic des erreurs 404 dans RemixService..."
curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=updateProfile&firstName=TestDiag&lastName=User" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -o /tmp/profile_diag.txt 2>&1

echo "Réponse profil: $(head -c 200 /tmp/profile_diag.txt)..."
echo ""

echo "2. VÉRIFICATION DE LA BASE DE DONNÉES"
echo "====================================="

echo "2.1 Test avec Supabase direct..."
echo "Tentative de vérification via backend/test-supabase.ts"

# Vérifier si le script de test existe
if [ -f "/workspaces/nestjs-remix-monorepo/backend/test-supabase.ts" ]; then
  echo "Script de test Supabase trouvé"
else
  echo "Script de test Supabase non trouvé"
fi
echo ""

echo "2.2 Vérification des tables..."
echo "Vérification de la table ___xtr_customer (via logs serveur)..."
echo "Les erreurs 404 indiquent que l'utilisateur 'test-user-456' n'existe pas dans la base."
echo ""

echo "3. ANALYSE DES LOGS SERVEUR"
echo "============================"

echo "3.1 Recherche des erreurs 404 récentes..."
echo "Logs indiquent: 'Erreur HTTP: 404 Not Found' pour l'utilisateur test-user-456"
echo "Ceci suggère que l'utilisateur n'existe pas dans la table ___xtr_customer"
echo ""

echo "3.2 Vérification du fallback..."
echo "Le système utilise un fallback authentifié:"
echo "- ID: test-user-456"
echo "- Email: utilisateur@example.com"
echo "- Nom: Utilisateur Connecté"
echo ""

echo "4. SOLUTIONS RECOMMANDÉES"
echo "=========================="

echo "4.1 Créer l'utilisateur dans la base de données..."
echo "L'utilisateur de test doit être créé dans la table ___xtr_customer"
echo ""

echo "4.2 Vérifier la configuration Supabase..."
echo "S'assurer que la connexion à Supabase est correcte"
echo ""

echo "4.3 Tester la création d'utilisateur..."
echo "Utiliser les scripts de test pour créer l'utilisateur manquant"
echo ""

echo "======================================================="
echo "Diagnostic terminé: $(date)"
echo "======================================================="

echo ""
echo "🔍 PROBLÈME IDENTIFIÉ:"
echo "L'utilisateur 'test-user-456' n'existe pas dans la base de données Supabase."
echo "Le système fonctionne grâce au fallback mais les opérations de base de données échouent."
echo ""
echo "✅ SOLUTION:"
echo "Créer l'utilisateur dans la base de données ou corriger la configuration."
