#!/usr/bin/env bash
# usage: alt_query.sh <pg_id> <file_of_type_ids> <out.csv>
cd "$(dirname "$0")/.."
pg=$1; ids=$(paste -sd, "$2"); out=$3
STATEMENT_TIMEOUT_MS=200000 ./sweep-psql.sh -At -c "\copy (
select $pg as pg_id, t.type_id,
  exists (select 1 from pieces_relation_type r
            join pieces p on p.piece_id = r.rtp_piece_id
            join pieces_price pp on pp.pri_piece_id_i = p.piece_id
           where r.rtp_pg_id = $pg and r.rtp_type_id = t.type_id
             and p.piece_pm_id is distinct from 2590 and coalesce(r.rtp_pm_id, p.piece_pm_id) is distinct from 2590
             and p.piece_display = true
             and pp.pri_dispo in ('1','2','3') and pp.pricing_state is distinct from 'FROZEN'
             and pp.pri_vente_ttc_n > 0) as autre_vendable_d118,
  exists (select 1 from pieces_relation_type r
            join pieces p on p.piece_id = r.rtp_piece_id
            join pieces_price pp on pp.pri_piece_id_i = p.piece_id
           where r.rtp_pg_id = $pg and r.rtp_type_id = t.type_id
             and p.piece_pm_id is distinct from 2590 and coalesce(r.rtp_pm_id, p.piece_pm_id) is distinct from 2590
             and p.piece_display = true and pp.pri_dispo = '1') as autre_dispo1_v3
from unnest('{$ids}'::int[]) as t(type_id)) to '$out.tmp' csv" >/dev/null 2>>kx/alt/errors.log && mv "$out.tmp" "$out"
