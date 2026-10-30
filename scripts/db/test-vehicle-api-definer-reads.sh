#!/usr/bin/env bash
# =============================================================================
# Banc de 20261026_vehicle_api_definer_reads.sql
#
# Joue RÉELLEMENT les rôles de l'API (anon, authenticated, service_role) sur
# l'image supabase/postgres, avant puis après la migration, puis compare par
# HTTP, à travers PostgREST, les lectures du sélecteur de véhicules :
#   T  = requête actuelle des services sur la table, en service_role (PROD, DEV)
#   RA = même requête sur la fonction, en anon (PREPROD READ_ONLY)
#   RS = même requête sur la fonction, en service_role
# Statut, Content-Range et corps doivent être identiques octet pour octet.
# Joue aussi le retour arrière (.down.sql), la ré-application et la garde
# fail-closed.
#
# Environnement : deux conteneurs locaux jetables (PostgreSQL + PostgREST),
# liés à 127.0.0.1, créés et détruits ici. Mots de passe et secret JWT tirés au
# hasard pour ce banc. Aucune variable de connexion Supabase n'est lue ; ne
# touche JAMAIS une base partagée.
#
# Usage : bash scripts/db/test-vehicle-api-definer-reads.sh
#         (DOCKER_PULL=never pour n'utiliser que des images déjà présentes)
# Sortie : 0 si toutes les assertions passent.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$ROOT/scripts/db/vehicle-api-definer-reads-fixture.sql"
MIGRATION="$ROOT/backend/supabase/migrations/20261026_vehicle_api_definer_reads.sql"
DOWN="$ROOT/backend/supabase/migrations/20261026_vehicle_api_definer_reads.down.sql"
PGIMAGE="${PGIMAGE:-supabase/postgres:17.6.1.164}"
PGRSTIMAGE="${PGRSTIMAGE:-postgrest/postgrest:v16.4}"
PULL="${DOCKER_PULL:-missing}"
DB="vehicle-api-definer-db-$$"
API="vehicle-api-definer-api-$$"

for c in docker curl jq openssl; do
  command -v "$c" >/dev/null || { echo "FATAL: $c requis"; exit 2; }
done
for f in "$FIXTURE" "$MIGRATION" "$DOWN"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done

# Only remove the containers created by this invocation and their anonymous data.
DB_ID=""; API_ID=""; WORK="$(mktemp -d)"
cleanup() {
  if [[ -n "$API_ID" ]]; then docker rm -fv "$API_ID" >/dev/null 2>&1 || true; fi
  if [[ -n "$DB_ID" ]]; then docker rm -fv "$DB_ID" >/dev/null 2>&1 || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT

PGPASS="$(openssl rand -hex 16)"
AUTHPASS="$(openssl rand -hex 16)"
JWT_SECRET="$(openssl rand -hex 32)"

echo "Images : $PGIMAGE, $PGRSTIMAGE"
DB_ID="$(docker run -d --pull "$PULL" --name "$DB" --memory=768m \
  -e POSTGRES_PASSWORD="$PGPASS" -p 127.0.0.1::3000 "$PGIMAGE")" || exit 2
for _ in $(seq 1 60); do
  docker exec "$DB" pg_isready -h localhost -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$DB" pg_isready -h localhost -U postgres >/dev/null 2>&1 || { echo "FATAL: postgres non prêt"; exit 2; }

# psql_as <utilisateur> <base> [args psql…]
psql_as() { local u="$1" d="$2"; shift 2; docker exec -i "$DB" psql -h localhost -U "$u" -d "$d" -v ON_ERROR_STOP=1 -q "$@"; }
sql() { psql_as postgres postgres -tA -c "$1" | tr -d '\r'; }

# Réglages de la base réelle : row_security=off (une lecture que la RLS
# filtrerait échoue au lieu de rendre moins de lignes) et PostgREST connecté en
# authenticator.
psql_as supabase_admin postgres <<SQL || { echo "FATAL: préparation des rôles"; exit 2; }
ALTER ROLE authenticator WITH PASSWORD '$AUTHPASS';
ALTER DATABASE postgres SET row_security = off;
SQL
echo "PostgreSQL : $(sql 'SHOW server_version')"
echo "Déclencheurs d'événements de l'image : $(sql "SELECT coalesce(string_agg(evtname, ',' ORDER BY evtname), 'aucun') FROM pg_event_trigger")"

echo
echo "=== Fixture (état d'accès PROD avant migration) ==="
psql_as postgres postgres -f - < "$FIXTURE" || { echo "FATAL: fixture en échec"; exit 2; }
COUNTS_BEFORE="$(sql "SELECT (SELECT count(*) FROM auto_marque)||'/'||(SELECT count(*) FROM auto_modele)||'/'||(SELECT count(*) FROM auto_type)")"
echo "lignes marques/modèles/types : $COUNTS_BEFORE"

API_ID="$(docker run -d --pull "$PULL" --name "$API" --memory=256m --network "container:$DB" \
  -e PGRST_DB_URI="postgres://authenticator:$AUTHPASS@localhost:5432/postgres" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="$JWT_SECRET" -e PGRST_DB_MAX_ROWS=1000 \
  -e PGRST_SERVER_PORT=3000 "$PGRSTIMAGE")" || exit 2
