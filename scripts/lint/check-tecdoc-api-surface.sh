#!/usr/bin/env bash
# =============================================================================
# Ratchet — empêcher la réouverture silencieuse de la surface TecDoc
#
# PÉRIMÈTRE VOLONTAIREMENT ÉTROIT : cinq objets nommés, listés ci-dessous.
# Ce garde ne juge AUCUN autre objet du dépôt — il n'a pas vocation à devenir
# une règle générique sur SECURITY DEFINER, qui casserait les exceptions
# historiques légitimes (cf. 20260616_vague5_*, 20260422_views_invoker_*).
#
# Ce qu'il refuse dans une NOUVELLE migration :
#   1. redonner EXECUTE sur resolve_type_id_remap à PUBLIC ou authenticated
#   2. recréer public.__load_tecdoc_raw
#   3. redonner un droit sur les 3 vues TecDoc à un rôle API
#   4. repasser une des 3 vues en security_invoker = false
#
# Exception gouvernée : ajouter le chemin de la migration dans
# scripts/lint/tecdoc-api-surface-allowlist.txt, avec une ligne de motif
# au-dessus. Une exception sans motif est refusée.
#
# Usage : bash scripts/lint/check-tecdoc-api-surface.sh [--base <ref>]
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGDIR="$ROOT/backend/supabase/migrations"
ALLOW="$ROOT/scripts/lint/tecdoc-api-surface-allowlist.txt"
LOCKDOWN="20260907_tecdoc_api_surface_lockdown.sql"

VIEWS='__tecdoc_losch_log|v_tecdoc_dlnr_reconciliation|v_tecdoc_unlinked_pieces_reason'
API_ROLES='PUBLIC|anon|authenticated|service_role'

violations=0
report() { echo "  VIOLATION  $1"; echo "             $2"; violations=$((violations+1)); }

is_allowed() {
  [[ -f "$ALLOW" ]] || return 1
  grep -qxF "$(basename "$1")" "$ALLOW"
}

shopt -s nullglob
for f in "$MIGDIR"/*.sql; do
  base="$(basename "$f")"
  # la migration de fermeture elle-même est l'état de référence, pas une violation
  [[ "$base" == "$LOCKDOWN" ]] && continue
  is_allowed "$f" && { echo "  SKIP (allowlist)  $base"; continue; }

  # règle 1 — EXECUTE rendu à PUBLIC ou authenticated sur la fonction runtime.
  # anon et service_role sont les deux rôles légitimes (PROD = service key,
  # PREPROD READ_ONLY = anon) : un GRANT vers eux n'est PAS une violation.
  if grep -nEi "GRANT[[:space:]]+(ALL|EXECUTE)[^;]*resolve_type_id_remap[^;]*TO[^;]*\b(PUBLIC|authenticated)\b" "$f" | grep -q .; then
    report "$base" "règle 1 : EXECUTE sur resolve_type_id_remap rendu à PUBLIC ou authenticated (rôles autorisés : anon, service_role uniquement)."
  fi

  # règle 2 — recréation de la fonction morte
  if grep -nEi "CREATE([[:space:]]+OR[[:space:]]+REPLACE)?[[:space:]]+FUNCTION[[:space:]]+public\.__load_tecdoc_raw" "$f" | grep -q .; then
    report "$base" "règle 2 : recréation de public.__load_tecdoc_raw (supprimée le 2026-09-07 comme API morte)."
  fi

  # règle 3 — droit rendu à un rôle API sur une des 3 vues
  if grep -nEi "GRANT[^;]*($VIEWS)[^;]*TO[^;]*($API_ROLES)" "$f" | grep -q .; then
    report "$base" "règle 3 : droit rendu à un rôle API sur une vue TecDoc de public."
  fi

  # règle 4 — retour en sémantique DEFINER
  if grep -nEi "ALTER[[:space:]]+VIEW[^;]*($VIEWS)[^;]*security_invoker[[:space:]]*=[[:space:]]*false" "$f" | grep -q .; then
    report "$base" "règle 4 : vue TecDoc repassée en security_invoker = false."
  fi
done

echo
if [[ "$violations" -eq 0 ]]; then
  echo "OK — surface TecDoc inchangée (0 violation sur $(ls -1 "$MIGDIR"/*.sql 2>/dev/null | wc -l) migrations)."
  exit 0
fi
echo "ÉCHEC — $violations violation(s)."
echo "Pour une exception gouvernée : ajouter le nom du fichier dans $ALLOW,"
echo "précédé d'une ligne '# motif : …' expliquant pourquoi la surface doit se rouvrir."
exit 1
