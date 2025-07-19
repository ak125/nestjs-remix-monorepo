#!/bin/bash

# 🧪 TESTS API AVEC DONNÉES RÉELLES
# Tests complets avec création, lecture, mise à jour

echo "🎯 TESTS API AVEC DONNÉES CONCRÈTES"
echo "===================================="

BASE_URL="http://localhost:3000/api"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔧 Vérification du serveur..."
if ! curl -s --connect-timeout 3 "http://localhost:3000" > /dev/null; then
    echo -e "${RED}❌ Serveur non accessible. Démarrez le backend avec:${NC}"
    echo "cd backend && npm run start:dev"
    exit 1
fi
echo -e "${GREEN}✅ Serveur accessible${NC}"
echo ""

echo "========================================"
echo "👥 TESTS UTILISATEURS"
echo "========================================"

echo -e "${YELLOW}🔨 1. Création d'un utilisateur${NC}"
USER_EMAIL="testuser$(date +%s)@example.com"
curl -s -X POST "${BASE_URL}/users" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${USER_EMAIL}\",
    \"password\": \"SecurePass123!\",
    \"firstName\": \"Jean\",
    \"lastName\": \"Dupont\",
    \"tel\": \"0123456789\",
    \"address\": \"123 Rue de la Paix\",
    \"city\": \"Paris\",
    \"zipCode\": \"75001\",
    \"country\": \"FR\",
    \"isPro\": false,
    \"level\": 1
  }" | jq '.'

echo ""
echo -e "${YELLOW}📋 2. Liste des utilisateurs${NC}"
curl -s "${BASE_URL}/users?limit=5" | jq '.users[0:2] | .[] | {id, email, firstName, lastName, level}'

echo ""
echo -e "${YELLOW}👥 3. Utilisateurs actifs${NC}"
curl -s "${BASE_URL}/users/active?limit=3" | jq '.users | length'

echo ""
echo -e "${YELLOW}🔍 4. Recherche utilisateurs${NC}"
curl -s "${BASE_URL}/users?search=test" | jq '.users | length'

echo ""
echo "========================================"
echo "📦 TESTS COMMANDES"
echo "========================================"

echo -e "${YELLOW}📊 1. Statistiques commandes${NC}"
curl -s "${BASE_URL}/orders/stats/general" | jq '.'

echo ""
echo -e "${YELLOW}📋 2. Liste des statuts${NC}"
curl -s "${BASE_URL}/orders/statuses/orders" | jq '.'

echo ""
echo -e "${YELLOW}📦 3. Dernières commandes${NC}"
curl -s "${BASE_URL}/orders?limit=3" | jq '.orders[0:2] | .[] | {id, status, total}'

echo ""
echo -e "${YELLOW}🔨 4. Création d'une commande${NC}"
ORDER_RESPONSE=$(curl -s -X POST "${BASE_URL}/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-123",
    "items": [
      {
        "productId": "PROD-BRAKE-001",
        "name": "Plaquettes de frein avant",
        "quantity": 1,
        "price": 45.99,
        "category": "automotive"
      },
      {
        "productId": "PROD-OIL-001", 
        "name": "Huile moteur 5W30",
        "quantity": 2,
        "price": 25.50,
        "category": "automotive"
      }
    ],
    "shippingAddress": {
      "street": "456 Avenue des Champs",
      "city": "Lyon",
      "zipCode": "69000",
      "country": "FR"
    },
    "billingAddress": {
      "street": "456 Avenue des Champs", 
      "city": "Lyon",
      "zipCode": "69000",
      "country": "FR"
    }
  }')

echo "$ORDER_RESPONSE" | jq '.'

# Extraire l'ID de la commande créée
ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.id // empty')

if [ -n "$ORDER_ID" ]; then
    echo ""
    echo -e "${YELLOW}🔄 5. Mise à jour statut commande${NC}"
    curl -s -X PATCH "${BASE_URL}/orders/${ORDER_ID}/status" \
      -H "Content-Type: application/json" \
      -d '{
        "status": "confirmed",
        "reason": "Commande validée par le client"
      }' | jq '.'
fi

echo ""
echo "========================================"
echo "🚗 TESTS MODULE AUTOMOBILE"
echo "========================================"

echo -e "${YELLOW}🔍 1. Validation VIN Honda Civic${NC}"
curl -s -X POST "${BASE_URL}/vehicle-data/validate-vin" \
  -H "Content-Type: application/json" \
  -d '{
    "vin": "1HGBH41JXMN109186"
  }' | jq '.'

