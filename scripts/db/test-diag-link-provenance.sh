#!/usr/bin/env bash
# =============================================================================
# Test adversarial de la migration 20261010_diag_link_provenance.sql
#
# Joue RÉELLEMENT la migration et ses deux fonctions sous les rôles PostgreSQL
# (SET LOCAL ROLE) et vérifie le COMPORTEMENT :
#   - surface : aucun rôle API n'écrit les 3 tables (service_role : lecture
#     seule), EXECUTE réservé à service_role, fonctions SECURITY DEFINER à
#     search_path figé, séquences d'identité fermées ;
#   - ADR-035 D7 en base : une provenance dont une source n'est pas
#     `raw_proven: true` est refusée ;
#   - __diag_projection_apply : atomicité d'un run, complétude, re-vérification
#     `active` sous FOR SHARE, cycle de vie des lignes vivantes / retirées,
#     run_key unique ;
#   - __diag_projection_record_failure : issue cohérente avec un apply validé,
#     annulé ou encore en file pour la même run_key ;
#   - idempotence et rollback.
#
# Environnement : conteneur PostgreSQL jetable, sans réseau (même majeure que la
# PROD). Ne touche JAMAIS une base réelle : aucune variable de connexion Supabase
# n'est lue, l'hôte est un conteneur local créé et détruit ici.
#
# Usage   : bash scripts/db/test-diag-link-provenance.sh
# Mutation: MIGRATION_UNDER_TEST=<variante.sql> bash scripts/db/test-diag-link-provenance.sh
# Sortie  : 0 si toutes les assertions passent, 1 si une échoue, 2 si fatal.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$ROOT/scripts/db/diag-link-provenance-fixture.sql"
# Une mutation ne vise que la migration ; le rollback est toujours celui du dépôt.
MIGRATION="${MIGRATION_UNDER_TEST:-$ROOT/backend/supabase/migrations/20261010_diag_link_provenance.sql}"
DOWN="$ROOT/backend/supabase/migrations/20261010_diag_link_provenance.down.sql"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="diag-provenance-test-$$"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
[[ -f "$FIXTURE"   ]] || { echo "FATAL: fixture absente: $FIXTURE"; exit 2; }
[[ -f "$MIGRATION" ]] || { echo "FATAL: migration absente: $MIGRATION"; exit 2; }
[[ -f "$DOWN"      ]] || { echo "FATAL: rollback absent: $DOWN"; exit 2; }

TMP="$(mktemp -d)"
cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

echo "Image     : $IMAGE"
echo "Migration : ${MIGRATION#"$ROOT"/}"
docker run -d --network none --memory 512m --memory-swap 512m --cpus 1 --pids-limit 128 --name "$CT" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test "$IMAGE" >/dev/null || exit 2
# Prêt = le serveur DÉFINITIF répond sur TCP. Le serveur temporaire que l'image
# lance pour son initialisation n'écoute que la socket Unix : sonder la socket
# rend la main pendant l'init, puis le serveur s'arrête sous la fixture.
ready() { docker exec "$CT" pg_isready -h 127.0.0.1 -U postgres -d test >/dev/null 2>&1; }
for _ in $(seq 1 60); do ready && break; sleep 1; done
ready || { echo "FATAL: postgres non prêt"; exit 2; }
echo "PostgreSQL: $(docker exec "$CT" psql -U postgres -d test -tAc 'SHOW server_version')"
echo

psql_run() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q "$@"; }

# Valeur scalaire lue en postgres (superutilisateur de la fixture, propriétaire des
# tables) : sert aussi à éprouver les contraintes hors des fonctions.
q() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -qtA -c "$1"; }

# Exécute $2 sous le rôle $1 et ANNULE ; imprime OUI / REFUSE_FONCTION / REFUSE /
# ABSENT / ERREUR. REFUSE_FONCTION isole le refus d'EXECUTE : les fonctions étant
# SECURITY DEFINER, un EXECUTE resté ouvert à anon RÉUSSIRAIT (elles écrivent avec
# les droits de leur propriétaire) ; seule la fonction elle-même peut refuser.
probe() {
  local role="$1" sql="$2" out rc
  out=$(docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -qtA 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE $role;
$sql
ROLLBACK;
SQL
)
  rc=$?
  if [[ $rc -eq 0 ]]; then echo "OUI"; return; fi
  case "$out" in
    *"permission denied for function"*)       echo "REFUSE_FONCTION" ;;
    *"permission denied"*|*"42501"*)          echo "REFUSE" ;;
    *"does not exist"*"function"*|*"42883"*)  echo "ABSENT" ;;
    *)                                        echo "ERREUR" ;;
  esac
}