BASE="http://$(docker port "$DB" 3000/tcp | head -1)"
for _ in $(seq 1 60); do
  [[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")" == "200" ]] && break
  sleep 0.5
done
[[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")" == "200" ]] || { echo "FATAL: PostgREST non prêt"; docker logs "$API" 2>&1 | tail -5; exit 2; }
echo "PostgREST : $(curl -s "$BASE/" | jq -r '.info.version // "?"')"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
jwt() {
  local h p s
  h=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  p=$(printf '{"role":"%s","exp":%d}' "$1" $(( $(date +%s) + 3600 )) | b64url)
  s=$(printf '%s.%s' "$h" "$p" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)
  printf '%s.%s.%s' "$h" "$p" "$s"
}
declare -A TOKEN=([anon]="$(jwt anon)" [service_role]="$(jwt service_role)")

# Encode chaque valeur comme le fait postgrest-js (URLSearchParams).
encode_query() {
  jq -rn --arg s "$1" '$s | split("&") | map(capture("^(?<k>[^=]+)=(?<v>.*)$") | "\(.k)=\(.v | @uri)") | join("&")'
}

# http <role> <chemin?requete brute> <prefer> <préfixe>
#   → <préfixe>.s : "statut|content-range" ; <préfixe>.b : corps tel que reçu
http() {
  local role="$1" target="$2" prefer="$3" out="$4" res qs hdr code cr
  res="${target%%\?*}"; qs="${target#*\?}"
  hdr="$WORK/h.$$"
  local args=(-s -o "$out.b" -D "$hdr" -w '%{http_code}' -H "Authorization: Bearer ${TOKEN[$role]}")
  [[ -n "$prefer" ]] && args+=(-H "Prefer: $prefer")
  code=$(curl "${args[@]}" "$BASE/$res?$(encode_query "$qs")")
  cr=$(tr -d '\r' < "$hdr" | sed -n 's/^[Cc]ontent-[Rr]ange: //p')
  printf '%s|%s' "$code" "$cr" > "$out.s"
}
status_of() { cut -d'|' -f1 "$1.s"; }
code_of() { jq -r 'if type=="object" then .code else "-" end' "$1.b"; }
same() { cmp -s "$1.s" "$2.s" && cmp -s "$1.b" "$2.b" && echo identique || echo différent; }
summary_of() { # statut, Content-Range, lignes ou code d'erreur
  printf '%s %s %s' "$(status_of "$1")" "$(cut -d'|' -f2 "$1.s" | sed 's/^$/-/')" \
    "$(jq -r 'if type=="array" then "\(length) ligne(s)" else (.code // "?") end' "$1.b" 2>/dev/null || echo '?')"
}

# probe <role> <sql> → OUI / REFUSE (42501) / ABSENT (42883) / ERREUR
# Avec row_security=off, la lecture d'une table RLS par un rôle sans BYPASSRLS est
# refusée dès la réécriture (« query would be affected by row-level security
# policy », 42501), avant le contrôle de droit : le classement se fait sur le code.
probe() {
  local role="$1" q="$2" out rc
  out=$(docker exec -i "$DB" psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -tA 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE $role;
$q
ROLLBACK;
SQL
)
  rc=$?
  if [[ $rc -eq 0 ]]; then echo "OUI"; return; fi
  case "$out" in
    *"ERROR:  42501:"*) echo "REFUSE" ;;
    *"ERROR:  42883:"*) echo "ABSENT" ;;
    *) echo "ERREUR"; printf '    [%s] %s\n' "$role" "$(grep -m1 -E 'ERROR|FATAL' <<<"$out")" >&2 ;;
  esac
}

