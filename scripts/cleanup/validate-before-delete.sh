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
#   #2  zero dynamic import (audit/dynamic-import-edges.json — required)
#   #3  zero runtime use (audit/runtime-entrypoints.json — required; Remix routes)
#   #4  zero string reference (path/basename appears as a literal anywhere)
#   #5  zero CI/script use (.github/workflows, package.json scripts/bin, .husky)
#   #6  zero DB/migration reference (SQL grep)
#   (#7 build+tests, #8 human review — done at PR time, not here.)
#
# Fail-closed: SAFE is printed only when every check above actually ran. The target
# must be a regular, tracked, committed file of this repository (not a symlink, not
# inside a submodule, not a TypeScript declaration file), and both audit/ manifests must be tracked, committed and
# well-formed. A check that cannot run (missing/invalid evidence, absent `node`,
# search error) is never read as "no use found". Names are data: they are escaped
# before reaching a regex and never parsed as an option.
#
# Usage:
#   ./scripts/cleanup/validate-before-delete.sh <relative_or_absolute_path>
#   (a relative path is taken from the repository root)
#
# Exit codes:
#   0 — SAFE
#   1 — BLOCKED (hits found; checks that could not run are listed too)
#   2 — invalid argument / target out of scope / setup error / INCONCLUSIVE
#       (no hit, but at least one check could not run)

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"

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

ere_escape() { # ere_escape <text> — <text> as a literal inside an ERE
  printf '%s' "$1" | sed -e 's/[][\.*^$(){}+?|/]/\\&/g'
}

refuse() { # refuse <message> — the target cannot be judged
  echo "ERROR: $1" >&2
  exit 2
}

