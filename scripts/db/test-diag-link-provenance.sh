#!/usr/bin/env bash
# =============================================================================
# Test adversarial de la migration <AAAAMMJJ>_diag_link_provenance.sql
#
# Joue RÉELLEMENT la migration et la RPC __diag_projection_apply sous les rôles
# PostgreSQL (SET LOCAL ROLE) et vérifie le COMPORTEMENT : atomicité d'un run,
# complétude, re-vérification `active` sous FOR SHARE, cycle de vie des lignes
# vivantes / retirées, fermeture anon / authenticated, idempotence.
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
if [[ -n "${MIGRATION_UNDER_TEST:-}" ]]; then
  MIGRATION="$MIGRATION_UNDER_TEST"
else
  shopt -s nullglob
  found=("$ROOT"/backend/supabase/migrations/*_diag_link_provenance.sql)
  shopt -u nullglob
  [[ ${#found[@]} -eq 1 ]] || { echo "FATAL: ${#found[@]} migration(s) *_diag_link_provenance.sql (1 attendue)"; exit 2; }
  MIGRATION="${found[0]}"
fi
# Le rollback est toujours celui du dépôt : une mutation ne vise que la migration.
shopt -s nullglob
downs=("$ROOT"/backend/supabase/migrations/*_diag_link_provenance.down.sql)
shopt -u nullglob
[[ ${#downs[@]} -eq 1 ]] || { echo "FATAL: ${#downs[@]} rollback(s) *_diag_link_provenance.down.sql (1 attendu)"; exit 2; }
DOWN="${downs[0]}"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="diag-provenance-test-$$"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
[[ -f "$FIXTURE"   ]] || { echo "FATAL: fixture absente: $FIXTURE"; exit 2; }
[[ -f "$MIGRATION" ]] || { echo "FATAL: migration absente: $MIGRATION"; exit 2; }
[[ -f "$DOWN"      ]] || { echo "FATAL: rollback absent: $DOWN"; exit 2; }

cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Image     : $IMAGE"
echo "Migration : ${MIGRATION#"$ROOT"/}"
docker run -d --network none --name "$CT" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test "$IMAGE" >/dev/null || exit 2
# Prêt = le serveur DÉFINITIF répond sur TCP. Le serveur temporaire que l'image
# lance pour son initialisation n'écoute que la socket Unix : sonder la socket
# rend la main pendant l'init, puis le serveur s'arrête sous la fixture.
ready() { docker exec "$CT" pg_isready -h 127.0.0.1 -U postgres -d test >/dev/null 2>&1; }
for _ in $(seq 1 60); do ready && break; sleep 1; done
ready || { echo "FATAL: postgres non prêt"; exit 2; }
echo "PostgreSQL: $(docker exec "$CT" psql -U postgres -d test -tAc 'SHOW server_version')"
echo

psql_run() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q "$@"; }

# Valeur scalaire lue en postgres (superutilisateur de la fixture).
q() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -qtA -c "$1"; }

# Exécute $2 sous le rôle $1 et ANNULE ; imprime OUI / REFUSE_FONCTION / REFUSE /
# ABSENT / ERREUR. REFUSE_FONCTION distingue le refus d'EXECUTE du refus d'une
# table touchée ENSUITE : la fonction étant SECURITY INVOKER, un EXECUTE resté
# ouvert à anon échouerait quand même sur la table, et une sonde qui ne lit que
# « permission denied » ne verrait pas la différence.
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

# ── Charges utiles ───────────────────────────────────────────────────────────
COMMIT40=$(printf 'a%.0s' $(seq 1 40))
HASH64=$(printf 'b%.0s' $(seq 1 64))
# proj <link_id> <gamme_slug> [sources_json]
proj() {
  local sources
  if [[ $# -ge 3 ]]; then sources="$3"
  else sources=$(printf '[{"slug":"src_%s","catalog_slug":"src_%s","type":"web","status":"active","raw_ref":"raw/src_%s","raw_proven":true}]' "$2" "$2" "$2")
  fi
  printf '{"link_id":%s,"wiki_path":"wiki/gamme/%s.md","gamme_slug":"%s","wiki_commit":"%s","content_hash":"sha256:%s","relation_to_part":"possible_cause","part_role":"Piece en cause pour ce symptome (fixture de test).","confidence":"medium","source_policy":"2_medium_concordant","confidence_score_computed":0.6,"reviewed":false,"diagnostic_safe":false,"sources":%s}' \
    "$1" "$2" "$2" "$COMMIT40" "$HASH64" "$sources"
}
# conf <gamme_slug> <relation_index> <symptom_slug> <reason>
conf() {
  printf '{"wiki_path":"wiki/gamme/%s.md","gamme_slug":"%s","relation_index":%s,"symptom_slug":"%s","system_slug":"filtration","reason":"%s","detail":{}}' \
    "$1" "$1" "$2" "$3" "$4"
}
# payload <exported_count> <projections csv> <conflicts csv>
payload() {
  printf '{"triggered_by":"admin","runtime_env":"test","index_sha256":"sha256:%s","builder_version":"1.0.0","exported_count":%s,"projections":[%s],"conflicts":[%s]}' \
    "$HASH64" "$1" "$2" "$3"
}
apply_sql() { printf 'SELECT public.__diag_projection_apply($j$%s$j$::jsonb);' "$1"; }

P113=$(proj 113 filtre-a-air); P114=$(proj 114 filtre-a-carburant); P117=$(proj 117 filtre-d-habitacle)
runs()  { q "SELECT count(*) FROM public.__diag_projection_runs"; }
live()  { q "SELECT count(*) FROM public.__diag_link_provenance WHERE retired_at IS NULL"; }
total() { q "SELECT count(*) FROM public.__diag_link_provenance"; }

# ── Installation ─────────────────────────────────────────────────────────────
psql_run -f - < "$FIXTURE" || { echo "FATAL: fixture en échec"; exit 2; }
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" \
  || { echo "FATAL: migration en échec"; exit 2; }

echo "1. Surface : anon / authenticated fermés, service_role ouvert"
for t in __diag_projection_runs __diag_projection_conflicts __diag_link_provenance; do
  assert "anon SELECT $t"          REFUSE "$(probe anon "SELECT 1 FROM public.$t LIMIT 1;")"
  assert "authenticated SELECT $t" REFUSE "$(probe authenticated "SELECT 1 FROM public.$t LIMIT 1;")"
  assert "service_role SELECT $t"  OUI    "$(probe service_role "SELECT 1 FROM public.$t LIMIT 1;")"
  assert "RLS active sur $t"       t      "$(q "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.$t'::regclass")"
done
EMPTY=$(apply_sql "$(payload 0 '' '')")
assert "anon EXECUTE __diag_projection_apply"          REFUSE_FONCTION "$(probe anon "$EMPTY")"
assert "authenticated EXECUTE __diag_projection_apply" REFUSE_FONCTION "$(probe authenticated "$EMPTY")"
assert "service_role EXECUTE __diag_projection_apply"  OUI    "$(probe service_role "$EMPTY")"
assert "fonction en SECURITY INVOKER" f "$(q "SELECT prosecdef FROM pg_proc WHERE oid = 'public.__diag_projection_apply(jsonb)'::regprocedure")"
assert "search_path figé" "search_path=public, pg_temp" "$(q "SELECT array_to_string(proconfig, ',') FROM pg_proc WHERE oid = 'public.__diag_projection_apply(jsonb)'::regprocedure")"

echo
echo "2. État de lancement : 3 relations exportées, 3 conflits source_not_raw_proven"
out=$(sr "$(apply_sql "$(payload 3 '' "$(conf filtre-a-air 0 perte_puissance_filtration source_not_raw_proven),$(conf filtre-a-carburant 0 perte_puissance_filtration source_not_raw_proven),$(conf filtre-d-habitacle 0 odeur_habitacle source_not_raw_proven)")")"); rc=$?
assert "run appliqué" 0 "$rc"
R1=$(q "SELECT max(id) FROM public.__diag_projection_runs")
assert "run : status / exported / projected / conflicts / retired" "applied|3|0|3|0" \
  "$(q "SELECT concat_ws('|', status, exported_count, projected_count, conflict_count, retired_count) FROM public.__diag_projection_runs WHERE id = $R1")"
assert "run : finished_at posé" t "$(q "SELECT finished_at IS NOT NULL FROM public.__diag_projection_runs WHERE id = $R1")"
assert "3 conflits rattachés au run" 3 "$(q "SELECT count(*) FROM public.__diag_projection_conflicts WHERE run_id = $R1 AND reason = 'source_not_raw_proven'")"
assert "0 ligne de provenance" 0 "$(total)"

echo
echo "3. Projection de 113 / 114 / 117"
out=$(sr "$(apply_sql "$(payload 3 "$P113,$P114,$P117" '')")"); rc=$?
assert "run appliqué" 0 "$rc"
R2=$(q "SELECT max(id) FROM public.__diag_projection_runs")
assert "3 lignes vivantes" 3 "$(live)"
assert "first_run_id = last_run_id = run courant" 3 "$(q "SELECT count(*) FROM public.__diag_link_provenance WHERE first_run_id = $R2 AND last_run_id = $R2")"
assert "reviewed / diagnostic_safe copiés tels quels" "f|f" "$(q "SELECT DISTINCT concat_ws('|', reviewed, diagnostic_safe) FROM public.__diag_link_provenance")"
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
out=$(sr "$(apply_sql "$(payload 2 "$P113,$(proj 113 filtre-a-air)" '')")"); rc=$?
assert_err "doublon (link_id, wiki_path) dans un run" "cannot affect row a second time" "$out" "$rc"
out=$(sr "$(apply_sql "$(payload 1 "$(proj 999 filtre-a-air)" '')")"); rc=$?
assert_err "lien inconnu" "encore actif" "$out" "$rc"
out=$(sr "$(apply_sql "$(payload 1 "$(proj 113 filtre-a-air '[]')" '')")"); rc=$?
assert_err "sources vides" "__diag_link_provenance_sources_check" "$out" "$rc"
out=$(sr "$(apply_sql "$(payload 1 '' "$(conf filtre-a-air 0 perte_puissance_filtration raison_inventee)")")"); rc=$?
assert_err "raison hors vocabulaire" "__diag_projection_conflicts_reason_check" "$out" "$rc"
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
echo "8. Run en échec enregistré à part (insertion directe du writer)"
out=$(sr "INSERT INTO public.__diag_projection_runs (triggered_by, runtime_env, status, error) VALUES ('admin', 'test', 'failed', 'index_missing');"); rc=$?
assert "run failed avec error" 0 "$rc"
out=$(sr "INSERT INTO public.__diag_projection_runs (triggered_by, runtime_env, status) VALUES ('admin', 'test', 'failed');"); rc=$?
assert_err "run failed sans error" "__diag_projection_runs_failed_has_error" "$out" "$rc"
out=$(sr "INSERT INTO public.__diag_projection_runs (triggered_by, runtime_env, status, error) VALUES ('cron', 'test', 'failed', 'index_missing');"); rc=$?
assert_err "triggered_by hors vocabulaire" "__diag_projection_runs_triggered_by_check" "$out" "$rc"
out=$(sr "UPDATE public.__diag_link_provenance SET retired_at = now() WHERE retired_at IS NULL;"); rc=$?
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
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -qtA >/dev/null 2>&1 <<SQL &
BEGIN;
SET LOCAL ROLE service_role;
$(apply_sql "$(payload 1 "$P113" '')")
SELECT pg_sleep(4);
ROLLBACK;
SQL
holder=$!
# Attente déterministe, pas un délai fixe : sur un runner chargé, l'UPDATE
# passerait avant les verrous. Le run concurrent est prêt quand il a rendu la
# main (pg_sleep) en tenant toujours son verrou consultatif.
held=0
for _ in $(seq 1 50); do
  held=$(q "SELECT count(*) FROM pg_stat_activity a WHERE a.wait_event = 'PgSleep' AND EXISTS (SELECT 1 FROM pg_locks l WHERE l.pid = a.pid AND l.locktype = 'advisory' AND l.granted)")
  [[ "$held" == 1 ]] && break; sleep 0.1
done
[[ "$held" == 1 ]] || { echo "FATAL: le run concurrent n'a pas pris ses verrous"; wait "$holder"; exit 2; }
out=$(q "SET lock_timeout = '1s'; UPDATE public.__diag_symptom_cause_link SET active = false WHERE id = 113;" 2>&1); rc=$?
assert_err "désactivation concurrente d'un lien projeté bloquée" "lock timeout" "$out" "$rc"
wait "$holder"
assert "lien 113 toujours actif" t "$(q "SELECT active FROM public.__diag_symptom_cause_link WHERE id = 113")"

echo
echo "10. Index valide à 0 entrée : tout ce qui vit est retiré"
live_before=$(live)
out=$(sr "$(apply_sql "$(payload 0 '' '')")"); rc=$?
assert "run appliqué" 0 "$rc"
assert "retired_count = lignes vivantes avant" "$live_before" "$(q "SELECT retired_count FROM public.__diag_projection_runs WHERE id = (SELECT max(id) FROM public.__diag_projection_runs)")"
assert "0 ligne vivante" 0 "$(live)"

echo
echo "11. Idempotence : rejouer la migration"
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" >/dev/null 2>&1; rc=$?
assert "rejeu sans erreur" 0 "$rc"
assert "3 politiques service_role" 3 "$(q "SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE '\_\_diag\_%\_service\_role\_all' AND tablename IN ('__diag_projection_runs', '__diag_projection_conflicts', '__diag_link_provenance')")"
assert "anon EXECUTE toujours refusé après rejeu" REFUSE_FONCTION "$(probe anon "$EMPTY")"
assert "historique conservé après rejeu" "$(total)" "$(q "SELECT count(*) FROM public.__diag_link_provenance")"

echo
echo "12. Rollback : le .down.sql retire les 4 objets, la migration se rejoue ensuite"
links_before=$(q "SELECT count(*) FROM public.__diag_symptom_cause_link")
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$DOWN" >/dev/null 2>&1; rc=$?
assert "rollback sans erreur" 0 "$rc"
assert "0 table de provenance restante" 0 "$(q "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('__diag_projection_runs', '__diag_projection_conflicts', '__diag_link_provenance')")"
assert "fonction retirée" 0 "$(q "SELECT count(*) FROM pg_proc WHERE proname = '__diag_projection_apply'")"
assert "liens du moteur intacts" "$links_before" "$(q "SELECT count(*) FROM public.__diag_symptom_cause_link")"
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" >/dev/null 2>&1; rc=$?
assert "migration rejouée après rollback" 0 "$rc"
assert "anon EXECUTE refusé après rejeu" REFUSE_FONCTION "$(probe anon "$EMPTY")"

echo
echo "Résultat : $pass PASS, $fail FAIL"
[[ $fail -eq 0 ]] || exit 1
