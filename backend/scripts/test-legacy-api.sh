#!/bin/bash

echo "🧪 Test API Legacy - Connexion Directe aux Tables"
echo "================================================="

BASE_URL="http://localhost:3000"

# Vérifier que le serveur fonctionne
echo -e "\n🔌 Test connexion serveur..."
curl -s "$BASE_URL/api/health" | jq '.' || echo "❌ Serveur non accessible"

# Test Users API
echo -e "\n👤 Test API Users:"
echo "1. GET /api/users (pagination)"
curl -s "$BASE_URL/api/users?page=1&limit=5" | jq '.data[0:2]'

echo -e "\n2. GET /api/users/:id (détail utilisateur)"
curl -s "$BASE_URL/api/users/2" | jq '.data'

echo -e "\n3. GET /api/users/search (recherche)"
curl -s "$BASE_URL/api/users/search?q=BISOU" | jq '.data'

echo -e "\n4. GET /api/users/:id/orders (commandes utilisateur)"
curl -s "$BASE_URL/api/users/80001/orders" | jq '.data[0:2]'

# Test Orders API
echo -e "\n📦 Test API Orders:"
echo "1. GET /api/orders (toutes les commandes)"
curl -s "$BASE_URL/api/orders?page=1&limit=3" | jq '.data'

echo -e "\n2. GET /api/orders/:id (détail commande)"
curl -s "$BASE_URL/api/orders/277001" | jq '.data'

echo -e "\n3. GET /api/orders/stats (statistiques)"
curl -s "$BASE_URL/api/orders/stats" | jq '.data'

echo -e "\n4. GET /api/orders?userId=80001 (commandes par utilisateur)"
curl -s "$BASE_URL/api/orders?userId=80001&limit=3" | jq '.data'

echo -e "\n✅ Tests terminés!"
echo -e "\n💡 URLs disponibles:"
echo "   - http://localhost:3000/api/users"
echo "   - http://localhost:3000/api/orders"
echo "   - http://localhost:3000/api/users/search?q=terme"
echo "   - http://localhost:3000/api/orders/stats"
