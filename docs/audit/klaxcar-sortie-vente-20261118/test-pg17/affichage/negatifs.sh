#!/usr/bin/env bash
set -uo pipefail
x() { docker exec -w /banc mandat-db-pg17 bash -c "$1"; }
fresh() { x "psql -U postgres -d template1 -qX -c 'DROP DATABASE IF EXISTS t' -c 'CREATE DATABASE t TEMPLATE vierge'"; }
P="psql -U postgres -d t -v ON_ERROR_STOP=1 -X"
fp() { x "$P -q -f etat.sql | sha256sum | cut -c1-16"; }
echo "== N1 (P9) : une pièce KLAXCAR masquée réaffichée entre le relevé et l'application"
fresh; x "$P -qc \"update pieces set piece_display=true where piece_id=(select min(piece_id) from pieces where piece_pm_id=2590 and not piece_display)\""
a=$(fp); x "$P -1 -f up.sql" 2>&1 | grep -E "ERROR"; b=$(fp); [ "$a" = "$b" ] && echo "  refus : état inchangé ($a)"
echo "== N2 (P8) : une pièce KLAXCAR de plus"
fresh; x "$P -qc \"insert into pieces select (jsonb_populate_record(p, '{\\\"piece_id\\\": 999999999}')).* from pieces p where piece_pm_id=2590 and not piece_display limit 1\""
a=$(fp); x "$P -1 -f up.sql" 2>&1 | grep -E "ERROR"; b=$(fp); [ "$a" = "$b" ] && echo "  refus : état inchangé ($a)"
echo "== N3 (P9) : réapplication après la down (même lot)"
fresh; x "$P -1 -f up.sql >/dev/null 2>&1; $P -f down.sql >/dev/null 2>&1"
a=$(fp); x "$P -1 -f up.sql" 2>&1 | grep -E "ERROR"; b=$(fp); [ "$a" = "$b" ] && echo "  refus : état inchangé ($a)"
echo "== N4 (D3) : une pièce du lot réaffichée à la main après la migration, puis down"
fresh; x "$P -1 -f up.sql >/dev/null 2>&1"; x "$P -qc \"update pieces set piece_display=true where piece_id=(select min(piece_id) from pieces_display_history where batch_id='cb9bd8ac-1e4e-4e94-9c6e-a660608795a3')\""
a=$(fp); x "$P -f down.sql" 2>&1 | grep -E "ERROR"; b=$(fp); [ "$a" = "$b" ] && echo "  refus : état inchangé, prix compris ($a)"
echo "== N5 (P2) : une ligne de prix dispo 1 ajoutée à une pièce KLAXCAR affichée (la rendrait non éligible à la quarantaine)"
fresh; x "$P -qc \"insert into pieces_price (pri_piece_id, pri_type, pri_piece_id_i, pri_pm_id, pri_dispo, pri_vente_ttc_n) select pri_piece_id, 'TEMOIN', pri_piece_id_i, '9999', '1', 10 from pieces_price pp join pieces p on p.piece_id=pp.pri_piece_id_i where p.piece_pm_id=2590 and p.piece_display limit 1\""
a=$(fp); x "$P -1 -f up.sql" 2>&1 | grep -E "ERROR"; b=$(fp); [ "$a" = "$b" ] && echo "  refus : état inchangé ($a)"
x "psql -U postgres -d template1 -qX -c 'DROP DATABASE IF EXISTS t'"
