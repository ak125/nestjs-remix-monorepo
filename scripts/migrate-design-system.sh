#!/bin/bash

# Script de migration automatique Design System
# Remplace les patterns hardcodÃ©s par composants @fafa/ui

set -e

FRONTEND_DIR="/workspaces/nestjs-remix-monorepo/frontend/app"

echo "ðŸš€ Migration Design System - Script Automatique"
echo "================================================"

# Fichiers Ã  migrer
FILES=(
  "routes/admin.users.\$id.tsx"
  "routes/admin.config._index.tsx"
  "routes/reviews._index.tsx"
  "routes/admin.blog.tsx"
  "routes/admin.optimization-summary.tsx"
)

# Compteur
TOTAL_CHANGES=0

for file in "${FILES[@]}"; do
  filepath="$FRONTEND_DIR/$file"
  
  if [ ! -f "$filepath" ]; then
    echo "âš ï¸  Fichier introuvable: $file"
    continue
  fi
  
  echo ""
  echo "ðŸ“ Traitement: $file"
  
  # Backup
  cp "$filepath" "${filepath}.backup"
  
  # Compter patterns avant
  BEFORE=$(grep -cE "bg-(green|red|yellow|blue)-(50|100|200)" "$filepath" || echo 0)
  
  # Pattern 1: Badge success basique
  sed -i 's/className="bg-green-100 text-green-800 px-2 py-1 rounded[^"]*"/variant="success" size="sm"/g' "$filepath"
  sed -i 's/className="bg-green-100 text-green-700 px-2 py-1 rounded[^"]*"/variant="success" size="sm"/g' "$filepath"
  
  # Pattern 2: Badge error
  sed -i 's/className="bg-red-100 text-red-800 px-2 py-1 rounded[^"]*"/variant="error" size="sm"/g' "$filepath"
  sed -i 's/className="bg-red-100 text-red-700 px-2 py-1 rounded[^"]*"/variant="error" size="sm"/g' "$filepath"
  
  # Pattern 3: Badge warning
  sed -i 's/className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded[^"]*"/variant="warning" size="sm"/g' "$filepath"
  
  # Pattern 4: Badge info
  sed -i 's/className="bg-blue-100 text-blue-800 px-2 py-1 rounded[^"]*"/variant="info" size="sm"/g' "$filepath"
  
  # Pattern 5: Alert success (div wrapper)
  sed -i 's/<div className="bg-green-50 border border-green-200[^"]*">/<Alert intent="success" variant="solid">/g' "$filepath"
  
  # Pattern 6: Alert error
  sed -i 's/<div className="bg-red-50 border border-red-200[^"]*">/<Alert intent="error" variant="solid">/g' "$filepath"
  
  # Pattern 7: Alert warning
  sed -i 's/<div className="bg-yellow-50 border border-yellow-200[^"]*">/<Alert intent="warning" variant="solid">/g' "$filepath"
  
  # Compter aprÃ¨s
  AFTER=$(grep -cE "bg-(green|red|yellow|blue)-(50|100|200)" "$filepath" || echo 0)
  
  CHANGES=$((BEFORE - AFTER))
  TOTAL_CHANGES=$((TOTAL_CHANGES + CHANGES))
  
  echo "   âœ… Changements: $CHANGES patterns remplacÃ©s"
  
done

echo ""
echo "================================================"
echo "âœ… MIGRATION TERMINÃ‰E"
echo "   Fichiers traitÃ©s: ${#FILES[@]}"
echo "   Patterns remplacÃ©s: ~$TOTAL_CHANGES"
echo ""
echo "âš ï¸  Ã‰TAPES MANUELLES REQUISES:"
echo "1. Ajouter: import { Alert, Badge } from '@fafa/ui'"
echo "2. Remplacer <span> par <Badge> pour patterns migrÃ©s"
echo "3. Valider TypeScript: npm run typecheck"
echo "4. Tester en dev: npm run dev"
echo ""
echo "ðŸ’¾ Backups crÃ©Ã©s: *.backup"
echo "   Pour restaurer: mv file.tsx.backup file.tsx"
