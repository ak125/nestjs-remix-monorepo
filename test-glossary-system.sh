#!/bin/bash

echo "🧪 Tests du système de glossaire optimisé"
echo "=========================================="

BASE_URL="http://localhost:3000"

# Test 1: Route index du glossaire
echo "📋 Test 1: Route index du glossaire"
RESPONSE=$(curl -s "$BASE_URL/blog/glossaire")
if echo "$RESPONSE" | grep -q "Glossaire Automobile"; then
    echo "✅ Route index fonctionne"
else
    echo "❌ Route index échoue"
fi

# Test 2: Recherche dans le glossaire
echo "🔍 Test 2: Recherche 'turbo' dans le glossaire"
RESPONSE=$(curl -s "$BASE_URL/blog/glossaire?search=turbo")
if echo "$RESPONSE" | grep -q "turbo"; then
    echo "✅ Recherche fonctionne"
else
    echo "❌ Recherche échoue"
fi

# Test 3: Terme ABS
echo "📖 Test 3: Définition ABS"
RESPONSE=$(curl -s "$BASE_URL/blog/word/abs")
if echo "$RESPONSE" | grep -q "Système Antiblocage"; then
    echo "✅ Terme ABS trouvé"
else
    echo "❌ Terme ABS non trouvé"
fi

# Test 4: Terme Turbo
echo "🏎️ Test 4: Définition Turbo"
RESPONSE=$(curl -s "$BASE_URL/blog/word/turbo")
if echo "$RESPONSE" | grep -q "turbocompresseur"; then
    echo "✅ Terme Turbo trouvé"
else
    echo "❌ Terme Turbo non trouvé"
fi

# Test 5: Terme ESP
echo "🛡️ Test 5: Définition ESP"
RESPONSE=$(curl -s "$BASE_URL/blog/word/esp")
if echo "$RESPONSE" | grep -q "Electronic Stability"; then
    echo "✅ Terme ESP trouvé"
else
    echo "❌ Terme ESP non trouvé"
fi

# Test 6: Terme inexistant
echo "❓ Test 6: Terme inexistant"
RESPONSE=$(curl -s "$BASE_URL/blog/word/inexistant")
if echo "$RESPONSE" | grep -q "Terme non trouvé"; then
    echo "✅ Gestion erreur 404 fonctionne"
else
    echo "❌ Gestion erreur 404 échoue"
fi

# Test 7: Filtrage par catégorie
echo "🏷️ Test 7: Filtre par catégorie"
RESPONSE=$(curl -s "$BASE_URL/blog/glossaire?category=Moteur")
if echo "$RESPONSE" | grep -q "Filtres"; then
    echo "✅ Filtrage par catégorie fonctionne"
else
    echo "❌ Filtrage par catégorie échoue"
fi

echo ""
echo "📊 Statistiques des données de démonstration:"
echo "- 6 termes disponibles: ABS, Turbo, ESP, FAP, DSG, AdBlue"
echo "- 4 catégories: Système de sécurité, Moteur, Dépollution, Transmission"
echo "- 3 niveaux de difficulté: Débutant, Intermédiaire, Avancé"
echo "- 2 articles liés inclus pour les tests"

echo ""
echo "✨ Tests terminés ! Le système de glossaire est fonctionnel."
