#!/bin/bash

# 🧪 SCRIPT DE TEST - VEHICLE SELECTOR MODERNISÉ
# 
# Test automatisé pour valider le VehicleSelector avec les données réelles
# 
# @version 1.0.0
# @since 2025-09-13

echo "🚗 ==============================================="
echo "   TEST VEHICLE SELECTOR MODERNISÉ"  
echo "==============================================="
echo ""

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
FRONTEND_URL="http://localhost:3001"
BACKEND_URL="http://localhost:3000"
TEST_PAGE="/test-vehicle-selector"

# Fonction pour afficher les résultats
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Vérification du backend NestJS
echo "📊 Test 1: Vérification Backend NestJS"
echo "----------------------------------------"

# Test de l'API Brands
print_info "Test API /api/vehicles/brands..."
BRANDS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/vehicles/brands" 2>/dev/null)
if [ "$BRANDS_STATUS" = "200" ]; then
    print_result 0 "API Brands opérationnelle (Status: $BRANDS_STATUS)"
else
    print_result 1 "API Brands non disponible (Status: $BRANDS_STATUS)"
fi

# Test de l'API Models
print_info "Test API /api/vehicles/models..."
MODELS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/vehicles/models?brandId=48&year=1997" 2>/dev/null)
if [ "$MODELS_STATUS" = "200" ]; then
    print_result 0 "API Models opérationnelle (Status: $MODELS_STATUS)"
else
    print_result 1 "API Models non disponible (Status: $MODELS_STATUS)"
fi

# Test de l'API Types
print_info "Test API /api/vehicles/types..."
TYPES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/vehicles/types?modelId=48022" 2>/dev/null)
if [ "$TYPES_STATUS" = "200" ]; then
    print_result 0 "API Types opérationnelle (Status: $TYPES_STATUS)"
else
    print_result 1 "API Types non disponible (Status: $TYPES_STATUS)"
fi

echo ""

# 2. Test des données spécifiques DAEWOO LANOS
echo "🔍 Test 2: Validation Données DAEWOO LANOS"
echo "-------------------------------------------"

# Récupération des données de test
print_info "Récupération des données DAEWOO LANOS..."
DAEWOO_DATA=$(curl -s "${BACKEND_URL}/api/vehicles/brands" 2>/dev/null | grep -i "daewoo" | head -1)
if [ ! -z "$DAEWOO_DATA" ]; then
    print_result 0 "Données DAEWOO trouvées dans l'API"
else
    print_result 1 "Données DAEWOO non trouvées"
fi

# Test des modèles LANOS
print_info "Test modèles LANOS pour DAEWOO (ID: 48)..."
LANOS_DATA=$(curl -s "${BACKEND_URL}/api/vehicles/models?brandId=48" 2>/dev/null | grep -i "lanos")
if [ ! -z "$LANOS_DATA" ]; then
    print_result 0 "Modèle LANOS trouvé pour DAEWOO"
else
    print_result 1 "Modèle LANOS non trouvé"
fi

echo ""

# 3. Test du frontend Remix
echo "🎨 Test 3: Frontend Remix et Page de Test"
echo "------------------------------------------"

# Vérification que le frontend est actif
print_info "Vérification du frontend Remix..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}" 2>/dev/null)
if [ "$FRONTEND_STATUS" = "200" ]; then
    print_result 0 "Frontend Remix opérationnel (Status: $FRONTEND_STATUS)"
else
    print_result 1 "Frontend Remix non disponible (Status: $FRONTEND_STATUS)"
    print_warning "Assurez-vous que 'npm run dev' est lancé dans /frontend"
fi

# Test de la page de test du VehicleSelector
print_info "Test de la page de test VehicleSelector..."
TEST_PAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}${TEST_PAGE}" 2>/dev/null)
if [ "$TEST_PAGE_STATUS" = "200" ]; then
    print_result 0 "Page de test VehicleSelector accessible (Status: $TEST_PAGE_STATUS)"
else
    print_result 1 "Page de test VehicleSelector non accessible (Status: $TEST_PAGE_STATUS)"
fi

echo ""

# 4. Test des composants React
echo "⚛️ Test 4: Composants React VehicleSelector"
echo "--------------------------------------------"

