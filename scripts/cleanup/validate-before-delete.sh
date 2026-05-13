#!/usr/bin/env bash
#
# validate-before-delete.sh — last local guard-rail before `git rm` (Phase 0.9 / cleanup).
#
# This is NOT the audit. The source of truth for the analysis is audit/*.json
# (produced by `npm run audit:inventory`). This script re-checks the *simple*
# deletion conditions #0–#6 mechanically on the targeted file, so a stray `git rm`
# can't slip through. SAFE is a strong signal, not a guarantee — always
# `npm run build` (×2) and `npm test` on a cleanup PR before push.
#
# Conditions checked here:
#   #0  not in the never-auto-delete zone (hardcoded below + audit/runtime-entrypoints.json)
#   #1  zero static import (grep of path/module across source dirs)
#   #2  zero dynamic import (audit/dynamic-import-edges.json, when present)
#   #3  zero runtime use (audit/runtime-entrypoints.json, when present; Remix routes)
#   #4  zero string reference (path/basename appears as a literal anywhere)
#   #5  zero CI/script use (.github/workflows, package.json scripts/bin, .husky)
#   #6  zero DB/migration reference (SQL grep)
#   (#7 build+tests, #8 human review — done at PR time, not here.)
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

# Hardcoded never-auto-delete zone — MUST mirror NEVER_AUTO_DELETE in
# scripts/audit/build-deep-inventory.js (glob: ** = any segments, * = within a segment).
NEVER_AUTO_DELETE_GLOBS=(
  'frontend/app/routes/**'
  'backend/src/workers/**'
  'backend/supabase/migrations/**'
  '.github/workflows/**'
  'docker/**'
  'packages/seo-roles/**'
  'packages/seo-role-contracts/**'
  'backend/src/main.ts'
  'backend/src/main.server.ts'
  'backend/src/app.module.ts'
  'backend/src/workers/worker.module.ts'
  'frontend/app/entry.client.tsx'
  'frontend/app/entry.server.tsx'
  'frontend/app/root.tsx'
)

glob_match() { # glob_match <glob> <path>
  local g="$1" p="$2" re
  re="$(printf '%s' "$g" | sed -e 's/[.[\*^$()+?{|]/\\&/g' -e 's/\\\*\\\*/__GLOBSTAR__/g' -e 's/\\\*/[^\/]*/g' -e 's/__GLOBSTAR__/.*/g')"
  [[ "$p" =~ ^${re}$ ]]
}

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

# ---- 0. never-auto-delete zone (hard refusal, regardless of other findings) ----
for g in "${NEVER_AUTO_DELETE_GLOBS[@]}"; do
  if glob_match "$g" "$REL"; then
    report_hit "[NEVER-AUTO-DELETE] '$REL' is in the protected zone ('$g') — refuse to delete even if the audit thinks it dead."
  fi
done

# ---- 0b / 2 / 3. audit/ artefacts cross-check (when present) ----
# NB: the JSON path and $REL are passed to `node -e` via process.argv, never spliced
# into the JS source — a path/basename containing a quote, backtick or ${...} must not
# be able to alter the probe (this script gets run on arbitrary repo paths).
RUNTIME_JSON="$REPO_ROOT/audit/runtime-entrypoints.json"
DYN_JSON="$REPO_ROOT/audit/dynamic-import-edges.json"
if [[ -f "$RUNTIME_JSON" ]] && command -v node >/dev/null 2>&1; then
  # The runtime_files list is broad and includes files of NestJS modules that
  # are NOT reachable from app.module.ts (the entrypoints.nestjs_unreachable_modules
  # list). For Step B drops of those subtrees, the runtime-entrypoint check must
  # not blanket-reject — by definition, an unreachable module file is not runtime.
  if node -e '
    const j = require(process.argv[1]);
    const rel = process.argv[2];
    const runtime = j.runtime_files || [];
    if (!runtime.includes(rel)) process.exit(1);
    const unreachable = (j.entrypoints && j.entrypoints.nestjs_unreachable_modules) || [];
    const subtreeDirs = unreachable
      .filter((p) => p.startsWith("backend/src/modules/"))
      .map((p) => p.replace(/[^/]+\.module\.ts$/, ""));
    if (subtreeDirs.some((d) => rel.startsWith(d))) process.exit(1);
    process.exit(0);
  ' "$RUNTIME_JSON" "$REL"; then
    report_hit "[RUNTIME-ENTRYPOINT] '$REL' is listed in audit/runtime-entrypoints.json — DO NOT delete."
  fi
