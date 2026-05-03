#!/usr/bin/env bash
#
# Validateur AGENTS.md / CLAUDE.md (anti-pattern + structure).
# Mémoire associée : feedback_no_hardcoded_infra_in_agentsmd.md
#
# Usage :
#   scripts/agents/validate-agents-md.sh --all             # tout valider
#   scripts/agents/validate-agents-md.sh --staged          # diff staged (pre-commit)
#   scripts/agents/validate-agents-md.sh --diff <ref>      # diff vs ref (CI)
#   scripts/agents/validate-agents-md.sh --file <path>     # un fichier (anti-pattern)
#   scripts/agents/validate-agents-md.sh --file <path> --type agents-md  # + structure
#   scripts/agents/validate-agents-md.sh --self-test       # tests négatifs embarqués
#
# Exit codes :
#   0 — PASS (ou WARN, affichage seulement)
#   1 — BLOCK (au moins une violation BLOCK)
#   2 — usage error

set -uo pipefail

SCRIPT_NAME="validate-agents-md.sh"
MEMORY_HINT="feedback_no_hardcoded_infra_in_agentsmd.md"

# Exclusions de path (submodules, worktrees, build, deps)
EXCLUDE_REGEX='(^|/)(backend/content/automecanik-wiki|\.worktrees|node_modules|dist|\.git|\.husky/_)(/|$)'

# Anti-pattern regexes (sur lignes ajoutées en mode diff)
RE_IP_VPS='46\.224\.118\.55|49\.12\.233\.2|178\.104\.1\.118'
RE_URL_INFRA='https?://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+(:[0-9]+)?|localhost:[0-9]+|127\.0\.0\.1:[0-9]+'
RE_SECRET='(token|api[_-]?key|secret)[[:space:]]*[:=][[:space:]]*[A-Za-z0-9_.-]+'
RE_UUID='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'
RE_ADR_TODO='ADR-[0-9]+.*\(à créer'
RE_STATE_FIGE='\b(ABSENTE|PRÉSENTE|PRESENTE|DOWN)\b'

# WARN regexes
RE_URL_OTHER='https?://'
RE_STATE_FLOU='\b(UP|OFF|ON)\b'

BLOCKS=0
WARNS=0
FILES_SCANNED=0

# ─── Helpers ──────────────────────────────────────────────────────────────────

is_excluded() {
  echo "$1" | grep -qE "$EXCLUDE_REGEX"
}

is_agents_md() {
  echo "$1" | grep -qE '(^|/)agents/[^/]+/AGENTS\.md$'
}

is_claude_md() {
  echo "$1" | grep -qE '(^|/)CLAUDE\.md$'
}

emit_block() {
  printf '[%s] %s:%s: BLOCK — %s\n' "$1" "$2" "$3" "$4"
  BLOCKS=$((BLOCKS + 1))
}

emit_warn() {
  printf '[%s] %s:%s: WARN — %s\n' "$1" "$2" "$3" "$4"
  WARNS=$((WARNS + 1))
}

# ─── Check structure (AGENTS.md uniquement, fichier complet) ──────────────────

check_structure() {
  local f="$1"

  # BLOCK — checks essentiels (anti-stub, AEC, rôle minimum)
  if ! grep -q "CONTRAT DE SORTIE" "$f"; then
    emit_block "STRUCTURE" "$f" 1 "en-tête AEC (CONTRAT DE SORTIE) manquant"
  fi
  if ! grep -Eq "^## Rôle\b|^## Ton rôle\b|^## Role\b" "$f"; then
    emit_block "STRUCTURE" "$f" 1 'section rôle absente (## Rôle / ## Ton rôle / ## Role)'
  fi
  local lines
  lines=$(wc -l < "$f" | tr -d ' ')
  if [ "$lines" -lt 60 ]; then
    emit_block "STRUCTURE" "$f" 1 "longueur < 60 lignes (anti-stub) — actuellement $lines"
  fi

  # WARN — sections canoniques recommandées (review manuelle, pas blocant)
  if ! grep -Eq "^## Hiérarchie\b|^## Reporte à\b|^## Hierarchy\b" "$f"; then
    emit_warn "STRUCTURE" "$f" 1 'section "## Hiérarchie" recommandée (ou "## Reporte à")'
  fi
  if ! grep -Eq "^## Infrastructure\b|^## Services disponibles\b|^## MCP" "$f"; then
    emit_warn "STRUCTURE" "$f" 1 'section "## Infrastructure" recommandée (ou "## Services disponibles")'
  fi
  if ! grep -Eq "^## Format" "$f"; then
    emit_warn "STRUCTURE" "$f" 1 'section "## Format ..." recommandée (rapport / sortie)'
  fi
  if ! grep -Eq "^## Règles\b|^## Règles de comportement\b|^## Rules\b" "$f"; then
    emit_warn "STRUCTURE" "$f" 1 'section "## Règles" recommandée'
  fi
}

