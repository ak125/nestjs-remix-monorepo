#!/bin/bash
# Test du groupement Avant/Arrière avec pieces_relation_criteria

echo "🧪 Test du groupement par position (pieces_relation_criteria)"
echo "=============================================================="

curl -s http://localhost:3000/api/catalog/batch-loader \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"typeId":18376,"gammeId":402,"marqueId":22,"modeleId":22040}' \
  | jq '{
    groupes: [.grouped_pieces[] | {
      titre: .title_h2,
      pieces: (.pieces | length),
      exemples: [.pieces[0:2][] | {id, nom}]
    }],
    total: (.grouped_pieces | map(.pieces | length) | add),
    stats: {
      avec_position: ((.grouped_pieces[] | select(.title_h2 | contains("Avant") or contains("Arrière")) | .pieces | length) // 0),
      sans_position: ((.grouped_pieces[] | select(.title_h2 == "Plaquettes de frein") | .pieces | length) // 0)
    }
  }'

echo ""
echo "✅ Test terminé"
