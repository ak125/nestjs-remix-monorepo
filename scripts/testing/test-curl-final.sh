#!/bin/bash

# ðŸ§ª Test curl breadcrumb dynamique
# Utilise les vraies URLs de votre application

echo "ðŸ§ª Tests curl - Fil d'ariane dynamique"
echo "======================================"
echo ""

# URL de test (celle qui fonctionne d'aprÃ¨s vos logs)
TEST_URL="http://localhost:3000/pieces/pompe-de-direction-assistee-12.html"

# Cookie de test (Renault Avantime)
VEHICLE_COOKIE='selected_vehicle=%7B%22marque_id%22%3A140%2C%22marque_name%22%3A%22Renault%22%2C%22marque_alias%22%3A%22renault%22%2C%22modele_id%22%3A1234%2C%22modele_name%22%3A%22Avantime%22%2C%22modele_alias%22%3A%22avantime%22%2C%22type_id%22%3A5678%2C%22type_name%22%3A%222.0%2016V%22%2C%22type_alias%22%3A%222-0-16v%22%2C%22selected_at%22%3A%222025-10-28T10%3A00%3A00.000Z%22%7D'

echo "ðŸ“ URL de test: $TEST_URL"
echo ""

# VÃ©rifier si le serveur rÃ©pond
if ! curl -s --connect-timeout 3 "http://localhost:3000" > /dev/null 2>&1; then
    echo "âŒ ERREUR: Le serveur ne rÃ©pond pas sur le port 3000"
    echo ""
    echo "âž¡ï¸  DÃ©marrez le backend avec:"
    echo "    cd backend && npm run dev"
    echo ""
    exit 1
fi

echo "âœ… Serveur accessible"
echo ""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ§ª TEST 1: SANS cookie (attendu: 3 niveaux)"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Faire la requÃªte et regarder les logs backend
echo "ðŸ“¤ Envoi de la requÃªte..."
RESPONSE_1=$(curl -s "$TEST_URL" 2>&1)

# VÃ©rifier le code de statut
STATUS_1=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL")

echo "ðŸ“Š Code HTTP: $STATUS_1"

if [ "$STATUS_1" = "200" ]; then
    echo "âœ… Page chargÃ©e avec succÃ¨s"
    
    # Chercher "Renault Avantime" dans la rÃ©ponse
    if echo "$RESPONSE_1" | grep -q "Renault Avantime"; then
        echo "âš ï¸  VÃ©hicule trouvÃ© SANS cookie (inattendu)"
    else
        echo "âœ… Pas de vÃ©hicule dans le breadcrumb (correct)"
    fi
else
    echo "âŒ Erreur HTTP $STATUS_1"
    echo ""
    echo "âž¡ï¸  VÃ©rifiez que la route existe dans votre application"
    echo "    ou changez TEST_URL dans le script"
fi

echo ""
echo ""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ§ª TEST 2: AVEC cookie (attendu: 4 niveaux)"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

echo "ðŸ“¤ Envoi de la requÃªte avec cookie..."
RESPONSE_2=$(curl -s -H "Cookie: $VEHICLE_COOKIE" "$TEST_URL" 2>&1)

# VÃ©rifier le code de statut
STATUS_2=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $VEHICLE_COOKIE" "$TEST_URL")

echo "ðŸ“Š Code HTTP: $STATUS_2"

if [ "$STATUS_2" = "200" ]; then
    echo "âœ… Page chargÃ©e avec succÃ¨s"
    
    # Chercher "Renault Avantime" dans la rÃ©ponse
    if echo "$RESPONSE_2" | grep -q "Renault Avantime"; then
        echo "âœ… VÃ©hicule 'Renault Avantime' dÃ©tectÃ© dans la rÃ©ponse (correct)"
    else
        echo "âŒ VÃ©hicule 'Renault Avantime' NON dÃ©tectÃ© (erreur)"
    fi
else
    echo "âŒ Erreur HTTP $STATUS_2"
fi

echo ""
echo ""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“Š RÃ‰SUMÃ‰"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

if [ "$STATUS_1" = "200" ] && [ "$STATUS_2" = "200" ]; then
    echo "âœ… Tests terminÃ©s avec succÃ¨s"
    echo ""
    echo "âž¡ï¸  VÃ©rifiez les logs du backend pour voir:"
    echo "    ðŸš— VÃ©hicule depuis cookie: ..."
    echo "    ðŸž Breadcrumb gÃ©nÃ©rÃ©: ..."
else
    echo "âš ï¸  Certains tests ont Ã©chouÃ©"
    echo ""
    echo "ðŸ“ Actions recommandÃ©es:"
    echo "1. VÃ©rifiez que l'URL $TEST_URL existe"
    echo "2. VÃ©rifiez les logs backend pour plus de dÃ©tails"
    echo "3. Testez directement dans le navigateur"
fi

echo ""