# ─── Check anti-pattern (sur contenu — lignes ajoutées ou fichier complet) ────

check_antipattern_lines() {
  local f="$1"
  local label="$2"
  local content="$3"

  # BLOCK — filtre case-insensitive, vérifications par-ligne aussi case-insensitive
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    local lineno
    lineno=$(printf '%s\n' "$line" | sed 's/:.*//')
    local body
    body=$(printf '%s\n' "$line" | sed 's/^[0-9]*://')
    if echo "$body" | grep -Eiq "$RE_IP_VPS"; then
      emit_block "$label" "$f" "$lineno" "IP brute des 3 VPS"
    fi
    if echo "$body" | grep -Eiq "$RE_URL_INFRA"; then
      emit_block "$label" "$f" "$lineno" "URL infra sensible (IP+port / localhost / 127.0.0.1)"
    fi
    if echo "$body" | grep -Eiq "$RE_SECRET"; then
      emit_block "$label" "$f" "$lineno" "token/clé/secret inline"
    fi
    if echo "$body" | grep -Eiq "$RE_UUID"; then
      emit_block "$label" "$f" "$lineno" "UUID complet"
    fi
    if echo "$body" | grep -Eq "$RE_ADR_TODO"; then
      emit_block "$label" "$f" "$lineno" "ADR référencée comme « à créer »"
    fi
    if echo "$body" | grep -Eq "$RE_STATE_FIGE"; then
      emit_block "$label" "$f" "$lineno" "assertion d'état infra figée"
    fi
  done < <(printf '%s\n' "$content" | grep -niE "$RE_IP_VPS|$RE_URL_INFRA|$RE_SECRET|$RE_UUID|$RE_ADR_TODO|$RE_STATE_FIGE" 2>/dev/null || true)

  # WARN — URL hors infra (non bloquante : github.com/ADR vault légitime)
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    local lineno
    lineno=$(printf '%s\n' "$line" | sed 's/:.*//')
    local body
    body=$(printf '%s\n' "$line" | sed 's/^[0-9]*://')
    # On WARN seulement si ce n'est pas déjà BLOCK (URL infra)
    if echo "$body" | grep -Eq "$RE_URL_OTHER" \
      && ! echo "$body" | grep -Eq "$RE_URL_INFRA"; then
      emit_warn "$label" "$f" "$lineno" "URL HTTP(S) hors infra — review manuelle"
    fi
    if echo "$body" | grep -Eq "$RE_STATE_FLOU"; then
      emit_warn "$label" "$f" "$lineno" "mot d'état flou (UP/OFF/ON)"
    fi
  done < <(printf '%s\n' "$content" | grep -nE "$RE_URL_OTHER|$RE_STATE_FLOU" 2>/dev/null || true)
}

# ─── Modes d'invocation ───────────────────────────────────────────────────────

run_all() {
  while IFS= read -r f; do
    is_excluded "$f" && continue
    FILES_SCANNED=$((FILES_SCANNED + 1))
    if is_agents_md "$f"; then
      check_structure "$f"
    fi
    # En mode --all, on NE check PAS l'anti-pattern (diff-only par construction)
  done < <(find . -type f \( -name 'AGENTS.md' -o -name 'CLAUDE.md' \) 2>/dev/null | sort)
}

run_diff() {
  local ref="$1"
  local files
  files=$(git diff --name-only "$ref"...HEAD -- 'AGENTS.md' 'CLAUDE.md' '**/AGENTS.md' '**/CLAUDE.md' 2>/dev/null)
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    is_excluded "$f" && continue
    [ ! -f "$f" ] && continue
    FILES_SCANNED=$((FILES_SCANNED + 1))
    if is_agents_md "$f"; then
      check_structure "$f"
    fi
    local added
    added=$(git diff "$ref"...HEAD -- "$f" | grep -E '^\+[^+]' | sed 's/^.//')
    [ -n "$added" ] && check_antipattern_lines "$f" "ADDED" "$added"
  done <<< "$files"
}

run_staged() {
  local files
  files=$(git diff --cached --name-only -- 'AGENTS.md' 'CLAUDE.md' '**/AGENTS.md' '**/CLAUDE.md' 2>/dev/null)
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    is_excluded "$f" && continue
    [ ! -f "$f" ] && continue
    FILES_SCANNED=$((FILES_SCANNED + 1))
    if is_agents_md "$f"; then
      check_structure "$f"
    fi
    local added
    added=$(git diff --cached -- "$f" | grep -E '^\+[^+]' | sed 's/^.//')
    [ -n "$added" ] && check_antipattern_lines "$f" "STAGED" "$added"
  done <<< "$files"
}

