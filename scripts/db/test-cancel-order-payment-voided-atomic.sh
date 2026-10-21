#!/usr/bin/env bash
# =============================================================================
# Test de comportement de 20261022_cancel_order_payment_voided_atomic.sql
#
# Prouve :
#   1. AVANT la migration, une commande payée dont le paiement a été annulé
#      dans Paybox ne peut pas être annulée en base : cancel_order_atomic la
#      refuse, et aucune autre fonction n'existe.
#   2. La pré-condition passe en transaction READ ONLY (comme dans
#      apply-migration.sh) ; la migration ne touche ni les fonctions voisines,
#      ni les données, ni le journal.
#   3. APRÈS, matrice de décision sur la ligne verrouillée : payée au statut
#      1|3|4 → annulée, champs de paiement intacts, ORDER_CANCELLED journalisé
#      avec l'attestation ; non payée, déjà annulée, hors canon, entrées
#      invalides → refus, ligne et journal intacts.
#   4. Partition avec cancel_order_atomic : pour une commande au statut 1|3|4,
#      exactement une des deux fonctions accepte.
#   5. Course « deux annulations simultanées » : la seconde attend le verrou
#      (observé dans pg_stat_activity), puis refuse ; un seul événement.
#   6. Droits (propriétaire seul, service_role compris refusé), structure,
#      idempotence et fermeture d'une ouverture préexistante, pré-condition qui
#      bloque une surcharge, rollback puis ré-application.
#
# Fixture minimale : scripts/db/cancel-order-atomic-fixture.sql. Les fonctions
# viennent des VRAIES migrations du dépôt, jamais d'une copie.
#
# Environnement : conteneur PostgreSQL jetable (même majeure que la PROD), sans
# réseau (--network none) et sans écoute TCP : psql passe par le socket local.
# Ne lit aucune variable de connexion Supabase, ne touche aucune base réelle.
#
# Usage : bash scripts/db/test-cancel-order-payment-voided-atomic.sh
# Sortie : 0 si toutes les assertions passent.
#
# Test de mutation (le test doit ÉCHOUER sur une migration affaiblie) :
#   sed '/Paid = same predicate/,/END IF;/d' \
#     backend/supabase/migrations/20261022_cancel_order_payment_voided_atomic.sql > /tmp/mut.sql
#   MIGRATION_UNDER_TEST=/tmp/mut.sql bash scripts/db/test-cancel-order-payment-voided-atomic.sh
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG_DIR="$ROOT/backend/supabase/migrations"
FIXTURE="$ROOT/scripts/db/cancel-order-atomic-fixture.sql"
HISTORY="$MIG_DIR/20260523_001_create_order_history.sql"
ORIGIN="$MIG_DIR/20260523_002_cancel_order_atomic.sql"
REFUSE_PAID="$MIG_DIR/20260924_cancel_order_atomic_refuse_paid.sql"
# MIGRATION_UNDER_TEST permet le test de mutation (pointer une copie altérée)
# sans toucher au fichier du dépôt. Par défaut : la migration réelle.
MIGRATION="${MIGRATION_UNDER_TEST:-$MIG_DIR/20261022_cancel_order_payment_voided_atomic.sql}"
DOWN="$MIG_DIR/20261022_cancel_order_payment_voided_atomic.down.sql"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="cancel-order-voided-test-$$"

SIG="public.cancel_order_payment_voided_atomic(text, text, text, uuid)"
CANCEL_SIG="public.cancel_order_atomic(text, text, bigint, uuid)"
APPEND_SIG="public.append_order_event(text, text, text, text, jsonb, text, uuid, bigint)"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
for f in "$FIXTURE" "$HISTORY" "$ORIGIN" "$REFUSE_PAID" "$MIGRATION" "$DOWN"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done

WORK="$(mktemp -d)"
# Only remove the container created by this invocation and its anonymous data.
CT_ID=""
cleanup() { if [[ -n "$CT_ID" ]]; then docker rm -fv "$CT_ID" >/dev/null 2>&1 || true; fi; rm -rf "$WORK"; }
trap cleanup EXIT

