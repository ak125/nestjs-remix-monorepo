#!/usr/bin/env bash
set -euo pipefail

echo "🔒 GATE-4: Secrets & sensitive artifacts hygiene (progressive)"

MODE="${MODE:-observe}"   # observe | block

# Fichiers interdits (hors templates)
FORBIDDEN_REGEX='(^|/)\.env(\..+)?$|\.env\.production$|\.env\.prod$|\.env\.backup|\.pem$|\.key$|_dump\.sql$|_export\.csv$'
ALLOW_REGEX='\.env\.example$|\.env\.template$|\.env\.sample$|example\.env$'

# 1) Report des fichiers déjà trackés (legacy)
tracked=$(git ls-files 2>/dev/null || true)
bad_tracked=$(echo "$tracked" | grep -E "$FORBIDDEN_REGEX" | grep -vE "$ALLOW_REGEX" || true)

if [[ -n "$bad_tracked" ]]; then
  echo "⚠️  Sensitive files already TRACKED in git (legacy, list truncated):"
  echo "$bad_tracked" | head -50
  if [[ "$MODE" == "block" ]]; then
    echo "ℹ️  MODE=block: legacy tracked files are NOT blocking yet (grandfather mode)."
  fi
fi

# 2) Bloquer uniquement les NOUVEAUX fichiers sensibles ajoutés dans ce commit
staged_added=$(git diff --cached --name-status 2>/dev/null | awk '$1=="A"{print $2}' || true)
new_bad=0

while IFS= read -r f; do
  [[ -z "${f:-}" ]] && continue
  # ignore allowlist
  if echo "$f" | grep -qE "$ALLOW_REGEX" 2>/dev/null; then
    continue
  fi

  if echo "$f" | grep -qE "$FORBIDDEN_REGEX" 2>/dev/null; then
    echo "❌ New sensitive file ADDED in commit: $f"
    new_bad=$((new_bad+1))
  fi
done <<< "$staged_added"

if [[ "$new_bad" -gt 0 ]]; then
  if [[ "$MODE" == "observe" ]]; then
    echo "⚠️  GATE-4 would block ($new_bad new sensitive file(s)), but MODE=observe."
    exit 0
  fi
  echo "🚫 GATE-4 FAILED ($new_bad new sensitive file(s) detected)"
  exit 1
fi

echo "✅ GATE-4 PASSED (progressive)"
