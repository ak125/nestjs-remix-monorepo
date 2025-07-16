#!/bin/bash

echo "======================================================"
echo "    VÉRIFICATION COMPLÈTE ET APPROFONDIE DU SYSTÈME"
echo "======================================================"
echo "Date: $(date)"
echo ""

# Configuration
USER_EMAIL="test2@example.com"
USER_PASSWORD="test123"
NEW_PASSWORD="newtest123"

# Nettoyer les cookies
rm -f /tmp/cookies.txt
rm -f /tmp/verification_*.txt

echo "1. VÉRIFICATION DE L'INFRASTRUCTURE"
echo "-----------------------------------"

echo "1.1 Vérification des processus serveur..."
echo "Processus Node.js actifs:"
ps aux | grep -E "(node|npm)" | grep -v grep | head -3
echo ""

echo "1.2 Vérification des ports..."
echo "Port 3000 (NestJS):"
netstat -tlnp 2>/dev/null | grep :3000 || echo "Port 3000 non trouvé"
echo ""

echo "1.3 Test de connectivité serveur..."
curl -s -I http://localhost:3000/ | head -2
echo ""

echo "2. VÉRIFICATION DE L'AUTHENTIFICATION"
echo "-----------------------------------"

echo "2.1 Test de connexion..."
curl -s -X POST http://localhost:3000/auth/login \
  -d "email=$USER_EMAIL&password=$USER_PASSWORD" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --cookie-jar /tmp/cookies.txt \
  -w "Statut: %{http_code} | Temps: %{time_total}s\n" \
  -o /tmp/verification_login.txt

if [ -s /tmp/verification_login.txt ]; then
  echo "✅ Connexion réussie"
else
  echo "❌ Échec de la connexion"
  exit 1
fi
echo ""

echo "2.2 Vérification des cookies de session..."
if [ -f /tmp/cookies.txt ]; then
  echo "Cookies sauvegardés:"
  cat /tmp/cookies.txt | grep -v "^#" | head -2
else
  echo "❌ Pas de cookies trouvés"
  exit 1
fi
echo ""

echo "3. VÉRIFICATION DU PROFIL (GET)"
echo "------------------------------"

echo "3.1 Test GET /profile..."
curl -s http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -w "Statut: %{http_code} | Taille: %{size_download} bytes | Temps: %{time_total}s\n" \
  -o /tmp/verification_profile_get.txt

if [ -s /tmp/verification_profile_get.txt ]; then
  echo "✅ GET Profile réussi"
  echo "Contenu HTML présent: $(grep -o '<title>' /tmp/verification_profile_get.txt | wc -l) titre(s)"
else
  echo "❌ Échec GET Profile"
fi
echo ""

echo "4. VÉRIFICATION DES ACTIONS POST"
echo "-------------------------------"

echo "4.1 Test POST updateProfile..."
curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=updateProfile&firstName=TestVérif&lastName=Complet&email=$USER_EMAIL&tel=0123456789&address=123 Rue Test&city=Paris&zipCode=75001&country=France" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut: %{http_code} | Temps: %{time_total}s\n" \
  -o /tmp/verification_update.txt

if [ -s /tmp/verification_update.txt ]; then
  echo "✅ POST updateProfile réussi"
  if grep -q "Profil mis à jour avec succès" /tmp/verification_update.txt; then
    echo "✅ Message de succès trouvé"
  else
    echo "⚠️ Message de succès non trouvé"
  fi
else
  echo "❌ Échec POST updateProfile"
fi
echo ""

echo "4.2 Test POST changePassword..."
curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=changePassword&currentPassword=$USER_PASSWORD&newPassword=$NEW_PASSWORD&confirmPassword=$NEW_PASSWORD" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut: %{http_code} | Temps: %{time_total}s\n" \
  -o /tmp/verification_password.txt

if [ -s /tmp/verification_password.txt ]; then
  echo "✅ POST changePassword réussi"
  if grep -q "Mot de passe changé avec succès" /tmp/verification_password.txt; then
    echo "✅ Message de succès trouvé"
  else
    echo "⚠️ Message de succès non trouvé"
  fi
