#!/bin/bash

# Script pour tester la connexion avec différents utilisateurs
# et vérifier qu'on voit bien le bon compte

echo "🧪 Test de connexion avec différents utilisateurs"
echo "================================================="
echo ""

# Fonction pour tester une connexion
test_login() {
  local email=$1
  local password=$2
  local name=$3
  
  echo "📝 Test connexion: $name ($email)"
  echo "---"
  
  # Se connecter
  LOGIN_RESPONSE=$(curl -s -c /tmp/cookie_$name.txt -X POST http://localhost:3000/authenticate \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=$email&password=$password" \
    -w "\nHTTP_CODE:%{http_code}")
  
  HTTP_CODE=$(echo "$LOGIN_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
  
  if [ "$HTTP_CODE" = "302" ]; then
    echo "✅ Connexion réussie (HTTP $HTTP_CODE)"
    
    # Vérifier l'utilisateur connecté
    USER_INFO=$(curl -s -b /tmp/cookie_$name.txt http://localhost:3000/auth/me)
    USER_EMAIL=$(echo "$USER_INFO" | jq -r '.user.email')
    USER_NAME=$(echo "$USER_INFO" | jq -r '.user.firstName + " " + .user.lastName')
    
    if [ "$USER_EMAIL" = "$email" ]; then
      echo "✅ Utilisateur correct: $USER_NAME ($USER_EMAIL)"
    else
      echo "❌ ERREUR: Attendu $email, mais reçu $USER_EMAIL"
    fi
  else
    echo "❌ Échec de connexion (HTTP $HTTP_CODE)"
  fi
  
  echo ""
}

# Tests avec différents comptes
test_login "superadmin@autoparts.com" "SuperAdmin2025!" "SuperAdmin"

# Ajouter d'autres comptes si disponibles
# test_login "admin@autoparts.com" "Admin2025!" "Admin"
# test_login "user@autoparts.com" "User2025!" "User"

echo "🏁 Tests terminés"
