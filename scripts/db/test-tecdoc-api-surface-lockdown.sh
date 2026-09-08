#!/usr/bin/env bash
# =============================================================================
# Test adversarial de la migration 20260907_tecdoc_api_surface_lockdown.sql
#
# Joue RÉELLEMENT les rôles PostgreSQL (SET LOCAL ROLE) contre les 5 portes,
# avant puis après la migration, et vérifie le COMPORTEMENT — pas les ACL.
#
# Environnement : conteneur PostgreSQL jetable (même majeure que la PROD).
# Ne touche JAMAIS la base de production : aucune variable de connexion
# Supabase n'est lue, l'hôte est un conteneur local créé et détruit ici.
#
# Usage : bash scripts/db/test-tecdoc-api-surface-lockdown.sh
# Sortie : 0 si toutes les assertions passent.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$ROOT/scripts/db/tecdoc-api-surface-fixture.sql"
MIGRATION="$ROOT/backend/supabase/migrations/20260907_tecdoc_api_surface_lockdown.sql"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="tecdoc-lockdown-test-$$"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
[[ -f "$FIXTURE"   ]] || { echo "FATAL: fixture absente: $FIXTURE"; exit 2; }
[[ -f "$MIGRATION" ]] || { echo "FATAL: migration absente: $MIGRATION"; exit 2; }

cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Image : $IMAGE"
docker run -d --name "$CT" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test "$IMAGE" >/dev/null || exit 2
for _ in $(seq 1 60); do
  docker exec "$CT" pg_isready -U postgres -d test >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CT" pg_isready -U postgres -d test >/dev/null 2>&1 || { echo "FATAL: postgres non prêt"; exit 2; }
echo "PostgreSQL : $(docker exec "$CT" psql -U postgres -d test -tAc 'SHOW server_version')"
echo

psql_run() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q "$@"; }

# probe <role> <sql> → écrit OUI / REFUSE / ABSENT / CIBLE_ABSENTE / ERREUR
probe() {
  local role="$1" sql="$2" out rc
  out=$(docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -tA 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE $role;
$sql
ROLLBACK;
SQL
)
  rc=$?
  if [[ $rc -eq 0 ]]; then echo "OUI"; return; fi
  case "$out" in
    *"permission denied"*|*"42501"*)                 echo "REFUSE" ;;
    *"does not exist"*"function"*|*"42883"*)         echo "ABSENT" ;;
    *"relation \"tecdoc_raw.t200\" does not exist"*) echo "CIBLE_ABSENTE" ;;
    *)                                               echo "ERREUR" ;;
  esac
}

pass=0; fail=0
assert() { # assert <libelle> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  PASS  $1 → $3"; pass=$((pass+1));
  else echo "  FAIL  $1 → obtenu '$3', attendu '$2'"; fail=$((fail+1)); fi
}

SEL_RECON="SELECT 1 FROM public.v_tecdoc_dlnr_reconciliation LIMIT 1;"
SEL_UNLINKED="SELECT 1 FROM public.v_tecdoc_unlinked_pieces_reason LIMIT 1;"
SEL_LOSCH="SELECT 1 FROM public.__tecdoc_losch_log LIMIT 1;"
INS_LOSCH="INSERT INTO public.__tecdoc_losch_log (source_artnr, source_dlnr, action) VALUES ('X',1,'probe');"
UPD_LOSCH="UPDATE public.__tecdoc_losch_log SET action='probe';"
DEL_LOSCH="DELETE FROM public.__tecdoc_losch_log;"
CALL_LOAD="SELECT public.__load_tecdoc_raw('999', '[]'::jsonb);"
CALL_REMAP_OK="SELECT * FROM public.resolve_type_id_remap(144071);"
CALL_REMAP_KO="SELECT * FROM public.resolve_type_id_remap(999999999);"

echo "=== Application de la fixture (état PROD avant migration) ==="
psql_run -f - < "$FIXTURE" || { echo "FATAL: fixture en échec"; exit 2; }
echo "ok"; echo

