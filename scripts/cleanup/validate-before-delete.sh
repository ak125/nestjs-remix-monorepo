#!/usr/bin/env bash
#
# validate-before-delete.sh — safety probe for cleanup PRs.
#
# Run before deleting a file flagged unused by knip. Reports SAFE or BLOCKED
# with the list of references that would be broken by the deletion.
#
# SAFE is a strong signal, not a guarantee. Always `npm run build` and
# `npm test` on a cleanup PR before push.
#
# Usage:
#   ./scripts/cleanup/validate-before-delete.sh <relative_or_absolute_path>
#
# Exit codes:
#   0 — SAFE
#   1 — BLOCKED (hits found)
#   2 — invalid argument / file not found / setup error

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <path-to-file-under-repo>" >&2
  exit 2
fi

INPUT="$1"
# Normalise to repo-relative path
if [[ "$INPUT" = /* ]]; then
  REL="${INPUT#"$REPO_ROOT"/}"
else
  REL="$INPUT"
fi
ABS="$REPO_ROOT/$REL"

if [[ ! -f "$ABS" ]]; then
  echo "ERROR: file not found: $ABS" >&2
  exit 2
fi

BASENAME="$(basename "$REL")"
STEM="${BASENAME%.*}"      # strip last extension
STEM2="${STEM%.*}"         # strip second ext (for .controller.ts -> "whatever")
MODULE_NAME="$STEM"        # NestJS-style class names are derived from the filename
# class-guess: CamelCase from dash-case filename stem
CLASS_GUESS="$(echo "$STEM" | awk -F'[-.]' '{ for (i=1;i<=NF;i++) printf("%s", toupper(substr($i,1,1)) substr($i,2)) }')"

echo "=== validate-before-delete ==="
echo "File     : $REL"
echo "Basename : $BASENAME"
echo "Stem     : $STEM"
echo "Class?   : $CLASS_GUESS"
echo ""

HITS=0
HIT_LINES=()

report_hit() {
  HITS=$((HITS + 1))
  HIT_LINES+=("$1")
}

# ---- 1. Remix convention-loaded route? ----
if [[ "$REL" == frontend/app/routes/* ]]; then
  report_hit "[REMIX-ROUTE] File is under frontend/app/routes/ — auto-loaded by Remix flat-routes, DO NOT delete."
fi

# ---- 2. NestJS DI registration (providers / imports / exports / controllers) ----
#  Grep the class name in @Module({ ... }) arrays. NestJS loads by identifier, not file path.
if [[ -n "$CLASS_GUESS" && ${#CLASS_GUESS} -gt 3 ]]; then
  DI_HITS=$(grep -rl --include='*.module.ts' \
    -E "(providers|imports|exports|controllers)\s*:\s*\[[^]]*\b${CLASS_GUESS}\b" \
    "$REPO_ROOT/backend/src" 2>/dev/null | grep -v "^$ABS$" || true)
  if [[ -n "$DI_HITS" ]]; then
    while IFS= read -r f; do
      report_hit "[NESTJS-DI] ${CLASS_GUESS} referenced in @Module array: ${f#"$REPO_ROOT"/}"
    done <<< "$DI_HITS"
  fi
fi

# ---- 3. Static / relative imports (with or without extension) ----
IMPORT_STEM_HITS=$(grep -rln --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.cjs' \
  -E "(from|import|require)\s*\(?\s*['\"\`][^'\"\`]*\/${STEM}(\.[a-z]+)?['\"\`]" \
  "$REPO_ROOT/backend/src" "$REPO_ROOT/frontend/app" "$REPO_ROOT/packages" "$REPO_ROOT/scripts" 2>/dev/null | grep -v "^$ABS$" || true)
if [[ -n "$IMPORT_STEM_HITS" ]]; then
  while IFS= read -r f; do
    report_hit "[IMPORT] imported by: ${f#"$REPO_ROOT"/}"
  done <<< "$IMPORT_STEM_HITS"
fi

# ---- 4. Dynamic/runtime string references (path or basename) ----
STRING_HITS=$(grep -rln --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.cjs' --include='*.json' --include='*.yml' --include='*.yaml' \
  -E "['\"\`][^'\"\`]*${REL}['\"\`]|['\"\`]${BASENAME}['\"\`]" \
  "$REPO_ROOT/backend" "$REPO_ROOT/frontend" "$REPO_ROOT/packages" "$REPO_ROOT/scripts" "$REPO_ROOT/.github" 2>/dev/null | grep -v "^$ABS$" || true)
if [[ -n "$STRING_HITS" ]]; then
  while IFS= read -r f; do
    report_hit "[STRING-REF] path/basename appears as string in: ${f#"$REPO_ROOT"/}"
  done <<< "$STRING_HITS"
fi

# ---- 5. Knowledge / governance references ----
KB_HITS=$(grep -rln --include='*.md' \
  -E "${STEM}" \
  "$REPO_ROOT/.claude/knowledge" "$REPO_ROOT/.claude/rules" 2>/dev/null || true)
if [[ -n "$KB_HITS" ]]; then
  while IFS= read -r f; do
    report_hit "[KNOWLEDGE] referenced in: ${f#"$REPO_ROOT"/}"
  done <<< "$KB_HITS"
fi

# ---- 6. Supabase migrations / SQL ----
SQL_HITS=$(grep -rln --include='*.sql' "${STEM}" "$REPO_ROOT/backend/supabase" 2>/dev/null || true)
if [[ -n "$SQL_HITS" ]]; then
  while IFS= read -r f; do
    report_hit "[SQL] name appears in migration: ${f#"$REPO_ROOT"/}"
  done <<< "$SQL_HITS"
fi

# ---- Verdict ----
echo ""
if [[ $HITS -eq 0 ]]; then
  echo "VERDICT: SAFE TO DELETE"
  echo ""
  echo "  No references found across imports, NestJS DI, string references,"
  echo "  knowledge docs, or SQL migrations."
  echo ""
  echo "  Recommended next steps before commit:"
  echo "    1. npm run typecheck"
  echo "    2. npm run build"
  echo "    3. npm test"
  echo "    4. git rm \"$REL\" && git commit -m 'chore(cleanup): remove $REL'"
  exit 0
else
  echo "VERDICT: BLOCKED ($HITS reference(s) found)"
  echo ""
  for line in "${HIT_LINES[@]}"; do
    echo "  - $line"
  done
  echo ""
  echo "  Review each hit. If a reference is itself dead code, delete it first"
  echo "  (bottom-up cleanup). Otherwise, keep this file and document the"
  echo "  retention reason in .claude/knowledge/ops/cleanup-targets.md."
  exit 1
fi
