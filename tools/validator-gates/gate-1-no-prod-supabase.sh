#!/usr/bin/env bash
set -euo pipefail

# ============================================
# GATE-1: No PROD Supabase/DB references in DEV
# ============================================

echo "🔒 GATE-1: No PROD Supabase/DB references in DEV"

# Denylist des project_ref PROD (a maintenir)
PROD_REFS=(
  "cxpojprgwgubzjyqzmoq"
)

# Exclure docs / gouvernance / scripts pour eviter faux positifs
EXCLUDE_GLOBS=(
  "governance/**"
  "docs/**"
  ".spec/**"
  ".local/**"
  ".archive/**"
  "**/*.md"
  "**/*.template"
  "**/*.example"
  "**/*.sql"                    # Migrations (URLs CDN, pas connexions runtime)
  "backend/*.js"                # Scripts one-shot
  "backend/*.mjs"
  "backend/*.sh"
  ".vscode/**"
  "docker-compose.imgproxy.yml" # CDN URL whitelist, pas connexion DB
)

# Cibles: seulement fichiers trackes pertinents
FILES=$(
  git ls-files 2>/dev/null \
  | grep -E '(^|/)\.env(\..+)?$|(^|/)\.env\..+|\.github/workflows/.*\.yml$|docker-compose.*\.yml$|prisma/.*|supabase/.*' \
  || true
)

errors=0

is_excluded() {
  local f="$1"
  for g in "${EXCLUDE_GLOBS[@]}"; do
    # bash glob match simple
    case "$f" in
      $g) return 0 ;;
    esac
  done
  return 1
}

while IFS= read -r f; do
  [[ -z "${f:-}" ]] && continue
  [[ ! -f "$f" ]] && continue
  if is_excluded "$f"; then
    continue
  fi

  for ref in "${PROD_REFS[@]}"; do
    if grep -q "$ref" "$f" 2>/dev/null; then
      echo "❌ PROD project_ref '$ref' found in: $f"
      # Ne pas afficher les valeurs, seulement la ligne (masquee)
      grep -n "$ref" "$f" 2>/dev/null | head -5 | sed 's/=.*/=[REDACTED]/'
      errors=$((errors+1))
    fi
  done
done <<< "$FILES"

# Runtime env (CI)
for ref in "${PROD_REFS[@]}"; do
  if [[ -n "${SUPABASE_URL:-}" ]] && echo "$SUPABASE_URL" | grep -q "$ref"; then
    echo "❌ PROD project_ref '$ref' found in runtime SUPABASE_URL [REDACTED]"
    errors=$((errors+1))
  fi
  if [[ -n "${DATABASE_URL:-}" ]] && echo "$DATABASE_URL" | grep -q "$ref"; then
    echo "❌ PROD project_ref '$ref' found in runtime DATABASE_URL [REDACTED]"
    errors=$((errors+1))
  fi
done

if [[ "$errors" -gt 0 ]]; then
  echo "🚫 GATE-1 FAILED ($errors issue(s))"
  exit 1
fi

echo "✅ GATE-1 PASSED"
