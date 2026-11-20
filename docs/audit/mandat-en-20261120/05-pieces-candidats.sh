#!/usr/bin/env bash
# Mandat EN — pièces dans la gamme des types candidats (04-candidats.tsv),
# critère du RPC de page et de R2TitleCollisionService : une ligne
# pieces_relation_type (rtp_pg_id, rtp_type_id). Lecture seule.
# Usage : 05-pieces-candidats.sh <dossier> <sweep-psql.sh>
set -euo pipefail
dir=$1; psqlro=$2
pg=$(tail -n +2 "$dir/04-candidats.tsv" | cut -f1 | paste -sd,)
ty=$(tail -n +2 "$dir/04-candidats.tsv" | cut -f2 | paste -sd,)
cat > "$dir/05-pieces-candidats.gen.sql" <<SQL
\pset footer off
\pset format unaligned
\pset fieldsep '\t'
SELECT c.pg_id, c.type_id
  FROM unnest('{$pg}'::int[], '{$ty}'::int[]) AS c(pg_id, type_id)
 WHERE EXISTS (SELECT 1 FROM pieces_relation_type r
                WHERE r.rtp_pg_id = c.pg_id AND r.rtp_type_id = c.type_id);
SQL
STATEMENT_TIMEOUT_MS=600000 "$psqlro" -q -f "$dir/05-pieces-candidats.gen.sql" | grep -v '^SET$' > "$dir/05-pieces-candidats.tsv"