pass=0; fail=0
assert() { # assert <libelle> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  PASS  $1 → $3"; pass=$((pass+1));
  else echo "  FAIL  $1 → obtenu '$3', attendu '$2'"; fail=$((fail+1)); fi
}

rpc_state() { # statut et code de rpc/get_vehicle_api_brands en anon (code '-' si succès)
  http anon "rpc/get_vehicle_api_brands?select=marque_id&limit=1" "" "$WORK/state"
  printf '%s %s' "$(status_of "$WORK/state")" "$(code_of "$WORK/state")"
}
wait_state() { # wait_state <état attendu> <essais de 0,5 s>
  local got
  for _ in $(seq 1 "$2"); do got=$(rpc_state); [[ "$got" == "$1" ]] && return 0; sleep 0.5; done
  echo "  (état observé : $got)"; return 1
}
reload_until() { # reload_until <état attendu> : NOTIFY puis attente
  sql "NOTIFY pgrst, 'reload schema'" >/dev/null
  wait_state "$1" 40
}

FUNCS=(
  "brands:SELECT count(*) FROM public.get_vehicle_api_brands();"
  "brand_models:SELECT count(*) FROM public.get_vehicle_api_brand_models(1::smallint);"
  "types_by_models:SELECT count(*) FROM public.get_vehicle_api_types_by_models(ARRAY['101']);"
  "model_types:SELECT count(*) FROM public.get_vehicle_api_model_types('601');"
)
TABLE_READS=(
  "auto_marque:SELECT 1 FROM public.auto_marque LIMIT 1;"
  "auto_modele:SELECT 1 FROM public.auto_modele LIMIT 1;"
  "auto_type:SELECT 1 FROM public.auto_type LIMIT 1;"
)
ROLES=(anon authenticated service_role)

matrix() { # matrix <tableau associatif à remplir>
  local -n M="$1"; local e r
  for r in "${ROLES[@]}"; do
    for e in "${FUNCS[@]}" "${TABLE_READS[@]}"; do M["$r,${e%%:*}"]=$(probe "$r" "${e#*:}"); done
  done
}

