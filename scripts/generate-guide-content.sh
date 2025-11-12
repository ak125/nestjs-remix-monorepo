#!/bin/bash

# Script pour générer tous les mini-contenus du guide d'achat
# Pour chaque étape et chaque gamme

API_URL="http://localhost:3000/api/ai-content/generate"

echo "🚀 Génération des contenus du guide d'achat..."
echo ""

# ====================================
# ÉTAPE 1 : COMPATIBILITÉ
# ====================================
echo "📋 ÉTAPE 1 - Vérifiez la compatibilité"
echo "======================================="

CONTENT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generic",
    "prompt": "En 2 phrases courtes (30-40 mots max), explique comment vérifier la compatibilité : sélecteur en ligne + type mine carte grise + certif R90",
    "tone": "friendly",
    "language": "fr",
    "maxLength": 120
  }' | jq -r '.content')

echo "$CONTENT"
echo ""
echo "---"
echo ""

# ====================================
# ÉTAPE 2 : GAMMES
# ====================================
echo "🏆 ÉTAPE 2 - Choisissez votre gamme"
echo "======================================="
echo ""

# GAMME ÉCONOMIQUE
echo "🥉 ÉCONOMIQUE - Usage urbain modéré"
CONTENT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generic",
    "prompt": "En 1-2 phrases (25-35 mots), décris la gamme économique : prix attractif, usage modéré quotidien, fiabilité assurée",
    "tone": "professional",
    "language": "fr",
    "maxLength": 100
  }' | jq -r '.content')

echo "$CONTENT"
echo ""

# GAMME QUALITÉ+
echo "🥈 QUALITÉ+ - Usage mixte recommandé"
CONTENT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generic",
    "prompt": "En 1-2 phrases (25-35 mots), décris la gamme qualité+ : meilleur équilibre, choix populaire, ville et route",
    "tone": "professional",
    "language": "fr",
    "maxLength": 100
  }' | jq -r '.content')

echo "$CONTENT"
echo ""

# GAMME PREMIUM
echo "🥇 PREMIUM - Performances maximales"
CONTENT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generic",
    "prompt": "En 1-2 phrases (25-35 mots), décris la gamme premium : technologies avancées, durée de vie maximale, performances optimales",
    "tone": "professional",
    "language": "fr",
    "maxLength": 100
  }' | jq -r '.content')

echo "$CONTENT"
echo ""
echo "---"
echo ""

# ====================================
# ÉTAPE 3 : SÉCURITÉ
# ====================================
echo "⚠️  ÉTAPE 3 - Sécurité essentielle"
echo "======================================="

CONTENT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generic",
    "prompt": "En 2 phrases courtes (30-40 mots), explique les règles de sécurité : changement par paire, seuil 3mm, contrôle 20 000 km",
    "tone": "professional",
    "language": "fr",
    "maxLength": 120
  }' | jq -r '.content')

echo "$CONTENT"
echo ""

echo "✅ Génération terminée !"
