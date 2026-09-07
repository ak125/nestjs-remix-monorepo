#!/usr/bin/env bash
# Tests de non-regression du parseur TecDoc — scripts/tecdoc-mysql-to-csv.py
#
# Deux niveaux :
#   1. FIXTURE SYNTHETIQUE (toujours executee) — aucune dependance : ni PROD, ni base,
#      ni donnee TecDoc sous licence. C'est le test qui fait foi en CI.
#   2. FIXTURES REELLES (executees seulement si le repertoire d'extraction existe) —
#      les 7 paires produites par le pipeline de mars 2026. Verifie d'abord l'empreinte
#      de l'entree, puis l'identite octet par octet de la sortie.
#
# Usage :  bash scripts/test-tecdoc-mysql-to-csv.sh [--with-large]
#   --with-large  inclut 012 (640 Mo d'entree, 1,18 Go de sortie, ~2 min, ~2 Go de disque)
#
# Sortie : 0 si tout passe. Tout saut est annonce explicitement.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARSER="$ROOT/scripts/tecdoc-mysql-to-csv.py"
FIXDIR="$ROOT/scripts/tecdoc-parser-fixtures"
REALDIR="${TECDOC_EXTRACT_DIR:-/opt/automecanik/data/tecdoc/extract}"
WITH_LARGE=0
[[ "${1:-}" == "--with-large" ]] && WITH_LARGE=1

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0; fail=0; skip=0
ok()   { echo "  PASS  $*"; pass=$((pass+1)); }
ko()   { echo "  FAIL  $*"; fail=$((fail+1)); }
sk()   { echo "  SKIP  $*"; skip=$((skip+1)); }

[[ -f "$PARSER" ]] || { echo "FATAL: parseur introuvable: $PARSER"; exit 2; }
echo "Parseur : $PARSER"
echo "         sha256 $(sha256sum "$PARSER" | cut -d' ' -f1)"
echo

# ---------- 1. Fixture synthetique (obligatoire) ----------
echo "1. Fixture synthetique (sans dependance externe)"
if python3 "$PARSER" "$FIXDIR/synthetic.dat.sql" -o "$TMP/synthetic.csv" 2>"$TMP/synthetic.err"; then
  if cmp -s "$TMP/synthetic.csv" "$FIXDIR/synthetic.expected.csv"; then
    ok "synthetic.dat.sql -> sortie identique a synthetic.expected.csv"
  else
    ko "synthetic.dat.sql -> sortie DIFFERENTE de l'attendu"
    diff "$FIXDIR/synthetic.expected.csv" "$TMP/synthetic.csv" | head -20
  fi
  # le resume va sur stderr, contrat consomme par tecdoc-batch-load.sh
  if grep -q '^SUMMARY|synthetic.dat.sql|rows=7|errors=0$' "$TMP/synthetic.err"; then
    ok "resume stderr conforme (SUMMARY|...|rows=7|errors=0)"
  else
    ko "resume stderr non conforme : $(cat "$TMP/synthetic.err")"
  fi
  # le parseur ecrit aussi un .meta a cote de la sortie ; duration_ms est non
  # deterministe par construction, on n'assere que les trois champs stables.
  if [[ -f "$TMP/synthetic.meta" ]]; then
    got="$(grep -v '^duration_ms=' "$TMP/synthetic.meta" | tr '\n' ' ')"
    if [[ "$got" == "rows_parsed=7 rows_emitted=7 rows_rejected=0 " ]]; then
      ok ".meta conforme (rows_parsed/emitted/rejected ; duration_ms ignore)"
    else
      ko ".meta non conforme : $got"
    fi
  else
    ko ".meta non genere a cote de la sortie"
  fi
else
  ko "le parseur a echoue sur la fixture synthetique"
fi
echo

# ---------- 2. Fixtures reelles (conditionnelles) ----------
echo "2. Fixtures reelles du pipeline de mars 2026"
if [[ ! -d "$REALDIR" ]]; then
  sk "repertoire absent ($REALDIR) — les 7 paires reelles ne sont pas verifiees ici."
  echo "        Ce n'est PAS une couverture complete : voir scripts/tecdoc-parser-fixtures/real-fixtures.sha256"
else
  MAN="$FIXDIR/real-fixtures.sha256"
  for n in 140 143 144 145 146 147 012; do
    if [[ "$n" == "012" && "$WITH_LARGE" -eq 0 ]]; then
      sk "012 (640 Mo) — relancer avec --with-large pour l'inclure"
      continue
    fi
    src="$REALDIR/$n.dat.sql"; ref="$REALDIR/$n.csv"
    if [[ ! -f "$src" || ! -f "$ref" ]]; then sk "$n : paire absente du repertoire"; continue; fi
    want_in="$(grep -E "  $n\.dat\.sql$" "$MAN" | cut -d' ' -f1)"
    got_in="$(sha256sum "$src" | cut -d' ' -f1)"
    if [[ -n "$want_in" && "$want_in" != "$got_in" ]]; then
      ko "$n : l'ENTREE a change (sha256 $got_in != $want_in du manifeste) — test non concluant"
      continue
    fi
    if python3 "$PARSER" "$src" -o "$TMP/$n.csv" 2>/dev/null && cmp -s "$TMP/$n.csv" "$ref"; then
      ok "$n : sortie identique octet par octet ($(wc -l < "$ref") lignes)"
    else
      ko "$n : sortie DIFFERENTE de la reference"
    fi
    rm -f "$TMP/$n.csv"
  done
fi

echo
echo "----------------------------------------"
echo "PASS=$pass  FAIL=$fail  SKIP=$skip"
[[ "$fail" -eq 0 ]] || exit 1
exit 0