# -----------------------------------------------------------------------------
# Lectures comparées. Chaque ligne : nom | statut attendu | requête table (T) |
# requête fonction (RA, RS) | en-tête Prefer. Les requêtes reprennent celles des
# services (backend/src/modules/vehicles/services/data/) ; côté fonction, les
# filtres que la fonction pose déjà sont retirés.
# -----------------------------------------------------------------------------
M1="101,102,103,104,105,106,107,108"; M5="501,502,503,504"
SEL2="type_id,type_modele_id,type_year_from,type_year_to,type_fuel"
CASES=(
  # getBrands
  "marques_affichees|200|auto_marque?select=*&marque_display=eq.1&offset=0&limit=50&order=marque_name.asc|get_vehicle_api_brands?select=*&marque_display=eq.1&offset=0&limit=50&order=marque_name.asc|"
  "marques_toutes_page2|200|auto_marque?select=*&offset=3&limit=3&order=marque_name.asc|get_vehicle_api_brands?select=*&offset=3&limit=3&order=marque_name.asc|"
  "marques_recherche|200|auto_marque?select=*&marque_display=eq.1&offset=0&limit=50&marque_name=ilike.%b%&order=marque_name.asc|get_vehicle_api_brands?select=*&marque_display=eq.1&offset=0&limit=50&marque_name=ilike.%b%&order=marque_name.asc|"
  "marques_hors_page|200|auto_marque?select=*&marque_display=eq.1&offset=50&limit=50&order=marque_name.asc|get_vehicle_api_brands?select=*&marque_display=eq.1&offset=50&limit=50&order=marque_name.asc|"
  # étape 1 de getModelsByBrand et de getYearsByBrand
  "ids_marque5|200|auto_modele?select=modele_id&modele_marque_id=eq.5|get_vehicle_api_brand_models?p_marque_id=5&select=modele_id|"
  "ids_marque1|200|auto_modele?select=modele_id&modele_marque_id=eq.1|get_vehicle_api_brand_models?p_marque_id=1&select=modele_id|"
  "ids_marque_sans_modele|200|auto_modele?select=modele_id&modele_marque_id=eq.8|get_vehicle_api_brand_models?p_marque_id=8&select=modele_id|"
  "ids_marque_borne|200|auto_modele?select=modele_id&modele_marque_id=eq.32767|get_vehicle_api_brand_models?p_marque_id=32767&select=modele_id|"
  "ids_hors_plage|400|auto_modele?select=modele_id&modele_marque_id=eq.999999|get_vehicle_api_brand_models?p_marque_id=999999&select=modele_id|"
  "ids_hors_plage_int4|400|auto_modele?select=modele_id&modele_marque_id=eq.2147483647|get_vehicle_api_brand_models?p_marque_id=2147483647&select=modele_id|"
  # étape 2 de getModelsByBrand (pages de 1 000, sans tri)
  "types_marque1|200|auto_type?select=$SEL2&type_modele_id=in.($M1)&offset=0&limit=1000|get_vehicle_api_types_by_models?p_modele_ids={$M1}&select=$SEL2&offset=0&limit=1000|"
  "types_marque5_p0|200|auto_type?select=$SEL2&type_modele_id=in.($M5)&offset=0&limit=1000|get_vehicle_api_types_by_models?p_modele_ids={$M5}&select=$SEL2&offset=0&limit=1000|"
  "types_marque5_p1|200|auto_type?select=$SEL2&type_modele_id=in.($M5)&offset=1000&limit=1000|get_vehicle_api_types_by_models?p_modele_ids={$M5}&select=$SEL2&offset=1000&limit=1000|"
  # étape 2 de getYearsByBrand
  "annees_marque1|200|auto_type?select=type_year_from,type_year_to&type_modele_id=in.($M1)&type_display=eq.1&type_year_from=not.is.null&offset=0&limit=1000|get_vehicle_api_types_by_models?p_modele_ids={$M1}&select=type_year_from,type_year_to&type_display=eq.1&type_year_from=not.is.null&offset=0&limit=1000|"
  "annees_marque5_p0|200|auto_type?select=type_year_from,type_year_to&type_modele_id=in.($M5)&type_display=eq.1&type_year_from=not.is.null&offset=0&limit=1000|get_vehicle_api_types_by_models?p_modele_ids={$M5}&select=type_year_from,type_year_to&type_display=eq.1&type_year_from=not.is.null&offset=0&limit=1000|"
  "annees_marque5_p1|200|auto_type?select=type_year_from,type_year_to&type_modele_id=in.($M5)&type_display=eq.1&type_year_from=not.is.null&offset=1000&limit=1000|get_vehicle_api_types_by_models?p_modele_ids={$M5}&select=type_year_from,type_year_to&type_display=eq.1&type_year_from=not.is.null&offset=1000&limit=1000|"
  # requête principale de getModelsByBrand (compte exact)
  "modeles_affiches|200|auto_modele?select=*&modele_marque_id=eq.1&modele_id=in.(101,102,103,105,106,108)&modele_display=eq.1&offset=0&limit=50&order=modele_name.asc|get_vehicle_api_brand_models?p_marque_id=1&select=*&modele_id=in.(101,102,103,105,106,108)&modele_display=eq.1&offset=0&limit=50&order=modele_name.asc|count=exact"
  "modeles_tous|200|auto_modele?select=*&modele_marque_id=eq.1&modele_id=in.(101,102,103,105,106,108)&offset=0&limit=50&order=modele_name.asc|get_vehicle_api_brand_models?p_marque_id=1&select=*&modele_id=in.(101,102,103,105,106,108)&offset=0&limit=50&order=modele_name.asc|count=exact"
  "modeles_page2|206|auto_modele?select=*&modele_marque_id=eq.1&modele_id=in.(101,102,103,105,106,108)&modele_display=eq.1&offset=2&limit=2&order=modele_name.asc|get_vehicle_api_brand_models?p_marque_id=1&select=*&modele_id=in.(101,102,103,105,106,108)&modele_display=eq.1&offset=2&limit=2&order=modele_name.asc|count=exact"
  "modeles_marque5|200|auto_modele?select=*&modele_marque_id=eq.5&modele_id=in.($M5)&modele_display=eq.1&offset=0&limit=50&order=modele_name.asc|get_vehicle_api_brand_models?p_marque_id=5&select=*&modele_id=in.($M5)&modele_display=eq.1&offset=0&limit=50&order=modele_name.asc|count=exact"
  "modeles_recherche|200|auto_modele?select=*&modele_marque_id=eq.1&modele_id=in.(101,102,103,105,106,108)&modele_display=eq.1&or=(modele_alias.ilike.%gi%,modele_name.ilike.%gi%)&offset=0&limit=50&order=modele_name.asc|get_vehicle_api_brand_models?p_marque_id=1&select=*&modele_id=in.(101,102,103,105,106,108)&modele_display=eq.1&or=(modele_alias.ilike.%gi%,modele_name.ilike.%gi%)&offset=0&limit=50&order=modele_name.asc|count=exact"
  "modeles_recherche_virgule|400|auto_modele?select=*&modele_marque_id=eq.1&modele_id=in.(101,102,103,105,106,108)&modele_display=eq.1&or=(modele_alias.ilike.%a,b%,modele_name.ilike.%a,b%)&offset=0&limit=50&order=modele_name.asc|get_vehicle_api_brand_models?p_marque_id=1&select=*&modele_id=in.(101,102,103,105,106,108)&modele_display=eq.1&or=(modele_alias.ilike.%a,b%,modele_name.ilike.%a,b%)&offset=0&limit=50&order=modele_name.asc|count=exact"
  "modeles_hors_page|416|auto_modele?select=*&modele_marque_id=eq.1&modele_id=in.(101,102,103,105,106,108)&modele_display=eq.1&offset=50&limit=50&order=modele_name.asc|get_vehicle_api_brand_models?p_marque_id=1&select=*&modele_id=in.(101,102,103,105,106,108)&modele_display=eq.1&offset=50&limit=50&order=modele_name.asc|count=exact"
  # getTypesByModel
  "motorisations_601|200|auto_type?select=*&type_modele_id=eq.601&type_display=eq.1&offset=0&limit=50&order=type_name.asc|get_vehicle_api_model_types?p_modele_id=601&select=*&offset=0&limit=50&order=type_name.asc|"
  "motorisations_601_page2|200|auto_type?select=*&type_modele_id=eq.601&type_display=eq.1&offset=2&limit=2&order=type_name.asc|get_vehicle_api_model_types?p_modele_id=601&select=*&offset=2&limit=2&order=type_name.asc|"
  "motorisations_601_recherche|200|auto_type?select=*&type_modele_id=eq.601&type_display=eq.1&offset=0&limit=50&type_name=ilike.%320%&order=type_name.asc|get_vehicle_api_model_types?p_modele_id=601&select=*&offset=0&limit=50&type_name=ilike.%320%&order=type_name.asc|"
  "motorisations_501|200|auto_type?select=*&type_modele_id=eq.501&type_display=eq.1&offset=0&limit=50&order=type_name.asc|get_vehicle_api_model_types?p_modele_id=501&select=*&offset=0&limit=50&order=type_name.asc|"
  "motorisations_masquees|200|auto_type?select=*&type_modele_id=eq.105&type_display=eq.1&offset=0&limit=50&order=type_name.asc|get_vehicle_api_model_types?p_modele_id=105&select=*&offset=0&limit=50&order=type_name.asc|"
  "motorisations_inconnu|200|auto_type?select=*&type_modele_id=eq.999&type_display=eq.1&offset=0&limit=50&order=type_name.asc|get_vehicle_api_model_types?p_modele_id=999&select=*&offset=0&limit=50&order=type_name.asc|"
)
case_field() { cut -d'|' -f"$2" <<<"$1"; }

