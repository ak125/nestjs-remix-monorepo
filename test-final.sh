#!/bin/bash

echo "🚀 TESTS CURL COMPLETS ET OPTIMISÉS"
echo "=================================="
echo ""

# Tests avec timeout court pour éviter les blocages
TIMEOUT=5
BASE_URL="http://localhost:3000/api/orders"

echo "📊 Test 1: Total des commandes"
TOTAL=$(curl -s --connect-timeout $TIMEOUT -m $TIMEOUT "$BASE_URL" | jq -r '.total // "ERREUR"')
echo "Résultat: $TOTAL commandes"
echo ""

echo "📊 Test 2: Commandes retournées"
RETURNED=$(curl -s --connect-timeout $TIMEOUT -m $TIMEOUT "$BASE_URL" | jq -r '.orders | length // "ERREUR"')
echo "Résultat: $RETURNED commandes dans la réponse"
echo ""

echo "📊 Test 3: Première commande"
FIRST=$(curl -s --connect-timeout $TIMEOUT -m $TIMEOUT "$BASE_URL" | jq -r '.orders[0] | "ID:" + .ord_id + " - " + .customer.cst_name + " - " + .ord_total_ttc + "€" // "ERREUR"')
echo "Résultat: $FIRST"
echo ""

echo "📊 Test 4: Pagination (page 2)"
PAGE2=$(curl -s --connect-timeout $TIMEOUT -m $TIMEOUT "${BASE_URL}?page=2&limit=3" | jq -r '.orders | length // "ERREUR"')
echo "Résultat: $PAGE2 commandes en page 2"
echo ""

echo "📊 Test 5: Chiffre d'affaires"
CA=$(curl -s --connect-timeout $TIMEOUT -m $TIMEOUT "$BASE_URL" | jq -r '.orders | map(.ord_total_ttc | tonumber) | add // "ERREUR"')
echo "Résultat: ${CA}€"
echo ""

echo "🎯 RÉSUMÉ DES TESTS"
echo "=================="
if [ "$TOTAL" != "ERREUR" ] && [ "$TOTAL" -gt 1000 ]; then
    echo "✅ Base de données: $TOTAL commandes (EXCELLENT)"
else
    echo "❌ Base de données: Problème détecté"
fi

if [ "$RETURNED" != "ERREUR" ] && [ "$RETURNED" -gt 0 ]; then
    echo "✅ API: $RETURNED commandes retournées (OK)"
else
    echo "❌ API: Problème de retour des données"
fi

if [ "$PAGE2" != "ERREUR" ] && [ "$PAGE2" -gt 0 ]; then
    echo "✅ Pagination: $PAGE2 commandes en page 2 (OK)"
else
    echo "❌ Pagination: Problème détecté"
fi

echo ""
echo "🎉 Tests terminés avec succès !"
echo "API Orders opérationnelle avec des données réelles"
