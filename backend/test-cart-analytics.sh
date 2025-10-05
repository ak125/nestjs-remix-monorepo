#!/bin/bash

# 📊 Script de test du système d'analytics panier
# Teste les fonctionnalités avancées: taux d'abandon, valeur moyenne, produits abandonnés

BASE_URL="${1:-http://localhost:3000}"

echo "📊 Tests du Système d'Analytics Panier"
echo "========================================"
echo "Base URL: $BASE_URL"
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Rapport complet des analytics
echo -e "${YELLOW}📊 Test 1: Rapport complet des analytics${NC}"
echo "GET $BASE_URL/api/cart/analytics/report"
curl -s "$BASE_URL/api/cart/analytics/report" | jq '.'
echo ""

# Test 2: Taux d'abandon et conversion
echo -e "${YELLOW}📈 Test 2: Taux d'abandon et de conversion${NC}"
echo "GET $BASE_URL/api/cart/analytics/abandonment"
ABANDONMENT=$(curl -s "$BASE_URL/api/cart/analytics/abandonment")
echo "$ABANDONMENT" | jq '.'

CREATED=$(echo "$ABANDONMENT" | jq -r '.stats.created // 0')
CONVERTED=$(echo "$ABANDONMENT" | jq -r '.stats.converted // 0')
ABANDONED=$(echo "$ABANDONMENT" | jq -r '.stats.abandoned // 0')
ABANDONMENT_RATE=$(echo "$ABANDONMENT" | jq -r '.stats.abandonmentRate // 0')
CONVERSION_RATE=$(echo "$ABANDONMENT" | jq -r '.stats.conversionRate // 0')

echo ""
echo -e "${BLUE}📊 Résumé Taux d'Abandon:${NC}"
echo "  - Paniers créés: $CREATED"
echo "  - Convertis (commandes): $CONVERTED"
echo "  - Abandonnés: $ABANDONED"
echo "  - Taux d'abandon: $ABANDONMENT_RATE%"
echo "  - Taux de conversion: $CONVERSION_RATE%"
echo ""

# Test 3: Valeur moyenne du panier
echo -e "${YELLOW}💰 Test 3: Valeur moyenne du panier${NC}"
echo "GET $BASE_URL/api/cart/analytics/average-value"
AVERAGE=$(curl -s "$BASE_URL/api/cart/analytics/average-value")
echo "$AVERAGE" | jq '.'

AVG_VALUE=$(echo "$AVERAGE" | jq -r '.stats.average // 0')
TOTAL_VALUE=$(echo "$AVERAGE" | jq -r '.stats.total // 0')
COUNT=$(echo "$AVERAGE" | jq -r '.stats.count // 0')

echo ""
echo -e "${BLUE}💰 Résumé Valeur Moyenne:${NC}"
echo "  - Valeur moyenne: ${AVG_VALUE}€"
echo "  - Total cumulé: ${TOTAL_VALUE}€"
echo "  - Nombre de paniers: $COUNT"
echo ""

# Test 4: Produits les plus abandonnés
echo -e "${YELLOW}🏆 Test 4: Produits les plus abandonnés${NC}"
echo "GET $BASE_URL/api/cart/analytics/abandoned-products"
PRODUCTS=$(curl -s "$BASE_URL/api/cart/analytics/abandoned-products")
echo "$PRODUCTS" | jq '.'

PRODUCT_COUNT=$(echo "$PRODUCTS" | jq -r '.count // 0')

echo ""
echo -e "${BLUE}🏆 Résumé Produits Abandonnés:${NC}"
echo "  - Nombre de produits: $PRODUCT_COUNT"
if [ "$PRODUCT_COUNT" -gt "0" ]; then
    echo "  - Top 3:"
    echo "$PRODUCTS" | jq -r '.products[0:3] | .[] | "    • Produit \(.productId): \(.abandonCount) abandons (\(.totalQuantity) unités)"'
fi
echo ""

echo "========================================"
echo -e "${GREEN}✅ Tests terminés${NC}"
echo ""

# Interprétation des résultats
echo "📝 Interprétation:"
echo ""

if [ "$CREATED" -eq "0" ]; then
    echo -e "${YELLOW}⚠️  Aucun panier créé pour le moment${NC}"
    echo "   Les analytics se construiront au fur et à mesure de l'activité"
else
    echo -e "${GREEN}📊 Analyse de l'activité:${NC}"
    
    if (( $(echo "$CONVERSION_RATE >= 50" | bc -l) )); then
        echo -e "  ${GREEN}✅ Excellent taux de conversion (${CONVERSION_RATE}%)${NC}"
    elif (( $(echo "$CONVERSION_RATE >= 30" | bc -l) )); then
        echo -e "  ${BLUE}📈 Bon taux de conversion (${CONVERSION_RATE}%)${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Taux de conversion à améliorer (${CONVERSION_RATE}%)${NC}"
    fi
    
    if (( $(echo "$ABANDONMENT_RATE >= 70" | bc -l) )); then
        echo -e "  ${YELLOW}⚠️  Taux d'abandon élevé (${ABANDONMENT_RATE}%)${NC}"
        echo "     💡 Actions recommandées:"
        echo "        - Simplifier le processus de commande"
        echo "        - Réduire les coûts de livraison"
        echo "        - Envoyer emails de rappel"
    elif (( $(echo "$ABANDONMENT_RATE >= 50" | bc -l) )); then
        echo -e "  ${BLUE}📊 Taux d'abandon moyen (${ABANDONMENT_RATE}%)${NC}"
    else
        echo -e "  ${GREEN}✅ Faible taux d'abandon (${ABANDONMENT_RATE}%)${NC}"
    fi
    
    if [ "$COUNT" -gt "0" ]; then
        echo -e "  ${BLUE}💰 Valeur moyenne: ${AVG_VALUE}€${NC}"
        if (( $(echo "$AVG_VALUE >= 100" | bc -l) )); then
            echo "     ✅ Excellent panier moyen"
        elif (( $(echo "$AVG_VALUE >= 50" | bc -l) )); then
            echo "     📈 Bon panier moyen"
        else
            echo "     💡 Opportunité d'upsell/cross-sell"
        fi
    fi
fi

echo ""
echo "🔗 Endpoints Analytics:"
echo "   GET  $BASE_URL/api/cart/analytics/report              (rapport complet)"
echo "   GET  $BASE_URL/api/cart/analytics/abandonment         (taux abandon/conversion)"
echo "   GET  $BASE_URL/api/cart/analytics/average-value       (valeur moyenne)"
echo "   GET  $BASE_URL/api/cart/analytics/abandoned-products  (produits abandonnés)"
echo ""

echo "💡 Note: Les analytics se construisent en temps réel au fur et"
echo "   à mesure de l'activité des paniers (création, conversion, abandon)"
echo ""
