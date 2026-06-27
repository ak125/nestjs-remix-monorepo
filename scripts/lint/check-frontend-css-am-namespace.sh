#!/usr/bin/env bash
# Block un-migrated reserved-namespace CSS vars in frontend app CSS.
#
# Why: DT-2b (Tailwind-4 chantier) renamed every @fafa/design-tokens scale var to
# the --am-* namespace so it can't collide with Tailwind v4's reserved theme
# namespaces (--color-*, --spacing-*, --font-*, --radius-*, --shadow-*,
# --container-*, --breakpoint-*) once we swap engines (TW-2). The package-side
# gate (check:reserved-namespaces) only sees tokens.css; this catches CONSUMERS in
# frontend/app/**/*.css that still reference an old (non --am-) reserved var —
# which would resolve to nothing post-swap (silent break, no fallback guaranteed).
#
# A `var(--<reserved>-…)` is a violation UNLESS it is --am- prefixed. Non-reserved
# customs (--line-height-*, --letter-spacing-*, --max-width-*, --grid-*, --z-*,
# --transition-*), locally-defined vars (--brand-primary*, --duration-*, --ease-*),
# and bare shadcn roles (--background …) are intentionally NOT matched.
#
# Used by: CI lint job (full scan). Read-only; exits 1 on any violation.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCAN_DIR="${1:-$ROOT/frontend/app}"

# var(--<reserved>-  where <reserved> immediately follows `var(--` (so --am-font- is
# NOT matched: there `am-` follows `var(--`, not `font-`).
PATTERN='var\(--(color|spacing|container|breakpoint|font|shadow|radius)-'

if [ ! -d "$SCAN_DIR" ]; then
  echo "check-frontend-css-am-namespace: scan dir not found: $SCAN_DIR" >&2
  exit 2
fi

matches="$(grep -rnoE "$PATTERN" --include='*.css' "$SCAN_DIR" 2>/dev/null || true)"

if [ -n "$matches" ]; then
  echo "❌ un-migrated reserved-namespace CSS var(s) in frontend app CSS:" >&2
  echo "$matches" | sed 's/^/   /' >&2
  echo "" >&2
  echo "   Fix: rename to the --am-* namespace, e.g. var(--font-body) → var(--am-font-body, <literal-fallback>)." >&2
  exit 1
fi

echo "✅ frontend app CSS: 0 un-migrated reserved-namespace var refs (all --am-* or non-reserved)."