# Exécute $1 sous service_role et VALIDE ; imprime la sortie, rend le code psql.
sr() {
  docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -qtA 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE service_role;
$1
COMMIT;
SQL
}

pass=0; fail=0
assert() {
  if [[ "$2" == "$3" ]]; then echo "  PASS  $1 → $3"; pass=$((pass+1))
  else echo "  FAIL  $1 → obtenu '$3', attendu '$2'"; fail=$((fail+1)); fi
}
# assert_err <libellé> <fragment attendu du message> <sortie> <code>
assert_err() {
  if [[ "$4" -ne 0 && "$3" == *"$2"* ]]; then echo "  PASS  $1 → refusé ($2)"; pass=$((pass+1))
  else echo "  FAIL  $1 → code $4, sortie '${3:0:200}', attendu un refus contenant '$2'"; fail=$((fail+1)); fi
}

# Attend qu'une requête de comptage rende 1 (5 s max) ; rend son dernier résultat.
wait_for() {
  local n=0
  for _ in $(seq 1 50); do
    n=$(q "$1"); [[ "$n" == 1 ]] && break; sleep 0.1
  done
  echo "$n"
}
HOLDS_ADVISORY="SELECT count(*) FROM pg_stat_activity a WHERE a.wait_event = 'PgSleep' AND EXISTS (SELECT 1 FROM pg_locks l WHERE l.pid = a.pid AND l.locktype = 'advisory' AND l.granted)"
WAITS_ON() { echo "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND wait_event = '$1'"; }

# ── Charges utiles ───────────────────────────────────────────────────────────
uuid() { cat /proc/sys/kernel/random/uuid; }
COMMIT40=$(printf 'a%.0s' $(seq 1 40))
HASH64=$(printf 'b%.0s' $(seq 1 64))
# Source au format de l'export WIKI (raw_proven + status + raw_ref épinglé).
src() { printf '{"slug":"src_%s","status":"active","raw_proven":%s,"raw_ref":{"repo":"automecanik-raw","manifest_id":"m_%s","expected_sha256":"sha256:%s"}}' "$1" "$2" "$1" "$HASH64"; }
# proj <link_id> <gamme_slug> [sources_json] ; PROJ_REVIEWED / PROJ_SAFE (défaut false)
proj() {
  local sources
  if [[ $# -ge 3 ]]; then sources="$3"; else sources="[$(src "$2" true)]"; fi
  printf '{"link_id":%s,"wiki_path":"wiki/gamme/%s.md","gamme_slug":"%s","wiki_commit":"%s","content_hash":"sha256:%s","relation_to_part":"possible_cause","part_role":"Piece en cause pour ce symptome (fixture de test).","confidence":"medium","source_policy":"2_medium_concordant","confidence_score_computed":0.6,"reviewed":%s,"diagnostic_safe":%s,"sources":%s}' \
    "$1" "$2" "$2" "$COMMIT40" "$HASH64" "${PROJ_REVIEWED:-false}" "${PROJ_SAFE:-false}" "$sources"
}
# conf <gamme_slug> <relation_index> <symptom_slug> <reason>
conf() {
  printf '{"wiki_path":"wiki/gamme/%s.md","gamme_slug":"%s","relation_index":%s,"symptom_slug":"%s","system_slug":"filtration","reason":"%s","detail":{}}' \
    "$1" "$1" "$2" "$3" "$4"
}
# payload <exported_count> <projections csv> <conflicts csv> ; RUN_KEY (défaut : clé neuve)
payload() {
  printf '{"run_key":"%s","triggered_by":"admin","runtime_env":"test","index_sha256":"sha256:%s","builder_version":"1.0.0","exported_count":%s,"projections":[%s],"conflicts":[%s]}' \
    "${RUN_KEY:-$(uuid)}" "$HASH64" "$1" "$2" "$3"
}
apply_sql() { printf 'SELECT public.__diag_projection_apply($j$%s$j$::jsonb);' "$1"; }
# failure <run_key> [champs JSON supplémentaires, avec virgule de tête]
failure() { printf '{"run_key":"%s","triggered_by":"admin","runtime_env":"test"%s}' "$1" "${2:-}"; }
fail_sql() { printf 'SELECT public.__diag_projection_record_failure($j$%s$j$::jsonb);' "$1"; }

P113=$(proj 113 filtre-a-air); P114=$(proj 114 filtre-a-carburant)
P117=$(PROJ_REVIEWED=true PROJ_SAFE=true proj 117 filtre-d-habitacle)
runs()  { q "SELECT count(*) FROM public.__diag_projection_runs"; }
live()  { q "SELECT count(*) FROM public.__diag_link_provenance WHERE retired_at IS NULL"; }
total() { q "SELECT count(*) FROM public.__diag_link_provenance"; }
TABLES="__diag_projection_runs __diag_projection_conflicts __diag_link_provenance"

# ── Installation ─────────────────────────────────────────────────────────────
psql_run -f - < "$FIXTURE" || { echo "FATAL: fixture en échec"; exit 2; }
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" \
  || { echo "FATAL: migration en échec"; exit 2; }

echo "1. Surface : anon / authenticated fermés, service_role en lecture seule"
for t in $TABLES; do
  assert "anon SELECT $t"          REFUSE "$(probe anon "SELECT 1 FROM public.$t LIMIT 1;")"
  assert "authenticated SELECT $t" REFUSE "$(probe authenticated "SELECT 1 FROM public.$t LIMIT 1;")"
  assert "service_role SELECT $t"  OUI    "$(probe service_role "SELECT 1 FROM public.$t LIMIT 1;")"
  # Colonne ordinaire : `SET id = id` serait rejeté à l'analyse (identité GENERATED
  # ALWAYS), avant le contrôle de droits, et ne prouverait rien.
  case $t in
    __diag_projection_runs)      col=error ;;
    __diag_projection_conflicts) col=detail ;;
    __diag_link_provenance)      col=part_role ;;
  esac
  assert "service_role UPDATE $t"   REFUSE "$(probe service_role "UPDATE public.$t SET $col = $col;")"
  assert "service_role DELETE $t"   REFUSE "$(probe service_role "DELETE FROM public.$t;")"
  assert "service_role TRUNCATE $t" REFUSE "$(probe service_role "TRUNCATE public.$t CASCADE;")"
  assert "RLS active sur $t"       t      "$(q "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.$t'::regclass")"
  seq=$(q "SELECT pg_get_serial_sequence('public.$t', 'id')")
  for r in anon authenticated service_role; do
    assert "$r nextval $seq" REFUSE "$(probe "$r" "SELECT nextval('$seq');")"
  done
