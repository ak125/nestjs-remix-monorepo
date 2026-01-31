#!/usr/bin/env bash
#
# Guardrail script: Ensure no localhost:3000 patterns remain in route files
#
# Usage:
#   ./scripts/check-no-localhost.sh
#
# Exit codes:
#   0 - Success (no localhost:3000 found)
#   1 - Failed (localhost:3000 patterns found)
#
# Add to CI or pre-commit hooks to prevent regression.

set -uo pipefail

ROUTES_DIR="frontend/app/routes"

# Check if routes directory exists
if [ ! -d "$ROUTES_DIR" ]; then
  echo "❌ Routes directory not found: $ROUTES_DIR"
  exit 1
fi

# Count occurrences of localhost:3000 (grep returns 1 if nothing found, that's OK)
COUNT=$(grep -r "localhost:3000" "$ROUTES_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')

if [ "$COUNT" != "0" ]; then
  echo "❌ Found localhost:3000 in routes ($COUNT hits)"
  echo ""
  echo "Files with localhost:3000:"
  grep -rn "localhost:3000" "$ROUTES_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null || true
  echo ""
  echo "🔧 Fix: Use getInternalApiUrl() from '~/utils/internal-api.server'"
  echo "   Run: node scripts/codemods/fix-internal-api-urls.mjs"
  exit 1
fi

echo "✅ No localhost:3000 in $ROUTES_DIR"

# Check vite.config.ts doesn't have active proxy to :3000 (ignore comments)
if grep -v "^[[:space:]]*//" frontend/vite.config.ts 2>/dev/null | grep -q "target.*:3000"; then
  echo "❌ FAIL: vite.config.ts has proxy to :3000"
  echo "   This causes double-hop HTTP calls in middlewareMode"
  exit 1
fi

echo "✅ vite.config.ts is clean (no proxy to :3000)"

# Check installGlobals is not called (Node 20+ has native fetch) - ignore comments
if grep -v "^[[:space:]]*//" frontend/vite.config.ts 2>/dev/null | grep -q "installGlobals()"; then
  echo "❌ FAIL: installGlobals() found in vite.config.ts"
  echo "   This conflicts with Node 20+ native fetch (undici)"
  exit 1
fi

echo "✅ No installGlobals() in vite.config.ts"

# Vérifier cohérence CSP/images
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/check-csp-images.sh" ]; then
  echo ""
  bash "$SCRIPT_DIR/check-csp-images.sh"
fi

echo ""
echo "🎉 All anti-regression checks passed!"
exit 0
