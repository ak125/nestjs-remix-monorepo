#!/bin/bash

# GÃ©nÃ©ration de contenus spÃ©cifiques par type de piÃ¨ce
API_URL="http://localhost:3000/api/ai-content/generate"

# Types de piÃ¨ces
PIECES=(
  "plaquettes de frein"
  "disques de frein"
  "amortisseurs"
  "filtres Ã  air"
  "filtres Ã  huile"
  "balais d'essuie-glace"
  "bougies d'allumage"
)

echo "ðŸ”§ GÃ©nÃ©ration des contenus par type de piÃ¨ce"
echo "============================================="
echo ""

for piece in "${PIECES[@]}"; do
  echo "ðŸ“¦ $piece"
  echo "-------------------"
  
  # Gamme Ã‰conomique
  CONTENU=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"generic\",
      \"prompt\": \"En 1 phrase de 20-30 mots, dÃ©cris la gamme Ã‰CONOMIQUE pour $piece : prix attractif, usage modÃ©rÃ©, fiabilitÃ© quotidienne\",
      \"tone\": \"professional\",
      \"language\": \"fr\",
      \"maxLength\": 80
    }" | jq -r '.content')
  
  echo "ðŸ¥‰ Ã‰conomique: $CONTENU"
  
  # Gamme QualitÃ©+
  CONTENU=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"generic\",
      \"prompt\": \"En 1 phrase de 20-30 mots, dÃ©cris la gamme QUALITÃ‰+ pour $piece : Ã©quilibre optimal, choix populaire, polyvalent\",
      \"tone\": \"professional\",
      \"language\": \"fr\",
      \"maxLength\": 80
    }" | jq -r '.content')
  
  echo "ðŸ¥ˆ QualitÃ©+: $CONTENU"
  
  # Gamme Premium
  CONTENU=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"generic\",
      \"prompt\": \"En 1 phrase de 20-30 mots, dÃ©cris la gamme PREMIUM pour $piece : technologies avancÃ©es, performances maximales, longÃ©vitÃ©\",
      \"tone\": \"professional\",
      \"language\": \"fr\",
      \"maxLength\": 80
    }" | jq -r '.content')
  
  echo "ðŸ¥‡ Premium: $CONTENU"
  echo ""
  
  # Pause pour Ã©viter le rate limiting
  sleep 2
done

echo "âœ… GÃ©nÃ©ration terminÃ©e pour toutes les piÃ¨ces !"
