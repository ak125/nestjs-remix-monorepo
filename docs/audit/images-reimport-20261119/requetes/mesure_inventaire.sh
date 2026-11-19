#!/usr/bin/env bash
# Relevé du 2026-11-19 (mandat DC) : exécute scripts/recover-tecdoc-images.sql
# en lecture seule, par lots de piece_id, et écrit un CSV par lot.
#
# Usage : mesure_inventaire.sh <sweep-psql.sh> <dossier de sortie>
#   <sweep-psql.sh> : lecteur en lecture seule (transaction READ ONLY,
#   statement_timeout 60 s), copie de 910b1e9f04:.claude/skills/live-evidence-sweep/
#   scripts/sweep-psql.sh. Aucun identifiant n'est lu ni écrit par ce script.
#
# SUBSTITUTION DE MESURE, propre à ce relevé (le module ne la fait pas) :
# public.piece_est_vendable n'est pas encore en base (PR #2191, brouillon,
# tête 32a7ee22d3f8735108792fdbdb34d037563219d6). Pour mesurer aujourd'hui,
# l'appel est remplacé par le corps des deux fonctions tel qu'écrit dans
# backend/supabase/migrations/20261118_est_vendable_definition_unique.sql à
# cette tête (sha256 49b64d6c193a2a1ffccf9916d7a22935b1b4a661a7b5f6ce92164f3a3e83b4b8),
# piece_est_vendable avec est_vendable déplié. Après application de #2191,
# relancer sans substitution.
set -euo pipefail
PSQL="$1"; OUT="$2"
HERE="$(cd "$(dirname "$0")" && pwd)"
SQL_FILE="$HERE/../../../../scripts/recover-tecdoc-images.sql"
TAILLE_LOT=50000
mkdir -p "$OUT"

CORPS_PR2191="EXISTS (SELECT 1 FROM public.pieces_price pp JOIN public.pieces pc ON pc.piece_id = pp.pri_piece_id_i WHERE pp.pri_piece_id_i = p.piece_id AND ((pp.pri_dispo IS NOT NULL AND pp.pri_dispo IN ('1', '2', '3')) AND pp.pricing_state IS DISTINCT FROM 'FROZEN' AND pc.piece_display IS TRUE AND (pp.pri_vente_ttc_n IS NOT NULL AND pp.pri_vente_ttc_n > 0 AND pp.pri_vente_ttc_n < 'Infinity'::numeric)))"

echo "debut $(date -u +%FT%TZ)" > "$OUT/journal.txt"
"$PSQL" -At -c "SELECT min(piece_id) FROM (SELECT piece_id, (row_number() OVER (ORDER BY piece_id) - 1) / $TAILLE_LOT AS g FROM pieces) t GROUP BY g ORDER BY 1" 2>/dev/null \
  | grep -E '^[0-9]+$' > "$OUT/bornes.txt"
mapfile -t B < "$OUT/bornes.txt"; B+=(2147483647)
echo "bornes $(date -u +%FT%TZ) lots=$(( ${#B[@]} - 1 ))" >> "$OUT/journal.txt"

for ((k = 0; k < ${#B[@]} - 1; k++)); do
  lo=${B[$k]}; hi=${B[$((k + 1))]}
  SQL=$(grep -v '^--' "$SQL_FILE" \
        | sed -e "s/%(id_min)s/$lo/" -e "s/%(id_max)s/$hi/" \
        | tr '\n' ' ' | sed -e 's/; *$//')
  SQL=${SQL/public.piece_est_vendable(p.piece_id)/$CORPS_PR2191}
  t0=$(date -u +%T)
  rc=0
  "$PSQL" -c "COPY ($SQL) TO STDOUT WITH CSV" > "$OUT/lot_$k.csv" 2> "$OUT/err_$k.txt" || rc=$?
  echo "lot $k [$lo,$hi[ $t0 rc=$rc lignes=$(wc -l < "$OUT/lot_$k.csv")" >> "$OUT/journal.txt"
done
echo "fin $(date -u +%FT%TZ)" >> "$OUT/journal.txt"