echo
echo "=== AVANT migration ==="
declare -A B; matrix B
for r in "${ROLES[@]}"; do
  for e in "${FUNCS[@]}"; do assert "$r → get_vehicle_api_${e%%:*}" ABSENT "${B[$r,${e%%:*}]}"; done
done
for e in "${TABLE_READS[@]}"; do
  t="${e%%:*}"
  assert "anon lit $t (défaut PREPROD reproduit)"  REFUSE "${B[anon,$t]}"
  assert "authenticated lit $t"                    REFUSE "${B[authenticated,$t]}"
  assert "service_role lit $t"                     OUI    "${B[service_role,$t]}"
done
http anon "auto_marque?select=*&marque_display=eq.1&offset=0&limit=50&order=marque_name.asc" "" "$WORK/anon_table_before"
assert "HTTP anon → /auto_marque (lecture actuelle de getBrands)" "401 42501" \
  "$(status_of "$WORK/anon_table_before") $(code_of "$WORK/anon_table_before")"
for c in "${CASES[@]}"; do
  n=$(case_field "$c" 1)
  http service_role "$(case_field "$c" 3)" "$(case_field "$c" 5)" "$WORK/$n.T0"
done

echo
echo "=== Migration ==="
# -1 : transaction unique, comme le runner de migration (la migration n'ouvre pas
# de BEGIN, cf. squawk assume_in_transaction).
psql_as postgres postgres -1 -f - < "$MIGRATION" || { echo "FATAL: migration en échec"; exit 2; }
echo "ok"
# Publication par PostgREST sans NOTIFY explicite : renseigne la procédure
# d'application (le runner de migration n'envoie pas de NOTIFY).
if wait_state "200 -" 10; then echo "publiée par PostgREST sans NOTIFY explicite (≤ 5 s)"
else echo "non publiée sans NOTIFY explicite après 5 s"; fi
reload_until "200 -" || { echo "FATAL: fonctions non publiées par PostgREST"; exit 2; }