echo "Image : $IMAGE"
CT_ID="$(docker run -d --name "$CT" --network none \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test \
  "$IMAGE" -c listen_addresses='')" || exit 2
for _ in $(seq 1 90); do
  if docker logs "$CT" 2>&1 | grep -q "PostgreSQL init process complete" \
     && docker exec "$CT" pg_isready -U postgres -d test >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$CT" pg_isready -U postgres -d test >/dev/null 2>&1 || { echo "FATAL: postgres non prêt"; exit 2; }
echo "PostgreSQL : $(docker exec "$CT" psql -U postgres -d test -tAc 'SHOW server_version')"
echo

psql_file() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q "$@"; }
q() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -tAq -c "$1" 2>&1 | tr -d '\r'; }

pass=0; fail=0
assert() { # assert <libelle> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  PASS  $1 → $3"; pass=$((pass+1));
  else echo "  FAIL  $1 → obtenu '$3', attendu '$2'"; fail=$((fail+1)); fi
}
assert_has() { # assert_has <libelle> <fragment attendu> <texte>
  if [[ "$3" == *"$2"* ]]; then echo "  PASS  $1 → « $2 »"; pass=$((pass+1));
  else echo "  FAIL  $1 → '$3' ne contient pas « $2 »"; fail=$((fail+1)); fi
}

probe() { # probe <role> <sql> → OUI / REFUSE / ERREUR
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
    *"permission denied"*|*"42501"*) echo "REFUSE" ;;
    *)                               echo "ERREUR" ;;
  esac
}

apply() { # apply <fichier> <libelle> — transaction unique, comme le runner
  if docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$1"; then
    echo "  ok  $2"
  else
    echo "  FAIL  $2 en échec"; fail=$((fail+1))
  fi
}

