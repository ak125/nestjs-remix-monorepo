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
#   - backend/src/modules/seo/**/seo-canonical*.ts (canonical service)
#   - backend/src/modules/seo/**/canonical*.ts (URL builders, aliases canon)
#
# Warn-only sur la **surface URL adjacente** :
#   - backend/src/modules/seo/**/sitemap*.ts (peuvent ajouter, pas
#     supprimer ; warning visible reviewer)
#   - backend/src/modules/seo/**/redirect*.ts (redirects — pareil)
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
# Confirmé empiriquement contre arbre réel monorepo (review PR-5) :
#   - backend/src/modules/seo/services/policies/seo-canonical.service.ts
#   - backend/src/modules/seo/services/* (canonical aliases / route builders)
HARD_BLOCK_PATTERNS=(
  '^frontend/app/routes/.+\.tsx$'
  '^backend/src/modules/seo/.*seo-canonical.*\.ts$'
  '^backend/src/modules/seo/.*canonical.*\.ts$'
)

# Exclusions du hard-block — cohérent avec canon `seo-criticality.yaml` qui
# excludes `admin/*`, `api/*`, `_*`, `__*` du SEO public. Sans ces exclusions,
# toute nouvelle route admin/api/internal crée un faux positif R-SEO-09.
# Incident PR-SBD-1 (2026-05-18) : admin.seo-control.tsx hard-bloqué à tort.
# Réf : .spec/00-canon/repository-registry/seo-criticality.yaml (excluded section)
#       + feedback_r_seo_09_phase1_path_based_block.md
EXCLUDE_PATTERNS=(
  '^frontend/app/routes/admin\.'
  '^frontend/app/routes/api\.'
  '^frontend/app/routes/account\.'
  '^frontend/app/routes/account_\.'
  '^frontend/app/routes/_'
  '^frontend/app/routes/__'
  '^frontend/app/routes/auth\.'
  '^frontend/app/routes/commercial\.'
)

WARN_PATTERNS=(
  '^backend/src/modules/seo/.*sitemap.*\.ts$'
  '^backend/src/modules/seo/.*redirect.*\.ts$'
)

# Fail-fast si BASE_REF inconnu — silent-pass = sécurité fictive.
BASE_REF_LOCAL="${BASE_REF#origin/}"
git fetch origin "$BASE_REF_LOCAL" --quiet 2>/dev/null || true
if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "::error:: BASE_REF '$BASE_REF' not resolvable. Fetch failed or ref missing." >&2
  exit 2
fi

# Detect changed files vs base (added/modified/renamed/deleted).
# For renames (R100), git diff emits "R100\told\tnew" → preserve $3 as new path.
mapfile -t CHANGED < <(git diff --name-status "$BASE_REF...HEAD" 2>/dev/null \
  | awk '{ if ($1 ~ /^R/) print $1"\t"$3; else print $1"\t"$2 }' || true)

if [[ ${#CHANGED[@]} -eq 0 ]]; then
  echo "OK: no changes vs $BASE_REF"
  exit 0
fi

HARD_BLOCKS=()
WARNS=()

for entry in "${CHANGED[@]}"; do
  status="${entry%%	*}"
  file="${entry#*	}"

  # Skip excluded paths (admin/api/auth/etc — not SEO public surface).
  excluded=0
  for pat in "${EXCLUDE_PATTERNS[@]}"; do
    if [[ "$file" =~ $pat ]]; then
      excluded=1
      break
    fi
  done
  if [[ $excluded -eq 1 ]]; then
    continue
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
