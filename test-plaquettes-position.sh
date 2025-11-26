#!/bin/bash
# Test: Toutes les plaquettes doivent avoir une position (Avant ou Arrière)
# Les pièces MGA doivent être correctement séparées

echo "🧪 TEST: Positions des plaquettes de frein + Vérification MGA"
echo "=============================================================="

# Test avec plusieurs véhicules
for TYPE_ID in 18376 18375 25454; do
  echo ""
  echo "📊 Véhicule typeId=$TYPE_ID"
  echo "----------------------------"
  
  RESULT=$(curl -s http://localhost:3000/api/catalog/batch-loader \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"typeId\":$TYPE_ID,\"gammeId\":402}")
  
  TOTAL=$(echo "$RESULT" | jq -r '.pieces | length')
  AVANT=$(echo "$RESULT" | jq -r '[.grouped_pieces[] | select(.title_h2 | contains("Avant"))] | map(.pieces | length) | add // 0')
  ARRIERE=$(echo "$RESULT" | jq -r '[.grouped_pieces[] | select(.title_h2 | contains("Arrière"))] | map(.pieces | length) | add // 0')
  SANS_POS=$(echo "$RESULT" | jq -r '[.grouped_pieces[] | select(.title_h2 | contains("Avant") or contains("Arrière") | not)] | map(.pieces | length) | add // 0')
  
  echo "  Total pièces: $TOTAL"
  echo "  Avant: $AVANT"
  echo "  Arrière: $ARRIERE"
  echo "  Sans position: $SANS_POS"
  
  if [ "$SANS_POS" -eq 0 ]; then
    echo "  ✅ OK: Toutes les pièces ont une position"
  else
    echo "  ❌ ERREUR: $SANS_POS pièces sans position!"
    exit 1
  fi
  
  # Vérification spéciale pour typeId=25454 (pièces MGA)
  if [ "$TYPE_ID" = "25454" ]; then
    MGA_931_GROUPE=$(echo "$RESULT" | jq -r '.grouped_pieces[] | select(.pieces[] | select(.reference == "931")) | .title_h2')
    MGA_932_GROUPE=$(echo "$RESULT" | jq -r '.grouped_pieces[] | select(.pieces[] | select(.reference == "932")) | .title_h2')
    
    echo "  🔍 MGA 931: $MGA_931_GROUPE"
    echo "  🔍 MGA 932: $MGA_932_GROUPE"
    
    if [[ "$MGA_931_GROUPE" == *"Avant"* ]] && [[ "$MGA_932_GROUPE" == *"Arrière"* ]]; then
      echo "  ✅ OK: MGA 931 (Avant) et 932 (Arrière) bien séparées"
    else
      echo "  ❌ ERREUR: MGA mal positionnées!"
      exit 1
    fi
  fi
done

echo ""
echo "=============================================================="
echo "✅ TOUS LES TESTS PASSENT"
echo "=============================================================="
