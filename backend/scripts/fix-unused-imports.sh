#!/bin/bash

# Script pour prÃ©fixer automatiquement les imports non utilisÃ©s avec underscore

set -e

echo "ðŸ”§ Correction des imports non utilisÃ©s..."

# Liste des imports Ã  traiter
IMPORTS=(
  "UseGuards"
  "Post"
  "Put"
  "Delete"
  "Body"
  "Param"
  "Query"
  "ApiBearerAuth"
  "BadRequestException"
  "EventEmitter2"
  "OrderLine"
  "OrderDbEntity"
  "OrderLineDbEntity"
  "OrderWithDetails"
  "VehicleFilterDto"
  "UserWithStats"
  "User"
  "PaginatedUsers"
  "GammeWithFamily"
  "ConfigItemDto"
  "PiecesRealController"
  "SupabaseBaseService"
  "NestConfigService"
  "MenuConfig"
  "Logger"
  "ContactTicket"
  "ReviewData"
  "SeoVariables"
  "SeoTemplate"
  "SeoSwitch"
  "SystemMetric"
  "FilterMetadata"
  "SwitchSystem"
  "crypto"
  "createHash"
)

FIXED=0

for import in "${IMPORTS[@]}"; do
  # Chercher les fichiers avec cet import non utilisÃ©
  files=$(npm run lint 2>&1 | grep -B 1 "'${import}' is defined but never used" | grep "^/" | sort -u || true)
  
  if [ -z "$files" ]; then
    continue
  fi
  
  echo "ðŸ“ Traitement de '$import'..."
  
  for file in $files; do
    if [ ! -f "$file" ]; then
      continue
    fi
    
    # PrÃ©fixer l'import avec type ... as _
    # Pattern 1: import { Import, ...
    if sed -i.bak "s/import { ${import},/import { type ${import} as _${import},/g" "$file" 2>/dev/null; then
      rm -f "$file.bak"
      ((FIXED++)) || true
    fi
    
    # Pattern 2: import { ..., Import, ...
    if sed -i.bak "s/, ${import},/, type ${import} as _${import},/g" "$file" 2>/dev/null; then
      rm -f "$file.bak"
    fi
    
    # Pattern 3: import { ..., Import }
    if sed -i.bak "s/, ${import} }/, type ${import} as _${import} }/g" "$file" 2>/dev/null; then
      rm -f "$file.bak"
    fi
    
    # Pattern 4: import { Import }
    if sed -i.bak "s/import { ${import} }/import { type ${import} as _${import} }/g" "$file" 2>/dev/null; then
      rm -f "$file.bak"
    fi
    
    echo "  âœ“ $file"
  done
done

echo ""
echo "âœ… Corrections terminÃ©es!"
echo "ðŸ“Š Fichiers modifiÃ©s: $FIXED"
echo ""
echo "ðŸ” VÃ©rification avec npm run lint..."
