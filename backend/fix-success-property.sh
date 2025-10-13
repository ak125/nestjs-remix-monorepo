#!/bin/bash

# Script pour ajouter 'success: true,' aux objets de réponse manquants dans les services vehicle

FILES=(
  "src/modules/vehicles/services/data/vehicle-models.service.ts"
  "src/modules/vehicles/services/data/vehicle-types.service.ts"
  "src/modules/vehicles/services/search/vehicle-mine.service.ts"
  "src/modules/vehicles/services/search/vehicle-search.service.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "🔧 Traitement de $file..."
    
    # Remplacer les patterns courants de réponse sans success
    sed -i 's/return {\n            data: data \|\| \[\],/return {\n            success: true,\n            data: data || [],/g' "$file"
    sed -i 's/return { data: \[\], total: 0, page, limit };/return { success: true, data: [], total: 0, page, limit };/g' "$file"
    sed -i 's/return { data: \[\], total: 0, page: 0, limit:/return { success: true, data: [], total: 0, page: 0, limit:/g' "$file"
    
    echo "✅ $file traité"
  fi
done

echo "🎉 Correction terminée !"
