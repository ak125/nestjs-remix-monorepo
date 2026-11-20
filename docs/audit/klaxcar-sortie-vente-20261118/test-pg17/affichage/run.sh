#!/usr/bin/env bash
# Banc PG17 jetable : migration + down du complément n° 1 (affichage KLAXCAR).
set -uo pipefail
P="psql -U postgres -v ON_ERROR_STOP=1 -X"
x() { docker exec -w /banc mandat-db-pg17 bash -c "$1"; }
snap() { x "$P -q -f etat.sql" > o/$1.etat.csv; x "$P -q -f servi.sql" > o/$1.servi.csv; x "$P -q -f page.sql" > o/$1.page.csv; x "$P -q -f journal.sql" > o/$1.journal.csv; x "$P -q -f sv.sql" > o/$1.sv.csv; }
kx() { x "$P -At -c \"select 'KLAXCAR total/affichées/masquées = '||count(*)||' / '||count(*) filter (where piece_display)||' / '||count(*) filter (where not piece_display) from pieces where piece_pm_id=2590; select 'journal lot cb9bd8ac = '||count(*) from pieces_display_history where batch_id='cb9bd8ac-1e4e-4e94-9c6e-a660608795a3'; select 'journal total = '||count(*) from pieces_display_history\""; }
cmp_() { if cmp -s o/$1 o/$2; then echo "  $1 = $2 (identique octet pour octet)"; else echo "  $1 ≠ $2"; fi; }
mkdir -p o
echo "== banc : $(x "$P -At -c 'select version()'" | cut -d, -f1) ; $(date -u +%FT%TZ)"
snap avant; kx
echo "== migration (enveloppée BEGIN/COMMIT comme l'engine) $(date -u +%FT%TZ)"
x "$P -1 -f up.sql" 2>&1 | grep -E "NOTICE|ERROR|ABORT" ; snap apres; kx
echo "== rejeu de la migration $(date -u +%FT%TZ)"
x "$P -1 -f up.sql" 2>&1 | grep -E "NOTICE|ERROR|ABORT"; snap rejeu; kx
cmp_ apres.etat.csv rejeu.etat.csv; cmp_ apres.journal.csv rejeu.journal.csv; cmp_ apres.servi.csv rejeu.servi.csv
echo "== down $(date -u +%FT%TZ)"
x "$P -f down.sql" 2>&1 | grep -v -E "^(BEGIN|COMMIT|SET|DO)$"; snap restaure; kx
echo "== rejeu de la down $(date -u +%FT%TZ)"
x "$P -f down.sql" 2>&1 | grep -E "NOTICE|ERROR|ABORT"; snap restaure2; kx
echo "== comparaisons avant / restauré"
cmp_ avant.etat.csv restaure.etat.csv; cmp_ avant.servi.csv restaure.servi.csv; cmp_ avant.page.csv restaure.page.csv; cmp_ restaure.etat.csv restaure2.etat.csv
echo "  journal : $(wc -l < o/avant.journal.csv) lignes avant, $(wc -l < o/restaure.journal.csv) après la down ; lignes ajoutées par le lot conservées :"
diff <(cat o/avant.journal.csv) <(head -n $(wc -l < o/avant.journal.csv) o/restaure.journal.csv) >/dev/null && echo "  les $(wc -l < o/avant.journal.csv) lignes antérieures sont inchangées"
echo "  search_vector NULL avant / après down (KLAXCAR et autres) :"
x "$P -At -c \"select count(*) filter (where search_vector is null) from pieces where piece_pm_id=2590\""
