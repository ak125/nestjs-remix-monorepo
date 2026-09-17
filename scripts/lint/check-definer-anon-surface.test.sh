#!/usr/bin/env bash
# =============================================================================
# Tests de check-definer-anon-surface.sh — fixtures adverses.
#
# Chaque cas ci-dessous a été construit APRÈS avoir mesuré que la version
# initiale du garde le laissait passer en silence (exit 0). Un test qui ne
# tombe pas quand on retire son correctif ne prouve rien : les cas T2, T3, T3b,
# T4, T5, T6, T7 et A2 sont précisément ceux-là.
#
# Usage : bash scripts/lint/check-definer-anon-surface.test.sh
# =============================================================================
set -uo pipefail

SRC_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD_SRC="$SRC_ROOT/scripts/lint/check-definer-anon-surface.sh"
LOCKDOWN="20260917_definer_rpc_anon_lockdown.sql"

pass=0
fail=0

# --- fabrique un bac à sable isolé : arborescence minimale attendue par le garde
new_sandbox() {
  local sb
  sb="$(mktemp -d)"
  mkdir -p "$sb/scripts/lint" "$sb/backend/supabase/migrations"
  cp "$GUARD_SRC" "$sb/scripts/lint/"
  # lockdown minimal : deux fonctions dans l'ensemble fermé
  cat > "$sb/backend/supabase/migrations/$LOCKDOWN" <<'SQL'
REVOKE ALL ON FUNCTION public.auth_resolve_user(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_resolve_user(text) TO service_role;
REVOKE ALL ON FUNCTION public.seo_apply_h1_write(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seo_apply_h1_write(text) TO service_role;
SQL
  # allowlist minimale : une fonction de rendu, motivée
  cat > "$sb/scripts/lint/definer-anon-allowlist.txt" <<'TXT'
# motif : chemin de rendu de la page gamme R1 — sans anon, la sonde bloquante
# « R1 Gamme » du smoke PREPROD passerait de 200 à 500 (le container CI
# s'authentifie en anon, ADR-028 Option D).
get_piece_detail
TXT
  echo "$sb"
}

run_guard() { bash "$1/scripts/lint/check-definer-anon-surface.sh" 2>&1; }

# assert_violates <sandbox> <libellé> [motif attendu dans la sortie]
assert_violates() {
  local sb="$1" label="$2" needle="${3:-}" out rc
  out="$(run_guard "$sb")"; rc=$?
  if [[ "$rc" -ne 0 ]] && { [[ -z "$needle" ]] || grep -q "$needle" <<< "$out"; }; then
    echo "  ✓ $label"; pass=$((pass+1))
  else
    echo "  ✗ $label — attendu exit≠0${needle:+ + « $needle »}, obtenu exit=$rc"
    echo "$out" | sed 's/^/      /'
    fail=$((fail+1))
  fi
  rm -rf "$sb"
}

assert_passes() {
  local sb="$1" label="$2" out rc
  out="$(run_guard "$sb")"; rc=$?
  if [[ "$rc" -eq 0 ]]; then
    echo "  ✓ $label"; pass=$((pass+1))
  else
    echo "  ✗ $label — attendu exit=0, obtenu exit=$rc"
    echo "$out" | sed 's/^/      /'
    fail=$((fail+1))
  fi
  rm -rf "$sb"
}

echo "Fixtures adverses — check-definer-anon-surface.sh"
echo

# --- T1 : cas nominal déjà couvert par la version initiale
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/20260918_t1.sql" <<'SQL'
CREATE OR REPLACE FUNCTION public.t1_fn(p integer) RETURNS integer
LANGUAGE sql SECURITY DEFINER AS $$ SELECT p $$;
SQL
assert_violates "$sb" "T1  DEFINER créée sans aucun REVOKE" "règle 1"

# --- T2 : RÉGRESSION — un seul rôle révoqué satisfaisait la disjonction
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/20260918_t2.sql" <<'SQL'
CREATE OR REPLACE FUNCTION public.t2_fn(p integer) RETURNS integer
LANGUAGE sql SECURITY DEFINER AS $$ SELECT p $$;
REVOKE ALL ON FUNCTION public.t2_fn(integer) FROM authenticated;
SQL
assert_violates "$sb" "T2  REVOKE partiel (authenticated seul) — anon reste ouvert" "règle 1"

# --- T3 : RÉGRESSION — SECURITY DEFINER placé APRÈS le corps
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/20260918_t3.sql" <<'SQL'
CREATE OR REPLACE FUNCTION public.t3_fn(p integer) RETURNS integer
AS $$ SELECT p $$
LANGUAGE sql
SECURITY DEFINER;
SQL
assert_violates "$sb" "T3  SECURITY DEFINER après le corps \$\$…\$\$" "règle 1"

# --- T3b : RÉGRESSION — corps non dollar-quoté (BEGIN ATOMIC)
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/20260918_t3b.sql" <<'SQL'
CREATE OR REPLACE FUNCTION public.t3b_fn(p integer) RETURNS integer
LANGUAGE sql SECURITY DEFINER
BEGIN ATOMIC
  SELECT p;
END;
SQL
assert_violates "$sb" "T3b corps BEGIN ATOMIC (non dollar-quoté)" "règle 1"

# --- T4 : RÉGRESSION — octroi en bloc, aucune fonction nommée
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/20260918_t4.sql" <<'SQL'
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
SQL
assert_violates "$sb" "T4  GRANT ON ALL FUNCTIONS IN SCHEMA public TO anon" "règle 4"

# --- T5 : RÉGRESSION — la cause racine elle-même
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/20260918_t5.sql" <<'SQL'
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
SQL
assert_violates "$sb" "T5  ALTER DEFAULT PRIVILEGES … TO anon (cause racine)" "règle 4"

# --- T6 : RÉGRESSION — l'allowlist exemptait la règle 2
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/20260918_t6.sql" <<'SQL'
GRANT EXECUTE ON FUNCTION public.get_piece_detail(integer) TO authenticated;
SQL
assert_violates "$sb" "T6  GRANT à authenticated sur une fonction ALLOWLISTÉE" "règle 2"

# --- T7 : RÉGRESSION — REVOKE écrit en commentaire de fin de ligne
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/20260918_t7.sql" <<'SQL'
CREATE OR REPLACE FUNCTION public.t7_fn(p integer) RETURNS integer
LANGUAGE sql SECURITY DEFINER AS $$ SELECT p $$;
SELECT 1; -- TODO: REVOKE ALL ON FUNCTION public.t7_fn(integer) FROM PUBLIC, anon, authenticated;
SQL
assert_violates "$sb" "T7  REVOKE en commentaire de fin de ligne" "règle 1"

# --- T8 : règle 3, déjà couverte par la version initiale
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/20260918_t8.sql" <<'SQL'
GRANT EXECUTE ON FUNCTION public.auth_resolve_user(text) TO anon;
SQL
assert_violates "$sb" "T8  re-GRANT anon sur une fonction fermée" "règle 3"

# --- A2 : RÉGRESSION — l'allowlist pouvait défaire le lockdown
sb="$(new_sandbox)"
cat >> "$sb/scripts/lint/definer-anon-allowlist.txt" <<'TXT'

# motif : prétendument nécessaire — doit être refusé, cette fonction est fermée.
auth_resolve_user
TXT
cat > "$sb/backend/supabase/migrations/20260918_a2.sql" <<'SQL'
GRANT EXECUTE ON FUNCTION public.auth_resolve_user(text) TO anon;
SQL
assert_violates "$sb" "A2  allowlist nommant une fonction FERMÉE" "ne peut pas défaire le lockdown"

# --- A1 : entrée d'allowlist sans ligne de motif
sb="$(new_sandbox)"
printf 'get_soft_404_alternatives\n' >> "$sb/scripts/lint/definer-anon-allowlist.txt"
assert_violates "$sb" "A1  entrée d'allowlist sans « # motif : … »" "motif"

# --- A3 : le bloc attenant existe mais n'ouvre AUCUNE ligne par « # motif : ».
#     Accepter le motif multi-ligne ne doit PAS accepter n'importe quel commentaire.
sb="$(new_sandbox)"
cat >> "$sb/scripts/lint/definer-anon-allowlist.txt" <<'TXT'

# ajoutée le 2026-09-18 par l'équipe catalogue, voir le ticket interne.
# (nécessaire au rendu, on verra plus tard.)
get_soft_404_alternatives
TXT
assert_violates "$sb" "A3  bloc de commentaire attenant SANS ligne « # motif : »" "motif"

# --- A4 : motif détaché de l'entrée par une ligne vide — ne la justifie plus.
#     Sans cette remise à zéro, le motif de l'entrée précédente couvrirait la suivante.
sb="$(new_sandbox)"
cat >> "$sb/scripts/lint/definer-anon-allowlist.txt" <<'TXT'

# motif : rendu public, sonde bloquante — mais détaché de l'entrée ci-dessous.

get_soft_404_alternatives
TXT
assert_violates "$sb" "A4  motif séparé de l'entrée par une ligne vide" "motif"

# --- C1 : RÉGRESSION — lockdown absent sortait 0 avec une simple NOTE
sb="$(new_sandbox)"
mv "$sb/backend/supabase/migrations/$LOCKDOWN" "$sb/backend/supabase/migrations/${LOCKDOWN}.applied"
assert_violates "$sb" "C1  migration de lockdown absente → ÉCHEC, pas NOTE" "introuvable"

# --- C2 : RÉGRESSION — allowlist absente sortait 0
sb="$(new_sandbox)"
rm "$sb/scripts/lint/definer-anon-allowlist.txt"
assert_violates "$sb" "C2  allowlist absente → ÉCHEC" "allowlist introuvable"

# --- C3 : RÉGRESSION — fichier .sql non daté écarté en silence
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/hotfix_sans_date.sql" <<'SQL'
GRANT EXECUTE ON FUNCTION public.auth_resolve_user(text) TO anon;
SQL
assert_violates "$sb" "C3  fichier .sql sans préfixe de date" "préfixe de date"

# --- P1 : le cas correct doit rester vert
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/20260918_p1.sql" <<'SQL'
CREATE OR REPLACE FUNCTION public.p1_fn(p integer) RETURNS integer
LANGUAGE sql SECURITY DEFINER AS $$ SELECT p $$;
REVOKE ALL ON FUNCTION public.p1_fn(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.p1_fn(integer) TO service_role;
SQL
assert_passes "$sb" "P1  DEFINER + REVOKE complet + GRANT service_role"

# --- P2 : une migration antérieure à la base du ratchet n'est pas jugée
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/20260101_p2.sql" <<'SQL'
CREATE OR REPLACE FUNCTION public.p2_fn(p integer) RETURNS integer
LANGUAGE sql SECURITY DEFINER AS $$ SELECT p $$;
SQL
assert_passes "$sb" "P2  migration antérieure à la base — hors périmètre"

# --- P3 : un GRANT anon sur une fonction ALLOWLISTÉE reste légitime
sb="$(new_sandbox)"
cat > "$sb/backend/supabase/migrations/20260918_p3.sql" <<'SQL'
GRANT EXECUTE ON FUNCTION public.get_piece_detail(integer) TO anon;
SQL
assert_passes "$sb" "P3  GRANT anon sur fonction allowlistée"

echo
echo "$pass réussi(s), $fail échec(s)."
[[ "$fail" -eq 0 ]] || exit 1
