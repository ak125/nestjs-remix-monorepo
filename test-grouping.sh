#!/bin/bash

# 🧪 Test du groupement Avant/Arrière
# Vérifie si la détection multi-critères fonctionne

echo "🧪 Test du groupement par position"
echo "=================================="
echo ""

# Attendre que le serveur soit prêt
echo "⏳ Vérification du serveur..."
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "❌ Serveur non disponible sur http://localhost:3000"
  echo "   Démarrez le serveur avec: cd backend && npm run start:dev"
  exit 1
fi

echo "✅ Serveur OK"
echo ""

# Appeler l'API
echo "📡 Appel API batch-loader..."
RESPONSE=$(curl -s http://localhost:3000/api/catalog/batch-loader \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"typeId":18376,"gammeId":402,"marqueId":22,"modeleId":22040}')

# Extraire les résultats
COUNT=$(echo "$RESPONSE" | jq -r '.count')
GROUPS=$(echo "$RESPONSE" | jq -r '.grouped_pieces[] | "\(.title_h2): \(.pieces | length) pièces"')

echo ""
echo "📊 Résultats:"
echo "============="
echo "Total pièces: $COUNT"
echo ""
echo "Groupes:"
echo "$GROUPS"
echo ""

# Compter les groupes
NUM_GROUPS=$(echo "$RESPONSE" | jq -r '.grouped_pieces | length')
HAS_AVANT=$(echo "$RESPONSE" | jq -r '.grouped_pieces[] | select(.title_h2 | contains("Avant")) | .title_h2' | wc -l)
HAS_ARRIERE=$(echo "$RESPONSE" | jq -r '.grouped_pieces[] | select(.title_h2 | contains("Arrière")) | .title_h2' | wc -l)

echo "🔍 Analyse:"
echo "==========="
echo "Nombre de groupes: $NUM_GROUPS"
echo "Groupes 'Avant': $HAS_AVANT"
echo "Groupes 'Arrière': $HAS_ARRIERE"
echo ""

# Vérification
if [ "$HAS_AVANT" -gt 0 ] && [ "$HAS_ARRIERE" -gt 0 ]; then
  echo "✅ SUCCÈS: Les groupes Avant/Arrière sont présents !"
else
  echo "⚠️  ATTENTION: Groupes Avant ou Arrière manquants"
  echo ""
  echo "Détails des critères de la première pièce:"
  echo "$RESPONSE" | jq '.grouped_pieces[0].pieces[0].criterias_techniques[0:3]'
fi

echo ""
echo "=================================="