run_file() {
  local f="$1"
  local force_type="${2:-}"
  [ ! -f "$f" ] && { echo "❌ fichier introuvable : $f" >&2; exit 2; }
  FILES_SCANNED=1
  if [ "$force_type" = "agents-md" ] || is_agents_md "$f"; then
    check_structure "$f"
  fi
  local content
  content=$(cat "$f")
  check_antipattern_lines "$f" "FILE" "$content"
}

# ─── Self-test (tests négatifs embarqués) ─────────────────────────────────────

run_self_test() {
  local tmp
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT

  local failed=0

  test_case() {
    local name="$1"
    local expected_exit="$2"
    local actual_exit="$3"
    if [ "$expected_exit" = "$actual_exit" ]; then
      printf '  ✓ %s\n' "$name"
    else
      printf '  ✗ %s (attendu exit=%s, obtenu exit=%s)\n' "$name" "$expected_exit" "$actual_exit"
      failed=$((failed + 1))
    fi
  }

  # 1. BLOCK IP
  echo 'Voir http://46.224.118.55:3000 pour audit' > "$tmp/ip.md"
  bash "$0" --file "$tmp/ip.md" >/dev/null 2>&1
  test_case "BLOCK IP brute" 1 $?

  # 2. BLOCK UUID
  echo 'agent_id: 12345678-aaaa-bbbb-cccc-1234567890ab' > "$tmp/uuid.md"
  bash "$0" --file "$tmp/uuid.md" >/dev/null 2>&1
  test_case "BLOCK UUID complet" 1 $?

  # 3. BLOCK secret (case-insensitive)
  echo 'config: API_KEY=abc123foo' > "$tmp/secret.md"
  bash "$0" --file "$tmp/secret.md" >/dev/null 2>&1
  test_case "BLOCK token/clé inline" 1 $?

  # 4. BLOCK ADR à créer
  echo 'Voir ADR-99 (à créer Phase X)' > "$tmp/adr.md"
  bash "$0" --file "$tmp/adr.md" >/dev/null 2>&1
  test_case "BLOCK ADR à créer" 1 $?

  # 5. BLOCK structure (AGENTS.md sans Hiérarchie)
  cat > "$tmp/stub.md" <<'EOF'
# Stub agent
**CONTRAT DE SORTIE : test.**
## Rôle
foo
EOF
  bash "$0" --file "$tmp/stub.md" --type agents-md >/dev/null 2>&1
  test_case "BLOCK structure AGENTS.md incomplète" 1 $?

  # 6. WARN URL github
  echo 'Voir https://github.com/ak125/governance-vault/issues/42' > "$tmp/url.md"
  bash "$0" --file "$tmp/url.md" >/dev/null 2>&1
  test_case "WARN URL github (non bloquant)" 0 $?

  # 7. PASS — fichier markdown banal sans AGENTS.md schema requis
  echo 'Note interne sans secret ni IP.' > "$tmp/clean.md"
  bash "$0" --file "$tmp/clean.md" >/dev/null 2>&1
  test_case "PASS — fichier propre" 0 $?

  if [ $failed -eq 0 ]; then
    echo "✅ all 7 self-tests passed"
    exit 0
  else
    echo "❌ $failed self-test(s) failed"
    exit 1
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME <mode>

Modes :
  --all                  Scan structure de tous les agents/*/AGENTS.md
  --staged               Scan diff staged (pre-commit hook)
  --diff <ref>           Scan diff vs ref (ex: origin/main)
  --file <path>          Scan anti-pattern d'un fichier
  --file <path> --type agents-md   + check structure
  --self-test            Tests négatifs embarqués

Voir mémoire $MEMORY_HINT pour les règles.
EOF
}

main() {
  if [ $# -eq 0 ]; then
    usage
    exit 2
  fi

  case "$1" in
    --all) run_all ;;
    --staged) run_staged ;;
    --diff)
      [ $# -lt 2 ] && { echo "❌ --diff <ref> requis" >&2; exit 2; }
      run_diff "$2"
      ;;
    --file)
      [ $# -lt 2 ] && { echo "❌ --file <path> requis" >&2; exit 2; }
      local force_type=""
      if [ $# -ge 4 ] && [ "$3" = "--type" ]; then
        force_type="$4"
      fi
      run_file "$2" "$force_type"
      ;;
    --self-test) run_self_test ;;
    -h|--help) usage; exit 0 ;;
    *) echo "❌ mode inconnu : $1" >&2; usage; exit 2 ;;
  esac

  echo
  echo "Coverage manifest:"
  echo "  files_read_count: $FILES_SCANNED"
  echo "  blocks: $BLOCKS"
  echo "  warns: $WARNS"

  if [ "$BLOCKS" -gt 0 ]; then
    echo "  final_status: BLOCK"
    echo
    echo "→ voir mémoire $MEMORY_HINT pour les règles"
    exit 1
  elif [ "$WARNS" -gt 0 ]; then
    echo "  final_status: WARN (revue manuelle)"
    exit 0
  else
    echo "  final_status: PASS"
    exit 0
  fi
}

main "$@"
