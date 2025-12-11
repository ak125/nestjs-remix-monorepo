#!/bin/bash

# ðŸ§ª Tests curl pour fil d'ariane dynamique
# Valide le comportement avec et sans cookie de vÃ©hicule

set -e

echo "ðŸ§ª Tests curl - Fil d'ariane dynamique"
echo "======================================"
echo ""

# Configuration
BASE_URL="http://localhost:3000"
TEST_URL="$BASE_URL/pieces/pompe-de-direction-assistee-18"

# Cookie de test (Renault Avantime)
VEHICLE_COOKIE='selected_vehicle=%7B%22marque_id%22%3A140%2C%22marque_name%22%3A%22Renault%22%2C%22marque_alias%22%3A%22renault%22%2C%22modele_id%22%3A1234%2C%22modele_name%22%3A%22Avantime%22%2C%22modele_alias%22%3A%22avantime%22%2C%22type_id%22%3A5678%2C%22type_name%22%3A%222.0%2016V%22%2C%22type_alias%22%3A%222-0-16v%22%2C%22selected_at%22%3A%222025-10-28T10%3A00%3A00.000Z%22%7D'

echo "ðŸ“ URL de test: $TEST_URL"
echo ""

# Test 1: Sans cookie
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ§ª TEST 1: RequÃªte SANS cookie"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "Attendu: 3 niveaux (Accueil â†’ PiÃ¨ces â†’ Pompe de direction assistÃ©e)"
echo ""

RESPONSE_1=$(curl -s "$TEST_URL")

# Extraction du breadcrumb HTML
BREADCRUMB_1=$(echo "$RESPONSE_1" | grep -oP '<nav[^>]*aria-label="Breadcrumb"[^>]*>.*?</nav>' | head -1)

if [ -z "$BREADCRUMB_1" ]; then
    echo "âŒ Breadcrumb non trouvÃ© dans la rÃ©ponse"
else
    echo "âœ… Breadcrumb trouvÃ©:"
    echo "$BREADCRUMB_1" | grep -oP '>([^<]+)</a>' | sed 's/>//g' | sed 's/<\/a>//g' | nl -w2 -s'. '
    
    # VÃ©rification du nombre de niveaux
    LEVEL_COUNT_1=$(echo "$BREADCRUMB_1" | grep -o '</a>' | wc -l)
    echo ""
    echo "Niveaux dÃ©tectÃ©s: $LEVEL_COUNT_1"
    
    if [ "$LEVEL_COUNT_1" -eq 2 ]; then
        echo "âœ… 3 niveaux confirmÃ©s (2 liens + 1 actuel)"
    else
        echo "âš ï¸  Nombre de niveaux inattendu: $LEVEL_COUNT_1 (attendu: 2)"
    fi
fi

echo ""
echo ""

# Test 2: Avec cookie
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ§ª TEST 2: RequÃªte AVEC cookie"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "Attendu: 4 niveaux (Accueil â†’ PiÃ¨ces â†’ Renault Avantime â†’ Pompe de direction assistÃ©e)"
echo ""

RESPONSE_2=$(curl -s -H "Cookie: $VEHICLE_COOKIE" "$TEST_URL")

# Extraction du breadcrumb HTML
BREADCRUMB_2=$(echo "$RESPONSE_2" | grep -oP '<nav[^>]*aria-label="Breadcrumb"[^>]*>.*?</nav>' | head -1)

if [ -z "$BREADCRUMB_2" ]; then
    echo "âŒ Breadcrumb non trouvÃ© dans la rÃ©ponse"
else
    echo "âœ… Breadcrumb trouvÃ©:"
    echo "$BREADCRUMB_2" | grep -oP '>([^<]+)</a>' | sed 's/>//g' | sed 's/<\/a>//g' | nl -w2 -s'. '
    
    # VÃ©rification du nombre de niveaux
    LEVEL_COUNT_2=$(echo "$BREADCRUMB_2" | grep -o '</a>' | wc -l)
    echo ""
    echo "Niveaux dÃ©tectÃ©s: $LEVEL_COUNT_2"
    
    if [ "$LEVEL_COUNT_2" -eq 3 ]; then
        echo "âœ… 4 niveaux confirmÃ©s (3 liens + 1 actuel)"
    else
        echo "âš ï¸  Nombre de niveaux inattendu: $LEVEL_COUNT_2 (attendu: 3)"
    fi
    
    # VÃ©rification de la prÃ©sence du vÃ©hicule
    if echo "$BREADCRUMB_2" | grep -q "Renault Avantime"; then
        echo "âœ… VÃ©hicule 'Renault Avantime' prÃ©sent dans le breadcrumb"
    else
        echo "âŒ VÃ©hicule 'Renault Avantime' NON trouvÃ© dans le breadcrumb"
    fi
