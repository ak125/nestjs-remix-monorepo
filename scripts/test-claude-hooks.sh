#!/usr/bin/env bash
#
# test-claude-hooks.sh — tests bash plain pour les nouveaux hooks Claude.
#
# Pattern repo `scripts/test-<thing>.sh` (cohérent avec test-internal-links.sh,
# test-payment-tunnel.sh, etc.). Pas de bats — non installé.
#
# Couvre 3 cas par hook neuf :
#   1. Nominal (entrée attendue → comportement attendu)
#   2. Fichier inexistant / input vide
#   3. CLAUDE_HOOKS_DISABLE=1 (rollback rapide)

set -u

PASS=0
FAIL=0
FAILED_TESTS=()

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo /opt/automecanik/app)"
cd "$REPO_ROOT" || exit 1

assert_exit() {
  local description="$1"
  local expected_exit="$2"
  local actual_exit="$3"
  if [ "$expected_exit" = "$actual_exit" ]; then
    PASS=$((PASS+1))
    echo "  PASS: $description"
  else
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$description (expected exit=$expected_exit, got $actual_exit)")
    echo "  FAIL: $description (expected exit=$expected_exit, got $actual_exit)"
  fi
}

assert_contains() {
  local description="$1"
  local needle="$2"
  local haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    PASS=$((PASS+1))
    echo "  PASS: $description"
  else
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$description (missing: '$needle')")
    echo "  FAIL: $description (missing: '$needle')"
  fi
}

assert_size_lt() {
  local description="$1"
  local max="$2"
  local actual="$3"
  if [ "$actual" -lt "$max" ]; then
    PASS=$((PASS+1))
    echo "  PASS: $description ($actual < $max)"
  else
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$description ($actual >= $max)")
    echo "  FAIL: $description ($actual >= $max)"
  fi
}

# ============================================================
# Hook 1 : posttool-lint-check.sh
# ============================================================

echo ""
echo "=== posttool-lint-check.sh ==="

# Cas 1 : édition CLAUDE.md → invoque validate-agents-md.sh (warn stderr possible)
INPUT='{"tool_name":"Edit","file_path":"/opt/automecanik/app/CLAUDE.md"}'
echo "$INPUT" | bash scripts/claude-hooks/posttool-lint-check.sh > /tmp/h1-out 2> /tmp/h1-err
assert_exit "posttool CLAUDE.md edit → exit 0 (warn-only)" "0" "$?"

# Cas 2 : input vide → exit 0
echo "" | bash scripts/claude-hooks/posttool-lint-check.sh > /tmp/h1b-out 2> /tmp/h1b-err
assert_exit "posttool empty input → exit 0" "0" "$?"

# Cas 3 : rollback CLAUDE_HOOKS_DISABLE=1
INPUT='{"tool_name":"Edit","file_path":"/opt/automecanik/app/CLAUDE.md"}'
CLAUDE_HOOKS_DISABLE=1 bash scripts/claude-hooks/posttool-lint-check.sh <<<"$INPUT" > /tmp/h1c-out 2>&1
assert_exit "posttool CLAUDE_HOOKS_DISABLE=1 → exit 0 silent" "0" "$?"

# Cas 4 (sanity) : fichier non-matching → exit 0, no output
echo '{"tool_name":"Edit","file_path":"/opt/automecanik/app/log.md"}' \
  | bash scripts/claude-hooks/posttool-lint-check.sh > /tmp/h1d-out 2> /tmp/h1d-err
assert_exit "posttool non-matching file → exit 0" "0" "$?"

# ============================================================
# Hook 2 : sessionstart-workspace-context.sh
# ============================================================

echo ""
echo "=== sessionstart-workspace-context.sh ==="

# Cas 1 : nominal depuis repo root → output contient sections attendues
OUT=$(bash scripts/claude-hooks/sessionstart-workspace-context.sh 2>/tmp/h2-err)
EXIT=$?
assert_exit "sessionstart nominal → exit 0" "0" "$EXIT"
assert_contains "sessionstart contient ## Workspace" "## Workspace" "$OUT"
assert_contains "sessionstart contient ## TOP" "## TOP" "$OUT"
assert_contains "sessionstart contient ## DO NOT start" "## DO NOT start" "$OUT"

