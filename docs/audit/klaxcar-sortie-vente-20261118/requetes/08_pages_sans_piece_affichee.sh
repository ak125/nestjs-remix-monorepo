#!/usr/bin/env bash
# Lecture seule. Pour les 4 615 paires servies (pg_id, type_id) sans autre pièce
# vendable (déc. 118) : reste-t-il une pièce affichée d'une autre marque, et
# KLAXCAR y est-elle affichée, hors filtre pollution (= ce que compte
# get_listing_products_extended_filtered) ? Seules ces paires peuvent tomber à 0.
# Entrée kx/pages_sans_vendable_d118.csv : les couples (pg_id, type_id) de
# ../pages-sans-piece-vendable.csv, sans en-tête. Sortie : pg_id, type_id,
# autre_affichee, klaxcar_affichee. Page à 0 produit = f,t (1 034 le 2026-11-19
# à 06:47 UTC). Lancé depuis le dossier de sweep-psql.sh (lecture seule).
cd "$(dirname "$0")/.."
out=kx/disp_cible.csv; : > $out
split -l 1000 -d kx/pages_sans_vendable_d118.csv kx/cible_
for f in kx/cible_*; do
  vals=$(awk -F, '{printf "%s(%s,%s)", (NR>1?",":""), $1, $2}' "$f")
  STATEMENT_TIMEOUT_MS=200000 ./sweep-psql.sh -At -F, -c "
  select v.g, v.t,
    exists (select 1 from pieces_relation_type r join pieces p on p.piece_id = r.rtp_piece_id
             where r.rtp_pg_id = v.g and r.rtp_type_id = v.t
               and p.piece_display = true and p.piece_pm_id is distinct from 2590
               and not exists (select 1 from _filter.rtp_pollution_ids x where x.piece_id = r.rtp_piece_id)),
    exists (select 1 from pieces_relation_type r join pieces p on p.piece_id = r.rtp_piece_id
             where r.rtp_pg_id = v.g and r.rtp_type_id = v.t
               and p.piece_display = true and p.piece_pm_id = 2590
               and not exists (select 1 from _filter.rtp_pollution_ids x where x.piece_id = r.rtp_piece_id))
  from (values $vals) v(g,t)" 2>>kx/disp_cible.err | grep -v '^SET' >> $out || echo "ECHEC $f" >> kx/disp_cible.err
done
rm -f kx/cible_*