done
assert "service_role INSERT __diag_projection_runs" REFUSE "$(probe service_role \
  "INSERT INTO public.__diag_projection_runs (run_key, triggered_by, runtime_env, status, error) VALUES ('$(uuid)', 'admin', 'test', 'failed', 'x');")"
assert "service_role INSERT __diag_link_provenance" REFUSE "$(probe service_role \
  "INSERT INTO public.__diag_link_provenance (link_id, wiki_path, gamme_slug, wiki_commit, content_hash, relation_to_part, part_role, confidence, source_policy, confidence_score_computed, reviewed, diagnostic_safe, sources, first_run_id, last_run_id) VALUES (113, 'w', 'g', 'c', 'h', 'r', 'p', 'c', 's', 0, false, false, '[{\"raw_proven\":true}]', 1, 1);")"
EMPTY=$(apply_sql "$(payload 0 '' '')")
FAIL_PROBE=$(fail_sql "$(failure "$(uuid)" ',"error":"probe"')")
for f in __diag_projection_apply __diag_projection_record_failure; do
  if [[ $f == __diag_projection_apply ]]; then call="$EMPTY"; else call="$FAIL_PROBE"; fi
  assert "anon EXECUTE $f"          REFUSE_FONCTION "$(probe anon "$call")"
  assert "authenticated EXECUTE $f" REFUSE_FONCTION "$(probe authenticated "$call")"
  assert "service_role EXECUTE $f"  OUI             "$(probe service_role "$call")"
  assert "$f en SECURITY DEFINER" t "$(q "SELECT prosecdef FROM pg_proc WHERE oid = 'public.$f(jsonb)'::regprocedure")"
  assert "$f : search_path figé" "search_path=pg_catalog, pg_temp" "$(q "SELECT array_to_string(proconfig, ',') FROM pg_proc WHERE oid = 'public.$f(jsonb)'::regprocedure")"
  assert "$f : EXECUTE à service_role seul" "service_role" "$(q "SELECT string_agg(r.rolname, ',' ORDER BY r.rolname) FROM pg_proc p, aclexplode(p.proacl) a JOIN pg_roles r ON r.oid = a.grantee WHERE p.oid = 'public.$f(jsonb)'::regprocedure AND a.privilege_type = 'EXECUTE' AND r.rolname <> 'postgres'")"
done
assert "PUBLIC sans EXECUTE" 0 "$(q "SELECT count(*) FROM pg_proc p, aclexplode(p.proacl) a WHERE p.proname IN ('__diag_projection_apply', '__diag_projection_record_failure') AND a.grantee = 0")"

