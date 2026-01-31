#!/usr/bin/env bash
# Anti-regression script: detect client-side localhost hardcodes
# Usage: npm run check:no-client-localhost
set -euo pipefail

FAIL=0

while IFS= read -r f; do
  # Trouver où commence le composant React
  comp_line=$(rg -n "^export default function" "$f" | head -1 | cut -d: -f1 || true)
  [ -z "${comp_line:-}" ] && continue

  # Trouver où commence l'action (si présente) - à exclure car SSR
  action_line=$(rg -n "^export async function action" "$f" | head -1 | cut -d: -f1 || true)

  # Chercher les hardcodes
  while IFS= read -r match; do
    linenum=$(echo "$match" | cut -d: -f1)

    # Si après action, c'est SSR (ok)
    if [ -n "${action_line:-}" ] && [ "$linenum" -ge "$action_line" ]; then
      continue
    fi

    # Si après composant, c'est CLIENT (interdit)
    if [ "$linenum" -ge "$comp_line" ]; then
      echo "❌ Client-side localhost hardcode in: $f (line $linenum)"
      echo "  -> $match"
      FAIL=1
    fi
  done < <(rg -n "http://(127\.0\.0\.1|localhost):3000" "$f" || true)

done < <(rg -l "http://(127\.0\.0\.1|localhost):3000" frontend/app/routes 2>/dev/null || true)

if [ "$FAIL" -eq 1 ]; then
  echo ""
  echo "⛔ FAIL: Client-side localhost hardcodes detected!"
  echo "   Fix: Replace with relative URLs (e.g., /api/...)"
  exit 1
fi

echo "✅ No client-side localhost hardcodes found."
