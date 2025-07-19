#!/bin/bash
echo "🚀 TESTS API FINALS"
echo "=================="

echo "1. Total commandes:"
curl -s "http://localhost:3000/api/orders" | jq -r '.total'

echo "2. Commandes retournées:"
curl -s "http://localhost:3000/api/orders" | jq -r '.orders | length'

echo "3. Première commande:"
curl -s "http://localhost:3000/api/orders" | jq -r '.orders[0] | "ID: " + .ord_id + " - Client: " + .customer.cst_name + " - Total: " + .ord_total_ttc + "€"'

echo "4. Clients uniques:"
curl -s "http://localhost:3000/api/orders" | jq -r '.orders | map(.customer.cst_name) | unique | length'

echo "5. CA des 10 premières:"
curl -s "http://localhost:3000/api/orders" | jq -r '.orders | map(.ord_total_ttc | tonumber) | add'

echo "6. Test pagination (page 2):"
curl -s "http://localhost:3000/api/orders?page=2&limit=3" | jq -r '.orders | length'

echo "✅ TESTS TERMINÉS"