echo
echo "=== APRÈS migration — rôles ==="
declare -A A; matrix A
for e in "${FUNCS[@]}"; do
  f="${e%%:*}"
  assert "anon → get_vehicle_api_$f"          OUI    "${A[anon,$f]}"
  assert "authenticated → get_vehicle_api_$f" REFUSE "${A[authenticated,$f]}"
  assert "service_role → get_vehicle_api_$f"  OUI    "${A[service_role,$f]}"
done
for e in "${TABLE_READS[@]}"; do
  t="${e%%:*}"
  assert "anon lit toujours pas $t"           REFUSE "${A[anon,$t]}"
  assert "authenticated lit toujours pas $t"  REFUSE "${A[authenticated,$t]}"
  assert "service_role lit toujours $t"       OUI    "${A[service_role,$t]}"
done

echo
echo "=== APRÈS migration — structure ==="
assert "4 fonctions STABLE SECURITY DEFINER, propriétaire postgres, search_path figé" "4" \
  "$(sql "SELECT count(*) FROM pg_proc WHERE proname LIKE 'get\_vehicle\_api\_%' AND prosecdef AND provolatile='s' AND proretset AND pg_get_userbyid(proowner)='postgres' AND proconfig = ARRAY['search_path=public, pg_temp']")"
assert "bénéficiaires EXECUTE de chaque fonction" "anon,postgres,service_role|anon,postgres,service_role|anon,postgres,service_role|anon,postgres,service_role" \
  "$(sql "SELECT string_agg(g, '|' ORDER BY p) FROM (SELECT p, string_agg(r, ',' ORDER BY r) g FROM (SELECT p.proname p, CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END r FROM pg_proc p, aclexplode(p.proacl) a WHERE p.proname LIKE 'get\_vehicle\_api\_%' AND a.privilege_type='EXECUTE') y GROUP BY p) x")"
assert "signatures" "get_vehicle_api_brand_models(smallint)|get_vehicle_api_brands()|get_vehicle_api_model_types(text)|get_vehicle_api_types_by_models(text[])" \
  "$(sql "SELECT string_agg(oid::regprocedure::text, '|' ORDER BY oid::regprocedure::text) FROM pg_proc WHERE proname LIKE 'get\_vehicle\_api\_%'")"
assert "aucun droit de table rendu à anon/authenticated" "0" \
  "$(sql "SELECT count(*) FROM (VALUES ('auto_marque'),('auto_modele'),('auto_type')) t(n), (VALUES ('anon'),('authenticated')) r(n), (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) p(n) WHERE has_table_privilege(r.n, 'public.'||t.n, p.n)")"
