#!/usr/bin/env bash
# Block Tailwind-v4 HARD-REMOVED utilities in frontend app code.
#
# Why: TW-1 (Tailwind-4 chantier) pre-normalized the deprecated utilities that v4
# DELETES outright — so a later engine swap (TW-2) is a no-op, not a silent
# breakage. These utilities still "work" under v3, so nothing else stops a
# regression from creeping back in before the swap. This gate does.
#
# Canonical replacements (all valid under BOTH v3 and v4):
#   flex-shrink-*  → shrink-*          flex-grow-*  → grow-*
#   bg-opacity-N   → bg-<color>/N      text-opacity-N → text-<color>/N   (etc.)
#   overflow-ellipsis → text-ellipsis  decoration-slice/clone → box-decoration-*
#
# EXEMPT: dynamic bg-opacity where the color is interpolated
# (`${expr} bg-opacity-N`) — the /N modifier on a runtime-built class is not
# JIT-scannable, so it can't be converted here; refactor at TW-2. The 2 known
# sites are admin.config._index.tsx (category.color). The exemption is by
# pattern (interpolation immediately before bg-opacity), not by line number.
#
# Used by: CI lint job. Read-only; exits 1 on any violation.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCAN_DIR="${1:-$ROOT/frontend/app}"

if [ ! -d "$SCAN_DIR" ]; then
  echo "check-tailwind-v4-removed-utilities: scan dir not found: $SCAN_DIR" >&2
  exit 2
fi

INCLUDES=(--include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.css')

# Class-form patterns. Leading delimiter allows `:` (Tailwind variants like
# `md:flex-shrink-0`); trailing delimiter EXCLUDES `:` so raw CSS properties
# (`flex-shrink: 0`, `flex-grow: 1`) are NOT matched — only class tokens are.
NON_OPACITY='[:"'"'"'`( ]((flex-(shrink|grow))(-[0-9]+)?|overflow-ellipsis|decoration-(slice|clone))["'"'"'`) ]'
violations=""

non_op="$(grep -rnoE "$NON_OPACITY" "${INCLUDES[@]}" "$SCAN_DIR" 2>/dev/null || true)"
[ -n "$non_op" ] && violations+="$non_op"$'\n'

# Opacity utilities: flag bg/text/border/divide/ring/placeholder-opacity-N, but
# DROP lines where a `${...}` interpolation sits immediately before `bg-opacity`
# (un-convertible dynamic case, exempt until TW-2).
op="$(grep -rnoE "(bg|text|border|divide|ring|placeholder)-opacity-[0-9]+" "${INCLUDES[@]}" "$SCAN_DIR" 2>/dev/null || true)"
if [ -n "$op" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    file="${line%%:*}"; rest="${line#*:}"; lineno="${rest%%:*}"
    # Re-read the source line to test for the dynamic-interpolation exemption.
    src="$(sed -n "${lineno}p" "$file" 2>/dev/null || true)"
    if printf '%s' "$src" | grep -qE '\$\{[^}]*\}[^"'"'"'`]*bg-opacity-[0-9]'; then
      continue # exempt: dynamic interpolated color + bg-opacity
    fi
    violations+="$line"$'\n'
  done <<< "$op"
fi

violations="$(printf '%s' "$violations" | sed '/^$/d')"
if [ -n "$violations" ]; then
  echo "❌ Tailwind-v4 hard-removed utility/utilities found (use the v3+v4 canonical form):" >&2
  printf '%s\n' "$violations" | sed 's/^/   /' >&2
  echo "" >&2
  echo "   flex-shrink-*→shrink-* · flex-grow-*→grow-* · *-opacity-N→/N modifier ·" >&2
  echo "   overflow-ellipsis→text-ellipsis · decoration-slice/clone→box-decoration-*" >&2
  exit 1
fi

echo "✅ no Tailwind-v4 hard-removed utilities in $SCAN_DIR (dynamic bg-opacity exempt)."