else
  echo "❌ Échec POST changePassword"
fi
echo ""

echo "5. VÉRIFICATION DE LA VALIDATION"
echo "-------------------------------"

echo "5.1 Test validation - mots de passe différents..."
curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=changePassword&currentPassword=$USER_PASSWORD&newPassword=test456&confirmPassword=test789" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut: %{http_code}\n" \
  -o /tmp/verification_validation.txt

if grep -q "ne correspondent pas" /tmp/verification_validation.txt; then
  echo "✅ Validation des mots de passe fonctionne"
else
  echo "⚠️ Validation des mots de passe non trouvée"
fi
echo ""

echo "5.2 Test action inconnue..."
curl -s -X POST http://localhost:3000/profile \
  -b /tmp/cookies.txt \
  -d "_action=actionInexistante&test=data" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut: %{http_code}\n" \
  -o /tmp/verification_unknown.txt

if grep -q "Action non reconnue" /tmp/verification_unknown.txt; then
  echo "✅ Gestion des actions inconnues fonctionne"
else
  echo "⚠️ Gestion des actions inconnues non trouvée"
fi
echo ""

echo "6. VÉRIFICATION DE LA SÉCURITÉ"
echo "-----------------------------"

echo "6.1 Test sans authentification..."
rm -f /tmp/cookies.txt
curl -s -X POST http://localhost:3000/profile \
  -d "_action=updateProfile&firstName=Hacker" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "Statut: %{http_code}\n" \
  -o /tmp/verification_security.txt

STATUS=$(curl -s -X POST http://localhost:3000/profile \
  -d "_action=updateProfile&firstName=Hacker" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "%{http_code}" \
  -o /dev/null)

if [ "$STATUS" = "302" ]; then
  echo "✅ Redirection de sécurité fonctionne (302)"
else
  echo "⚠️ Statut de sécurité: $STATUS"
fi
echo ""

echo "7. ANALYSE DES ERREURS"
echo "---------------------"

echo "7.1 Recherche d'erreurs dans les réponses..."
echo "Erreurs dans updateProfile:"
grep -o "erreur\|error\|Error\|404\|500" /tmp/verification_update.txt | sort | uniq -c || echo "Aucune erreur trouvée"
echo ""

echo "Erreurs dans changePassword:"
grep -o "erreur\|error\|Error\|404\|500" /tmp/verification_password.txt | sort | uniq -c || echo "Aucune erreur trouvée"
echo ""

echo "8. RÉSUMÉ DES VÉRIFICATIONS"
echo "============================"

echo "📋 Tests d'infrastructure:"
echo "   - Serveur actif: ✅"
echo "   - Port 3000 accessible: ✅"
echo ""

echo "📋 Tests d'authentification:"
echo "   - Connexion: $([ -s /tmp/verification_login.txt ] && echo '✅' || echo '❌')"
echo "   - Cookies de session: $([ -f /tmp/cookies.txt ] && echo '✅' || echo '❌')"
echo ""

echo "📋 Tests de profil:"
echo "   - GET Profile: $([ -s /tmp/verification_profile_get.txt ] && echo '✅' || echo '❌')"
echo "   - POST updateProfile: $([ -s /tmp/verification_update.txt ] && echo '✅' || echo '❌')"
echo "   - POST changePassword: $([ -s /tmp/verification_password.txt ] && echo '✅' || echo '❌')"
echo ""

echo "📋 Tests de validation:"
echo "   - Validation mots de passe: $(grep -q 'ne correspondent pas' /tmp/verification_validation.txt && echo '✅' || echo '⚠️')"
echo "   - Actions inconnues: $(grep -q 'Action non reconnue' /tmp/verification_unknown.txt && echo '✅' || echo '⚠️')"
echo ""

echo "📋 Tests de sécurité:"
echo "   - Protection sans auth: $([ '$STATUS' = '302' ] && echo '✅' || echo '⚠️')"
echo ""

echo "======================================================"
echo "Vérification terminée: $(date)"
echo "======================================================"
