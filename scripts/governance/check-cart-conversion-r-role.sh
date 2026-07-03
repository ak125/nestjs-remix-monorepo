#!/usr/bin/env bash
# check-cart-conversion-r-role.sh
#
# Invariant : tout texte mentionnant R8 dans même ligne que panier|cart|conver|achat
# est une violation P1 (mauvaise cartographie business-mapping).
#
# Canon : .spec/00-canon/role-matrix.md § "URL pattern → R-role (cart/conversion analysis)"
# Doctrine mémoire : feedback_r8_is_vehicle_not_gamme (R8 = page véhicule pure, JAMAIS cart)
#
# Pourquoi : confondre R8 (fiche véhicule /constructeurs/...) et R2_PRODUCT véhicule-aware
# (/pieces/<gamme>/<marque>/<modele>/<motorisation>.html) envoie le levier UX sur la
# mauvaise surface. Erreur observée 2026-05-25 lors de l'investigation funnel cart.
#
# Whitelist (fichiers où R8 + role-list context est légitime, pas violation cart) :
#   - .spec/00-canon/role-matrix.md (le canon lui-même)
#   - scripts/governance/check-cart-conversion-r-role.sh (ce fichier)
#   - scripts/governance/__tests__/* (tests bats)
#   - log.md / log-archive-*.md (session timeline append-only, review humaine)
#   - .claude/prompts/** (prompts agents Claude Code, doc R-role)
#   - .claude/skills/** (DEV skills Claude Code, doc R-role — même classe que prompts ;
#       les skills SEO en workspace sont déjà couvertes par workspaces/**/.claude/**)
#   - workspaces/**/.claude/** (workspace agents + skills SEO, discussion multi-role)
#   - workspaces/**/AGENTS/** (AGENTS.md SEO workspace)
#
# Negative-match : phrasings qui CITENT R8 pour clarifier la doctrine (pas violation)
#   - "JAMAIS R8" / "PAS R8" / "R8 ne convertit pas" / "R8 ne porte pas"
#   - "R8 = fiche véhicule" / "R8 (`/constructeurs/...`)" / "hors R-matrix"
#   - "invariant" (le nom de la règle elle-même)
#   - Role ranges (R0-R8, R1-R8, etc.) — list canon, pas analyse cart
#   - "R6_GUIDE_ACHAT" / autres noms canon uppercase contenant ACHAT

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

WHITELIST_RE='^(\.spec/00-canon/role-matrix\.md|scripts/governance/check-cart-conversion-r-role\.sh|scripts/governance/__tests__/.*cart-conversion-r-role.*|log\.md|log-archive-.*\.md|\.claude/prompts/.*|\.claude/skills/.*|workspaces/.*/\.claude/.*|workspaces/.*/AGENTS/.*)$'

# Cherche \bR8\b sur même ligne que panier/cart/conver/achat/landing piece, exclut whitelist et negative-match
VIOLATIONS=$(
  git ls-files '*.md' \
  | grep -vE "$WHITELIST_RE" \
  | xargs -r grep -nE '\bR8\b' 2>/dev/null \
  | grep -iE '(panier|cart|conver|achat[^c-r_]|landing.*pi[èe]ce)' \
  | grep -ivE '(JAMAIS R8|R8 = fiche|R8.*pas catalogue|PAS R8|ne convertit pas|hors R-matrix|R8 ne porte pas|invariant|R8 \(`?/constructeurs|R[0-9]-R8|R[0-9] [aà] R8|R6_GUIDE_ACHAT|GUIDE_ACHAT)' \
  || true
)

if [ -n "$VIOLATIONS" ]; then
  cat <<'EOF' >&2
❌ R-role cart/conversion classification violation détectée.

R8 = fiche véhicule pure (/constructeurs/...). JAMAIS source de panier ou conversion.
Le vrai canal cart-capable véhicule-aware = R2_PRODUCT
  (/pieces/<gamme>-<id>/<marque>-<id>/<modele>-<id>/<type>-<id>.html)

Canon : .spec/00-canon/role-matrix.md § "URL pattern → R-role (cart/conversion analysis)"

Lignes en violation :
EOF
  echo "$VIOLATIONS" >&2
  exit 1
fi

echo "✓ R-role cart/conversion classification : aucune violation détectée."
