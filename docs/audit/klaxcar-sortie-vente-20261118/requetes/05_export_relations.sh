#!/usr/bin/env bash
cd "$(dirname "$0")/.."
for f in kx/rel/lot_[0-9][0-9][0-9]; do
  out="$f.csv"; [[ -s "$out" ]] && continue
  ids=$(paste -sd, "$f")
  STATEMENT_TIMEOUT_MS=120000 ./sweep-psql.sh -At -c "\copy (select rtp_type_id, rtp_pg_id, rtp_piece_id, rtp_pm_id from pieces_relation_type where rtp_piece_id = any('{$ids}'::int[])) to '$out.tmp' csv" >/dev/null 2>>kx/rel/errors.log && mv "$out.tmp" "$out" || echo "ECHEC $f" >> kx/rel/errors.log
done
echo FIN $(date -u +%T) >> kx/rel/errors.log
