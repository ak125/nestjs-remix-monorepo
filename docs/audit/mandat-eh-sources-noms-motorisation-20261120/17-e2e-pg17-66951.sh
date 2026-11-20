#!/usr/bin/env bash
# Mandat EK : garde EH sur 66951 (PostgreSQL 17 jetable, conteneur pg17-mandat-ek-<pid>, jamais une base réelle).
# Usage : bash e2e-66951.sh <racine du dépôt> <migration EE de 30704d234>
set -euo pipefail
R=$(cd "$1" && pwd); EE_ANCIENNE=$2; M=$R/backend/supabase/migrations
UP_EE=$M/20261120_auto_type_name_meta_corrections_mandat_ee.sql; UP_EH=$M/20261120_auto_type_name_origine_corrections_mandat_eh.sql
C=pg17-mandat-ek-$$
docker run -d --rm --name "$C" -e POSTGRES_PASSWORD=jetable postgres:17 >/dev/null
trap 'docker rm -f "$C" >/dev/null 2>&1 || true' EXIT
until docker exec "$C" pg_isready -U postgres -q 2>/dev/null && docker exec "$C" psql -U postgres -tAc 'select 1' >/dev/null 2>&1; do sleep 1; done
P() { docker exec -i "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
applique() { P -1 < "$1" 2>&1 | sed 's/^psql:<stdin>:[0-9]*: //' || true; }
v() { echo "$1 : 66951 = $(P -tA -c "select type_name||' / '||type_name_meta from public.auto_type where type_id='66951'")"; }
emp() { P -tA -c "select '$1 : '||count(*)||' types, empreinte '||md5(string_agg(type_id||'|'||type_name||'|'||type_name_meta, '#' order by type_id::int)) from public.auto_type"; }
echo "== $(date -u +%FT%TZ) $(P -tA -c 'select version()' | cut -d' ' -f1-4) jetable"
P <<SQL
create table public.auto_type (type_id text primary key, type_name text, type_name_meta text);
create table public.__vehicle_page_cache (type_id integer primary key, stale boolean not null default false, stale_reason text, rebuilds integer not null default 0);
create function public.rebuild_vehicle_page_cache(p integer) returns void language sql as \$\$ update public.__vehicle_page_cache set stale = false, rebuilds = rebuilds + 1 where type_id = p \$\$;
SQL
P < "$M/20260425_mark_stale_with_followup_rebuild.sql" >/dev/null
python3 -I - "$R/docs/audit/mandat-ee-noms-motorisation-20261120/classement.tsv" <<'PY' | P
import csv, sys
q = lambda s: "'" + s.replace("'", "''") + "'" if s != "" else "NULL"
rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8"), delimiter="\t", quoting=csv.QUOTE_NONE))
print("insert into public.auto_type values " + ",".join(f"({q(r['type_id'])},{q(r['type_name'])},{q(r['type_name_meta'])})" for r in rows) + ";")
print("insert into public.__vehicle_page_cache(type_id) select type_id::int from public.auto_type;")
PY
echo "fixtures : 900 types de classement.tsv (mandat EE), mark_stale_with_followup_rebuild 20260425"
echo "-- A. migrations de la branche : EE ne touche plus 66951, EH le corrige, retours"
v A0-initial
applique "$UP_EE" | grep -o 'mandat EE : [0-9]* valeurs écrites' || true; v A1-apres-ee
applique "$UP_EH" | grep -o 'mandat EH : [0-9]* types corrigés' || true; v A2-apres-eh
applique "${UP_EH%.sql}.down.sql" | grep -o 'mandat EH : [0-9]* types corrigés' || true; v A3-apres-retour-eh
applique "${UP_EE%.sql}.down.sql" | grep -o 'mandat EE : [0-9]* valeurs écrites' || true; v A4-apres-retour-ee
echo "-- B. EE de 30704d234 (qui écrivait 66951) appliquée avant EH : la garde EH doit refuser sans rien écrire"
applique "$EE_ANCIENNE" | grep -o 'mandat EE : [0-9]* valeurs écrites' || true; v B1-apres-ee-ancienne
emp B1-avant-eh
applique "$UP_EH"
emp B2-apres-refus-eh
v B2-apres-refus-eh