declare -A B
for r in anon authenticated service_role; do
  B["$r,load"]=$(probe "$r" "$CALL_LOAD")
  B["$r,recon"]=$(probe "$r" "$SEL_RECON")
  B["$r,unlinked"]=$(probe "$r" "$SEL_UNLINKED")
  B["$r,loschsel"]=$(probe "$r" "$SEL_LOSCH")
  B["$r,loschins"]=$(probe "$r" "$INS_LOSCH")
  B["$r,loschupd"]=$(probe "$r" "$UPD_LOSCH")
  B["$r,loschdel"]=$(probe "$r" "$DEL_LOSCH")
  B["$r,remap"]=$(probe "$r" "$CALL_REMAP_OK")
done

echo "=== AVANT migration — assertions sur l'état vulnérable ==="
assert "anon peut appeler __load_tecdoc_raw"          OUI "${B[anon,load]}"
assert "service_role LIT v_tecdoc_dlnr_reconciliation" OUI "${B[service_role,recon]}"
assert "service_role LIT v_tecdoc_unlinked_pieces"     OUI "${B[service_role,unlinked]}"
assert "service_role LIT __tecdoc_losch_log"           OUI "${B[service_role,loschsel]}"
# INSERT est deja bloque AVANT la migration — mais pas par l'ACL de la vue
# (has_table_privilege(service_role, __tecdoc_losch_log, INSERT) = true en prod) :
# il bute sur le nextval du DEFAULT, et service_role n'a pas USAGE sur
# tecdoc_map.losch_log_id_seq (verifie en prod 2026-09-07 : acl NULL sur les 13
# sequences de tecdoc_map). C'est precisement l'ecart grant/comportement que ce
# banc doit exposer : l'ecriture reellement ouverte etait UPDATE et DELETE.
assert "service_role INSERT bloque par la sequence (pas par l'ACL)" REFUSE "${B[service_role,loschins]}"
assert "service_role ÉCRIT (UPDATE) via la vue"        OUI "${B[service_role,loschupd]}"
assert "service_role ÉCRIT (DELETE) via la vue"        OUI "${B[service_role,loschdel]}"
assert "anon peut appeler resolve_type_id_remap"       OUI "${B[anon,remap]}"
echo

echo "=== Application de la migration ==="
# -1 : transaction unique, pour reproduire l'atomicité que le runner de migration
# fournit en prod (la migration elle-même n'ouvre pas de BEGIN, cf. squawk).
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" \
  || { echo "FATAL: migration en échec"; exit 2; }
echo "ok"; echo

declare -A A
for r in anon authenticated service_role; do
  A["$r,load"]=$(probe "$r" "$CALL_LOAD")
  A["$r,recon"]=$(probe "$r" "$SEL_RECON")
  A["$r,unlinked"]=$(probe "$r" "$SEL_UNLINKED")
  A["$r,loschsel"]=$(probe "$r" "$SEL_LOSCH")
  A["$r,loschins"]=$(probe "$r" "$INS_LOSCH")
  A["$r,loschupd"]=$(probe "$r" "$UPD_LOSCH")
  A["$r,loschdel"]=$(probe "$r" "$DEL_LOSCH")
  A["$r,remap"]=$(probe "$r" "$CALL_REMAP_OK")
done

echo "=== APRÈS migration — les 4 portes doivent être fermées ==="
for r in anon authenticated service_role; do
  assert "$r → __load_tecdoc_raw"                ABSENT "${A[$r,load]}"
  assert "$r → v_tecdoc_dlnr_reconciliation"     REFUSE "${A[$r,recon]}"
  assert "$r → v_tecdoc_unlinked_pieces_reason"  REFUSE "${A[$r,unlinked]}"
  assert "$r → __tecdoc_losch_log SELECT"        REFUSE "${A[$r,loschsel]}"
  assert "$r → __tecdoc_losch_log INSERT"        REFUSE "${A[$r,loschins]}"
  assert "$r → __tecdoc_losch_log UPDATE"        REFUSE "${A[$r,loschupd]}"
  assert "$r → __tecdoc_losch_log DELETE"        REFUSE "${A[$r,loschdel]}"
