#!/bin/bash

# ðŸ§ª Tests curl ultra-rapides
# Juste pour valider que le cookie fonctionne

URL="http://localhost:3000/pieces/pompe-de-direction-assistee-12.html"
COOKIE='selected_vehicle=%7B%22marque_id%22%3A140%2C%22marque_name%22%3A%22Renault%22%2C%22marque_alias%22%3A%22renault%22%2C%22modele_id%22%3A1234%2C%22modele_name%22%3A%22Avantime%22%2C%22modele_alias%22%3A%22avantime%22%2C%22type_id%22%3A5678%2C%22type_name%22%3A%222.0%2016V%22%2C%22type_alias%22%3A%222-0-16v%22%2C%22selected_at%22%3A%222025-10-28T10%3A00%3A00.000Z%22%7D'

echo "ðŸ§ª Test rapide curl"
echo ""

# Test 1: Sans cookie
echo "1ï¸âƒ£  SANS cookie:"
curl -s "$URL" 2>/dev/null | grep -q "Renault Avantime"
if [ $? -eq 0 ]; then
    echo "   âŒ VÃ©hicule dÃ©tectÃ© (ne devrait pas)"
else
    echo "   âœ… Pas de vÃ©hicule (correct)"
fi

# Test 2: Avec cookie
echo "2ï¸âƒ£  AVEC cookie:"
curl -s -H "Cookie: $COOKIE" "$URL" 2>/dev/null | grep -q "Renault Avantime"
if [ $? -eq 0 ]; then
    echo "   âœ… VÃ©hicule 'Renault Avantime' dÃ©tectÃ© (correct)"
else
    echo "   âŒ VÃ©hicule non dÃ©tectÃ© (erreur)"
fi

echo ""
echo "âœ… Tests terminÃ©s"
