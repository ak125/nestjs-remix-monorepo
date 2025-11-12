#!/bin/bash

echo "=== Diagnostic de connexion Supabase ==="
echo ""

echo "1. Variables d'environnement :"
echo "   SUPABASE_URL=$(grep SUPABASE_URL backend/.env | cut -d'=' -f2 | tr -d '"')"
echo "   SUPABASE_ANON_KEY présente: $(grep -q SUPABASE_ANON_KEY backend/.env && echo 'Oui' || echo 'Non')"
echo ""

echo "2. Résolution DNS :"
SUPABASE_HOST=$(grep SUPABASE_URL backend/.env | cut -d'/' -f3 | tr -d '"')
getent hosts "$SUPABASE_HOST" || echo "   ❌ DNS non résolu"
echo ""

echo "3. Test de connectivité (timeout 5s) :"
SUPABASE_URL=$(grep SUPABASE_URL backend/.env | cut -d'=' -f2 | tr -d '"')
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$SUPABASE_URL/rest/v1/" 2>&1)
if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 500 ]; then
    echo "   ✅ Connexion réussie (HTTP $HTTP_CODE)"
else
    echo "   ❌ Connexion échouée (HTTP $HTTP_CODE ou timeout)"
fi
echo ""

echo "4. Test avec authentification :"
ANON_KEY=$(grep SUPABASE_ANON_KEY backend/.env | cut -d'=' -f2 | tr -d '"')
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -H "apikey: $ANON_KEY" \
    "$SUPABASE_URL/rest/v1/" 2>&1)
if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 500 ]; then
    echo "   ✅ Authentification réussie (HTTP $HTTP_CODE)"
else
    echo "   ❌ Authentification échouée (HTTP $HTTP_CODE ou timeout)"
fi
echo ""

echo "5. Variables réseau du système :"
echo "   HTTP_PROXY: ${HTTP_PROXY:-non défini}"
echo "   HTTPS_PROXY: ${HTTPS_PROXY:-non défini}"
echo "   NO_PROXY: ${NO_PROXY:-non défini}"
echo ""

echo "=== Fin du diagnostic ==="