# --- Accès aux données --------------------------------------------------------
# seed <ord_id> <statut> <ord_is_pay> <ord_date_pay> — littéraux SQL ou NULL.
# payment_confirmed = true sur toute commande payée par le drapeau, comme le
# callback Paybox.
seed() {
  q "INSERT INTO public.___xtr_order (ord_id, ord_ords_id, ord_is_pay, ord_date_pay, payment_confirmed)
     VALUES ('$1', $2, $3, $4, $3 = '1')" >/dev/null
}
st()        { q "SELECT COALESCE(ord_ords_id, 'NULL') FROM public.___xtr_order WHERE ord_id = '$1'"; }
row()       { q "SELECT COALESCE(ord_ords_id, 'NULL') || '|' || (ord_cancel_date IS NOT NULL) || '|' || COALESCE(ord_cancel_reason, 'NULL')
                 FROM public.___xtr_order WHERE ord_id = '$1'"; }
pay()       { q "SELECT COALESCE(ord_is_pay, 'NULL') || '|' || COALESCE(ord_date_pay, 'NULL') || '|' || COALESCE(payment_confirmed::text, 'NULL')
                 FROM public.___xtr_order WHERE ord_id = '$1'"; }
n_ev()      { q "SELECT count(*) FROM public.___xtr_order_history WHERE ord_id = '$1'"; }
ev()        { q "SELECT event_type || '|' || COALESCE(from_status, 'NULL') || '|' || to_status || '|' || source
                        || '|' || COALESCE(user_id::text, 'NULL') || '|' || correlation_id
                 FROM public.___xtr_order_history WHERE ord_id = '$1'"; }
ev_payload(){ q "SELECT (payload->>'reason') || '|' || (payload->>'payment_voided_before_capture') || '|' || (payload->>'attested_by')
                        || '|' || COALESCE(payload->>'ord_is_pay', 'NULL') || '|' || COALESCE(payload->>'ord_date_pay', 'NULL')
                 FROM public.___xtr_order_history WHERE ord_id = '$1'"; }
body_md5()  { q "SELECT md5(prosrc) FROM pg_proc WHERE oid = '$1'::regprocedure"; }
acl()       { q "SELECT proacl::text FROM pg_proc WHERE oid = '$SIG'::regprocedure"; }
orders_md5(){ q "SELECT md5(COALESCE(string_agg(o::text, ',' ORDER BY o.ord_id), '')) FROM public.___xtr_order o"; }
exists_fn() { q "SELECT to_regprocedure('$SIG') IS NOT NULL"; }

REASON="Rupture fournisseur : paiement annulé dans Paybox avant encaissement"
CORR="00000000-0000-4000-8000-000000000001"

# call_sql <sql> → « OK » ou le message d'erreur. En postgres, le rôle des
# opérations manuelles (propriétaire de la fonction).
call_sql() {
  local out
  if out=$(docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -tAq -c "$1" 2>&1); then echo "OK";
  else echo "$out" | sed -n 's/^.*ERROR: *//p' | head -1; fi
}
# voided <ord_id SQL|NULL> [motif SQL] [attestation SQL] [corrélation SQL]
voided() {
  call_sql "SELECT public.cancel_order_payment_voided_atomic($1, ${2:-'$REASON'}, ${3:-'owner'}, ${4:-'$CORR'::uuid})"
}
cancel() { call_sql "SELECT public.cancel_order_atomic('$1', 'motif test', 42, gen_random_uuid())"; }

# expect_ok <libelle> <ord_id> <statut de départ>
expect_ok() {
  local label="$1" id="$2" from="$3" pay_before
  pay_before="$(pay "$id")"
  assert "$label : annulation acceptée" "OK" "$(voided "'$id'")"
  assert "$label : statut 2, date et motif d'annulation" "2|true|$REASON" "$(row "$id")"
  assert "$label : champs de paiement intacts" "$pay_before" "$(pay "$id")"
  assert "$label : un événement ORDER_CANCELLED $from → 2, sans utilisateur" \
    "ORDER_CANCELLED|$from|2|owner_attestation|NULL|$CORR" "$(ev "$id")"
  assert "$label : payload = motif, attestation, état de paiement lu" \
    "$REASON|true|owner|${pay_before%|*}" "$(ev_payload "$id")"
}

# expect_refused <libelle> <ord_id SQL> <fragment attendu> [motif] [attestation] [corrélation]
expect_refused() {
  local label="$1" id_sql="$2" needle="$3" id before_row before_pay before_ev msg
  id="${id_sql//\'/}"
  before_row="$(row "$id")"; before_pay="$(pay "$id")"; before_ev="$(n_ev "$id")"
  msg="$(voided "$id_sql" "${4:-}" "${5:-}" "${6:-}")"
  assert_has "$label : refus" "$needle" "$msg"
  assert "$label : ligne inchangée" "$before_row|$before_pay" "$(row "$id")|$(pay "$id")"
  assert "$label : aucun événement ajouté" "$before_ev" "$(n_ev "$id")"
}

# =============================================================================
echo "=== Fixture + état de départ = base live (20260523_001, 20260523_002, 20260924) ==="
psql_file -f - < "$FIXTURE" || { echo "FATAL: fixture en échec"; exit 2; }
# Colonne live absente de la fixture commune : elle sert ici à prouver que les
# champs de paiement ne sont pas touchés.
q "ALTER TABLE public.___xtr_order ADD COLUMN payment_confirmed BOOLEAN" >/dev/null
apply "$HISTORY"     "20260523_001 (historique + append_order_event)"
apply "$ORIGIN"      "20260523_002 (cancel_order_atomic d'origine + create_order_atomic)"
apply "$REFUSE_PAID" "20260924 (cancel_order_atomic refuse toute commande payée)"
echo

# =============================================================================
echo "=== 1. AVANT 20261022 — le trou, reproduit ==="
seed B-VOIDED "'3'" "'1'" "'2026-10-17T07:26:52.153Z'"
assert "fonction absente" "f" "$(exists_fn)"
assert_has "cancel_order_atomic refuse la commande payée" "refund workflow required" "$(cancel B-VOIDED)"
assert "la commande reste payée au statut 3" "3|false|NULL" "$(row B-VOIDED)"
echo

# =============================================================================
echo "=== 2. Pré-condition en lecture seule, puis application de 20261022 ==="
awk '!d&&/^DO \$precheck\$/{f=1} f{print} f&&/^\$precheck\$;/{f=0;d=1}' "$MIGRATION" > "$WORK/precheck.sql"
assert "un seul bloc \$precheck\$, bien délimité" "1|\$precheck\$;" \
  "$(grep -c '^DO \$precheck\$' "$WORK/precheck.sql")|$(tail -n 1 "$WORK/precheck.sql")"
{ echo "BEGIN TRANSACTION READ ONLY;"; cat "$WORK/precheck.sql"; echo "COMMIT;"; } > "$WORK/precheck-ro.sql"
if psql_file -f - < "$WORK/precheck-ro.sql" >/dev/null 2>&1; then PRE=OK; else PRE=ECHEC; fi
assert "pré-condition passe en transaction READ ONLY" "OK" "$PRE"
BEFORE_CANCEL="$(body_md5 "$CANCEL_SIG")"
BEFORE_APPEND="$(body_md5 "$APPEND_SIG")"
BEFORE_ORDERS="$(orders_md5)"
BEFORE_HIST="$(q "SELECT count(*) FROM public.___xtr_order_history")"
apply "$MIGRATION" "20261022"
NEW_MD5="$(body_md5 "$SIG")"
assert "fonction créée" "t" "$(exists_fn)"
assert "cancel_order_atomic non touchée" "$BEFORE_CANCEL" "$(body_md5 "$CANCEL_SIG")"
assert "append_order_event non touchée" "$BEFORE_APPEND" "$(body_md5 "$APPEND_SIG")"
assert "aucune commande modifiée par la migration" "$BEFORE_ORDERS" "$(orders_md5)"
assert "aucun événement écrit par la migration" "$BEFORE_HIST" "$(q "SELECT count(*) FROM public.___xtr_order_history")"
echo

# =============================================================================
echo "=== 3. APRÈS — annulations acceptées (payée, canon 1|3|4 → 2) ==="
seed A-S1-FLAG  "'1'" "'1'" NULL
seed A-S1-DATE  "'1'" "'0'" "'2026-10-20T12:18:13.541Z'"
seed A-S4-PAD   "'4'" "'0'" "'  2026-10-01  '"
expect_ok "statut 3, drapeau + date (cas Paybox)" B-VOIDED 3
expect_ok "statut 1, drapeau seul"                A-S1-FLAG 1
expect_ok "statut 1, date seule"                  A-S1-DATE 1
expect_ok "statut 4, date entourée d'espaces"     A-S4-PAD  4
assert_has "deuxième annulation de la même commande" "already cancelled" "$(voided "'B-VOIDED'")"
assert "deuxième annulation : toujours un seul événement" "1" "$(n_ev B-VOIDED)"
echo

# =============================================================================
echo "=== 4. APRÈS — refus : non payée, déjà annulée, hors canon ==="
seed R-S1   "'1'" "'0'" NULL
seed R-S3   "'3'" "'0'" NULL
seed R-S4   "'4'" "'0'" NULL
seed R-WS   "'3'" "'0'" "E' \t\n '"
seed R-NULL "'1'" NULL  NULL
seed R-S2   "'2'" "'1'" "'2026-09-01 10:00:00'"
seed R-S5   "'5'" "'1'" "'2026-09-01 10:00:00'"
seed R-S6   "'6'" "'1'" "'2026-09-01 10:00:00'"
seed R-NOST NULL  "'1'" "'2026-09-01 10:00:00'"
NP="is not paid — use cancel_order_atomic"
expect_refused "statut 1 non payée"                    "'R-S1'"   "$NP"
expect_refused "statut 3 non payée"                    "'R-S3'"   "$NP"
expect_refused "statut 4 non payée"                    "'R-S4'"   "$NP"
expect_refused "date de paiement faite de blancs"      "'R-WS'"   "$NP"
expect_refused "ord_is_pay absent, sans date"          "'R-NULL'" "$NP"
expect_refused "déjà annulée, payée"                   "'R-S2'"   "already cancelled"
expect_refused "statut 5 payée (terminal)"             "'R-S5'"   "invalid transition"
expect_refused "statut '6' payée (hors canon)"         "'R-S6'"   "invalid transition"
expect_refused "statut absent, payée"                  "'R-NOST'" "invalid transition"
echo

# =============================================================================
echo "=== 5. APRÈS — refus : entrées invalides ==="
seed R-IN "'3'" "'1'" "'2026-10-17T07:26:52.153Z'"
assert_has "commande inexistante" "not found" "$(voided "'R-DOES-NOT-EXIST'")"
assert_has "identifiant vide"     "p_ord_id is required" "$(voided "''")"
assert_has "identifiant NULL"     "p_ord_id is required" "$(voided "NULL")"
expect_refused "corrélation NULL"   "'R-IN'" "p_correlation_id is required" "" "" "NULL::uuid"
expect_refused "motif NULL"         "'R-IN'" "p_reason is required"         "NULL"
expect_refused "motif blanc"        "'R-IN'" "p_reason is required"         "'   '"
expect_refused "attestation NULL"   "'R-IN'" "p_attested_by is required"    "" "NULL"
expect_refused "attestation vide"   "'R-IN'" "p_attested_by is required"    "" "''"
expect_refused "attestation blanche" "'R-IN'" "p_attested_by is required"   "" "E' \t '"
echo

# =============================================================================
echo "=== 6. Partition avec cancel_order_atomic (statuts 1|3|4) ==="
i=0
for s in 1 3 4; do
  for p in "'0'|NULL" "NULL|NULL" "'0'|'   '" "'1'|NULL" "'0'|'2026-10-01'" "'1'|'2026-10-01'"; do
    i=$((i+1))
    seed "P$i-a" "'$s'" "${p%|*}" "${p#*|}"
    seed "P$i-b" "'$s'" "${p%|*}" "${p#*|}"
    a="$(cancel "P$i-a")"; b="$(voided "'P$i-b'")"
    n=0; [[ "$a" == OK ]] && n=$((n+1)); [[ "$b" == OK ]] && n=$((n+1))
    assert "statut $s, (ord_is_pay|ord_date_pay)=$p : une seule fonction accepte" "1" "$n"
  done
done
echo

# =============================================================================
echo "=== 7. Course « deux annulations simultanées » ==="
seed C-RACE "'3'" "'1'" "'2026-10-17T07:26:52.153Z'"
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<SQL &
BEGIN;
SELECT public.cancel_order_payment_voided_atomic('C-RACE', 'premier', 'owner', gen_random_uuid());
SELECT pg_sleep(4);
COMMIT;
SQL
first_pid=$!
waited=0; blocked=0
for _ in $(seq 1 50); do
  [[ "$(q "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%pg_sleep(4)%' AND pid <> pg_backend_pid()")" == "1" ]] && { waited=1; break; }
  sleep 0.1
done
( voided "'C-RACE'" "'second'" > "$WORK/race.out" ) &
second_pid=$!
for _ in $(seq 1 50); do
  [[ "$(q "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%cancel_order_payment_voided_atomic%' AND pid <> pg_backend_pid()")" == "1" ]] && { blocked=1; break; }
  sleep 0.1
done
wait "$first_pid"; wait "$second_pid"
assert "la première annulation tenait la ligne" "1" "$waited"
assert "la seconde a attendu le verrou (pg_stat_activity)" "1" "$blocked"
assert_has "la seconde relit la ligne verrouillée et refuse" "already cancelled" "$(cat "$WORK/race.out")"
assert "un seul événement, motif de la première" "1|premier" "$(n_ev C-RACE)|$(q "SELECT ord_cancel_reason FROM public.___xtr_order WHERE ord_id = 'C-RACE'")"
echo

# =============================================================================
echo "=== 8. Droits et structure ==="
CALL="SELECT public.cancel_order_payment_voided_atomic('R-IN', 'x', 'x', gen_random_uuid());"
assert "anon : EXECUTE refusé"          "REFUSE" "$(probe anon          "$CALL")"
assert "authenticated : EXECUTE refusé" "REFUSE" "$(probe authenticated "$CALL")"
assert "service_role : EXECUTE refusé"  "REFUSE" "$(probe service_role  "$CALL")"
assert "droits = propriétaire seul, sans PUBLIC" "{postgres=X/postgres}" "$(acl)"
assert "SECURITY DEFINER" "t" "$(q "SELECT prosecdef FROM pg_proc WHERE oid = '$SIG'::regprocedure")"
assert "search_path épinglé, pg_temp en dernier" '{"search_path=public, pg_temp"}' "$(q "SELECT proconfig::text FROM pg_proc WHERE oid = '$SIG'::regprocedure")"
assert "signature et retour" "p_ord_id text, p_reason text, p_attested_by text, p_correlation_id uuid|void" \
  "$(q "SELECT pg_get_function_identity_arguments(oid) || '|' || prorettype::regtype FROM pg_proc WHERE oid = '$SIG'::regprocedure")"
assert "une seule surcharge" "1" "$(q "SELECT count(*) FROM pg_proc WHERE proname = 'cancel_order_payment_voided_atomic'")"
assert_has "commentaire" "voided in Paybox before capture" "$(q "SELECT obj_description('$SIG'::regprocedure, 'pg_proc')")"
echo

# =============================================================================
echo "=== 9. Idempotence et fermeture d'une ouverture de droits préexistante ==="
q "GRANT EXECUTE ON FUNCTION $SIG TO PUBLIC, anon, authenticated, service_role" >/dev/null
assert "ouverture simulée : service_role peut appeler" "t" "$(q "SELECT has_function_privilege('service_role', '$SIG', 'EXECUTE')")"
apply "$MIGRATION" "20261022 ré-appliquée"
assert "ré-application : même corps" "$NEW_MD5" "$(body_md5 "$SIG")"
assert "ré-application : ouverture refermée" "{postgres=X/postgres}" "$(acl)"
echo

# =============================================================================
echo "=== 10. La pré-condition bloque une surcharge ==="
q "CREATE FUNCTION public.cancel_order_payment_voided_atomic(p_ord_id text) RETURNS void LANGUAGE plpgsql AS 'BEGIN NULL; END'" >/dev/null
if psql_file -1 -f - < "$MIGRATION" > "$WORK/overload.out" 2>&1; then OV=APPLIQUEE; else OV=REFUSEE; fi
assert "migration refusée" "REFUSEE" "$OV"
assert_has "motif : surcharge" "une autre surcharge" "$(cat "$WORK/overload.out")"
assert "corps de la fonction réelle inchangé" "$NEW_MD5" "$(body_md5 "$SIG")"
q "DROP FUNCTION public.cancel_order_payment_voided_atomic(text)" >/dev/null
echo

# =============================================================================
echo "=== 11. Rollback puis ré-application ==="
apply "$DOWN" "20261022 .down.sql"
assert "rollback : fonction supprimée" "f" "$(exists_fn)"
assert "rollback : les annulations faites restent" "2|true|$REASON" "$(row B-VOIDED)"
assert "rollback : leurs événements restent" "1" "$(n_ev B-VOIDED)"
apply "$DOWN" "20261022 .down.sql rejoué (IF EXISTS)"
apply "$MIGRATION" "20261022 ré-appliquée après rollback"
assert "ré-application : même corps" "$NEW_MD5" "$(body_md5 "$SIG")"
assert "ré-application : propriétaire seul" "{postgres=X/postgres}" "$(acl)"
seed D-VOIDED "'3'" "'1'" "'2026-10-20T12:18:13.541Z'"
expect_ok "ré-application : annulation de nouveau possible" D-VOIDED 3
echo

echo "=== Résultat : $pass PASS, $fail FAIL ==="
[[ $fail -eq 0 ]]