echo
echo "2. État de lancement : 3 relations exportées, 3 conflits source_not_raw_proven"
out=$(sr "$(apply_sql "$(payload 3 '' "$(conf filtre-a-air 0 perte_puissance_filtration source_not_raw_proven),$(conf filtre-a-carburant 0 perte_puissance_filtration source_not_raw_proven),$(conf filtre-d-habitacle 0 odeur_habitacle source_not_raw_proven)")")"); rc=$?
assert "run appliqué" 0 "$rc"
R1=$(q "SELECT max(id) FROM public.__diag_projection_runs")
assert "run : status / exported / projected / conflicts / retired" "applied|3|0|3|0" \
  "$(q "SELECT concat_ws('|', status, exported_count, projected_count, conflict_count, retired_count) FROM public.__diag_projection_runs WHERE id = $R1")"
assert "run : finished_at posé, error NULL" "t|t" "$(q "SELECT concat_ws('|', finished_at IS NOT NULL, error IS NULL) FROM public.__diag_projection_runs WHERE id = $R1")"
assert "3 conflits rattachés au run" 3 "$(q "SELECT count(*) FROM public.__diag_projection_conflicts WHERE run_id = $R1 AND reason = 'source_not_raw_proven'")"
assert "0 ligne de provenance" 0 "$(total)"
out=$(sr "$(apply_sql "$(payload 2 '' "$(conf filtre-a-air 1 perte_puissance_filtration cause_slug_mismatch),$(conf filtre-a-air 2 perte_puissance_filtration vehicle_scope_unsupported)")")"); rc=$?
assert "raisons ADR-112 acceptées (cause_slug_mismatch, vehicle_scope_unsupported)" 0 "$rc"
assert "2 conflits ADR-112 enregistrés" 2 "$(q "SELECT count(*) FROM public.__diag_projection_conflicts WHERE reason IN ('cause_slug_mismatch', 'vehicle_scope_unsupported')")"

echo
echo "3. Projection de 113 / 114 / 117"
out=$(sr "$(apply_sql "$(payload 3 "$P113,$P114,$P117" '')")"); rc=$?
assert "run appliqué" 0 "$rc"
R2=$(q "SELECT max(id) FROM public.__diag_projection_runs")
K2=$(q "SELECT run_key FROM public.__diag_projection_runs WHERE id = $R2")
assert "3 lignes vivantes" 3 "$(live)"
assert "first_run_id = last_run_id = run courant" 3 "$(q "SELECT count(*) FROM public.__diag_link_provenance WHERE first_run_id = $R2 AND last_run_id = $R2")"
assert "reviewed / diagnostic_safe copiés tels quels (false)" "f|f" "$(q "SELECT DISTINCT concat_ws('|', reviewed, diagnostic_safe) FROM public.__diag_link_provenance WHERE link_id IN (113, 114)")"
assert "reviewed / diagnostic_safe copiés tels quels (true)" "t|t" "$(q "SELECT concat_ws('|', reviewed, diagnostic_safe) FROM public.__diag_link_provenance WHERE link_id = 117")"
assert "sources copiées telles quelles" t "$(q "SELECT sources = '[$(src filtre-a-air true)]'::jsonb FROM public.__diag_link_provenance WHERE link_id = 113")"
assert "retour de la RPC" "{\"run_id\": $R2, \"retired_count\": 0, \"conflict_count\": 0, \"projected_count\": 3}" "$out"
PA113=$(q "SELECT projected_at FROM public.__diag_link_provenance WHERE link_id = 113")

echo
echo "4. Rejeu du même export : upsert, aucune ligne nouvelle"
sleep 1
out=$(sr "$(apply_sql "$(payload 3 "$P113,$P114,$P117" '')")"); rc=$?
assert "run appliqué" 0 "$rc"
R3=$(q "SELECT max(id) FROM public.__diag_projection_runs")
assert "toujours 3 lignes au total" 3 "$(total)"
assert "first_run_id inchangé" 3 "$(q "SELECT count(*) FROM public.__diag_link_provenance WHERE first_run_id = $R2")"
assert "last_run_id avancé" 3 "$(q "SELECT count(*) FROM public.__diag_link_provenance WHERE last_run_id = $R3")"
assert "projected_at inchangé" "$PA113" "$(q "SELECT projected_at FROM public.__diag_link_provenance WHERE link_id = 113")"

echo
echo "5. Retrait doux : l'export ne porte plus que 113"
out=$(sr "$(apply_sql "$(payload 1 "$P113" '')")"); rc=$?
assert "run appliqué" 0 "$rc"
R4=$(q "SELECT max(id) FROM public.__diag_projection_runs")
assert "retired_count = 2" 2 "$(q "SELECT retired_count FROM public.__diag_projection_runs WHERE id = $R4")"
assert "1 ligne vivante" 1 "$(live)"
assert "114 et 117 retirées par ce run" 2 "$(q "SELECT count(*) FROM public.__diag_link_provenance WHERE link_id IN (114, 117) AND retired_run_id = $R4 AND retired_at IS NOT NULL")"

