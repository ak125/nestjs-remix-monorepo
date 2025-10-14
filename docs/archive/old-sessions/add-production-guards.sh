#!/bin/bash

# Liste des fichiers demo/test à protéger
files=(
  "frontend/app/routes/commercial.vehicles.demo.tsx"
  "frontend/app/routes/commercial.vehicles.model-selector-demo.tsx"
  "frontend/app/routes/commercial.vehicles.system-test.tsx"
  "frontend/app/routes/commercial.vehicles.type-selector-demo.tsx"
  "frontend/app/routes/commercial.vehicles.year-selector-demo.tsx"
  "frontend/app/routes/demo-images.tsx"
  "frontend/app/routes/search-demo.tsx"
  "frontend/app/routes/search.demo.tsx"
  "frontend/app/routes/test-route.tsx"
  "frontend/app/routes/test-simple.tsx"
  "frontend/app/routes/v5-ultimate-demo.tsx"
)

GUARD_CODE='
  // 🛡️ Production Guard: Cette route est uniquement pour dev/test
  if (process.env.NODE_ENV === "production") {
    throw new Response("Not Found", { status: 404 });
  }
'

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Chercher la première fonction loader
    if grep -q "export async function loader" "$file"; then
      # Insérer le guard après la ligne de signature du loader
      sed -i "/export async function loader/a\\$GUARD_CODE" "$file"
      echo "✅ Guard ajouté: $file"
    elif grep -q "export const loader" "$file"; then
      # Pour les loaders const
      sed -i "/export const loader/,/{/a\\$GUARD_CODE" "$file"
      echo "✅ Guard ajouté: $file"
    else
      echo "⚠️  Pas de loader trouvé: $file"
    fi
  else
    echo "❌ Fichier introuvable: $file"
  fi
done

echo ""
echo "🎯 Guards production ajoutés sur toutes les routes demo/test"
