#!/usr/bin/env bash
set -euo pipefail

# ============================================
# GATE-2: No dangerous MCP permissions in tracked config
# ============================================

echo "🔒 GATE-2: No dangerous MCP permissions in tracked config"

DANGEROUS=(
  "mcp__supabase__execute_sql"
  "mcp__supabase__apply_migration"
)

# Seulement les fichiers TRACKES dans git
files=$(git ls-files 2>/dev/null | grep -E '^\.claude/.*settings.*\.json$' || true)

errors=0

while IFS= read -r f; do
  [[ -z "${f:-}" ]] && continue
  [[ ! -f "$f" ]] && continue

  for p in "${DANGEROUS[@]}"; do
    if grep -q "\"$p\"" "$f" 2>/dev/null; then
      echo "❌ Dangerous MCP permission '$p' found in tracked file: $f"
      grep -n "\"$p\"" "$f" 2>/dev/null | head -10
      errors=$((errors+1))
    fi
  done
done <<< "$files"

if [[ "$errors" -gt 0 ]]; then
  echo "🚫 GATE-2 FAILED ($errors issue(s))"
  exit 1
fi

echo "✅ GATE-2 PASSED"