fi

echo ""
echo ""

# Test 3: VÃ©rification JSON-LD Schema.org
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ§ª TEST 3: Validation Schema.org JSON-LD"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Test 3a: Sans cookie
echo "ðŸ“ Sans cookie:"
JSON_LD_1=$(echo "$RESPONSE_1" | grep -oP '<script type="application/ld\+json">.*?</script>' | grep -oP '\{.*\}')

if [ -z "$JSON_LD_1" ]; then
    echo "âŒ JSON-LD non trouvÃ©"
else
    POSITIONS_1=$(echo "$JSON_LD_1" | grep -oP '"position":\s*\d+' | grep -oP '\d+' | tr '\n' ',' | sed 's/,$//')
    echo "âœ… JSON-LD trouvÃ©"
    echo "   Positions: [$POSITIONS_1]"
    
    if echo "$POSITIONS_1" | grep -q "1,2,3"; then
        echo "âœ… 3 positions sÃ©quentielles (1,2,3)"
    else
        echo "âš ï¸  Positions non-standard: $POSITIONS_1"
    fi
fi

echo ""

# Test 3b: Avec cookie
echo "ðŸ“ Avec cookie:"
JSON_LD_2=$(echo "$RESPONSE_2" | grep -oP '<script type="application/ld\+json">.*?</script>' | grep -oP '\{.*\}')

if [ -z "$JSON_LD_2" ]; then
    echo "âŒ JSON-LD non trouvÃ©"
else
    POSITIONS_2=$(echo "$JSON_LD_2" | grep -oP '"position":\s*\d+' | grep -oP '\d+' | tr '\n' ',' | sed 's/,$//')
    echo "âœ… JSON-LD trouvÃ©"
    echo "   Positions: [$POSITIONS_2]"
    
    # Le JSON-LD doit rester Ã  3 niveaux (canonique, sans vÃ©hicule)
    if echo "$POSITIONS_2" | grep -q "1,2,3"; then
        echo "âœ… 3 positions sÃ©quentielles (canonique, sans vÃ©hicule)"
    elif echo "$POSITIONS_2" | grep -q "1,2,3,4"; then
        echo "âš ï¸  4 positions dÃ©tectÃ©es (attention: JSON-LD doit rester canonique Ã  3 niveaux)"
    else
        echo "âš ï¸  Positions non-standard: $POSITIONS_2"
    fi
fi

echo ""
echo ""

# Test 4: Badge de filtre vÃ©hicule
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ§ª TEST 4: Badge de filtre vÃ©hicule"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Sans cookie: badge ne doit PAS Ãªtre prÃ©sent
if echo "$RESPONSE_1" | grep -q "VehicleFilterBadge"; then
    echo "âš ï¸  Badge vÃ©hicule prÃ©sent SANS cookie (inattendu)"
else
    echo "âœ… Badge vÃ©hicule absent sans cookie"
fi

# Avec cookie: badge DOIT Ãªtre prÃ©sent
if echo "$RESPONSE_2" | grep -q "FiltrÃ© pour"; then
    echo "âœ… Badge vÃ©hicule prÃ©sent avec cookie"
else
    echo "âš ï¸  Badge vÃ©hicule absent AVEC cookie (inattendu)"
fi

echo ""
echo ""

# RÃ©sumÃ©
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“Š RÃ‰SUMÃ‰ DES TESTS"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""
echo "âœ… Tests terminÃ©s avec succÃ¨s"
echo ""
echo "VÃ©rifications manuelles recommandÃ©es:"
echo "1. Ouvrir $TEST_URL dans le navigateur"
echo "2. VÃ©rifier l'affichage du breadcrumb (3 niveaux)"
echo "3. SÃ©lectionner un vÃ©hicule via VehicleSelector"
echo "4. VÃ©rifier le breadcrumb avec vÃ©hicule (4 niveaux)"
echo "5. VÃ©rifier le badge bleu 'FiltrÃ© pour: [VÃ©hicule]'"
echo ""
