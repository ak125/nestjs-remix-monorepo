#!/usr/bin/env bash
set -euo pipefail

# ============================================
# GATE-4: Secrets & sensitive artifacts hygiene
# ============================================

echo "🔒 GATE-4: Secrets & sensitive artifacts hygiene"

tracked=$(git ls-files 2>/dev/null || true)

# Patterns de fichiers interdits (trackes)
# Note: on utilise grep -E
forbidden_tracked_regex='(^|/)\.env(\..+)?$|\.env\.production$|\.env\.prod$|\.env\.backup|\.pem$|\.key$|_dump\.sql$|_export\.csv$'

# Patterns autorises (example, template)
allow_regex='\.env\.example$|\.env\.template$|example\.env$'

# Trouver les fichiers interdits trackes
bad_tracked=$(echo "$tracked" | grep -E "$forbidden_tracked_regex" | grep -vE "$allow_regex" || true)

if [[ -n "$bad_tracked" ]]; then
  echo "❌ Sensitive files are TRACKED in git (list truncated):"
  echo "$bad_tracked" | head -50
  echo ""
  echo "🚫 GATE-4 FAILED"
  exit 1
fi

echo "✅ GATE-4 PASSED"