echo
echo "6. Réapparition : 114 revient, nouvelle ligne vivante, l'historique reste"
out=$(sr "$(apply_sql "$(payload 2 "$P113,$P114" '')")"); rc=$?
assert "run appliqué" 0 "$rc"
assert "114 : 1 retirée + 1 vivante" "1|1" "$(q "SELECT concat_ws('|', count(*) FILTER (WHERE retired_at IS NOT NULL), count(*) FILTER (WHERE retired_at IS NULL)) FROM public.__diag_link_provenance WHERE link_id = 114")"
assert "2 lignes vivantes" 2 "$(live)"

echo
echo "7. Atomicité : tout échec annule le run entier"
before_runs=$(runs); before_total=$(total); before_conf=$(q "SELECT count(*) FROM public.__diag_projection_conflicts")
out=$(sr "$(apply_sql "$(payload 5 "$P113" "$(conf filtre-a-air 1 perte_puissance_filtration duplicate_relation)")")"); rc=$?
assert_err "complétude : exported 5 ≠ 1 + 1" "__diag_projection_runs_complete" "$out" "$rc"
out=$(sr "$(apply_sql '{"run_key":"'"$(uuid)"'","triggered_by":"admin","runtime_env":"test","index_sha256":"x","builder_version":"1.0.0","projections":[],"conflicts":[]}')"); rc=$?
assert_err "exported_count absent" "__diag_projection_runs_complete" "$out" "$rc"
out=$(sr "$(apply_sql '{"run_key":"'"$(uuid)"'","triggered_by":"admin","runtime_env":"test","builder_version":"1.0.0","exported_count":0,"projections":[],"conflicts":[]}')"); rc=$?
assert_err "export non identifié (index_sha256 absent)" "__diag_projection_runs_applied_identified" "$out" "$rc"
out=$(sr "$(apply_sql '{"triggered_by":"admin","runtime_env":"test","index_sha256":"x","builder_version":"1.0.0","exported_count":0,"projections":[],"conflicts":[]}')"); rc=$?
assert_err "run_key absente" "run_key manquante" "$out" "$rc"
out=$(sr "$(apply_sql '{"run_key":"'"$(uuid)"'","triggered_by":"admin","runtime_env":"test","index_sha256":"x","builder_version":"1.0.0","exported_count":0,"conflicts":[]}')"); rc=$?
assert_err "projections absent" "doivent être des tableaux" "$out" "$rc"
out=$(sr "$(RUN_KEY=$K2 apply_sql "$(RUN_KEY=$K2 payload 1 "$P113" '')")"); rc=$?
assert_err "run_key déjà appliquée" "__diag_projection_runs_run_key_key" "$out" "$rc"
out=$(sr "$(apply_sql "$(payload 2 "$P113,$(proj 113 filtre-a-air)" '')")"); rc=$?
assert_err "doublon (link_id, wiki_path) dans un run" "cannot affect row a second time" "$out" "$rc"
out=$(sr "$(apply_sql "$(payload 1 "$(proj 999 filtre-a-air)" '')")"); rc=$?
assert_err "lien inconnu" "encore actif" "$out" "$rc"
for case in "sources vides|[]" \
            "source raw_proven false|[$(src x false)]" \
            "une source sur deux non prouvée|[$(src x true),$(src y false)]" \
            "raw_proven en chaîne|[$(src x '"true"')]" \
            "raw_proven absent|[{\"slug\":\"src_x\",\"status\":\"active\"}]" \
            "source non objet|[true]" \
            "sources non tableau|{\"raw_proven\":true}"; do
  out=$(sr "$(apply_sql "$(payload 1 "$(proj 113 filtre-a-air "${case#*|}")" '')")"); rc=$?
  assert_err "D7 : ${case%%|*}" "__diag_link_provenance_sources_raw_proven" "$out" "$rc"
done
out=$(sr "$(apply_sql "$(payload 1 '' "$(conf filtre-a-air 0 perte_puissance_filtration raison_inventee)")")"); rc=$?
assert_err "raison hors vocabulaire" "__diag_projection_conflicts_reason_check" "$out" "$rc"
out=$(sr "$(apply_sql "$(payload 1 '' "$(conf filtre-a-air -1 perte_puissance_filtration duplicate_relation)")")"); rc=$?
assert_err "relation_index négatif" "__diag_projection_conflicts_relation_index_check" "$out" "$rc"
q "UPDATE public.__diag_symptom_cause_link SET active = false WHERE id = 117" >/dev/null
out=$(sr "$(apply_sql "$(payload 2 "$P113,$P117" '')")"); rc=$?
assert_err "lien désactivé (active = false)" "encore actif" "$out" "$rc"
q "UPDATE public.__diag_symptom_cause_link SET active = NULL WHERE id = 117" >/dev/null
out=$(sr "$(apply_sql "$(payload 2 "$P113,$P117" '')")"); rc=$?
assert_err "lien à active NULL" "encore actif" "$out" "$rc"
q "UPDATE public.__diag_symptom_cause_link SET active = true WHERE id = 117" >/dev/null
assert "aucun run laissé par les échecs"        "$before_runs"  "$(runs)"
assert "aucune provenance laissée par les échecs" "$before_total" "$(total)"
assert "aucun conflit laissé par les échecs"    "$before_conf"  "$(q "SELECT count(*) FROM public.__diag_projection_conflicts")"

echo
echo "8. Run en échec : __diag_projection_record_failure"
KF=$(uuid)
out=$(sr "$(fail_sql "$(failure "$KF" ',"error":"index_missing"')")"); rc=$?
assert "clé neuve : enregistrée" 0 "$rc"
RF=$(q "SELECT id FROM public.__diag_projection_runs WHERE run_key = '$KF'")
assert "retour" "{\"run_id\": $RF, \"status\": \"failed\"}" "$out"
assert "ligne : status / error / exported / projected / conflicts / retired / finished" "failed|index_missing|∅|0|0|0|t" \
  "$(q "SELECT concat_ws('|', status, error, coalesce(exported_count::text, '∅'), projected_count, conflict_count, retired_count, finished_at IS NOT NULL) FROM public.__diag_projection_runs WHERE id = $RF")"
before_runs=$(runs)
out=$(sr "$(fail_sql "$(failure "$KF" ',"error":"autre_erreur"')")"); rc=$?
assert "même clé rejouée : issue connue rendue" "{\"run_id\": $RF, \"status\": \"failed\"}" "$out"
assert "même clé rejouée : erreur d'origine conservée" index_missing "$(q "SELECT error FROM public.__diag_projection_runs WHERE id = $RF")"
out=$(sr "$(fail_sql "$(failure "$K2" ',"error":"timeout_transport"')")"); rc=$?
assert "clé d'un run appliqué : rend applied" "{\"run_id\": $R2, \"status\": \"applied\"}" "$out"
assert "clé d'un run appliqué : run intact" "applied|t" "$(q "SELECT concat_ws('|', status, error IS NULL) FROM public.__diag_projection_runs WHERE id = $R2")"
assert "aucun run ajouté par les deux rejeux" "$before_runs" "$(runs)"
out=$(sr "$(fail_sql "$(failure "$(uuid)" ',"error":"x","exported_count":7,"index_sha256":"sha256:abc","builder_version":"1.0.0"')")"); rc=$?
assert "exported_count connu : conservé" "7|sha256:abc|1.0.0" "$(q "SELECT concat_ws('|', exported_count, index_sha256, builder_version) FROM public.__diag_projection_runs WHERE id = (SELECT max(id) FROM public.__diag_projection_runs)")"
out=$(sr "$(fail_sql "$(failure "$(uuid)")")"); rc=$?
assert_err "échec sans error" "__diag_projection_runs_error_iff_failed" "$out" "$rc"
out=$(sr "$(fail_sql "$(failure "$(uuid)" ',"error":"   "')")"); rc=$?
assert_err "échec à error blanche" "__diag_projection_runs_error_iff_failed" "$out" "$rc"
out=$(sr "$(fail_sql '{"run_key":"'"$(uuid)"'","triggered_by":"cron","runtime_env":"test","error":"x"}')"); rc=$?
assert_err "triggered_by hors vocabulaire" "__diag_projection_runs_triggered_by_check" "$out" "$rc"
out=$(sr "$(fail_sql '{"triggered_by":"admin","runtime_env":"test","error":"x"}')"); rc=$?
assert_err "run_key absente" "run_key manquante" "$out" "$rc"
out=$(sr "$(fail_sql '{"run_key":"pas-une-cle","triggered_by":"admin","runtime_env":"test","error":"x"}')"); rc=$?
assert_err "run_key mal formée" "invalid input syntax for type uuid" "$out" "$rc"
out=$(sr "$(fail_sql '{"run_key":"'"$(uuid)"'","triggered_by":"admin","error":"x"}')"); rc=$?
assert_err "runtime_env absent" "null value in column \"runtime_env\"" "$out" "$rc"
out=$(sr "$(fail_sql "$(failure "$(uuid)" ',"error":"x","exported_count":-1')")"); rc=$?
assert_err "compteur négatif (exported_count)" "__diag_projection_runs_exported_count_check" "$out" "$rc"
# Contraintes éprouvées hors fonctions, en propriétaire des tables.
out=$(q "INSERT INTO public.__diag_projection_runs (run_key, triggered_by, runtime_env, status, error, projected_count) VALUES ('$(uuid)', 'admin', 'test', 'failed', 'x', 1);" 2>&1); rc=$?
assert_err "run failed qui aurait écrit" "__diag_projection_runs_failed_wrote_nothing" "$out" "$rc"
out=$(q "INSERT INTO public.__diag_projection_runs (run_key, triggered_by, runtime_env, status, error, exported_count, index_sha256, builder_version) VALUES ('$(uuid)', 'admin', 'test', 'applied', 'x', 0, 'x', '1.0.0');" 2>&1); rc=$?
assert_err "run applied avec error" "__diag_projection_runs_error_iff_failed" "$out" "$rc"
out=$(q "UPDATE public.__diag_link_provenance SET retired_at = now() WHERE retired_at IS NULL;" 2>&1); rc=$?
assert_err "retired_at sans retired_run_id" "__diag_link_provenance_retired_pair" "$out" "$rc"

echo
echo "9. Verrous : consultatif pendant le run, FOR SHARE sur les liens projetés"
assert "verrou consultatif tenu dans la transaction" 1 "$(docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -qtA <<SQL | tail -1
BEGIN;
SET LOCAL ROLE service_role;
$(apply_sql "$(payload 1 "$P113" '')")
SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid();
ROLLBACK;
SQL
)"
# hold <secondes> <COMMIT|ROLLBACK> <run_key> <exported> <projections csv> : run tenu
# ouvert en arrière-plan ; son pid dans HOLDER.
hold() {
  docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -qtA >"$TMP/hold.$3" 2>&1 <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
$(RUN_KEY=$3 apply_sql "$(RUN_KEY=$3 payload "$4" "$5" '')")
SELECT pg_sleep($1);
$2;
SQL
  HOLDER=$!
}
# Attente déterministe, pas un délai fixe : sur un runner chargé, l'opération
# concurrente passerait avant les verrous. Le run tenu est prêt quand il a rendu la
# main (pg_sleep) en tenant toujours son verrou consultatif.
hold 4 ROLLBACK "$(uuid)" 1 "$P113"
[[ "$(wait_for "$HOLDS_ADVISORY")" == 1 ]] || { echo "FATAL: le run concurrent n'a pas pris ses verrous"; wait "$HOLDER"; exit 2; }
out=$(q "SET lock_timeout = '1s'; UPDATE public.__diag_symptom_cause_link SET active = false WHERE id = 113;" 2>&1); rc=$?
assert_err "désactivation concurrente d'un lien projeté bloquée" "lock timeout" "$out" "$rc"
wait "$HOLDER"
assert "lien 113 toujours actif" t "$(q "SELECT active FROM public.__diag_symptom_cause_link WHERE id = 113")"

echo
echo "9b. Échec enregistré pendant un apply en vol de même clé"
for outcome in COMMIT ROLLBACK; do
  k=$(uuid); before_runs=$(runs)
  hold 3 "$outcome" "$k" 2 "$P113,$P114"
  [[ "$(wait_for "$HOLDS_ADVISORY")" == 1 ]] || { echo "FATAL: run tenu absent"; wait "$HOLDER"; exit 2; }
  sr "$(fail_sql "$(failure "$k" ',"error":"timeout_transport"')")" >"$TMP/rf" 2>&1 &
  rf=$!
  assert "$outcome : l'échec attend la transaction de l'apply" 1 "$(wait_for "$(WAITS_ON transactionid)")"
  wait "$HOLDER"; wait "$rf"
  if [[ $outcome == COMMIT ]]; then expected=applied; else expected=failed; fi
  assert "$outcome : issue rendue" "$expected" "$(sed -n 's/.*"status": "\([a-z]*\)".*/\1/p' "$TMP/rf")"
  assert "$outcome : une seule ligne pour la clé, statut $expected" "1|$expected" "$(q "SELECT concat_ws('|', count(*), max(status)) FROM public.__diag_projection_runs WHERE run_key = '$k'")"
  assert "$outcome : un run de plus" "$((before_runs + 1))" "$(runs)"
done

echo
echo "9c. Échec enregistré pendant qu'un apply de même clé attend le verrou"
k=$(uuid)
hold 3 ROLLBACK "$(uuid)" 2 "$P113,$P114"
[[ "$(wait_for "$HOLDS_ADVISORY")" == 1 ]] || { echo "FATAL: run tenu absent"; wait "$HOLDER"; exit 2; }
sr "$(RUN_KEY=$k apply_sql "$(RUN_KEY=$k payload 2 "$P113,$P114" '')")" >"$TMP/queued" 2>&1 &
queued=$!
assert "l'apply de même clé attend le verrou consultatif" 1 "$(wait_for "$(WAITS_ON advisory)")"
out=$(sr "$(fail_sql "$(failure "$k" ',"error":"timeout_transport"')")"); rc=$?
assert "l'échec est écrit sans attendre" failed "$(sed -n 's/.*"status": "\([a-z]*\)".*/\1/p' <<<"$out")"
wait "$HOLDER"; wait "$queued"; rc=$?
assert_err "l'apply en file est ensuite refusé" "__diag_projection_runs_run_key_key" "$(cat "$TMP/queued")" "$rc"
assert "une seule ligne pour la clé, en échec" "1|failed" "$(q "SELECT concat_ws('|', count(*), max(status)) FROM public.__diag_projection_runs WHERE run_key = '$k'")"

echo
echo "10. Index valide à 0 entrée : tout ce qui vit est retiré"
live_before=$(live)
out=$(sr "$(apply_sql "$(payload 0 '' '')")"); rc=$?
assert "run appliqué" 0 "$rc"
assert "retired_count = lignes vivantes avant" "$live_before" "$(q "SELECT retired_count FROM public.__diag_projection_runs WHERE id = (SELECT max(id) FROM public.__diag_projection_runs)")"
assert "0 ligne vivante" 0 "$(live)"

echo
echo "11. Idempotence : rejouer la migration"
total_before=$(total)
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" >/dev/null 2>&1; rc=$?
assert "rejeu sans erreur" 0 "$rc"
assert "3 politiques, toutes SELECT service_role" "3|3" "$(q "SELECT concat_ws('|', count(*), count(*) FILTER (WHERE cmd = 'SELECT' AND roles = '{service_role}' AND policyname = tablename || '_service_role_select')) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('__diag_projection_runs', '__diag_projection_conflicts', '__diag_link_provenance')")"
assert "service_role toujours sans écriture" f "$(q "SELECT bool_or(has_table_privilege('service_role', 'public.' || t, 'INSERT') OR has_table_privilege('service_role', 'public.' || t, 'UPDATE') OR has_table_privilege('service_role', 'public.' || t, 'DELETE')) FROM unnest(ARRAY['__diag_projection_runs', '__diag_projection_conflicts', '__diag_link_provenance']) AS t")"
assert "anon EXECUTE apply toujours refusé"          REFUSE_FONCTION "$(probe anon "$EMPTY")"
assert "anon EXECUTE record_failure toujours refusé" REFUSE_FONCTION "$(probe anon "$FAIL_PROBE")"
assert "historique conservé après rejeu" "$total_before" "$(q "SELECT count(*) FROM public.__diag_link_provenance")"

echo
echo "12. Rollback : le .down.sql retire les 5 objets, la migration se rejoue ensuite"
links_before=$(q "SELECT count(*) FROM public.__diag_symptom_cause_link")
# Le rollback tourne SANS -1 (comme à la main) : il doit porter sa propre transaction,
# sinon les SET LOCAL ne bornent rien et les DROP ne sont pas atomiques.
assert "rollback auto-transactionnel (BEGIN / SET LOCAL / COMMIT)" "1|1|2" "$(printf '%s|%s|%s' "$(grep -c '^BEGIN;$' "$DOWN")" "$(grep -c '^COMMIT;$' "$DOWN")" "$(grep -c '^SET LOCAL ' "$DOWN")")"
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -f - < "$DOWN" >/dev/null 2>&1; rc=$?
assert "rollback sans erreur" 0 "$rc"
assert "0 table de provenance restante" 0 "$(q "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('__diag_projection_runs', '__diag_projection_conflicts', '__diag_link_provenance')")"
assert "fonctions retirées" 0 "$(q "SELECT count(*) FROM pg_proc WHERE proname IN ('__diag_projection_apply', '__diag_projection_record_failure')")"
assert "liens du moteur intacts" "$links_before" "$(q "SELECT count(*) FROM public.__diag_symptom_cause_link")"
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" >/dev/null 2>&1; rc=$?
assert "migration rejouée après rollback" 0 "$rc"
assert "anon EXECUTE refusé après rejeu" REFUSE_FONCTION "$(probe anon "$EMPTY")"

echo
echo "Résultat : $pass PASS, $fail FAIL"
[[ $fail -eq 0 ]] || exit 1
