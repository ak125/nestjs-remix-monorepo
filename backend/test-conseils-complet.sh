#!/bin/bash

# 🧪 Script de test complet du système de conseils

echo "🔍 Test du système de conseils de remplacement"
echo "=============================================="
echo ""

# 1. Test backend - Endpoint conseils
echo "1️⃣  Test endpoint /api/blog/conseil/247"
echo "-------------------------------------------"
CONSEIL_RESPONSE=$(curl -s http://localhost:3000/api/blog/conseil/247)
CONSEIL_COUNT=$(echo "$CONSEIL_RESPONSE" | jq '.data | length')
echo "✅ Nombre de conseils récupérés: $CONSEIL_COUNT"
echo "$CONSEIL_RESPONSE" | jq '.data[].title'
echo ""

# 2. Test backend - Article avec pg_id
echo "2️⃣  Test article by-gamme avec pg_id"
echo "-------------------------------------------"
ARTICLE_RESPONSE=$(curl -s http://localhost:3000/api/blog/article/by-gamme/support-moteur)
ARTICLE_PG_ID=$(echo "$ARTICLE_RESPONSE" | jq -r '.data.pg_id')
echo "✅ Article pg_id: $ARTICLE_PG_ID"
echo "✅ Article slug: $(echo "$ARTICLE_RESPONSE" | jq -r '.data.slug')"
echo "✅ Article title: $(echo "$ARTICLE_RESPONSE" | jq -r '.data.title')"
echo ""

# 3. Test backend - SEO switches
echo "3️⃣  Test SEO switches"
echo "-------------------------------------------"
SWITCHES_RESPONSE=$(curl -s http://localhost:3000/api/blog/seo-switches/247)
SWITCHES_COUNT=$(echo "$SWITCHES_RESPONSE" | jq '.data | length')
echo "✅ Nombre de switches SEO: $SWITCHES_COUNT"
echo ""

# 4. Résumé
echo "📊 RÉSUMÉ"
echo "=============================================="
if [ "$CONSEIL_COUNT" -eq 5 ] && [ "$ARTICLE_PG_ID" = "247" ] && [ "$SWITCHES_COUNT" -gt 0 ]; then
    echo "✅ Tous les tests sont PASSÉS"
    echo ""
    echo "📋 Détail des conseils:"
    echo "$CONSEIL_RESPONSE" | jq -r '.data[] | "  - \(.title)"'
    echo ""
    echo "🎯 Structure attendue dans le frontend:"
    echo "  1. Section 'Rôle' (au début)"
    echo "  2. Contenu principal"
    echo "  3. Sections montage/démontage (× 4 cards)"
    echo "  4. Carousel véhicules (avec switches SEO)"
else
    echo "❌ Certains tests ont ÉCHOUÉ"
    echo "  - Conseils: $CONSEIL_COUNT (attendu: 5)"
    echo "  - Article pg_id: $ARTICLE_PG_ID (attendu: 247)"
    echo "  - Switches: $SWITCHES_COUNT (attendu: > 0)"
fi
echo ""

# 5. URL Frontend
echo "🌐 URL Frontend à tester:"
echo "http://localhost:3001/blog-pieces-auto/conseils/support-moteur"
echo ""
