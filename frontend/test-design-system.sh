#!/bin/bash

# Script de test pour la page Design System

echo "â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—"
echo "â•‘                                                                              â•‘"
echo "â•‘                   ðŸ§ª TESTS DESIGN SYSTEM - CURL                             â•‘"
echo "â•‘                                                                              â•‘"
echo "â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
DESIGN_SYSTEM_PATH="/design-system"

echo "ðŸ“‹ Configuration:"
echo "   Base URL: $BASE_URL"
echo "   Page: $DESIGN_SYSTEM_PATH"
echo ""

# Test 1: Page accessible
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "Test 1: Page /design-system accessible"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${DESIGN_SYSTEM_PATH}")

if [ "$HTTP_CODE" = "200" ]; then
    echo "âœ… PASS - HTTP $HTTP_CODE (OK)"
else
    echo "âŒ FAIL - HTTP $HTTP_CODE (Expected 200)"
    exit 1
fi
echo ""

# Test 2: Contenu Alert prÃ©sent
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "Test 2: Composant Alert prÃ©sent"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

RESPONSE=$(curl -s "${BASE_URL}${DESIGN_SYSTEM_PATH}")

if echo "$RESPONSE" | grep -q "Alert Component"; then
    echo "âœ… PASS - Titre 'Alert Component' trouvÃ©"
else
    echo "âŒ FAIL - Titre 'Alert Component' non trouvÃ©"
    exit 1
fi

if echo "$RESPONSE" | grep -q "border-success-500"; then
    echo "âœ… PASS - Classes sÃ©mantiques success trouvÃ©es"
else
    echo "âŒ FAIL - Classes sÃ©mantiques success non trouvÃ©es"
    exit 1
fi
echo ""

# Test 3: Composant Badge prÃ©sent
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "Test 3: Composant Badge prÃ©sent"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

if echo "$RESPONSE" | grep -q "Badge Component"; then
    echo "âœ… PASS - Titre 'Badge Component' trouvÃ©"
else
    echo "âŒ FAIL - Titre 'Badge Component' non trouvÃ©"
    exit 1
fi

if echo "$RESPONSE" | grep -q "10 variantes disponibles"; then
    echo "âœ… PASS - Description badges trouvÃ©e"
else
    echo "âŒ FAIL - Description badges non trouvÃ©e"
    exit 1
fi
echo ""

# Test 4: Composant Button prÃ©sent
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "Test 4: Composant Button prÃ©sent"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

if echo "$RESPONSE" | grep -q "Button Component"; then
    echo "âœ… PASS - Titre 'Button Component' trouvÃ©"
else
    echo "âŒ FAIL - Titre 'Button Component' non trouvÃ©"
    exit 1
fi

if echo "$RESPONSE" | grep -q "16 variantes"; then
    echo "âœ… PASS - Description buttons trouvÃ©e"
else
    echo "âŒ FAIL - Description buttons non trouvÃ©e"
    exit 1
fi
echo ""

# Test 5: Statistiques de migration prÃ©sentes
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "Test 5: Statistiques de migration"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

if echo "$RESPONSE" | grep -q "95.4%"; then
    echo "âœ… PASS - Stat '95.4%' trouvÃ©e"
else
    echo "âŒ FAIL - Stat '95.4%' non trouvÃ©e"
    exit 1
fi

if echo "$RESPONSE" | grep -q "Migration Statistics"; then
    echo "âœ… PASS - Section statistiques trouvÃ©e"
else
    echo "âŒ FAIL - Section statistiques non trouvÃ©e"
    exit 1
fi
echo ""

# Test 6: Couleurs branding documentÃ©es
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "Test 6: Couleurs branding (purple/orange)"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

if echo "$RESPONSE" | grep -q "Hybride"; then
    echo "âœ… PASS - Badge 'Hybride' (purple) trouvÃ©"
else
    echo "âŒ FAIL - Badge 'Hybride' non trouvÃ©"
    exit 1
fi

if echo "$RESPONSE" | grep -q "Diesel"; then
    echo "âœ… PASS - Badge 'Diesel' (orange) trouvÃ©"
else
    echo "âŒ FAIL - Badge 'Diesel' non trouvÃ©"
    exit 1
fi
echo ""

# RÃ©sumÃ©
echo "â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—"
echo "â•‘                                                                              â•‘"
echo "â•‘                        âœ… TOUS LES TESTS RÃ‰USSIS ! âœ…                         â•‘"
echo "â•‘                                                                              â•‘"
echo "â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""
echo "ðŸ“Š RÃ©sultats:"
echo "   âœ… 6/6 tests passÃ©s"
echo "   ðŸŒ Page accessible: ${BASE_URL}${DESIGN_SYSTEM_PATH}"
echo ""
echo "ðŸ’¡ Pour tester manuellement:"
echo "   curl ${BASE_URL}${DESIGN_SYSTEM_PATH} | grep -i 'design system'"
echo ""
