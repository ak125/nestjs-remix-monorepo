#!/usr/bin/env bash
# Mandat EH, 6.4 : essai de bout en bout des deux migrations (EE type_name_meta,
# EH type_name) sur un PostgreSQL 17 jetable (docker), jamais sur une base réelle.
# Usage : bash 15-e2e-pg17.sh <racine du dépôt>   (sortie : stdout, à rediriger vers e2e-pg17.txt)
# Fixtures : les 900 types de classement.tsv (mandat EE) avec leurs type_name et
# type_name_meta relevés, un cache véhicule minimal, la vraie fonction
# mark_stale_with_followup_rebuild (20260425) et une reconstruction simulée.
set -euo pipefail
R=$(cd "$1" && pwd)
EE=$R/docs/audit/mandat-ee-noms-motorisation-20261120
EH=$R/docs/audit/mandat-eh-sources-noms-motorisation-20261120
M=$R/backend/supabase/migrations
UP_EE=$M/20261120_auto_type_name_meta_corrections_mandat_ee.sql
UP_EH=$M/20261120_auto_type_name_origine_corrections_mandat_eh.sql
C=pg17-mandat-eh-$$
docker run -d --rm --name "$C" -e POSTGRES_PASSWORD=jetable postgres:17 >/dev/null
trap 'docker rm -f "$C" >/dev/null 2>&1 || true' EXIT
until docker exec "$C" pg_isready -U postgres -q 2>/dev/null && docker exec "$C" psql -U postgres -tAc 'select 1' >/dev/null 2>&1; do sleep 1; done
P() { docker exec -i "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
etat() { P -tA -c "select '$1', count(*), md5(string_agg(type_id||'|'||coalesce(type_name,'∅')||'|'||coalesce(type_name_meta,'∅'), '#' order by type_id::int)),
  (select sum(rebuilds) from public.__vehicle_page_cache), (select count(*) from public.__vehicle_page_cache where stale) from public.auto_type" | tr '|' ' ' | sed 's/ / | /g'; }
applique() { P -1 < "$1" 2>&1 | sed 's/^psql:<stdin>:[0-9]*: //' || true; }
controle() { echo "écarts au contrôle $2 (attendu 0) : $(P -tA < "$1" | grep -c . || true)"; }

echo "== $(date -u +%FT%TZ) $(P -tA -c 'select version()' | cut -d' ' -f1-4) jetable"
P <<SQL
create table public.auto_type (type_id text primary key, type_name text, type_name_meta text);
create table public.__vehicle_page_cache (type_id integer primary key, stale boolean not null default false,
  stale_reason text, rebuilds integer not null default 0);
create function public.rebuild_vehicle_page_cache(p integer) returns void language sql as
  \$\$ update public.__vehicle_page_cache set stale = false, rebuilds = rebuilds + 1 where type_id = p \$\$;
SQL
P < "$M/20260425_mark_stale_with_followup_rebuild.sql" >/dev/null
python3 -I - "$EE/classement.tsv" <<'PY' | P
import csv, sys
q = lambda s: "'" + s.replace("'", "''") + "'" if s != "" else "NULL"
rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8"), delimiter="\t", quoting=csv.QUOTE_NONE))
print("insert into public.auto_type values " + ",".join(f"({q(r['type_id'])},{q(r['type_name'])},{q(r['type_name_meta'])})" for r in rows) + ";")
print("insert into public.__vehicle_page_cache(type_id) select type_id::int from public.auto_type;")
PY
echo "fixtures : $(P -tA -c 'select count(*) from public.auto_type') types (classement.tsv), mark_stale_with_followup_rebuild 20260425, reconstruction simulée"
echo "colonnes : étape | types | empreinte (type_id, type_name, type_name_meta) | reconstructions cumulées | pages périmées"
etat 0-initial; INIT=$(etat x | cut -d'|' -f3)
echo "-- 1. application EE (type_name_meta)"; applique "$UP_EE"; etat 1-apres-ee; controle "$EE/07-controle-apres.sql" 07
echo "-- 2. application EH (type_name)"; applique "$UP_EH"; etat 2-apres-eh; controle "$EH/13-controle-apres.sql" 13
echo "-- 3. rejeu des deux"; applique "$UP_EE"; applique "$UP_EH"; etat 3-apres-rejeu
echo "-- 4. retour EH puis EE"; applique "${UP_EH%.sql}.down.sql"; applique "${UP_EE%.sql}.down.sql"; etat 4-apres-retours
echo "empreinte initiale retrouvée : $([ "$(etat x | cut -d'|' -f3)" = "$INIT" ] && echo oui || echo NON)"
echo "-- 5. rejeu des retours"; applique "${UP_EH%.sql}.down.sql"; applique "${UP_EE%.sql}.down.sql"; etat 5-apres-rejeu-retours
ID=$(awk -F'\t' 'NR>1 && $9=="origine"{print $1; exit}' "$EH/decisions.tsv")
echo "-- 6. garde EH : type_name du type $ID modifié entre-temps"
P -c "update public.auto_type set type_name = type_name || ' X' where type_id = '$ID'"; etat 6-avant
applique "$UP_EH"; etat 6-apres-refus
P -c "update public.auto_type set type_name = left(type_name, -2) where type_id = '$ID'"
echo "-- 7. garde EH : type_name_meta du type $ID modifié entre-temps"
P -c "update public.auto_type set type_name_meta = type_name_meta || ' X' where type_id = '$ID'"; etat 7-avant
applique "$UP_EH"; etat 7-apres-refus
P -c "update public.auto_type set type_name_meta = left(type_name_meta, -2) where type_id = '$ID'"
echo "-- 8. garde EH : type $ID absent"
P -c "delete from public.auto_type where type_id = '$ID'"; etat 8-avant
applique "$UP_EH"; etat 8-apres-refus