done
echo

echo "=== APRÈS migration — porte 5 : le 301 doit survivre ==="
assert "anon         → resolve_type_id_remap"    OUI    "${A[anon,remap]}"
assert "service_role → resolve_type_id_remap"    OUI    "${A[service_role,remap]}"
assert "authenticated→ resolve_type_id_remap"    REFUSE "${A[authenticated,remap]}"
rows_ok=$(docker exec -i "$CT" psql -U postgres -d test -tAq <<SQL
BEGIN; SET LOCAL ROLE anon;
SELECT new_id||'|'||type_alias||'|'||modele_alias||'|'||marque_alias FROM public.resolve_type_id_remap(144071);
ROLLBACK;
SQL
)
assert "301 : 144071 résout vers la bonne URL" "60050|mito-1-3-jtdm|mito|alfa-romeo" "$(echo "$rows_ok" | tr -d '\r')"
rows_ko=$(docker exec -i "$CT" psql -U postgres -d test -tAq <<SQL
BEGIN; SET LOCAL ROLE anon;
SELECT count(*) FROM public.resolve_type_id_remap(999999999);
ROLLBACK;
SQL
)
assert "ID inconnu → 0 ligne (410 naturel préservé)" "0" "$(echo "$rows_ko" | tr -d '\r')"
echo

echo "=== APRÈS migration — invariants structurels ==="
inv=$(docker exec -i "$CT" psql -U postgres -d test -tA -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v' AND c.relname IN ('__tecdoc_losch_log','v_tecdoc_dlnr_reconciliation','v_tecdoc_unlinked_pieces_reason') AND c.reloptions::text LIKE '%security_invoker=true%';")
assert "les 3 vues sont en security_invoker" "3" "$(echo "$inv" | tr -d '\r')"
usg=$(docker exec -i "$CT" psql -U postgres -d test -tA -c "SELECT count(*) FROM (SELECT unnest(ARRAY['anon','authenticated','service_role']) r, unnest(ARRAY['tecdoc_raw','tecdoc_map']) s) x WHERE has_schema_privilege(x.r,x.s,'USAGE');")
assert "USAGE sur tecdoc_* toujours refusé aux rôles API" "0" "$(echo "$usg" | tr -d '\r')"
data=$(docker exec -i "$CT" psql -U postgres -d test -tA -c "SELECT count(*) FROM tecdoc_map.losch_log;")
assert "aucune donnée TecDoc modifiée (losch_log intacte)" "1" "$(echo "$data" | tr -d '\r')"
echo

echo "=== MATRICE avant → après ==="
printf "%-38s | %-22s | %-22s | %s\n" "objet" "anon" "authenticated" "service_role"
printf "%s\n" "---------------------------------------+------------------------+------------------------+---------------------"
for k in "load:__load_tecdoc_raw" "recon:v_tecdoc_dlnr_reconciliation" "unlinked:v_tecdoc_unlinked_pieces_reason" "loschsel:__tecdoc_losch_log SELECT" "loschins:__tecdoc_losch_log INSERT" "loschupd:__tecdoc_losch_log UPDATE" "loschdel:__tecdoc_losch_log DELETE" "remap:resolve_type_id_remap"; do
  key="${k%%:*}"; lbl="${k#*:}"
  printf "%-38s | %-22s | %-22s | %s\n" "$lbl" \
    "${B[anon,$key]} → ${A[anon,$key]}" \
    "${B[authenticated,$key]} → ${A[authenticated,$key]}" \
    "${B[service_role,$key]} → ${A[service_role,$key]}"
done

echo
echo "----------------------------------------"
echo "PASS=$pass  FAIL=$fail"
[[ "$fail" -eq 0 ]] || exit 1
exit 0
