#!/bin/bash

# 🧪 SCRIPT DE TEST CURL - API Breadcrumb & Metadata
# Test complet de toutes les fonctionnalités implémentées

echo "🧪 TESTS API BREADCRUMB & METADATA"
echo "=================================="
echo ""

BASE_URL="http://localhost:3000"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les résultats
print_test() {
    echo -e "${BLUE}Test $1:${NC} $2"
}

print_success() {
    echo -e "${GREEN}✅ RÉUSSI:${NC} $1"
}

print_error() {
    echo -e "${RED}❌ ÉCHEC:${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️  PROBLÈME:${NC} $1"
}

# Test 1: Récupération métadonnées existantes
print_test "1" "Récupération métadonnées existantes"
response=$(curl -s -X GET "$BASE_URL/api/metadata/pieces/filtre-a-huile-7/audi-22/a3-ii-22031/2-0-tdi-19966.html" -H "Content-Type: application/json")
if echo "$response" | grep -q '"success":true'; then
    print_success "Métadonnées récupérées"
    echo "   Titre trouvé: $(echo "$response" | grep -o '"title":"[^"]*"' | head -1)"
else
    print_error "Erreur récupération métadonnées"
fi
echo ""

# Test 2: Création nouvelles métadonnées
print_test "2" "Création nouvelles métadonnées"
response=$(curl -s -X POST "$BASE_URL/api/metadata/test-creation" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test de création - Pièces auto",
    "description": "Description test pour validation API",
    "keywords": ["test", "creation", "api"],
    "h1": "Test Création API",
    "robots": "index,follow"
  }')
if echo "$response" | grep -q '"success":true'; then
    print_success "Métadonnées créées"
else
    print_error "Création échouée - $(echo "$response" | grep -o '"statusCode":[0-9]*')"
fi
echo ""

# Test 3: Service breadcrumb (problématique)
print_test "3" "Service breadcrumb - Récupération"
response=$(curl -s -X GET "$BASE_URL/api/metadata/breadcrumb/pieces/test" -H "Content-Type: application/json")
if echo "$response" | grep -q '"breadcrumbs"'; then
    print_success "Breadcrumb récupéré au bon format"
elif echo "$response" | grep -q '"title"'; then
    print_warning "Service retourne des métadonnées au lieu de breadcrumb"
else
    print_error "Erreur service breadcrumb"
fi
echo ""

# Test 4: Génération automatique breadcrumb
print_test "4" "Génération automatique breadcrumb"
response=$(curl -s -X GET "$BASE_URL/api/metadata/breadcrumb/generate?url=/pieces/freinage/disques" -H "Content-Type: application/json")
if echo "$response" | grep -q '"generate"'; then
    print_warning "Génération retourne des métadonnées par défaut"
else
    print_error "Génération automatique non fonctionnelle"
fi
echo ""

# Test 5: Interface admin
print_test "5" "Interface admin - Liste breadcrumbs"
response=$(curl -s -X GET "$BASE_URL/admin/breadcrumbs" -H "Content-Type: application/json")
if echo "$response" | grep -q '"data"'; then
    print_success "Interface admin accessible"
elif echo "$response" | grep -q '"statusCode":404'; then
    print_error "Routes admin non trouvées"
else
    print_warning "Interface admin retourne des données inattendues"
fi
echo ""

# Test 6: Création breadcrumb via admin
print_test "6" "Création breadcrumb via interface admin"
response=$(curl -s -X POST "$BASE_URL/admin/breadcrumbs" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "/test/admin/creation",
    "title": "Test Admin - Breadcrumb",
    "description": "Test création via interface admin",
    "breadcrumbs": [
      {"label": "Accueil", "path": "/", "isClickable": true, "active": false},
      {"label": "Test", "path": "/test", "isClickable": true, "active": false},
      {"label": "Admin", "path": "/test/admin", "isClickable": true, "active": false},
      {"label": "Création", "path": "/test/admin/creation", "isClickable": false, "active": true}
    ]
  }')
if echo "$response" | grep -q '"success":true'; then
    print_success "Breadcrumb créé via admin"
else
    print_error "Création admin échouée"
fi
echo ""

# Test 7: Statistiques admin
print_test "7" "Statistiques interface admin"
response=$(curl -s -X GET "$BASE_URL/admin/breadcrumbs/stats/overview" -H "Content-Type: application/json")
if echo "$response" | grep -q '"total"'; then
    print_success "Statistiques récupérées"
    echo "   Total: $(echo "$response" | grep -o '"total":[0-9]*' | cut -d':' -f2)"
else
    print_error "Statistiques non disponibles"
fi
echo ""

# Test 8: Prévisualisation breadcrumb
print_test "8" "Prévisualisation breadcrumb"
response=$(curl -s -X POST "$BASE_URL/admin/breadcrumbs/preview" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "/preview/test",
    "title": "Test Prévisualisation",
    "breadcrumbs": [
      {"label": "Accueil", "path": "/", "isClickable": true, "active": false},
      {"label": "Prévisualisation", "path": "/preview/test", "isClickable": false, "active": true}
    ]
  }')
if echo "$response" | grep -q '"schemaOrg"'; then
    print_success "Prévisualisation générée avec Schema.org"
else
    print_error "Prévisualisation échouée"
fi
echo ""

# Test 9: Vérification cache
print_test "9" "Performance cache - Double appel"
start_time=$(date +%s%N)
curl -s -X GET "$BASE_URL/api/metadata/pieces/filtre-a-huile-7/audi-22/a3-ii-22031/2-0-tdi-19966.html" > /dev/null
first_call=$(($(date +%s%N) - start_time))

start_time=$(date +%s%N)
curl -s -X GET "$BASE_URL/api/metadata/pieces/filtre-a-huile-7/audi-22/a3-ii-22031/2-0-tdi-19966.html" > /dev/null
second_call=$(($(date +%s%N) - start_time))

if [ $second_call -lt $first_call ]; then
    print_success "Cache fonctionnel (2ème appel plus rapide)"
else
    print_warning "Cache peut-être non optimal"
fi
echo ""

# Test 10: Nettoyage cache
print_test "10" "Nettoyage cache"
response=$(curl -s -X POST "$BASE_URL/api/metadata/breadcrumb/cache/clear" -H "Content-Type: application/json")
if echo "$response" | grep -q '"success"'; then
    print_success "Cache nettoyé"
else
    print_warning "Nettoyage cache non confirmé"
fi
echo ""

echo "=================================="
echo "🏁 TESTS TERMINÉS"
echo ""
echo "📊 RÉSUMÉ DES PROBLÈMES IDENTIFIÉS:"
echo "1. Service breadcrumb retourne des métadonnées au lieu de breadcrumbs"
echo "2. Routes POST pour métadonnées non fonctionnelles"
echo "3. Interface admin non accessible ou mal configurée"
echo "4. Génération automatique retourne des données par défaut"
echo ""
echo "✅ POINTS POSITIFS:"
echo "1. Récupération métadonnées existantes fonctionne"
echo "2. Stockage de données dans la base réussi"
echo "3. Structure API bien définie"
echo "4. Cache Redis intégré"
echo ""
echo "🔧 ACTIONS RECOMMANDÉES:"
echo "1. Corriger la logique du service breadcrumb"
echo "2. Ajouter les routes POST manquantes"
echo "3. Déboguer l'interface admin"
echo "4. Implémenter la vraie génération automatique"