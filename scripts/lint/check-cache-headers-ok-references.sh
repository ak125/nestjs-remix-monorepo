#!/usr/bin/env bash
# Force que tout commentaire d'exemption `CACHE-HEADERS-OK` cite une
# référence traçable au format (#NNN), (INC-YYYY-NNN) ou (ADR-NNN) suivie
# d'une raison courte non-vide.
#
# Pourquoi : les dérogations orphelines sans ticket s'accumulent et deviennent
# impossibles à reviewer en bulk. Voir INC-2026-005 (PR #320) + memory
# feedback_pr_scope_recovery_vs_platform.
#
# Bon (accepté) :
#   // CACHE-HEADERS-OK (#320) — route 410 statique, no-store déjà posé
#   // CACHE-HEADERS-OK (INC-2026-005) — exemption documentée
#   // CACHE-HEADERS-OK (ADR-028) — read-only preprod
#
# Mauvais (refusé) :
#   // CACHE-HEADERS-OK
#   // CACHE-HEADERS-OK juste pour ce test
#   // CACHE-HEADERS-OK (FIXME)
#
# Used by: .husky/pre-commit (staged) + CI lint job (full repo).
# Sister rule (positive): .ast-grep/rules/frontend-no-headers-bypass-buildCacheHeaders.yml

set -euo pipefail

# Default scope: source code only (avoid scanning audit-reports/, log.md, etc.)
DEFAULT_SCOPE=(frontend/app backend/src scripts)
if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  mapfile -t FILES < <(
    find "${DEFAULT_SCOPE[@]}" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) 2>/dev/null
  )
fi

VIOLATIONS=0
# Accept: (#NNN) or (INC-YYYY-NN[N]) or (ADR-NNN) followed by whitespace then
# at least one non-whitespace char (the reason).
ACCEPT_RE='CACHE-HEADERS-OK[[:space:]]+\((#[0-9]+|INC-[0-9]{4}-[0-9]+|ADR-[0-9]+)\)[[:space:]]+[^[:space:]]'

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  # Only inspect comments — be permissive about leading slashes.
  while IFS=: read -r line content; do
    # Strip leading // and whitespace
    stripped="${content#"${content%%[![:space:]]*}"}"
    stripped="${stripped#//}"
    stripped="${stripped#"${stripped%%[![:space:]]*}"}"
    # Match accepted pattern
    if [[ "$stripped" =~ $ACCEPT_RE ]]; then
      continue
    fi
    echo "❌ $f:$line — CACHE-HEADERS-OK without traceable reference:" >&2
    echo "     $content" >&2
    VIOLATIONS=$((VIOLATIONS + 1))
  done < <(grep -nE "CACHE-HEADERS-OK" "$f" 2>/dev/null || true)
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "" >&2
  echo "❌ $VIOLATIONS unanchored CACHE-HEADERS-OK exemption(s) found." >&2
  echo "   Add a reference: // CACHE-HEADERS-OK (#NNN | INC-YYYY-NNN | ADR-NNN) — reason" >&2
  exit 1
fi

echo "✅ All CACHE-HEADERS-OK exemptions properly anchored."
