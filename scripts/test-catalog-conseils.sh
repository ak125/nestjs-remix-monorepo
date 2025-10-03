#!/bin/bash

# Script de test pour vérifier l'intégration des conseils dans la page catalogue

echo "🧪 Test d'intégration des conseils dans la page catalogue"
echo "=========================================================="
echo ""

# Test 1: Vérifier que l'API conseils fonctionne
echo "📡 Test 1: API conseils pour pg_id=247 (support-moteur)"
CONSEIL_RESPONSE=$(curl -s "http://localhost:3000/api/blog/conseil/247")
CONSEIL_COUNT=$(echo "$CONSEIL_RESPONSE" | jq '.data | length')

if [ "$CONSEIL_COUNT" -eq 5 ]; then
  echo "✅ API retourne bien 5 conseils"
  echo "$CONSEIL_RESPONSE" | jq '.data[] | .title' | head -5
else
  echo "❌ Erreur: API retourne $CONSEIL_COUNT conseils au lieu de 5"
  exit 1
fi

echo ""
echo "📝 Conseils récupérés:"
echo "$CONSEIL_RESPONSE" | jq -r '.data[] | "  - \(.title)"'

echo ""
echo "🎨 Structure de la page catalogue:"
echo "URL pattern: /pieces/support-moteur-247/renault-140/clio-i-140002/1-9-d-10318.html"
echo ""
echo "Paramètres extraits:"
echo "  - brand: renault-140"
echo "  - model: clio-i-140002"
echo "  - type: 1-9-d-10318"
echo "  - category: support-moteur-247"
echo "  - pg_id: 247 (extrait de category)"
echo ""

echo "✅ Tous les tests API passent!"
echo ""
echo "📝 Pour tester dans le navigateur:"
echo "   1. Assurez-vous que le frontend tourne (npm run dev)"
echo "   2. Naviguez vers: http://localhost:5173/pieces/support-moteur-247/renault-140/clio-i-140002/filtres.html"
echo "   3. Scrollez en bas de la liste des pièces"
echo "   4. Vous devriez voir 5 sections de conseils avec des couleurs différentes:"
echo "      - Bleu: Rôle d'un support moteur"
echo "      - Orange: Symptômes et pannes, Quand changer"
echo "      - Vert: Démontage, Remontage"
echo ""