# Cas 2 : borne taille — output < 2000 bytes
SIZE=$(echo -n "$OUT" | wc -c)
assert_size_lt "sessionstart output bounded" "2000" "$SIZE"

# Cas 3 : rollback CLAUDE_HOOKS_DISABLE=1 → output vide, exit 0
OUT=$(CLAUDE_HOOKS_DISABLE=1 bash scripts/claude-hooks/sessionstart-workspace-context.sh 2>/tmp/h2c-err)
EXIT=$?
assert_exit "sessionstart CLAUDE_HOOKS_DISABLE=1 → exit 0" "0" "$EXIT"
if [ -z "$OUT" ]; then
  PASS=$((PASS+1))
  echo "  PASS: sessionstart CLAUDE_HOOKS_DISABLE=1 → output vide"
else
  FAIL=$((FAIL+1))
  FAILED_TESTS+=("sessionstart CLAUDE_HOOKS_DISABLE=1 should emit nothing")
  echo "  FAIL: sessionstart CLAUDE_HOOKS_DISABLE=1 should emit nothing"
fi

# ============================================================
# Hook 3 : stop-claude-md-suggest.sh
# ============================================================

echo ""
echo "=== stop-claude-md-suggest.sh ==="

# Cas 1 : nominal sur branche feature → exit 0 (peut émettre ou non selon count fix)
bash scripts/claude-hooks/stop-claude-md-suggest.sh > /tmp/h3-out 2> /tmp/h3-err
assert_exit "stop-claude-md-suggest nominal → exit 0" "0" "$?"

# Cas 2 : rollback CLAUDE_HOOKS_DISABLE=1
CLAUDE_HOOKS_DISABLE=1 bash scripts/claude-hooks/stop-claude-md-suggest.sh > /tmp/h3b-out 2> /tmp/h3b-err
assert_exit "stop-claude-md-suggest CLAUDE_HOOKS_DISABLE=1 → exit 0" "0" "$?"
if [ ! -s /tmp/h3b-out ] && [ ! -s /tmp/h3b-err ]; then
  PASS=$((PASS+1))
  echo "  PASS: stop-claude-md-suggest CLAUDE_HOOKS_DISABLE=1 → silent"
else
  FAIL=$((FAIL+1))
  FAILED_TESTS+=("stop-claude-md-suggest should emit nothing when disabled")
  echo "  FAIL: stop-claude-md-suggest disabled should emit nothing"
fi

# Cas 3 : sur branche 'main' simulée (HEAD detached) → exit 0 (skip)
ORIG_HEAD=$(git rev-parse HEAD)
git checkout --detach >/dev/null 2>&1
bash scripts/claude-hooks/stop-claude-md-suggest.sh > /tmp/h3c-out 2> /tmp/h3c-err
RC=$?
git checkout - >/dev/null 2>&1
assert_exit "stop-claude-md-suggest detached HEAD → exit 0 skip" "0" "$RC"

# ============================================================
# Validator : validate-top-priorities.sh
# ============================================================

echo ""
echo "=== validate-top-priorities.sh ==="

bash scripts/governance/validate-top-priorities.sh .claude/top-priorities.md > /tmp/v1-out 2>&1
assert_exit "validate-top-priorities nominal → exit 0" "0" "$?"

# Cas 2 : fichier inexistant
bash scripts/governance/validate-top-priorities.sh /tmp/nonexistent.md > /tmp/v2-out 2>&1
assert_exit "validate-top-priorities missing file → exit 1" "1" "$?"

# Cas 3 : sur-dépassement borne TOP (créer fichier temporaire)
cat > /tmp/top-bloat.md <<'EOF'
## TOP
- a
- b
- c
- d
- e
- f
- g

## DO_NOT_START
- x

## ACTIVE_INCIDENTS
- y

## STRUCTURAL_CONSTRAINTS
- z
EOF
bash scripts/governance/validate-top-priorities.sh /tmp/top-bloat.md > /tmp/v3-out 2>&1
assert_exit "validate-top-priorities TOP>5 → exit 1" "1" "$?"
assert_contains "validate-top-priorities flags TOP overflow" "TOP a 7" "$(cat /tmp/v3-out)"

