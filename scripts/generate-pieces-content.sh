#!/bin/bash

# Génération de contenus spécifiques par type de pièce
API_URL="http://localhost:3000/api/ai-content/generate"

# Types de pièces
PIECES=(
  "plaquettes de frein"
  "disques de frein"
  "amortisseurs"
  "filtres à air"
  "filtres à huile"
  "balais d'essuie-glace"
  "bougies d'allumage"
)

echo "🔧 Génération des contenus par type de pièce"
echo "============================================="
echo ""

for piece in "${PIECES[@]}"; do
  echo "📦 $piece"
  echo "-------------------"
  
  # Gamme Économique
  CONTENU=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"generic\",
      \"prompt\": \"En 1 phrase de 20-30 mots, décris la gamme ÉCONOMIQUE pour $piece : prix attractif, usage modéré, fiabilité quotidienne\",
      \"tone\": \"professional\",
      \"language\": \"fr\",
      \"maxLength\": 80
    }" | jq -r '.content')
  
  echo "🥉 Économique: $CONTENU"
  
  # Gamme Qualité+
  CONTENU=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"generic\",
      \"prompt\": \"En 1 phrase de 20-30 mots, décris la gamme QUALITÉ+ pour $piece : équilibre optimal, choix populaire, polyvalent\",
      \"tone\": \"professional\",
      \"language\": \"fr\",
      \"maxLength\": 80
    }" | jq -r '.content')
  
  echo "🥈 Qualité+: $CONTENU"
  
  # Gamme Premium
  CONTENU=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"generic\",
      \"prompt\": \"En 1 phrase de 20-30 mots, décris la gamme PREMIUM pour $piece : technologies avancées, performances maximales, longévité\",
      \"tone\": \"professional\",
      \"language\": \"fr\",
      \"maxLength\": 80
    }" | jq -r '.content')
  
  echo "🥇 Premium: $CONTENU"
  echo ""
  
  # Pause pour éviter le rate limiting
  sleep 2
done

echo "✅ Génération terminée pour toutes les pièces !"
