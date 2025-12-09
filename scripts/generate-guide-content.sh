#!/bin/bash

# Script pour gÃ©nÃ©rer tous les mini-contenus du guide d'achat
# Pour chaque Ã©tape et chaque gamme

API_URL="http://localhost:3000/api/ai-content/generate"

echo "ðŸš€ GÃ©nÃ©ration des contenus du guide d'achat..."
echo ""

# ====================================
# Ã‰TAPE 1 : COMPATIBILITÃ‰
# ====================================
echo "ðŸ“‹ Ã‰TAPE 1 - VÃ©rifiez la compatibilitÃ©"
echo "======================================="

CONTENT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generic",
    "prompt": "En 2 phrases courtes (30-40 mots max), explique comment vÃ©rifier la compatibilitÃ© : sÃ©lecteur en ligne + type mine carte grise + certif R90",
    "tone": "friendly",
    "language": "fr",
    "maxLength": 120
  }' | jq -r '.content')

echo "$CONTENT"
echo ""
echo "---"
echo ""

# ====================================
# Ã‰TAPE 2 : GAMMES
# ====================================
echo "ðŸ† Ã‰TAPE 2 - Choisissez votre gamme"
echo "======================================="
echo ""

# GAMME Ã‰CONOMIQUE
echo "ðŸ¥‰ Ã‰CONOMIQUE - Usage urbain modÃ©rÃ©"
CONTENT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generic",
    "prompt": "En 1-2 phrases (25-35 mots), dÃ©cris la gamme Ã©conomique : prix attractif, usage modÃ©rÃ© quotidien, fiabilitÃ© assurÃ©e",
    "tone": "professional",
    "language": "fr",
    "maxLength": 100
  }' | jq -r '.content')

echo "$CONTENT"
echo ""

# GAMME QUALITÃ‰+
echo "ðŸ¥ˆ QUALITÃ‰+ - Usage mixte recommandÃ©"
CONTENT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generic",
    "prompt": "En 1-2 phrases (25-35 mots), dÃ©cris la gamme qualitÃ©+ : meilleur Ã©quilibre, choix populaire, ville et route",
    "tone": "professional",
    "language": "fr",
    "maxLength": 100
  }' | jq -r '.content')

echo "$CONTENT"
echo ""

# GAMME PREMIUM
echo "ðŸ¥‡ PREMIUM - Performances maximales"
CONTENT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generic",
    "prompt": "En 1-2 phrases (25-35 mots), dÃ©cris la gamme premium : technologies avancÃ©es, durÃ©e de vie maximale, performances optimales",
    "tone": "professional",
    "language": "fr",
    "maxLength": 100
  }' | jq -r '.content')

echo "$CONTENT"
echo ""
echo "---"
echo ""

# ====================================
# Ã‰TAPE 3 : SÃ‰CURITÃ‰
# ====================================
echo "âš ï¸  Ã‰TAPE 3 - SÃ©curitÃ© essentielle"
echo "======================================="

CONTENT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generic",
    "prompt": "En 2 phrases courtes (30-40 mots), explique les rÃ¨gles de sÃ©curitÃ© : changement par paire, seuil 3mm, contrÃ´le 20 000 km",
    "tone": "professional",
    "language": "fr",
    "maxLength": 120
  }' | jq -r '.content')

echo "$CONTENT"
echo ""

echo "âœ… GÃ©nÃ©ration terminÃ©e !"