assert "données inchangées (marques/modèles/types)" "$COUNTS_BEFORE" \
  "$(sql "SELECT (SELECT count(*) FROM auto_marque)||'/'||(SELECT count(*) FROM auto_modele)||'/'||(SELECT count(*) FROM auto_type)")"

# Détournement par une table temporaire homonyme : le corps qualifie public.
hijack() { # hijack <role> → nombre de marques rendu, ou REFUSE si TEMP est refusé
  local out
  out=$(docker exec -i "$DB" psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -tA 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE $1;
SET LOCAL search_path = pg_temp, public;
CREATE TEMP TABLE auto_marque (marque_id smallint, marque_name text) ON COMMIT DROP;
INSERT INTO auto_marque SELECT g, 'X' FROM generate_series(1, 50) g;
SELECT count(*) FROM public.get_vehicle_api_brands();
ROLLBACK;
SQL
) || { [[ "$out" == *"permission denied"* ]] && echo "REFUSE" || echo "ERREUR"; return; }
  tr -d '\r' <<<"$out" | grep -E '^[0-9]+$' | tail -1
}
nb_marques="$(sql 'SELECT count(*) FROM auto_marque')"
for r in anon service_role; do
  h=$(hijack "$r")
  if [[ "$h" == "REFUSE" ]]; then assert "$r : table temporaire refusée (vecteur fermé en amont)" REFUSE "$h"
  else assert "$r : table temporaire auto_marque sans effet sur la fonction" "$nb_marques" "$h"; fi
done

echo
echo "=== APRÈS migration — équivalence HTTP T / RA / RS ==="
printf '  %-28s %-30s %-30s %s\n' "lecture" "T (table, service_role)" "RA (fonction, anon)" "RS"
for c in "${CASES[@]}"; do
  n=$(case_field "$c" 1); want=$(case_field "$c" 2); prefer=$(case_field "$c" 5)
  http service_role "$(case_field "$c" 3)" "$prefer" "$WORK/$n.T"
  http anon         "rpc/$(case_field "$c" 4)" "$prefer" "$WORK/$n.RA"
  http service_role "rpc/$(case_field "$c" 4)" "$prefer" "$WORK/$n.RS"
  printf '  %-28s %-30s %-30s %s\n' "$n" "$(summary_of "$WORK/$n.T")" "$(summary_of "$WORK/$n.RA")" "$(summary_of "$WORK/$n.RS")"
done
for c in "${CASES[@]}"; do
  n=$(case_field "$c" 1); want=$(case_field "$c" 2)
  assert "$n : statut T"                     "$want"    "$(status_of "$WORK/$n.T")"
  assert "$n : T identique avant/après"      identique  "$(same "$WORK/$n.T0" "$WORK/$n.T")"
  for v in RA RS; do
    r=$(same "$WORK/$n.T" "$WORK/$n.$v"); assert "$n : $v = T" identique "$r"
    if [[ "$r" != identique ]]; then
      diff <(cat "$WORK/$n.T.s"; echo; jq -c 'if type=="array" then .[] else . end' "$WORK/$n.T.b") \
           <(cat "$WORK/$n.$v.s"; echo; jq -c 'if type=="array" then .[] else . end' "$WORK/$n.$v.b") | head -8 | cut -c1-200 | sed 's/^/        /'
    fi
  done
done
assert "types_marque5 : 1 000 + 201 lignes (plafond db-max-rows)" "1000|201" \
  "$(jq length "$WORK/types_marque5_p0.RA.b")|$(jq length "$WORK/types_marque5_p1.RA.b")"
assert "types_marque5 : pages disjointes et complètes" "1201" \
  "$(jq -s 'add | map(.type_id) | unique | length' "$WORK/types_marque5_p0.RA.b" "$WORK/types_marque5_p1.RA.b")"

