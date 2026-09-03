#!/usr/bin/env bash
# Block-new : interdit toute NOUVELLE divergence du prédicat de vendabilité `pri_dispo`.
#
# Why: le prédicat canonique (pri_dispo IN ('1','2','3') AND pri_vente_ttc_n > 0 AND
# piece_display = true) a UNE autorité — SellabilityTruthService (TS) + is_piece_sellable /
# refresh_catalog_sellable_candidates (SQL). Ré-exprimer un filtre `pri_dispo` ailleurs
# réintroduit la classe de divergence (front {1,2,3} vs backend '1'-only) que le sous-système
# "vérité canonique" (PR1) supprime. Cf. plan catalog-sellable-truth 2026-06-13.
#
# Stratégie = BLOCK-NEW DIFF-SCOPED (pattern ratchet du repo) :
#   • on ne scanne QUE les lignes AJOUTÉES dans le diff vs la base (origin/main) → l'historique
#     (16 sites legacy + migrations pricing gouvernées) est grandfather, jamais retrofit ;
#   • error (exit 1) sur toute nouvelle ligne divergente non exemptée ;
#   • EXEMPTÉ : fichiers sous backend/src/modules/pricing/** (le module autorité) ET toute ligne
#     portant l'annotation explicite `@sellable-canon` (SQL `-- @sellable-canon`, TS `// @sellable-canon`).
#
# Complémentaire à la règle ast-grep `commerce-no-direct-dispo-filter` (severity warning) qui,
# elle, rend visible le BACKLOG des 16 sites existants (IDE + lint advisory).
#
# Used by: CI lint job (gates) — base = origin/main ; override via DISPO_CANON_BASE.
#          Exit 0 = OK, 1 = nouvelle divergence non annotée détectée.
set -euo pipefail

BASE_REF="${DISPO_CANON_BASE:-origin/main}"
if git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  BASE="$(git merge-base "$BASE_REF" HEAD 2>/dev/null || echo "$BASE_REF")"
else
  # Base introuvable (ex. shallow clone sans origin/main) → fallback dernier commit.
  BASE="$(git rev-parse HEAD~1 2>/dev/null || echo HEAD)"
fi

# Motif divergence : query-builder TS (.eq/.in/.neq/.filter('pri_dispo'…)) OU filtre SQL (pri_dispo = / IN).
PATTERN="(\.(eq|in|neq|filter)\([[:space:]]*['\"]pri_dispo['\"]|pri_dispo[[:space:]]*(=|IN))"

violations=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  # Scope : TS backend + migrations SQL.
  if [[ "$f" == backend/src/*.ts || "$f" == backend/supabase/migrations/*.sql ]]; then :; else continue; fi
  # Exemption : module autorité (chemin) OU fichier déclaré autorité (marqueur header).
  if [[ "$f" == backend/src/modules/pricing/* ]]; then continue; fi
  if [ -f "$f" ] && grep -q '@sellable-canon-authority' "$f" 2>/dev/null; then continue; fi

  # Lignes AJOUTÉES uniquement (diff working-tree vs base, on retire le '+').
  while IFS= read -r line; do
    content="${line#+}"
    case "$content" in *"@sellable-canon"*) continue ;; esac
    if printf '%s\n' "$content" | grep -qE "$PATTERN"; then
      echo "  ✗ $f : ${content#"${content%%[![:space:]]*}"}"
      violations=$((violations + 1))
    fi
  done < <(git diff --unified=0 "$BASE" -- "$f" 2>/dev/null | grep -E '^\+[^+]' || true)
done < <(git diff --name-only --diff-filter=AMR "$BASE" -- backend/src backend/supabase/migrations 2>/dev/null || true)

if [ "$violations" -gt 0 ]; then
  cat >&2 <<'EOF'

✗ check-dispo-canon : nouvelle(s) divergence(s) du prédicat `pri_dispo` détectée(s) ci-dessus.
  → Consommer l'autorité unique au lieu d'inliner un filtre :
      TS  : SellabilityTruthService.isSellablePiece() / getAggregate()
      SQL : is_piece_sellable() / refresh_catalog_sellable_candidates()
  → Exception légitime (usage NON-vendabilité, ex. vue stock admin) : annoter la ligne
      `-- @sellable-canon: <raison>` (SQL) ou `// @sellable-canon: <raison>` (TS), owner-revu.
EOF
  exit 1
fi

echo "✓ check-dispo-canon : aucune nouvelle divergence pri_dispo (base $BASE)."
