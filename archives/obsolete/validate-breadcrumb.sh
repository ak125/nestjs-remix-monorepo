#!/bin/bash

# 🧪 Script de validation du fil d'ariane Schema.org

echo "🍞 Validation du fil d'ariane (Breadcrumb)"
echo "=========================================="
echo ""

# URL à tester (remplacer par votre URL de production)
URL="${1:-http://localhost:3000/constructeurs/bmw-33/serie-1-f20-33019/2-0-118-d-5671.html}"

echo "🔍 URL testée: $URL"
echo ""

# 1. Extraire le JSON-LD
echo "📊 Extraction du JSON-LD Schema.org..."
SCHEMA=$(curl -s "$URL" | grep -oP '(?<=<script type="application/ld\+json">).*?(?=</script>)' | jq '.')

if [ -z "$SCHEMA" ]; then
    echo "❌ Aucun schema JSON-LD trouvé"
    exit 1
fi

echo "✅ Schema trouvé:"
echo "$SCHEMA"
echo ""

# 2. Valider la structure
echo "🔍 Validation de la structure..."

# Vérifier le type
TYPE=$(echo "$SCHEMA" | jq -r '.["@type"]')
if [ "$TYPE" != "BreadcrumbList" ]; then
    echo "❌ Type incorrect: $TYPE (attendu: BreadcrumbList)"
    exit 1
fi
echo "✅ Type correct: BreadcrumbList"

# Vérifier le contexte
CONTEXT=$(echo "$SCHEMA" | jq -r '.["@context"]')
if [ "$CONTEXT" != "https://schema.org" ]; then
    echo "❌ Contexte incorrect: $CONTEXT"
    exit 1
fi
echo "✅ Contexte correct: https://schema.org"

# Compter les éléments
ITEMS_COUNT=$(echo "$SCHEMA" | jq '.itemListElement | length')
echo "✅ Nombre d'éléments: $ITEMS_COUNT"

# Valider chaque élément
echo ""
echo "🔍 Validation des éléments..."
for i in $(seq 0 $((ITEMS_COUNT - 1))); do
    ITEM=$(echo "$SCHEMA" | jq ".itemListElement[$i]")
    POSITION=$(echo "$ITEM" | jq -r '.position')
    NAME=$(echo "$ITEM" | jq -r '.name')
    ITEM_URL=$(echo "$ITEM" | jq -r '.item // "N/A"')
    
    echo "  [$POSITION] $NAME"
    if [ "$ITEM_URL" != "N/A" ]; then
        echo "      → $ITEM_URL"
    fi
done

echo ""
echo "🎉 Validation terminée avec succès!"
echo ""

# 3. Tester avec Google Rich Results (optionnel)
echo "🌐 Pour tester avec Google Rich Results Test:"
echo "   https://search.google.com/test/rich-results?url=$(echo $URL | jq -sRr @uri)"
echo ""

# 4. Suggestions
echo "💡 Suggestions:"
echo "   - Vérifier dans Google Search Console après indexation"
echo "   - Tester avec différents navigateurs"
echo "   - Valider avec https://validator.schema.org/"