# Vérification de l'existence des fichiers
VEHICLE_SELECTOR_FILE="frontend/app/components/vehicle/VehicleSelector.tsx"
if [ -f "$VEHICLE_SELECTOR_FILE" ]; then
    print_result 0 "Fichier VehicleSelector.tsx présent"
    
    # Vérification du contenu du composant
    if grep -q "interface VehicleBrand" "$VEHICLE_SELECTOR_FILE"; then
        print_result 0 "Interfaces TypeScript définies"
    else
        print_result 1 "Interfaces TypeScript manquantes"
    fi
    
    if grep -q "const BrandSchema = z.object" "$VEHICLE_SELECTOR_FILE"; then
        print_result 0 "Validation Zod implémentée"
    else
        print_result 1 "Validation Zod manquante"
    fi
    
    if grep -q "fetchWithRetry" "$VEHICLE_SELECTOR_FILE"; then
        print_result 0 "Retry logic implémentée"
    else
        print_result 1 "Retry logic manquante"
    fi
    
    if grep -q "gtag" "$VEHICLE_SELECTOR_FILE"; then
        print_result 0 "Analytics Google intégrées"
    else
        print_result 1 "Analytics Google manquantes"
    fi
    
else
    print_result 1 "Fichier VehicleSelector.tsx manquant"
fi

echo ""

# 5. Instructions pour les tests manuels
echo "🧪 Test 5: Instructions Tests Manuels"
echo "--------------------------------------"

print_info "Pour tester manuellement le VehicleSelector modernisé:"
echo ""
echo "1. 🌐 Ouvrez votre navigateur sur: ${FRONTEND_URL}${TEST_PAGE}"
echo ""
echo "2. 🔍 Testez la sélection progressive:"
echo "   • Sélectionnez 'DAEWOO' dans le premier select"
echo "   • Choisissez '1997' dans le select année"
echo "   • Sélectionnez 'LANOS' dans le select modèle"
echo "   • Choisissez '1.3 Essence' dans le select motorisation"
echo ""
echo "3. 🎯 Vérifiez les fonctionnalités:"
echo "   • ✅ Loading spinners pendant les appels API"
echo "   • ✅ Messages d'erreur en cas de problème réseau"
echo "   • ✅ Navigation clavier (Tab, Enter, Échap)"
echo "   • ✅ Responsive design sur mobile/desktop"
echo "   • ✅ Analytics dans la console développeur"
echo ""
echo "4. 🚀 Testez le bouton 'Précharger DAEWOO LANOS':"
echo "   • Le sélecteur doit se remplir automatiquement"
echo "   • Les logs d'activité doivent s'afficher"
echo ""

echo ""

# 6. Résumé final
echo "📋 RÉSUMÉ DES TESTS"
echo "==================="

if [ "$BRANDS_STATUS" = "200" ] && [ "$MODELS_STATUS" = "200" ] && [ "$TYPES_STATUS" = "200" ]; then
    print_result 0 "APIs Backend: Toutes opérationnelles"
else
    print_result 1 "APIs Backend: Certaines non disponibles"
fi

if [ "$FRONTEND_STATUS" = "200" ] && [ "$TEST_PAGE_STATUS" = "200" ]; then
    print_result 0 "Frontend: Opérationnel avec page de test"
else
    print_result 1 "Frontend: Problème d'accessibilité"
fi

if [ -f "$VEHICLE_SELECTOR_FILE" ]; then
    print_result 0 "VehicleSelector: Composant modernisé présent"
else
    print_result 1 "VehicleSelector: Composant manquant"
fi

echo ""
print_info "🎉 Test terminé! VehicleSelector modernisé prêt pour validation manuelle."
print_info "📊 Consultez le rapport détaillé: RAPPORT_VEHICLESELECTOR_MODERNISATION.md"

echo ""
echo "🔗 Liens utiles:"
echo "   • Page de test: ${FRONTEND_URL}${TEST_PAGE}"
echo "   • API Brands: ${BACKEND_URL}/api/vehicles/brands"
echo "   • Documentation: /RAPPORT_VEHICLESELECTOR_MODERNISATION.md"

echo ""
echo "==============================================="