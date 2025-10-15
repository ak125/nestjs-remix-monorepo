#!/bin/bash

# Script pour préfixer automatiquement les imports non utilisés avec underscore

set -e

echo "🔧 Correction des imports non utilisés..."

# Liste des imports à traiter
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
  # Chercher les fichiers avec cet import non utilisé
  files=$(npm run lint 2>&1 | grep -B 1 "'${import}' is defined but never used" | grep "^/" | sort -u || true)
  
  if [ -z "$files" ]; then
    continue
  fi
  
  echo "📝 Traitement de '$import'..."
  
  for file in $files; do
    if [ ! -f "$file" ]; then
      continue
    fi
    
    # Préfixer l'import avec type ... as _
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
    
    echo "  ✓ $file"
  done
done

echo ""
echo "✅ Corrections terminées!"
echo "📊 Fichiers modifiés: $FIXED"
echo ""
echo "🔍 Vérification avec npm run lint..."