# ============================================================
# Guard : pretool-bash-guard.sh — Guard 6 (tag v* = PROD deploy trigger)
# ============================================================

echo ""
echo "=== pretool-bash-guard.sh (Guard 6 tag PROD) ==="

run_bash_guard() {
  echo "{\"command\":\"$1\"}" | bash scripts/claude-hooks/pretool-bash-guard.sh >/dev/null 2>&1
  echo $?
}

# BLOCK : créations/pushes de tag v* (déclencheur deploy PROD)
assert_exit "bash-guard: git tag v1.2.3 → BLOCK"           "2" "$(run_bash_guard 'git tag v1.2.3')"
assert_exit "bash-guard: git tag -a v1.2.3 -m rel → BLOCK" "2" "$(run_bash_guard 'git tag -a v1.2.3 -m rel')"
assert_exit "bash-guard: git tag -s v2.0.0 → BLOCK"        "2" "$(run_bash_guard 'git tag -s v2.0.0')"
assert_exit "bash-guard: git push origin v1.2.3 → BLOCK"   "2" "$(run_bash_guard 'git push origin v1.2.3')"
assert_exit "bash-guard: git push --tags → BLOCK"          "2" "$(run_bash_guard 'git push --tags')"
# ALLOW : pas de faux positif sur les usages git courants
assert_exit "bash-guard: git tag (list) → allow"           "0" "$(run_bash_guard 'git tag')"
assert_exit "bash-guard: push feature branch → allow"      "0" "$(run_bash_guard 'git push origin feat/foo')"
assert_exit "bash-guard: git status → allow"               "0" "$(run_bash_guard 'git status')"
# Sanity : guard existant (Guard 1) toujours actif
assert_exit "bash-guard: git push origin main → BLOCK (G1)" "2" "$(run_bash_guard 'git push origin main')"

# ============================================================
# Guard : pretool-supabase-guard.sh — Guard 6 (DML direct sur tables gouvernées)
# ============================================================

echo ""
echo "=== pretool-supabase-guard.sh (Guard 6 DML) ==="

run_sql_guard() {
  echo "{\"query\":\"$1\"}" | bash scripts/claude-hooks/pretool-supabase-guard.sh >/dev/null 2>&1
  echo $?
}

# BLOCK : DML brut sur pieces / pieces_price / __seo_*
assert_exit "sql-guard: UPDATE pieces_price → BLOCK"           "2" "$(run_sql_guard 'UPDATE pieces_price SET pri_dispo=1')"
assert_exit "sql-guard: UPDATE pieces → BLOCK"                 "2" "$(run_sql_guard 'UPDATE pieces SET x=1 WHERE id=1')"
assert_exit "sql-guard: DELETE FROM __seo_keywords → BLOCK"    "2" "$(run_sql_guard 'DELETE FROM __seo_keywords WHERE id=1')"
assert_exit "sql-guard: lowercase update public.pieces_price → BLOCK" "2" "$(run_sql_guard 'update public.pieces_price set x=1')"
# ALLOW : pas de faux positif (autre table pieces_*, SELECT, INSERT hors scope owner)
assert_exit "sql-guard: UPDATE pieces_relation_type → allow"  "0" "$(run_sql_guard 'UPDATE pieces_relation_type SET x=1')"
assert_exit "sql-guard: SELECT FROM pieces → allow"           "0" "$(run_sql_guard 'SELECT * FROM pieces')"
assert_exit "sql-guard: INSERT pieces_price → allow (scope=UPDATE/DELETE)" "0" "$(run_sql_guard 'INSERT INTO pieces_price (id) VALUES (1)')"
# Sanity : guard existant (Guard 1) toujours actif
assert_exit "sql-guard: DROP TABLE foo (no IF EXISTS) → BLOCK (G1)" "2" "$(run_sql_guard 'DROP TABLE foo')"

# ============================================================
# Résumé
# ============================================================

echo ""
echo "======================================"
echo "Tests : $PASS passed / $FAIL failed"
echo "======================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Échecs :"
  for t in "${FAILED_TESTS[@]}"; do
    echo "  - $t"
  done
  exit 1
fi

exit 0
