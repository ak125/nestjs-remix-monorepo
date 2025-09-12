#!/bin/bash
# Test du filtrage des motorisations par année

echo "🚗 Test du filtrage des motorisations par année"
echo "=============================================="

echo ""
echo "📊 Test AUDI A1 (modèle ID: 22025)"
echo "-----------------------------------"

echo "🔍 Toutes les motorisations:"
curl -s "http://localhost:3000/api/vehicles/models/22025/types" | jq '.data | length'

echo ""
echo "🗓️ Motorisations pour 2012 (filtrage manuel):"
curl -s "http://localhost:3000/api/vehicles/models/22025/types" | \
  jq '.data[] | select(.type_year_from <= "2012" and .type_year_to >= "2012") | {type_name, type_year_from, type_year_to}' | \
  jq -s 'length'

echo ""
echo "🗓️ Motorisations pour 2016 (filtrage manuel):"
curl -s "http://localhost:3000/api/vehicles/models/22025/types" | \
  jq '.data[] | select(.type_year_from <= "2016" and .type_year_to >= "2016") | {type_name, type_year_from, type_year_to}' | \
  jq -s 'length'

echo ""
echo "🗓️ Motorisations pour 2020 (filtrage manuel):"
curl -s "http://localhost:3000/api/vehicles/models/22025/types" | \
  jq '.data[] | select(.type_year_from <= "2020" and .type_year_to >= "2020") | {type_name, type_year_from, type_year_to}' | \
  jq -s 'length'

echo ""
echo "✅ Le filtrage côté frontend devrait maintenant fonctionner!"
echo "💡 Testez sur la page : sélectionnez AUDI > année > A1 > vérifiez les motorisations"