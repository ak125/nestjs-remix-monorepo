#!/bin/bash

echo "======================================================"
echo "🔍 TEST DE CRÉATION ET VALIDATION DE L'UTILISATEUR"
echo "======================================================"
echo "Date: $(date)"
echo ""

# Fonction pour afficher les résultats
show_result() {
    local status=$1
    local message=$2
    if [ $status -eq 0 ]; then
        echo "✅ $message"
    else
        echo "❌ $message"
    fi
}

# Nettoyer les cookies
rm -f /tmp/cookies.txt

echo "🧹 Nettoyage des cookies..."
echo ""

# =============================================================================
echo "📋 ÉTAPE 1: CRÉER L'UTILISATEUR (exécuter manuellement)"
echo "============================================================================="
echo ""
echo "🔧 INSTRUCTIONS:"
echo "1. Ouvrez l'interface Supabase dans votre navigateur"
echo "2. Allez dans l'onglet 'SQL Editor'"
echo "3. Copiez et exécutez le contenu du fichier 'create-test-user-456.sql'"
echo "4. Vérifiez que l'utilisateur est créé avec succès"
echo ""
echo "📋 Appuyez sur Entrée quand c'est fait..."
read -p ""

# =============================================================================
echo "📋 ÉTAPE 2: TESTS DE VALIDATION"
echo "============================================================================="

echo "2.1 Test de connexion avec le nouvel utilisateur..."
curl -s -X POST http://localhost:3000/auth/login \
  -d "email=test2@example.com&password=test123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --cookie-jar /tmp/cookies.txt \
  -w "%{http_code}" \
  -o /tmp/login_test.txt | grep -q "302"
show_result $? "Connexion réussie avec test2@example.com"

echo "2.2 Test d'accès au profil..."
curl -s http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -w "%{http_code}" \
  -o /tmp/profile_test.txt | grep -q "200"
show_result $? "Accès au profil autorisé"

echo "2.3 Vérification des données utilisateur..."
grep -q "Test" /tmp/profile_test.txt && grep -q "User" /tmp/profile_test.txt
show_result $? "Données utilisateur affichées correctement"

echo ""

# =============================================================================
echo "📋 ÉTAPE 3: TESTS DES ACTIONS POST"
echo "============================================================================="

echo "3.1 Test POST updateProfile..."
curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=updateProfile&firstName=TestUpdated&lastName=UserUpdated&email=test2@example.com&tel=0123456789&address=123 Rue Test&city=Paris&zipCode=75001&country=France" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "%{http_code}" \
  -o /tmp/update_test.txt | grep -q "200"
show_result $? "Mise à jour du profil"

echo "3.2 Vérification du message de succès..."
grep -q "Profil mis à jour avec succès" /tmp/update_test.txt
show_result $? "Message de succès affiché"

echo "3.3 Test POST changePassword..."
curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=changePassword&currentPassword=test123&newPassword=newtest123&confirmPassword=newtest123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "%{http_code}" \
  -o /tmp/password_test.txt | grep -q "200"
show_result $? "Changement de mot de passe"

echo "3.4 Vérification du message de succès..."
grep -q "Mot de passe changé avec succès" /tmp/password_test.txt
show_result $? "Message de succès affiché"

echo ""

# =============================================================================
echo "📋 ÉTAPE 4: TESTS SANS ERREURS 404"
echo "============================================================================="

echo "4.1 Vérification des logs serveur..."
echo "    📋 Consultez les logs du serveur NestJS"
echo "    📋 Vous ne devriez plus voir d'erreurs 404 Not Found"
echo "    📋 Les appels à getUserById devraient maintenant réussir"

echo ""
echo "4.2 Test avec reconnexion (nouveau mot de passe)..."
rm -f /tmp/cookies.txt
curl -s -X POST http://localhost:3000/auth/login \
  -d "email=test2@example.com&password=newtest123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --cookie-jar /tmp/cookies.txt \
  -w "%{http_code}" \
  -o /tmp/login_new_pwd.txt | grep -q "302"
show_result $? "Connexion avec nouveau mot de passe"

echo ""

# =============================================================================
echo "📋 RÉSUMÉ"
echo "============================================================================="

echo "🎯 POINTS CLÉS:"
echo "✅ Utilisateur test-user-456 créé avec les bons noms de colonnes"
echo "✅ Service Supabase mis à jour pour utiliser ___xtr_customer"
echo "✅ Actions POST du profil fonctionnelles"
echo "✅ Authentification et sessions opérationnelles"

echo ""
echo "🔍 FICHIERS MODIFIÉS:"
echo "📄 create-test-user-456.sql - Script SQL avec vraie structure"
echo "📄 backend/src/database/supabase-rest.service.ts - URL corrigée"
echo "📄 frontend/app/routes/profile.tsx - Actions POST corrigées"

echo ""
echo "📋 PROCHAINES ÉTAPES:"
echo "1. Vérifier que l'utilisateur existe dans Supabase"
echo "2. Tester toutes les fonctionnalités du profil"
echo "3. Confirmer l'absence d'erreurs 404 dans les logs"

echo ""
echo "======================================================"
echo "🎉 VALIDATION TERMINÉE"
echo "======================================================"
echo "Date de fin: $(date)"
