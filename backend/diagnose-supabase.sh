#!/bin/bash

echo "=== Diagnostic de connexion Supabase ==="
echo ""

echo "1. Variables d'environnement :"
echo "   SUPABASE_URL=$(grep SUPABASE_URL backend/.env | cut -d'=' -f2 | tr -d '"')"
echo "   SUPABASE_ANON_KEY prÃ©sente: $(grep -q SUPABASE_ANON_KEY backend/.env && echo 'Oui' || echo 'Non')"
echo ""

echo "2. RÃ©solution DNS :"
SUPABASE_HOST=$(grep SUPABASE_URL backend/.env | cut -d'/' -f3 | tr -d '"')
getent hosts "$SUPABASE_HOST" || echo "   âŒ DNS non rÃ©solu"
echo ""

echo "3. Test de connectivitÃ© (timeout 5s) :"
SUPABASE_URL=$(grep SUPABASE_URL backend/.env | cut -d'=' -f2 | tr -d '"')
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$SUPABASE_URL/rest/v1/" 2>&1)
if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 500 ]; then
    echo "   âœ… Connexion rÃ©ussie (HTTP $HTTP_CODE)"
else
    echo "   âŒ Connexion Ã©chouÃ©e (HTTP $HTTP_CODE ou timeout)"
fi
echo ""

echo "4. Test avec authentification :"
ANON_KEY=$(grep SUPABASE_ANON_KEY backend/.env | cut -d'=' -f2 | tr -d '"')
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -H "apikey: $ANON_KEY" \
    "$SUPABASE_URL/rest/v1/" 2>&1)
if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 500 ]; then
    echo "   âœ… Authentification rÃ©ussie (HTTP $HTTP_CODE)"
else
    echo "   âŒ Authentification Ã©chouÃ©e (HTTP $HTTP_CODE ou timeout)"
fi
echo ""

echo "5. Variables rÃ©seau du systÃ¨me :"
echo "   HTTP_PROXY: ${HTTP_PROXY:-non dÃ©fini}"
echo "   HTTPS_PROXY: ${HTTPS_PROXY:-non dÃ©fini}"
echo "   NO_PROXY: ${NO_PROXY:-non dÃ©fini}"
echo ""

echo "=== Fin du diagnostic ==="