echo
echo "=== Retour arrière (.down.sql) ==="
psql_as postgres postgres -f - < "$DOWN" || { echo "FATAL: retour arrière en échec"; exit 2; }
echo "ok"
reload_until "404 PGRST202" || true
declare -A D; matrix D
for e in "${FUNCS[@]}"; do assert "anon → get_vehicle_api_${e%%:*} après retour" ABSENT "${D[anon,${e%%:*}]}"; done
assert "anon lit toujours pas auto_marque après retour" REFUSE "${D[anon,auto_marque]}"
assert "service_role lit auto_marque après retour"      OUI    "${D[service_role,auto_marque]}"
http anon "rpc/get_vehicle_api_brands?select=*&limit=1" "" "$WORK/rpc_after_down"
assert "HTTP anon → rpc après retour" "404 PGRST202" \
  "$(status_of "$WORK/rpc_after_down") $(code_of "$WORK/rpc_after_down")"
http service_role "$(case_field "${CASES[0]}" 3)" "" "$WORK/after_down.T"
assert "lecture table service_role inchangée après retour" identique \
  "$(same "$WORK/$(case_field "${CASES[0]}" 1).T0" "$WORK/after_down.T")"
assert "données inchangées après retour" "$COUNTS_BEFORE" \
  "$(sql "SELECT (SELECT count(*) FROM auto_marque)||'/'||(SELECT count(*) FROM auto_modele)||'/'||(SELECT count(*) FROM auto_type)")"
out=$(psql_as postgres postgres -f - < "$DOWN" 2>&1); rc=$?
assert "second retour arrière refusé (fonctions absentes)" "rc≠0 ABORT" \
  "$([[ $rc -ne 0 ]] && echo 'rc≠0' || echo 'rc=0') $(grep -q 'ABORT' <<<"$out" && echo ABORT || echo '-')"

echo
echo "=== Ré-application ==="
psql_as postgres postgres -1 -f - < "$MIGRATION" || { echo "FATAL: ré-application en échec"; exit 2; }
echo "ok"
reload_until "200 -" || true
n0=$(case_field "${CASES[0]}" 1)
http anon "rpc/$(case_field "${CASES[0]}" 4)" "" "$WORK/$n0.RA2"
assert "$n0 : RA = T après ré-application" identique "$(same "$WORK/$n0.T" "$WORK/$n0.RA2")"

echo
echo "=== Garde fail-closed : modele_marque_id d'un autre type ==="
psql_as supabase_admin postgres -c "CREATE DATABASE failclosed OWNER postgres" || { echo "FATAL: base failclosed"; exit 2; }
psql_as postgres failclosed -f - < "$FIXTURE" || { echo "FATAL: fixture failclosed"; exit 2; }
psql_as postgres failclosed -c "ALTER TABLE public.auto_modele ALTER COLUMN modele_marque_id TYPE integer"
out=$(psql_as postgres failclosed -1 -f - < "$MIGRATION" 2>&1); rc=$?
echo "  sortie : $(grep -m1 -E 'ERROR|ERREUR' <<<"$out")"
assert "migration refusée"         "rc≠0" "$([[ $rc -ne 0 ]] && echo 'rc≠0' || echo 'rc=0')"
assert "cause : signature smallint introuvable" oui \
  "$(grep -qE 'get_vehicle_api_brand_models\(smallint\)' <<<"$out" && echo oui || echo non)"
assert "aucune fonction créée"     "0" \
  "$(psql_as postgres failclosed -tA -c "SELECT count(*) FROM pg_proc WHERE proname LIKE 'get\_vehicle\_api\_%'" | tr -d '\r')"

echo
echo "=== MATRICE avant → après → retour ==="
printf "%-34s | %-26s | %-26s | %s\n" "objet" "anon" "authenticated" "service_role"
for e in "${FUNCS[@]}" "${TABLE_READS[@]}"; do
  k="${e%%:*}"; lbl="$k"; [[ "$k" == auto_* ]] || lbl="get_vehicle_api_$k"
  printf "%-34s | %-26s | %-26s | %s\n" "$lbl" \
    "${B[anon,$k]} → ${A[anon,$k]} → ${D[anon,$k]}" \
    "${B[authenticated,$k]} → ${A[authenticated,$k]} → ${D[authenticated,$k]}" \
    "${B[service_role,$k]} → ${A[service_role,$k]} → ${D[service_role,$k]}"
done

echo
echo "----------------------------------------"
echo "PASS=$pass  FAIL=$fail"
[[ "$fail" -eq 0 ]] || exit 1
exit 0
