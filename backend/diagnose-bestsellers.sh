#!/bin/bash

echo "ðŸ” Diagnostic Bestsellers - Page BMW"
echo "===================================="
echo ""

# 1. Test backend API
echo "1ï¸âƒ£  Test Backend API..."
RESPONSE=$(curl -s 'http://localhost:3000/api/manufacturers/brand/bmw/bestsellers?limitVehicles=2&limitParts=2')

VEHICLES_COUNT=$(echo "$RESPONSE" | jq '.data.vehicles | length')
PARTS_COUNT=$(echo "$RESPONSE" | jq '.data.parts | length')

if [ "$VEHICLES_COUNT" -gt 0 ]; then
    echo "   âœ… Backend: $VEHICLES_COUNT vÃ©hicules retournÃ©s"
else
    echo "   âŒ Backend: Aucun vÃ©hicule"
fi

if [ "$PARTS_COUNT" -gt 0 ]; then
    echo "   âœ… Backend: $PARTS_COUNT piÃ¨ces retournÃ©es"
else
    echo "   âŒ Backend: Aucune piÃ¨ce"
fi

echo ""

# 2. VÃ©rifier les champs des vÃ©hicules
echo "2ï¸âƒ£  VÃ©rification donnÃ©es vÃ©hicule..."
VEHICLE=$(echo "$RESPONSE" | jq '.data.vehicles[0]')

echo "   Marque: $(echo "$VEHICLE" | jq -r '.marque_name')"
echo "   ModÃ¨le: $(echo "$VEHICLE" | jq -r '.modele_name')"
echo "   Type: $(echo "$VEHICLE" | jq -r '.type_name')"
echo "   Puissance: $(echo "$VEHICLE" | jq -r '.type_power_ps') ch"
echo "   Image: $(echo "$VEHICLE" | jq -r '.modele_pic')"

echo ""

# 3. Construire URLs attendues
echo "3ï¸âƒ£  URLs gÃ©nÃ©rÃ©es (frontend)..."
MARQUE_ALIAS=$(echo "$VEHICLE" | jq -r '.marque_alias')
MARQUE_ID=$(echo "$VEHICLE" | jq -r '.marque_id')
MODELE_ALIAS=$(echo "$VEHICLE" | jq -r '.modele_alias')
MODELE_ID=$(echo "$VEHICLE" | jq -r '.modele_id')
TYPE_ALIAS=$(echo "$VEHICLE" | jq -r '.type_alias')
CGC_TYPE_ID=$(echo "$VEHICLE" | jq -r '.cgc_type_id')
MODELE_PIC=$(echo "$VEHICLE" | jq -r '.modele_pic')

VEHICLE_URL="/constructeurs/$MARQUE_ALIAS-$MARQUE_ID/$MODELE_ALIAS-$MODELE_ID/$TYPE_ALIAS-$CGC_TYPE_ID.html"
IMAGE_URL="/upload/constructeurs-automobiles/modeles/$MODELE_PIC"

echo "   Vehicle URL: $VEHICLE_URL"
echo "   Image URL: $IMAGE_URL"

echo ""

# 4. VÃ©rifier les piÃ¨ces
echo "4ï¸âƒ£  VÃ©rification donnÃ©es piÃ¨ce..."
PART=$(echo "$RESPONSE" | jq '.data.parts[0]')

PG_NAME=$(echo "$PART" | jq -r '.pg_name')
PG_ALIAS=$(echo "$PART" | jq -r '.pg_alias')
PG_PIC=$(echo "$PART" | jq -r '.pg_pic')
PART_MARQUE=$(echo "$PART" | jq -r '.marque_alias')

PART_URL="/pieces/$PART_MARQUE/$PG_ALIAS"
PART_IMAGE="/upload/pieces-auto/$PG_PIC"

echo "   Nom: $PG_NAME"
echo "   Part URL: $PART_URL"
echo "   Image URL: $PART_IMAGE"

echo ""

# 5. Test cache
echo "5ï¸âƒ£  Test Cache Redis..."
echo "   RequÃªte 1..."
TIME1=$(curl -s -w "%{time_total}" -o /dev/null 'http://localhost:3000/api/manufacturers/brand/bmw/bestsellers?limitVehicles=5&limitParts=5')
echo "   Temps: ${TIME1}s"

sleep 1

echo "   RequÃªte 2 (cachÃ©e)..."
TIME2=$(curl -s -w "%{time_total}" -o /dev/null 'http://localhost:3000/api/manufacturers/brand/bmw/bestsellers?limitVehicles=5&limitParts=5')
echo "   Temps: ${TIME2}s"

# Calcul ratio
if (( $(echo "$TIME1 > $TIME2" | bc -l) )); then
    echo "   âœ… Cache actif ($(echo "scale=1; $TIME1 / $TIME2" | bc)Ã— plus rapide)"
else
    echo "   âš ï¸  Cache non dÃ©tectÃ©"
fi

echo ""
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo "âœ… Diagnostic terminÃ©!"
echo ""
echo "ðŸ“‹ Prochaines Ã©tapes:"
echo "   1. Frontend doit Ãªtre lancÃ©: cd frontend && npm run dev"
echo "   2. Ouvrir: http://localhost:5173/constructeurs/bmw-33.html"
echo "   3. VÃ©rifier que les sections apparaissent:"
echo "      - ðŸš— VÃ©hicules BMW les plus recherchÃ©s (6 cartes)"
echo "      - ðŸ“¦ PiÃ¨ces BMW populaires (8 cartes)"
echo "   4. VÃ©rifier que les images chargent"
echo "   5. VÃ©rifier que les liens fonctionnent"
echo "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
