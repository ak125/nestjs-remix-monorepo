#!/bin/bash

# 🔍 Analyse détaillée d'une pièce sans position
# Pour comprendre pourquoi certaines pièces ne sont pas groupées

echo "🔍 Analyse d'une pièce sans position détectée"
echo "=============================================="
echo ""

# Appeler l'API
RESPONSE=$(curl -s http://localhost:3000/api/catalog/batch-loader \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"typeId":18376,"gammeId":402,"marqueId":22,"modeleId":22040}')

# Trouver le groupe sans position (titre sans Avant/Arrière)
GROUP_INDEX=$(echo "$RESPONSE" | jq -r '.grouped_pieces | to_entries[] | select(.value.title_h2 == "Plaquettes de frein") | .key')

if [ -z "$GROUP_INDEX" ]; then
  echo "✅ Aucun groupe 'Plaquettes de frein' sans position trouvé !"
  echo "   Tous les groupes ont une position détectée."
  exit 0
fi

echo "Analyse du groupe: Plaquettes de frein (sans position)"
echo "Nombre de pièces: $(echo "$RESPONSE" | jq ".grouped_pieces[$GROUP_INDEX].pieces | length")"
echo ""

# Analyser les 3 premières pièces
echo "📋 Critères des 3 premières pièces de ce groupe:"
echo "================================================="

for i in 0 1 2; do
  PIECE=$(echo "$RESPONSE" | jq ".grouped_pieces[$GROUP_INDEX].pieces[$i]")
  
  if [ "$PIECE" != "null" ]; then
    PIECE_ID=$(echo "$PIECE" | jq -r '.id')
    PIECE_NAME=$(echo "$PIECE" | jq -r '.nom')
    NUM_CRITERIA=$(echo "$PIECE" | jq '.criterias_techniques | length')
    
    echo ""
    echo "🔧 Pièce #$((i+1)): ID=$PIECE_ID"
    echo "   Nom: $PIECE_NAME"
    echo "   Nombre de critères: $NUM_CRITERIA"
    
    if [ "$NUM_CRITERIA" -eq 0 ]; then
      echo "   ❌ AUCUN critère technique !"
    else
      echo "   Critères:"
      echo "$PIECE" | jq -r '.criterias_techniques[] | "      - \(.criteria): \(.value) \(.unit)"'
      
      # Chercher des mots-clés de position
      HAS_POSITION=$(echo "$PIECE" | jq -r '.criterias_techniques[] | "\(.criteria) \(.value)"' | grep -iE '(avant|arriere|arrière|essieu|gauche|droit|front|rear)' | head -1)
      
      if [ -n "$HAS_POSITION" ]; then
        echo "   🎯 Critère avec position trouvé: $HAS_POSITION"
      else
        echo "   ⚠️  Aucun critère ne contient de mot-clé de position"
      fi
    fi
  fi
done

echo ""
echo "=============================================="
echo ""
echo "💡 Suggestions:"
echo "   1. Si les pièces n'ont AUCUN critère → Problème de chargement"
echo "   2. Si critères présents mais sans position → Utiliser piece_name"
echo "   3. Si position détectée mais pas groupée → Problème de logique"