fi
if [[ -f "$DYN_JSON" ]] && command -v node >/dev/null 2>&1; then
  if node -e 'const j=require(process.argv[1]); process.exit((j.edges||[]).some((e)=>e.to===process.argv[2])?0:1)' "$DYN_JSON" "$REL"; then
    report_hit "[DYNAMIC-IMPORT] '$REL' is the target of a dynamic import (audit/dynamic-import-edges.json)."
  fi
fi

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

# ---- 4b. HTTP route callers (catch frontend HTTP edges that TS imports miss) ----
# Lesson canari PR-3b-1 substitution (PR #466 closed 2026-05-13): a NestJS module can
# be "unreachable from app.module.ts" yet still serve live HTTP traffic via a sibling
# *.controller.ts that the frontend calls with `fetch('/api/...')`. TS does not see
# this edge — build green, but 404 prod on every page hitting the route.
#
# For any file under `backend/src/modules/<subtree>/<dir>/...`, extract
# `@Controller('<path>')` strings from `*.controller.ts` files in the subtree, then
# grep that path across frontend/app, packages, scripts, e2e, tests. Any hit means
# the subtree exposes a live HTTP edge — dropping any of its files breaks the route.
#
# Scope: only modules whose *.controller.ts uses a string-arg @Controller decorator.
# `@Controller({ path: '...' })` object-form is not parsed (rare in this codebase).
SUBTREE_DIR=""
if [[ "$REL" =~ ^(backend/src/modules/[^/]+)/ ]]; then
  SUBTREE_DIR="${BASH_REMATCH[1]}/"
fi

if [[ -n "$SUBTREE_DIR" && -d "$REPO_ROOT/$SUBTREE_DIR" ]]; then
  # Extract route paths from @Controller('<path>') string-arg decorators in the subtree.
  CONTROLLER_PATHS=$(grep -rhE "@Controller\s*\(\s*['\"\`]" "$REPO_ROOT/$SUBTREE_DIR" 2>/dev/null \
    | sed -nE "s/.*@Controller\s*\(\s*['\"\`]([^'\"\`]+)['\"\`].*/\1/p" \
    | sort -u || true)
  if [[ -n "$CONTROLLER_PATHS" ]]; then
    # Resolve the search dirs that actually exist (e2e/ and tests/ are optional).
    HTTP_SEARCH_DIRS=()
    for d in frontend/app packages scripts e2e tests; do
      [[ -d "$REPO_ROOT/$d" ]] && HTTP_SEARCH_DIRS+=("$REPO_ROOT/$d")
    done
    if [[ ${#HTTP_SEARCH_DIRS[@]} -gt 0 ]]; then
      while IFS= read -r ROUTE_PATH; do
        [[ -z "$ROUTE_PATH" ]] && continue
        ROUTE_HITS=$(grep -rln --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.cjs' \
          -F "$ROUTE_PATH" \
          "${HTTP_SEARCH_DIRS[@]}" 2>/dev/null | grep -v "^$ABS$" || true)
        if [[ -n "$ROUTE_HITS" ]]; then
          while IFS= read -r f; do
            report_hit "[HTTP-ROUTE-CALLER] @Controller('$ROUTE_PATH') consumed by: ${f#"$REPO_ROOT"/}"
          done <<< "$ROUTE_HITS"
        fi
      done <<< "$CONTROLLER_PATHS"
    fi
  fi
fi

# ---- 5. CI / npm scripts / git hooks (path or basename in workflows, package.json, husky) ----
CI_HITS=$(grep -rln \
  -e "$REL" -e "$BASENAME" \
  "$REPO_ROOT/.github/workflows" "$REPO_ROOT/.husky" 2>/dev/null | grep -v "/_/" || true)
PKG_HITS=$( { git -C "$REPO_ROOT" ls-files '*package.json' 2>/dev/null || true; } | while IFS= read -r pj; do
  grep -lE "\"(scripts|bin)\"" "$REPO_ROOT/$pj" >/dev/null 2>&1 && grep -lF -e "$REL" -e "$BASENAME" "$REPO_ROOT/$pj" 2>/dev/null && echo "$pj"
done || true)
for h in $CI_HITS $PKG_HITS; do
  report_hit "[CI/SCRIPT] path/basename referenced in: ${h#"$REPO_ROOT"/}"
done

# ---- 7. Knowledge / governance references ----
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