if [[ $# -ne 1 || -z "$1" ]]; then
  echo "Usage: $0 <path-to-file-under-repo>" >&2
  exit 2
fi

# ---- Target resolution: one physical, repo-relative spelling for every check ----
# `./x`, `a//b`, `a/./b`, `..` and absolute spellings all resolve to the same REL, so a
# protected path cannot dodge the never-auto-delete zone by being spelled differently.
INPUT="$1"
if [[ "$INPUT" = /* ]]; then CAND="$INPUT"; else CAND="$REPO_ROOT/$INPUT"; fi
NAME="$(basename -- "$CAND")"
PARENT_PHYS="$(CDPATH='' cd -P -- "$(dirname -- "$CAND")" 2>/dev/null && pwd -P)" \
  || refuse "file not found: $INPUT"
if [[ -z "$NAME" || "$NAME" == "." || "$NAME" == ".." || "$NAME" == "/" ]]; then
  refuse "not a file path: $INPUT"
fi
if [[ "$PARENT_PHYS" == "$REPO_ROOT" ]]; then
  REL="$NAME"
elif [[ "$PARENT_PHYS" == "$REPO_ROOT"/* ]]; then
  REL="${PARENT_PHYS#"$REPO_ROOT"/}/$NAME"
else
  refuse "'$INPUT' resolves outside the repository ($PARENT_PHYS/$NAME) — not cleanup scope."
fi
ABS="$REPO_ROOT/$REL"

if [[ -L "$ABS" ]]; then
  refuse "'$REL' is a symlink — never followed; delete it deliberately, outside this guard."
fi
if [[ ! -f "$ABS" ]]; then
  refuse "not a regular file: $REL"
fi
TOPLEVEL="$(git -C "$PARENT_PHYS" rev-parse --show-toplevel 2>&1)" \
  || refuse "git cannot inspect '$REL': $TOPLEVEL"
if [[ "$TOPLEVEL" != "$REPO_ROOT" ]]; then
  refuse "'$REL' belongs to another git repository ($TOPLEVEL — submodule or nested repo) — not cleanup scope."
fi

# git_state <rel> — prints why <rel> is not a tracked, committed file; returns 1 then.
git_state() {
  local rel="$1" rc err
  err="$(git -C "$REPO_ROOT" ls-files --error-unmatch -- ":(literal)$rel" 2>&1 >/dev/null)"
  rc=$?
  if [[ $rc -eq 1 ]]; then echo "'$rel' is not tracked by git"; return 1; fi
  if [[ $rc -ne 0 ]]; then echo "git ls-files failed on '$rel' (exit $rc): $err"; return 1; fi
  err="$(git -C "$REPO_ROOT" diff --quiet HEAD -- ":(literal)$rel" 2>&1)"
  rc=$?
  if [[ $rc -eq 1 ]]; then echo "'$rel' has uncommitted changes"; return 1; fi
  if [[ $rc -ne 0 ]]; then echo "git diff failed on '$rel' (exit $rc): $err"; return 1; fi
  return 0
}

# Untracked: `git rm` cannot remove it and its references were never reviewed.
# Uncommitted changes: the verdict would judge a state nobody committed.
STATE="$(git_state "$REL")" || refuse "$STATE — commit or discard first; only a committed file can be judged."

# Declaration files: tsc loads them through tsconfig include/types (ambient
# `declare module` / `declare global`), not through an import — no check below sees that use.
case "$NAME" in
  *.d.ts | *.d.mts | *.d.cts)
    refuse "'$REL' is a TypeScript declaration file — tsc loads it through tsconfig include/types, not through an import, so no check here can see its uses. Prove it unused with the type-check (condition #7) and delete it deliberately."
    ;;
esac

TMPD="$(mktemp -d)" || refuse "mktemp failed"
trap 'rm -rf -- "$TMPD"' EXIT

BASENAME="$(basename -- "$REL")"
STEM="${BASENAME%.*}"      # strip last extension
STEM2="${STEM%.*}"         # strip second ext (for .controller.ts -> "whatever")
MODULE_NAME="$STEM"        # NestJS-style class names are derived from the filename
# class-guess: CamelCase from dash-case filename stem
CLASS_GUESS="$(printf '%s\n' "$STEM" | awk -F'[-.]' '{ for (i=1;i<=NF;i++) printf("%s", toupper(substr($i,1,1)) substr($i,2)) }')"
STEM_RE="$(ere_escape "$STEM")"
REL_RE="$(ere_escape "$REL")"
BASENAME_RE="$(ere_escape "$BASENAME")"
CLASS_RE="$(ere_escape "$CLASS_GUESS")"

echo "=== validate-before-delete ==="
echo "File     : $REL"
echo "Basename : $BASENAME"
echo "Stem     : $STEM"
echo "Class?   : $CLASS_GUESS"
echo ""

HITS=0
HIT_LINES=()
ERRORS=0
ERROR_LINES=()

report_hit() {
  HITS=$((HITS + 1))
  HIT_LINES+=("$1")
}

report_error() { # a check that could not run — never counted as "no use"
  ERRORS=$((ERRORS + 1))
  ERROR_LINES+=("$1")
}

# search <tag> <self|all> <grep args...> — files matching, as SEARCH_RESULT (NUL-safe).
# `self` drops the target itself. grep exit 1 = no match; > 1 = the search failed,
# recorded as an error (return 1) instead of being read as "no reference".
SEARCH_RESULT=()
search() {
  local tag="$1" scope="$2" rc f
  shift 2
  SEARCH_RESULT=()
  grep -Z "$@" >"$TMPD/search.out" 2>"$TMPD/search.err"
  rc=$?
  if [[ $rc -gt 1 ]]; then
    report_error "$tag search failed (grep exit $rc): $(head -c 300 "$TMPD/search.err" | tr '\n' ' ')"
    return 1
  fi
  while IFS= read -r -d '' f; do
    [[ "$scope" == self && "$f" == "$ABS" ]] && continue
    SEARCH_RESULT+=("$f")
  done <"$TMPD/search.out"
  return 0
}

# ---- 0. never-auto-delete zone (hard refusal, regardless of other findings) ----
for g in "${NEVER_AUTO_DELETE_GLOBS[@]}"; do
  if glob_match "$g" "$REL"; then
    report_hit "[NEVER-AUTO-DELETE] '$REL' is in the protected zone ('$g') — refuse to delete even if the audit thinks it dead."
  fi
done

# ---- 0b / 2 / 3. audit/ artefacts cross-check (required evidence) ----
# NB: the manifest path and $REL reach `node` through the environment, never spliced
# into the JS source — a path/basename containing a quote, backtick or ${...} must not
# be able to alter the probe (this script gets run on arbitrary repo paths).
# Each probe validates the manifest's shape and prints exactly HIT or MISS; anything
# else (crash, parse error, schema error) is an error, not a miss.
#
# The runtime_files list is broad and includes files of NestJS modules that
# are NOT reachable from app.module.ts (the entrypoints.nestjs_unreachable_modules
# list). For Step B drops of those subtrees, the runtime-entrypoint check must
# not blanket-reject — by definition, an unreachable module file is not runtime.
RUNTIME_PROBE='
  const fs = require("fs");
  const name = "audit/runtime-entrypoints.json";
  const fail = (m) => { process.stderr.write(name + ": " + m + "\n"); process.exit(3); };
  let j;
  try { j = JSON.parse(fs.readFileSync(process.env.VBD_MANIFEST, "utf8")); }
  catch (e) { fail("unreadable or not JSON — " + e.message); }
  if (!j || typeof j !== "object" || Array.isArray(j)) fail("top level must be an object");
  const runtime = j.runtime_files;
  if (!Array.isArray(runtime) || runtime.length === 0 || !runtime.every((p) => typeof p === "string"))
    fail("runtime_files must be a non-empty array of paths");
  const ep = j.entrypoints === undefined ? {} : j.entrypoints;
  if (!ep || typeof ep !== "object" || Array.isArray(ep)) fail("entrypoints must be an object");
  const unreachable = ep.nestjs_unreachable_modules === undefined ? [] : ep.nestjs_unreachable_modules;
  if (!Array.isArray(unreachable) || !unreachable.every((p) => typeof p === "string"))
    fail("entrypoints.nestjs_unreachable_modules must be an array of paths");
  const rel = process.env.VBD_REL;
  let hit = runtime.includes(rel);
  if (hit) {
    const subtreeDirs = unreachable
      .filter((p) => p.startsWith("backend/src/modules/"))
      .map((p) => p.replace(/[^/]+\.module\.ts$/, ""));
    if (subtreeDirs.some((d) => rel.startsWith(d))) hit = false;
  }
  process.stdout.write(hit ? "HIT\n" : "MISS\n");
'
DYN_PROBE='
  const fs = require("fs");
  const name = "audit/dynamic-import-edges.json";
  const fail = (m) => { process.stderr.write(name + ": " + m + "\n"); process.exit(3); };
  let j;
  try { j = JSON.parse(fs.readFileSync(process.env.VBD_MANIFEST, "utf8")); }
  catch (e) { fail("unreadable or not JSON — " + e.message); }
  if (!j || typeof j !== "object" || Array.isArray(j)) fail("top level must be an object");
  const edges = j.edges;
  if (!Array.isArray(edges) || !edges.every((e) => e && typeof e === "object" && typeof e.to === "string"))
    fail("edges must be an array of { from, to } objects");
  process.stdout.write(edges.some((e) => e.to === process.env.VBD_REL) ? "HIT\n" : "MISS\n");
'

# probe_manifest <tag> <manifest-rel> <js> <hit message>
probe_manifest() {
  local tag="$1" mrel="$2" js="$3" msg="$4" out rc why
  if [[ -L "$REPO_ROOT/$mrel" || ! -f "$REPO_ROOT/$mrel" ]]; then
    report_error "$tag $mrel is missing — required evidence (npm run audit:inventory)."
    return
  fi
  if ! why="$(git_state "$mrel")"; then
    report_error "$tag $mrel cannot be trusted: $why."
    return
  fi
  if ! command -v node >/dev/null 2>&1; then
    report_error "$tag node not found — cannot read $mrel."
    return
  fi
  out="$(VBD_MANIFEST="$REPO_ROOT/$mrel" VBD_REL="$REL" node -e "$js" 2>"$TMPD/probe.err")"
  rc=$?
  if [[ $rc -eq 0 && "$out" == HIT ]]; then
    report_hit "$msg"
  elif [[ $rc -ne 0 || "$out" != MISS ]]; then
    report_error "$tag $mrel could not be checked (node exit $rc): $(head -c 300 "$TMPD/probe.err" | tr '\n' ' ')"
  fi
}

probe_manifest "[RUNTIME-ENTRYPOINT]" "audit/runtime-entrypoints.json" "$RUNTIME_PROBE" \
  "[RUNTIME-ENTRYPOINT] '$REL' is listed in audit/runtime-entrypoints.json — DO NOT delete."
probe_manifest "[DYNAMIC-IMPORT]" "audit/dynamic-import-edges.json" "$DYN_PROBE" \
  "[DYNAMIC-IMPORT] '$REL' is the target of a dynamic import (audit/dynamic-import-edges.json)."

# ---- 1. Remix convention-loaded route? ----
if [[ "$REL" == frontend/app/routes/* ]]; then
  report_hit "[REMIX-ROUTE] File is under frontend/app/routes/ — auto-loaded by Remix flat-routes, DO NOT delete."
fi

# ---- 2. NestJS DI registration (providers / imports / exports / controllers) ----
#  Grep the class name in @Module({ ... }) arrays. NestJS loads by identifier, not file path.
if [[ -n "$CLASS_GUESS" && ${#CLASS_GUESS} -gt 3 ]]; then
  if search "[NESTJS-DI]" self -rl --include='*.module.ts' \
    -E -e "(providers|imports|exports|controllers)\s*:\s*\[[^]]*\b${CLASS_RE}\b" \
    -- "$REPO_ROOT/backend/src"; then
    for f in "${SEARCH_RESULT[@]}"; do
      report_hit "[NESTJS-DI] ${CLASS_GUESS} referenced in @Module array: ${f#"$REPO_ROOT"/}"
    done
  fi
fi

# ---- 3. Static / relative imports (with or without extension) ----
# A specifier names the file as `…/<stem>` or `…/<stem>.<ext>`, optionally followed by a
# bundler query (`?url`, `?raw`, `?inline` — Vite). An index file is also named by its
# directory (`…/<dir>`, `…/<dir>/`), and from inside that directory by a specifier made
# only of `.`/`..` segments (`'.'`, `'../'`, `'../..'`) — every such specifier under the
# directory counts (over-approximation: it may name an ancestor instead).
IMPORT_SPEC_RE="[^'\"\`]*\/${STEM_RE}(\.[a-z]+)?"
INDEX_DIR=""
if [[ "$STEM" == index && "$REL" == */* ]]; then
  INDEX_DIR="${REL%/*}"
  IMPORT_SPEC_RE="${IMPORT_SPEC_RE}|[^'\"\`]*\/$(ere_escape "${INDEX_DIR##*/}")\/?"
fi
IMPORTERS=()
declare -A IMPORTER_SEEN=()
collect_importers() {
  local f
  for f in "${SEARCH_RESULT[@]}"; do
    [[ -n "${IMPORTER_SEEN[$f]+x}" ]] && continue
    IMPORTER_SEEN[$f]=1
    IMPORTERS+=("$f")
  done
}
if search "[IMPORT]" self -rl --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.cjs' \
  -E -e "(from|import|require)\s*\(?\s*['\"\`](${IMPORT_SPEC_RE})(\?[^'\"\`]*)?['\"\`]" \
  -- "$REPO_ROOT/backend/src" "$REPO_ROOT/frontend/app" "$REPO_ROOT/packages" "$REPO_ROOT/scripts"; then
  collect_importers
fi
if [[ -n "$INDEX_DIR" ]] \
  && search "[IMPORT]" self -rl --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.cjs' \
    -E -e "(from|import|require)\s*\(?\s*['\"\`]\.\.?(\/\.\.)*\/?['\"\`]" \
    -- "$REPO_ROOT/$INDEX_DIR"; then
  collect_importers
fi
for f in "${IMPORTERS[@]}"; do
  report_hit "[IMPORT] imported by: ${f#"$REPO_ROOT"/}"
done

# ---- 4. Dynamic/runtime string references (path or basename) ----
if search "[STRING-REF]" self -rl --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.cjs' --include='*.json' --include='*.yml' --include='*.yaml' \
  -E -e "['\"\`][^'\"\`]*${REL_RE}['\"\`]|['\"\`]${BASENAME_RE}['\"\`]" \
  -- "$REPO_ROOT/backend" "$REPO_ROOT/frontend" "$REPO_ROOT/packages" "$REPO_ROOT/scripts" "$REPO_ROOT/.github"; then
  for f in "${SEARCH_RESULT[@]}"; do
    report_hit "[STRING-REF] path/basename appears as string in: ${f#"$REPO_ROOT"/}"
  done
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
  CONTROLLER_PATHS=()
  grep -rh -E -e "@Controller\s*\(\s*['\"\`]" -- "$REPO_ROOT/$SUBTREE_DIR" >"$TMPD/controllers" 2>"$TMPD/controllers.err"
  rc=$?
  if [[ $rc -gt 1 ]]; then
    report_error "[HTTP-ROUTE-CALLER] @Controller extraction failed (grep exit $rc): $(head -c 300 "$TMPD/controllers.err" | tr '\n' ' ')"
  elif sed -nE "s/.*@Controller\s*\(\s*['\"\`]([^'\"\`]+)['\"\`].*/\1/p" "$TMPD/controllers" >"$TMPD/routes.raw" \
    && sort -u "$TMPD/routes.raw" >"$TMPD/routes"; then
    mapfile -t CONTROLLER_PATHS <"$TMPD/routes"
  else
    report_error "[HTTP-ROUTE-CALLER] @Controller path extraction failed (sed/sort)."
  fi
  if [[ ${#CONTROLLER_PATHS[@]} -gt 0 ]]; then
    # Resolve the search dirs that actually exist (e2e/ and tests/ are optional).
    HTTP_SEARCH_DIRS=()
    for d in frontend/app packages scripts e2e tests; do
      [[ -d "$REPO_ROOT/$d" ]] && HTTP_SEARCH_DIRS+=("$REPO_ROOT/$d")
    done
    if [[ ${#HTTP_SEARCH_DIRS[@]} -gt 0 ]]; then
      for ROUTE_PATH in "${CONTROLLER_PATHS[@]}"; do
        [[ -z "$ROUTE_PATH" ]] && continue
        if search "[HTTP-ROUTE-CALLER]" self -rl --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.cjs' \
          -F -e "$ROUTE_PATH" \
          -- "${HTTP_SEARCH_DIRS[@]}"; then
          for f in "${SEARCH_RESULT[@]}"; do
            report_hit "[HTTP-ROUTE-CALLER] @Controller('$ROUTE_PATH') consumed by: ${f#"$REPO_ROOT"/}"
          done
        fi
      done
    fi
  fi
fi

# ---- 5. CI / npm scripts / git hooks (path or basename in workflows, package.json, husky) ----
if search "[CI/SCRIPT]" all -rl -F -e "$REL" -e "$BASENAME" \
  -- "$REPO_ROOT/.github/workflows" "$REPO_ROOT/.husky"; then
  for f in "${SEARCH_RESULT[@]}"; do
    [[ "$f" == */_/* ]] && continue
    report_hit "[CI/SCRIPT] path/basename referenced in: ${f#"$REPO_ROOT"/}"
  done
fi
if git -C "$REPO_ROOT" ls-files -z -- '*package.json' >"$TMPD/pkgs" 2>"$TMPD/pkgs.err"; then
  while IFS= read -r -d '' pj; do
    grep -qE -e '"(scripts|bin)"' -- "$REPO_ROOT/$pj" 2>"$TMPD/pkg.err"
    rc=$?
    [[ $rc -eq 1 ]] && continue
    if [[ $rc -eq 0 ]]; then
      grep -qF -e "$REL" -e "$BASENAME" -- "$REPO_ROOT/$pj" 2>"$TMPD/pkg.err"
      rc=$?
      [[ $rc -eq 0 ]] && report_hit "[CI/SCRIPT] path/basename referenced in: $pj"
    fi
    if [[ $rc -gt 1 ]]; then
      report_error "[CI/SCRIPT] search failed on $pj (grep exit $rc): $(head -c 300 "$TMPD/pkg.err" | tr '\n' ' ')"
    fi
  done <"$TMPD/pkgs"
else
  report_error "[CI/SCRIPT] git ls-files '*package.json' failed: $(head -c 300 "$TMPD/pkgs.err" | tr '\n' ' ')"
fi

# ---- 7. Knowledge / governance references ----
if search "[KNOWLEDGE]" all -rl --include='*.md' -F -e "$STEM" \
  -- "$REPO_ROOT/.claude/knowledge" "$REPO_ROOT/.claude/rules"; then
  for f in "${SEARCH_RESULT[@]}"; do
    report_hit "[KNOWLEDGE] referenced in: ${f#"$REPO_ROOT"/}"
  done
fi

# ---- 6. Supabase migrations / SQL ----
if search "[SQL]" all -rl --include='*.sql' -F -e "$STEM" -- "$REPO_ROOT/backend/supabase"; then
  for f in "${SEARCH_RESULT[@]}"; do
    report_hit "[SQL] name appears in migration: ${f#"$REPO_ROOT"/}"
  done
fi

# ---- Verdict ----
echo ""
if [[ $HITS -eq 0 && $ERRORS -eq 0 ]]; then
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
elif [[ $HITS -gt 0 ]]; then
  echo "VERDICT: BLOCKED ($HITS reference(s) found)"
  echo ""
  for line in "${HIT_LINES[@]}"; do
    echo "  - $line"
  done
  if [[ $ERRORS -gt 0 ]]; then
    echo ""
    echo "  In addition, $ERRORS check(s) could not run:"
    for line in "${ERROR_LINES[@]}"; do
      echo "  - $line"
    done
  fi
  echo ""
  echo "  Review each hit. If a reference is itself dead code, delete it first"
  echo "  (bottom-up cleanup). Otherwise, keep this file and document the"
  echo "  retention reason in .claude/knowledge/ops/cleanup-targets.md."
  exit 1
else
  echo "VERDICT: INCONCLUSIVE ($ERRORS check(s) could not run — no use found is NOT evidence of no use)"
  echo ""
  for line in "${ERROR_LINES[@]}"; do
    echo "  - $line"
  done
  echo ""
  echo "  Fix the cause (missing/invalid evidence, absent tool, search error) and re-run."
  exit 2
fi
