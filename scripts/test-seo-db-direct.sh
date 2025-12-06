#!/bin/bash

echo "🔍 Test direct Supabase - Vérification nettoyage <p>"
echo "======================================================"
echo ""

SUPABASE_URL="https://ygstpegocuhrjvvnzfvq.supabase.co/rest/v1"
APIKEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnc3RwZWdvY3Vocmp2dm56ZnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MjA0NTQsImV4cCI6MjA1MDM5NjQ1NH0.z7BcxL9qBp2bEGYRMRj3iBfp9vMOh5eTyYqOaO0xWXQ"

# Test 1: Kit embrayage (pg_id=479)
echo "📦 Test 1: Kit d'embrayage (pg_id=479)"
echo "--------------------------------------"

curl -s "$SUPABASE_URL/__seo_gamme_car?sgc_pg_id=eq.479&select=sgc_h1,sgc_content&limit=1" \
  -H "apikey: $APIKEY" \
  -H "Authorization: Bearer $APIKEY" | jq -r '.[0] | "H1: " + (.sgc_h1[:100]) + "\n\nContent (150 chars): " + (.sgc_content[:150])'

echo ""
echo ""

# Test 2: Batterie (pg_id=1)
echo "🔋 Test 2: Batterie (pg_id=1)"
echo "--------------------------------------"

curl -s "$SUPABASE_URL/__seo_gamme_car?sgc_pg_id=eq.1&select=sgc_h1,sgc_content&limit=1" \
  -H "apikey: $APIKEY" \
  -H "Authorization: Bearer $APIKEY" | jq -r '.[0] | "H1: " + (.sgc_h1[:100]) + "\n\nContent (150 chars): " + (.sgc_content[:150])'

echo ""
echo ""

# Test 3: Compter les <p> restants
echo "📊 Statistiques globales"
echo "--------------------------------------"

curl -s "$SUPABASE_URL/__seo_gamme_car?select=sgc_h1,sgc_content&limit=5" \
  -H "apikey: $APIKEY" \
  -H "Authorization: Bearer $APIKEY" | jq -r '.[] | select(.sgc_h1 | test("<p")) | "❌ H1 avec <p>: " + .sgc_h1[:80]' | head -3

echo ""

curl -s "$SUPABASE_URL/__seo_gamme_car?select=sgc_content&limit=5" \
  -H "apikey: $APIKEY" \
  -H "Authorization: Bearer $APIKEY" | jq -r '.[] | select(.sgc_content | test("<p[^>]*>")) | "⚠️  Content avec <p>: " + .sgc_content[:80]' | head -3

echo ""
echo "======================================================"
echo "✅ Tests terminés"
