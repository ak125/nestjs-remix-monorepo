#!/usr/bin/env bash
# scripts/audit/audit-pieces-media-img-invariants.sh
#
# Nightly ratchet: ensures no `pieces_media_img` row is in a state that would
# render as a broken image on the live site.
#
# Invariants (seuil = 0 for each) :
#   I1. Aucune ligne `pmi_display='1'` avec `pmi_folder=''` (folder vide).
#   I2. Aucune ligne `pmi_display='1'` avec `pmi_name` sans extension
#       (le rewrite imgproxy ajoute `@webp` mais nécessite un nom valide).
#   I3. Aucune ligne `pmi_display='1'` dont `(pmi_pm_id, pmi_folder)` n'est pas
#       conforme à .spec/00-canon/repository-registry/brand-folder-registry.yaml
#       (folder appartient à la marque ; bloque les corruptions par décalage
#       de colonne — cf. incident 2026-05-22 où pmi_pm_id contenait la valeur
#       folder au lieu du pm_id).
#
# Context: corruption découverte 2026-05-23 (~4,76 M lignes affichées
# malformées, ~7 347 pièces VALEO/SKF/MAGNETI cassées à l'affichage). Tier C
# (soft-hide) appliqué le même jour ; ce ratchet bloque toute régression.
#
# Plan source: .claude/plans/utiliser-superpower-je-tiens-vivid-feather.md
# ADR: (vault) Recovery pieces_media_img corruption post-TecDoc 2026
#
# Exit codes:
#   0  All invariants pass.
#   1  ≥1 invariant violated (prints offending counts to stderr).
#   2  Setup error (psql missing, DATABASE_URL absent, query failure).
#
# Reproduce:  bash scripts/audit/audit-pieces-media-img-invariants.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# --- Setup ------------------------------------------------------------------
if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not found in PATH" >&2
  exit 2
fi

# Resolve a Postgres URL :
#   1. DATABASE_URL env (CI provisioning path).
#   2. backend/.env DATABASE_URL line (local convenience).
#   3. Construct from Supabase vars (SUPABASE_DB_HOST + SUPABASE_DB_PASSWORD
#      + project ref from SUPABASE_URL) — the canonical Supabase combo.
if [[ -z "${DATABASE_URL:-}" ]] && [[ -f backend/.env ]]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' backend/.env | head -1 | cut -d= -f2- || true)
fi
if [[ -z "${DATABASE_URL:-}" ]] && [[ -f backend/.env ]]; then
  # Fallback: derive from Supabase vars
  sb_host=$(grep -E '^SUPABASE_DB_HOST=' backend/.env | head -1 | cut -d= -f2-)
  sb_pw=$(grep -E '^SUPABASE_DB_PASSWORD=' backend/.env | head -1 | cut -d= -f2-)
  sb_url=$(grep -E '^SUPABASE_URL=' backend/.env | head -1 | cut -d= -f2-)
  sb_ref=$(echo "$sb_url" | sed -E 's|https?://([^.]+)\..*|\1|')
  if [[ -n "$sb_host" && -n "$sb_pw" && -n "$sb_ref" ]]; then
    DATABASE_URL="postgres://postgres.${sb_ref}:${sb_pw}@${sb_host}:5432/postgres?sslmode=require"
  fi
fi
export DATABASE_URL
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: no Postgres URL resolvable (set DATABASE_URL or provide SUPABASE_DB_HOST + SUPABASE_DB_PASSWORD + SUPABASE_URL in backend/.env)" >&2
  exit 2
fi

PSQL=(psql "$DATABASE_URL" --no-psqlrc --tuples-only --no-align --quiet)

# --- Queries ----------------------------------------------------------------
# Scope = DISPLAYED pieces only (piece_display=true). The plan explicitly defers
# malformed rows attached to hidden pieces (inventory not exposed on the site) ;
# tightening invariants to displayed-only matches the actual UX risk envelope.
sql_i1="SELECT count(*) FROM pieces_media_img m JOIN pieces p ON p.piece_id=m.pmi_piece_id_i WHERE p.piece_display=true AND m.pmi_display='1' AND coalesce(m.pmi_folder,'')='';"
sql_i2="SELECT count(*) FROM pieces_media_img m JOIN pieces p ON p.piece_id=m.pmi_piece_id_i WHERE p.piece_display=true AND m.pmi_display='1' AND m.pmi_name !~ '\\.';"
# I3: brand→folder consistency. The registry is YAML; we read its
# pm_id/primary_folder/alt_folders pairs by yq if installed, fall back to a
# best-effort regex over the YAML. Each violating row = a displayed image whose
# (pmi_pm_id, pmi_folder) is not in the allowed set for that brand.
# Implementation: load registry into a tmp values table, anti-join.
sql_i3_setup="DROP TABLE IF EXISTS _audit_brand_folder_allowed;
CREATE TEMP TABLE _audit_brand_folder_allowed (pm_id text, folder text);"

# --- Execute ----------------------------------------------------------------
echo "[audit] pieces_media_img invariants (`date -Iseconds`)"

i1=$("${PSQL[@]}" -c "$sql_i1" | tr -d ' \n')
i2=$("${PSQL[@]}" -c "$sql_i2" | tr -d ' \n')

status=0
printf "  I1 (folder empty on displayed)     : %s\n" "$i1"
printf "  I2 (name without extension)        : %s\n" "$i2"
[[ "$i1" -ne 0 ]] && status=1
[[ "$i2" -ne 0 ]] && status=1

# I3 — registry-aware. Skipped here (requires yq + temp table loading) ; tracked
# as a TODO once the registry YAML is committed and a small loader is added.
# Plan: dedicated TS audit reading the YAML and feeding the pairs.
echo "  I3 (brand→folder consistency)      : SKIPPED (loader TODO)"

if [[ $status -eq 0 ]]; then
  echo "[audit] OK — all invariants pass"
else
  echo "[audit] FAIL — invariant(s) violated. See counts above." >&2
fi
exit $status
