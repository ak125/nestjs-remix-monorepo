#!/usr/bin/env bash
# Block confused `preprod` formulations in markdown files.
#
# Why: 419 occurrences across monorepo+vault+memory mixed DEV/PREPROD/PROD
# semantics. Canon is in .claude/rules/deployment.md (glossary STRICT). Patterns
# below are FORBIDDEN because they imply false topology:
#   - "DEV pré-prod" / "DEV preprod" → conflates 2 distinct machines
#   - "preprod.automecanik.com"      → hostname does NOT exist
#   - "preprod miroir"               → PREPROD is READ_ONLY, not a replica
#   - "déployer en pré-prod ... prod" (human staging gate) → CI-only env
#   - "staging"                       → banned term in this repo
#
# See: ADR-075 "Deployment topology clarification" (vault).
# Used by: .husky/pre-commit (staged .md only) + CI lint job (full repo).

set -euo pipefail

# Scope: every committed .md file. CI passes no args; pre-commit passes staged.
if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  mapfile -t FILES < <(git ls-files -- '*.md')
fi

# Files allowed to USE forbidden patterns (canon defines them, errata correct
# them, archived/log files are immutable history).
ALLOWLIST_REGEX='^(\.claude/rules/deployment\.md|CLAUDE\.md|.*/_archive/.*|CHANGELOG.*\.md|log\.md|.*\.errata\.md|.*-errata-.*\.md|scripts/lint/check-preprod-vocabulary\.sh)$'

# Each pattern paired with a label for the error message.
declare -a PATTERNS=(
  'DEV[[:space:]]+pré-prod|DEV[[:space:]]+preprod'
  'preprod\.automecanik\.com'
  'preprod[[:space:]]+miroir|miroir[[:space:]]+de[[:space:]]+PROD'
  '[Ss]taging[[:space:]]+(soak|env|environment|server|VPS|deploy|deployment|gate)'
)
declare -a LABELS=(
  '"DEV pré-prod" or "DEV preprod" (conflates 2 distinct machines — use PREPROD container or DEV machine)'
  '"preprod.automecanik.com" (hostname does not exist — PREPROD is localhost:3200 on runner 49.12.233.2)'
  '"preprod miroir" or "miroir de PROD" (PREPROD is READ_ONLY ephemeral CI, not a replica)'
  '"staging <soak|env|server|VPS|deploy|deployment|gate>" (banned for deployment topology — use PREPROD or PROD)'
)

violations=0

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  case "$f" in
    *.md) ;;
    *) continue ;;
  esac

  # Skip allowlisted files
  if [[ "$f" =~ $ALLOWLIST_REGEX ]]; then
    continue
  fi

  for i in "${!PATTERNS[@]}"; do
    pattern="${PATTERNS[$i]}"
    label="${LABELS[$i]}"
    # Use grep -E (POSIX ERE). Exit code 0 = match found = violation.
    if matches=$(grep -nE "$pattern" "$f" 2>/dev/null); then
      # Filter out lines marked as ERRATUM (explicit corrections allowed)
      filtered=$(echo "$matches" | grep -v 'ERRATUM' || true)
      if [ -n "$filtered" ]; then
        echo ""
        echo "❌ FORBIDDEN vocabulary in $f"
        echo "   Pattern: $label"
        echo "$filtered" | sed 's|^|     |'
        violations=$((violations + 1))
      fi
    fi
  done
done

if [ "$violations" -gt 0 ]; then
  cat <<EOF

────────────────────────────────────────────────────────────────────────────
$violations forbidden vocabulary occurrence(s) detected.

Canon (charged at session start) : .claude/rules/deployment.md
Vocabulary STRICT :
  - DEV     = machine 46.224.118.55 (poste opérateur, no deploy container)
  - PREPROD = container CI éphémère 49.12.233.2:3200 (READ_ONLY, no human access)
  - PROD    = container live 49.12.233.2:80/443 (www.automecanik.com)

To bypass for legitimate ERRATUM, prefix the line with "ERRATUM" (e.g.
"**[ERRATUM YYYY-MM-DD]** preprod.automecanik.com was used incorrectly here...").
────────────────────────────────────────────────────────────────────────────
EOF
  exit 1
fi

echo "✅ Preprod vocabulary lint: $((${#FILES[@]})) file(s) checked, 0 violations."
