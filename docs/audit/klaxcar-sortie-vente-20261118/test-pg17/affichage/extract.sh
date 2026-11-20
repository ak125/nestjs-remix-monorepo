#!/usr/bin/env bash
# Extraction en lecture seule pour le banc PG17 jetable (complément n° 1).
# usage: extract.sh <fichier type_id,pg_id>
set -euo pipefail
cd "$(dirname "$0")/.."
D=pg17b/data; mkdir -p "$D"
vals=$(awk -F, 'NF>=2{printf "%s(%s,%s)", (n++?",":""), $1, $2}' "$1")
PAIRS="(values $vals) v(t,g)"
P="(select r.rtp_piece_id from pieces_relation_type r join $PAIRS on r.rtp_type_id=v.t and r.rtp_pg_id=v.g union select piece_id from pieces where piece_pm_id=2590)"
PR="(select r.rtp_piece_id from pieces_relation_type r join $PAIRS on r.rtp_type_id=v.t and r.rtp_pg_id=v.g)"
TABLES="public.pieces public.pieces_marque public.pieces_price public.pieces_relation_type public.pieces_gamme public.pieces_media_img public.pieces_side_filtre public.pieces_criteria public.pieces_relation_criteria public.pieces_display_history public.auto_type public.auto_modele public.auto_marque public.auto_type_motor_code public.auto_type_number_code public.catalog_gamme public.__seo_gamme_car public.__seo_family_gamme_car_switch public.__seo_gamme_car_switch public.__seo_item_switch public.pieces_ref_brand public.pieces_ref_search _filter.rtp_pollution_ids"
inlist=$(for t in $TABLES; do printf "%s('%s','%s')" "${sep:-}" "${t%%.*}" "${t#*.}"; sep=,; done)
q() { STATEMENT_TIMEOUT_MS=200000 ./sweep-psql.sh -At -c "$1" 2>>pg17b/extract.err | grep -v '^SET' || true; }
q "select format('CREATE TABLE %I.%I (%s);', n.nspname, c.relname,
      string_agg(format('%I %s%s', a.attname, format_type(a.atttypid, a.atttypmod),
                        case when a.attnotnull then ' NOT NULL' else '' end), ', ' order by a.attnum))
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where (n.nspname, c.relname) in ($inlist) group by n.nspname, c.relname order by 1" > pg17b/schema.sql
cp_() { STATEMENT_TIMEOUT_MS=200000 ./sweep-psql.sh -At -c "\\copy ($2) to '$D/$1.csv' csv header" >/dev/null 2>>pg17b/extract.err; echo "$1 $(($(wc -l < $D/$1.csv)-1))"; }
cp_ pieces "select * from pieces where piece_id in $P"
cp_ pieces_price "select * from pieces_price where pri_piece_id_i in $P"
cp_ pieces_relation_type "select r.* from pieces_relation_type r join $PAIRS on r.rtp_type_id=v.t and r.rtp_pg_id=v.g"
cp_ pieces_media_img "select * from pieces_media_img where pmi_piece_id in (select piece_id::text from $PR x(piece_id))"
cp_ pieces_criteria "select * from pieces_criteria where pc_cri_id::text='100' and pc_piece_id in (select piece_id::text from $PR x(piece_id))"
cp_ pieces_relation_criteria "select c.* from pieces_relation_criteria c join $PAIRS on c.rcp_type_id=v.t and c.rcp_pg_id=v.g"
cp_ pieces_ref_search "select * from pieces_ref_search where prs_kind='3' and prs_piece_id in (select piece_id::text from $PR x(piece_id))"
cp_ auto_type "select * from auto_type where type_id::text in (select t::text from $PAIRS)"
cp_ auto_type_motor_code "select * from auto_type_motor_code where tmc_type_id::text in (select t::text from $PAIRS)"
cp_ auto_type_number_code "select * from auto_type_number_code where tnc_type_id::text in (select t::text from $PAIRS)"
for t in pieces_marque pieces_gamme pieces_side_filtre pieces_display_history auto_modele auto_marque catalog_gamme __seo_gamme_car __seo_family_gamme_car_switch __seo_gamme_car_switch __seo_item_switch pieces_ref_brand; do cp_ "$t" "select * from public.$t"; done
cp_ rtp_pollution_ids "select * from _filter.rtp_pollution_ids"
