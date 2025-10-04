#!/bin/bash

echo "🧪 Test de l'upgrade automatique de mot de passe"
echo ""

# Test avec superadmin (MD5)
echo "1️⃣  Login avec superadmin@autoparts.com (MD5 legacy)..."
curl -s -X POST http://localhost:3000/authenticate \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@autoparts.com","password":"admin123"}' \
  -c /tmp/cookies-test.txt \
  -i 2>&1 | grep -E "HTTP|Set-Cookie" | head -3

echo ""
echo "2️⃣  Vérification dans les logs du serveur..."
echo "   Recherchez : '🔄 Auto-upgrading password hash for user: superadmin@autoparts.com'"
echo ""

# Second login pour vérifier que le hash a bien été upgradé
echo "3️⃣  Second login pour vérifier l'upgrade..."
sleep 1
curl -s -X POST http://localhost:3000/authenticate \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@autoparts.com","password":"admin123"}' \
  -c /tmp/cookies-test2.txt \
  -i 2>&1 | grep -E "HTTP|Set-Cookie" | head -3

echo ""
echo "✅ Tests terminés - Vérifiez les logs du serveur backend"