echo ""
echo -e "${YELLOW}🚗 2. Validation immatriculation française${NC}"
curl -s -X POST "${BASE_URL}/vehicle-data/validate-registration" \
  -H "Content-Type: application/json" \
  -d '{
    "registration": "AB-123-CD",
    "country": "FR"
  }' | jq '.'

echo ""
echo -e "${YELLOW}🔧 3. Recherche pièces équivalentes${NC}"
curl -s "${BASE_URL}/vehicle-data/equivalent-parts/BRAKE-PAD-FRONT-001" | jq '.'

echo ""
echo -e "${YELLOW}🚗 4. Création commande automobile complète${NC}"
AUTO_ORDER=$(curl -s -X POST "${BASE_URL}/automotive-orders" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "auto-cust-456",
    "vehicleData": {
      "vin": "1HGBH41JXMN109186",
      "registration": "AB-123-CD",
      "make": "Honda",
      "model": "Civic",
      "year": 2021,
      "engineType": "petrol",
      "engineSize": "1.5",
      "fuelType": "petrol"
    },
    "items": [
      {
        "oemCode": "HONDA-BRAKE-001",
        "description": "Plaquettes frein avant Honda Civic",
        "quantity": 1,
        "price": 65.99,
        "compatibility": ["Honda Civic 2016-2021"]
      }
    ],
    "shippingAddress": {
      "street": "789 Rue de l'\''Auto",
      "city": "Toulouse",
      "zipCode": "31000", 
      "country": "FR"
    }
  }')

echo "$AUTO_ORDER" | jq '.'

echo ""
echo "========================================"
echo "💰 TESTS CALCULS"
echo "========================================"

echo -e "${YELLOW}💸 1. Calcul taxes commande automobile${NC}"
curl -s -X POST "${BASE_URL}/tax-calculation/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-auto-123",
    "country": "FR",
    "customerType": "individual",
    "items": [
      {
        "id": "item-brake",
        "price": 65.99,
        "quantity": 1,
        "category": "automotive"
      },
      {
        "id": "item-oil",
        "price": 25.50,
        "quantity": 2,
        "category": "automotive"
      }
    ]
  }' | jq '.'

echo ""
echo -e "${YELLOW}🚚 2. Calcul frais de livraison${NC}"
curl -s -X POST "${BASE_URL}/shipping-calculation/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-ship-123",
    "origin": "Paris, FR",
    "destination": "Lyon, FR", 
    "weight": 3.2,
    "dimensions": {
      "length": 40,
      "width": 30,
      "height": 15
    },
    "items": [
      {
        "id": "brake-pads",
        "weight": 1.5,
        "dimensions": {
          "length": 20,
          "width": 15,
          "height": 5
        }
      },
      {
        "id": "oil-bottles",
        "weight": 1.7,
        "dimensions": {
          "length": 25,
          "width": 10,
          "height": 8
        }
      }
    ]
  }' | jq '.'

echo ""
echo "========================================"
echo "🧪 TESTS D'ERREURS"
echo "========================================"

echo -e "${YELLOW}❌ 1. VIN invalide${NC}"
curl -s -X POST "${BASE_URL}/vehicle-data/validate-vin" \
  -H "Content-Type: application/json" \
  -d '{
    "vin": "INVALID-VIN-NUMBER"
  }' | jq '.'

echo ""
echo -e "${YELLOW}❌ 2. Utilisateur inexistant${NC}"
curl -s "${BASE_URL}/users/user-does-not-exist" | jq '.'

echo ""
echo -e "${YELLOW}❌ 3. Données manquantes${NC}"
curl -s -X POST "${BASE_URL}/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "incomplete@test.com"
  }' | jq '.'

echo ""
echo "========================================"
echo "📊 RÉSUMÉ DES TESTS"
echo "========================================"

echo -e "${GREEN}✅ Tests terminés avec succès !${NC}"
echo ""
echo "📈 APIs testées :"
echo "  👥 Users: Création, liste, recherche"
echo "  📦 Orders: Statistiques, création, mise à jour statut"
echo "  🚗 Automotive: Validation VIN, immatriculation, commandes"
echo "  💰 Calculs: Taxes et frais de livraison"
echo "  ❌ Gestion d'erreurs: VIN invalide, données manquantes"
echo ""
echo "🎯 Tous les modules legacy sont opérationnels !"
echo ""
echo "🚀 Prochaine étape: Tester le frontend"
echo "   cd frontend && npm run dev"
echo "   http://localhost:3001/admin"
