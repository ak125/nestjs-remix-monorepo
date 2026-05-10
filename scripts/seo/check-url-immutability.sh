#!/usr/bin/env bash
# check-url-immutability.sh — Phase 1 surface guard for R-SEO-09
# (URLs canon strictement immuables — vault rules-seo-pagerole.md / R-SEO-09).
#
# ## Why
# Modifier silencieusement une URL canon (rename de route Remix, slug d'aliasing
# SQL, redirect map) casse instantanément le SEO acquis sur la page : 30j à
# 90j de requêtes désindexées par GSC, perte de positions stables, contenu
# orphelin. Cf. mémoires `feedback_no_url_changes_ever` + `seo-r2-thin-content-root-cause`.
#
# ## Scope MVP — Phase 1 (intentionnellement étroit)
# Hard-block sur changements détectés dans la **surface URL canonique** :
#   - frontend/app/routes/**/*.tsx (Remix : filename = URL pattern)
#   - backend/src/seo/**/canonical-url*.ts (URL builders)
#   - .claude/canon-mirrors/url-immutability.md (mirror vault R-SEO-09)
#
# Warn-only sur la **surface URL adjacente** :
#   - backend/src/sitemap/**/*.ts (sitemap generators — peuvent ajouter, pas
#     supprimer ; warning visible reviewer)
#   - backend/src/seo/**/redirect*.ts (redirects — pareil)
#
# Phase 2 (follow-up post-observation) : étendre via signal empirique
# (regression GSC, position drop, manual flag).
#
# ## Modes
#   pr      : exit 1 si hard-block detecté dans la surface canonique
#   audit   : print findings, exit 0 (mode dry-run pour observation)
#
# ## Variables
#   BASE_REF (default: origin/main) — base à comparer pour le diff
#
# Référence canon : R-SEO-09 (governance-vault/ledger/rules/rules-seo-pagerole.md)
set -euo pipefail

MODE="${1:-pr}"
BASE_REF="${BASE_REF:-origin/main}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

if [[ "$MODE" != "pr" && "$MODE" != "audit" ]]; then
  echo "Usage: $0 {pr|audit}" >&2
  exit 2
fi

# Surfaces protégées (regex extended, anchored to start of relative path).
HARD_BLOCK_PATTERNS=(
  '^frontend/app/routes/.+\.tsx$'
  '^backend/src/seo/.*canonical-url.*\.ts$'
  '^\.claude/canon-mirrors/url-immutability\.md$'
)

WARN_PATTERNS=(
  '^backend/src/sitemap/.+\.ts$'
  '^backend/src/seo/.*redirect.*\.ts$'
)

git fetch origin main --quiet 2>/dev/null || true

# Detect changed files vs base (added/modified/renamed/deleted).
mapfile -t CHANGED < <(git diff --name-status "$BASE_REF...HEAD" 2>/dev/null \
  | awk '{print $1"\t"$2}' || true)

if [[ ${#CHANGED[@]} -eq 0 ]]; then
  echo "OK: no changes vs $BASE_REF"
  exit 0
fi

HARD_BLOCKS=()
WARNS=()

for entry in "${CHANGED[@]}"; do
  status="${entry%%	*}"
  file="${entry#*	}"
  # Renames look like "R100\told\tnew" — extract the new path
  if [[ "$status" =~ ^R ]]; then
    file="${file##*	}"
  fi
  for pat in "${HARD_BLOCK_PATTERNS[@]}"; do
    if [[ "$file" =~ $pat ]]; then
      HARD_BLOCKS+=("[$status] $file")
      break
    fi
  done
  for pat in "${WARN_PATTERNS[@]}"; do
    if [[ "$file" =~ $pat ]]; then
      WARNS+=("[$status] $file")
      break
    fi
  done
done

if [[ ${#WARNS[@]} -gt 0 ]]; then
  echo "::warning:: URL-adjacent surface touched (R-SEO-09 review needed):"
  printf '  - %s\n' "${WARNS[@]}"
  echo ""
fi

if [[ ${#HARD_BLOCKS[@]} -gt 0 ]]; then
  if [[ "$MODE" == "pr" ]]; then
    echo "::error:: HARD BLOCK — R-SEO-09 URL canonical surface modified:" >&2
    printf '  - %s\n' "${HARD_BLOCKS[@]}" >&2
    echo "" >&2
    echo "If this change is intentional and approved by the SEO owner, document" >&2
    echo "the trade-off in the PR body and add label \`r-seo-09-override\`" >&2
    echo "on the PR (override flow not yet implemented — Phase 2 follow-up)." >&2
    echo "" >&2
    echo "Reference: governance-vault/ledger/rules/rules-seo-pagerole.md (R-SEO-09)" >&2
    exit 1
  else
    echo "::warning:: AUDIT MODE — would HARD BLOCK on:"
    printf '  - %s\n' "${HARD_BLOCKS[@]}"
    echo ""
    echo "Run with MODE=pr to enforce."
  fi
fi

if [[ ${#HARD_BLOCKS[@]} -eq 0 && ${#WARNS[@]} -eq 0 ]]; then
  echo "OK: no R-SEO-09 surface touched"
fi
exit 0
