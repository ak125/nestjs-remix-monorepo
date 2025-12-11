#!/bin/bash

# ðŸ§ª Test Rapide - Cookie VÃ©hicule

echo "ðŸ§ª Test 1: RequÃªte SANS cookie"
echo "â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€"
curl -s "http://localhost:3000/pieces/filtre-a-huile-12.html" | \
  grep -oP '(?<=ðŸž Breadcrumb: ).*' || echo "Logs non dÃ©tectÃ©s (serveur peut-Ãªtre pas en mode dev)"

echo ""
echo "ðŸ§ª Test 2: RequÃªte AVEC cookie Renault Avantime"
echo "â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€"

# Cookie vÃ©hicule encodÃ©
COOKIE='selected_vehicle=%7B%22marque_id%22%3A140%2C%22marque_name%22%3A%22Renault%22%2C%22marque_alias%22%3A%22renault%22%2C%22modele_id%22%3A30125%2C%22modele_name%22%3A%22Avantime%22%2C%22modele_alias%22%3A%22avantime%22%2C%22type_id%22%3A12345%2C%22type_name%22%3A%222.0%2016V%22%2C%22type_alias%22%3A%222-0-16v%22%2C%22selected_at%22%3A%222025-10-28T22%3A00%3A00.000Z%22%7D'

curl -s -H "Cookie: $COOKIE" "http://localhost:3000/pieces/filtre-a-huile-12.html" | \
  grep -oP '(?<=ðŸž Breadcrumb: ).*' || echo "Logs non dÃ©tectÃ©s"

echo ""
echo "âœ… Tests terminÃ©s"
