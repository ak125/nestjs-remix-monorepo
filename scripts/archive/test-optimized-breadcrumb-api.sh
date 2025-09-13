#!/bin/bash

# 🧪 Test du service OptimizedBreadcrumbService
echo "🧪 Tests OptimizedBreadcrumbService - API Breadcrumb"
echo "=================================================="

# Configuration
API_BASE="http://localhost:3000"
TEST_PATH="products/brake-pads/premium"

echo ""
echo "1️⃣ Test API Breadcrumb - Récupération"
echo "----------------------------------------"
curl -s -X GET "${API_BASE}/api/breadcrumb/${TEST_PATH}?lang=fr" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "2️⃣ Test API Breadcrumb - Schema.org"
echo "-------------------------------------"
curl -s -X GET "${API_BASE}/api/breadcrumb/schema/${TEST_PATH}?lang=fr" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "3️⃣ Test API Breadcrumb - Configuration"
echo "---------------------------------------"
curl -s -X GET "${API_BASE}/api/breadcrumb/config?lang=fr" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "4️⃣ Test API Breadcrumb - Mise à jour"
echo "-------------------------------------"
curl -s -X POST "${API_BASE}/api/breadcrumb/${TEST_PATH}" \
  -H "Content-Type: application/json" \
  -d '{
    "breadcrumbs": [
      {"label": "Accueil", "path": "/", "active": false},
      {"label": "Produits", "path": "/products", "active": false},
      {"label": "Freinage", "path": "/products/brake-pads", "active": false},
      {"label": "Premium", "path": "/products/brake-pads/premium", "active": true}
    ]
  }' | jq '.'

echo ""
echo "5️⃣ Test API Breadcrumb - Validation après mise à jour"
echo "-------------------------------------------------------"
curl -s -X GET "${API_BASE}/api/breadcrumb/${TEST_PATH}?lang=fr" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "6️⃣ Test API Breadcrumb - Nettoyage cache"
echo "-----------------------------------------"
curl -s -X POST "${API_BASE}/api/breadcrumb/cache/clear" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "7️⃣ Test API Metadata - Récupération"  
echo "------------------------------------"
curl -s -X GET "${API_BASE}/api/metadata/${TEST_PATH}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "✅ Tests terminés!"
echo "=================="
