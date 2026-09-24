#!/usr/bin/env bash
# =============================================================================
# Test de comportement de 20260924_cancel_order_atomic_refuse_paid.sql
#
# Prouve le défaut PUIS sa correction :
#   1. AVANT la migration (corps d'origine 20260523_002, identique au corps live
#      — empreinte md5 vérifiée), une commande PAYÉE dont le statut est '1', '3'
#      ou '4' est annulée par la RPC. C'est aussi vrai en course : un paiement
#      confirmé pendant que l'annulation attend le verrou ne l'arrête pas.
#   2. APRÈS, matrice complète de décision sur la ligne verrouillée : payée
#      (drapeau, date seule, quel que soit le statut) → refus « refund workflow
#      required » ; déjà annulée → « already cancelled », même si elle avait été
#      payée ; statut hors canon ou absent → « invalid transition » ; 1|3|4 non
#      payée → annulée, avec l'événement ORDER_CANCELLED dans la même
#      transaction. Chaque refus laisse la ligne et l'historique intacts.
#   3. Course « paiement confirmé pendant l'annulation » : l'annulation attend
#      le verrou (observé dans pg_stat_activity, pas supposé), puis refuse.
#   4. Droits (anon / authenticated refusés, service_role seul), structure
#      (DEFINER, search_path, surcharge unique), fonctions voisines et données
#      non touchées, idempotence, fermeture d'une ouverture de droits
#      préexistante, rollback exact vers le corps live puis ré-application.
#
# Fixture minimale : scripts/db/cancel-order-atomic-fixture.sql. Les fonctions
# viennent des VRAIES migrations du dépôt, jamais d'une copie.
#
# Environnement : conteneur PostgreSQL jetable (même majeure que la PROD), sans
# réseau (--network none) et sans écoute TCP : psql passe par le socket local.
# Ne lit aucune variable de connexion Supabase, ne touche aucune base réelle.
#
# Usage : bash scripts/db/test-cancel-order-atomic-refuse-paid.sh
# Sortie : 0 si toutes les assertions passent.
#
# Test de mutation (le test doit ÉCHOUER sur une migration affaiblie) :
#   sed '/Paid = same predicate/,/END IF;/d' \
#     backend/supabase/migrations/20260924_cancel_order_atomic_refuse_paid.sql > /tmp/mut.sql
#   MIGRATION_UNDER_TEST=/tmp/mut.sql bash scripts/db/test-cancel-order-atomic-refuse-paid.sh
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG_DIR="$ROOT/backend/supabase/migrations"
FIXTURE="$ROOT/scripts/db/cancel-order-atomic-fixture.sql"
HISTORY="$MIG_DIR/20260523_001_create_order_history.sql"
ORIGIN="$MIG_DIR/20260523_002_cancel_order_atomic.sql"
RIGHTS="$MIG_DIR/20260617_revoke_anon_execute_cancel_order_atomic_and_order_payment_siblings.sql"
# MIGRATION_UNDER_TEST permet le test de mutation (pointer une copie altérée)
# sans toucher au fichier du dépôt. Par défaut : la migration réelle.
MIGRATION="${MIGRATION_UNDER_TEST:-$MIG_DIR/20260924_cancel_order_atomic_refuse_paid.sql}"
DOWN="$MIG_DIR/20260924_cancel_order_atomic_refuse_paid.down.sql"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="cancel-order-atomic-test-$$"

# Empreinte md5(prosrc) du corps live de cancel_order_atomic, relevée le
# 2026-09-24 en lecture seule. Le test part de ce corps-là, ou ne part pas.
LIVE_MD5="ea565836042a13929d8e1e35370bda57"
SIG="public.cancel_order_atomic(text, text, bigint, uuid)"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
for f in "$FIXTURE" "$HISTORY" "$ORIGIN" "$RIGHTS" "$MIGRATION" "$DOWN"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done

WORK="$(mktemp -d)"
cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

echo "Image : $IMAGE"
docker run -d --name "$CT" --network none \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test \
  "$IMAGE" -c listen_addresses='' >/dev/null || exit 2
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
assert_lacks() { # assert_lacks <libelle> <fragment interdit> <texte>
  if [[ "$3" != *"$2"* ]]; then echo "  PASS  $1 → sans « $2 »"; pass=$((pass+1));
  else echo "  FAIL  $1 → '$3' contient « $2 »"; fail=$((fail+1)); fi
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
seed() {
  q "INSERT INTO public.___xtr_order (ord_id, ord_ords_id, ord_is_pay, ord_date_pay) VALUES ('$1', $2, $3, $4)" >/dev/null
}
st()        { q "SELECT COALESCE(ord_ords_id, 'NULL') FROM public.___xtr_order WHERE ord_id = '$1'"; }
has_date()  { q "SELECT (ord_cancel_date IS NOT NULL) FROM public.___xtr_order WHERE ord_id = '$1'"; }
n_ev()      { q "SELECT count(*) FROM public.___xtr_order_history WHERE ord_id = '$1'"; }
ev()        { q "SELECT event_type || '|' || COALESCE(from_status, 'NULL') || '|' || to_status || '|' || source
                        || '|' || (payload->>'reason') || '|' || (payload->>'cancelled_by_user_id') || '|' || user_id
                 FROM public.___xtr_order_history WHERE ord_id = '$1'"; }
body_md5()  { q "SELECT md5(prosrc) FROM pg_proc WHERE oid = '$1'::regprocedure"; }
acl()       { q "SELECT proacl::text FROM pg_proc WHERE oid = '$SIG'::regprocedure"; }
orders_md5(){ q "SELECT md5(COALESCE(string_agg(o::text, ',' ORDER BY o.ord_id), '')) FROM public.___xtr_order o"; }

# cancel <ord_id SQL|NULL> [correlation SQL] → « OK » ou le message d'erreur.
# Appel en service_role, comme le backend.
cancel() {
  local id_sql="$1" corr="${2:-gen_random_uuid()}" out
  if out=$(docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -tAq 2>&1 <<SQL
SET ROLE service_role;
SELECT public.cancel_order_atomic($id_sql, 'motif test', 42, $corr);
SQL
); then echo "OK"; else echo "$out" | sed -n 's/^.*ERROR: *//p' | head -1; fi
}

# expect_ok <libelle> <ord_id> <statut de départ>
expect_ok() {
  local label="$1" id="$2" from="$3"
  assert "$label : annulation acceptée" "OK" "$(cancel "'$id'")"
  assert "$label : statut → 2" "2" "$(st "$id")"
  assert "$label : date d'annulation posée" "t" "$(has_date "$id")"
  assert "$label : un événement ORDER_CANCELLED $from → 2, même transaction" \
    "ORDER_CANCELLED|$from|2|orders_service|motif test|42|42" "$(ev "$id")"
}

# expect_refused <libelle> <ord_id> <fragment du message attendu>
expect_refused() {
  local label="$1" id="$2" needle="$3" before msg
  before="$(st "$id")"
  msg="$(cancel "'$id'")"
  assert_has "$label : refus" "$needle" "$msg"
  assert "$label : statut inchangé" "$before" "$(st "$id")"
  assert "$label : aucune date d'annulation" "f" "$(has_date "$id")"
  assert "$label : aucun événement" "0" "$(n_ev "$id")"
}

# race <ord_id> → message de l'annulation lancée PENDANT qu'une transaction
# confirme le paiement de la même commande. Le verrou est observé, pas supposé.
race() {
  local id="$1" waited=0 blocked=0 pay_pid cancel_pid
  docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<SQL &
BEGIN;
UPDATE public.___xtr_order SET ord_is_pay = '1', ord_date_pay = '2026-09-24 10:00:00' WHERE ord_id = '$id';
SELECT pg_sleep(4);
COMMIT;
SQL
  pay_pid=$!
  for _ in $(seq 1 50); do
    [[ "$(q "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%pg_sleep(4)%' AND pid <> pg_backend_pid()")" == "1" ]] && { waited=1; break; }
    sleep 0.1
  done
  ( cancel "'$id'" > "$WORK/race-$id.out" ) &
  cancel_pid=$!
  for _ in $(seq 1 50); do
    [[ "$(q "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%cancel_order_atomic%' AND pid <> pg_backend_pid()")" == "1" ]] && { blocked=1; break; }
    sleep 0.1
  done
  wait "$pay_pid"; wait "$cancel_pid"
  assert "course $id : la transaction de paiement tenait la ligne" "1" "$waited"
  assert "course $id : l'annulation a attendu le verrou (pg_stat_activity)" "1" "$blocked"
  RACE_MSG="$(cat "$WORK/race-$id.out")"
}

# =============================================================================
echo "=== Fixture + état de départ = base live (20260523_001, 20260523_002, droits 20260617) ==="
psql_file -f - < "$FIXTURE" || { echo "FATAL: fixture en échec"; exit 2; }
apply "$HISTORY" "20260523_001 (historique + append_order_event)"
apply "$ORIGIN"  "20260523_002 (cancel_order_atomic d'origine + create_order_atomic)"
# 20260617 ferme aussi mark_order_paid_atomic, absente de la fixture : on rejoue
# ses seules lignes REVOKE/GRANT portant sur les fonctions présentes.
{ echo "SET LOCAL lock_timeout = '5s';"
  grep -E '^(REVOKE|GRANT) .*(create_order_atomic|cancel_order_atomic|append_order_event)\(' "$RIGHTS"
} > "$WORK/rights.sql"
assert "20260617 : 6 lignes de droits rejouées (3 fonctions × REVOKE + GRANT)" "6" "$(grep -cE '^(REVOKE|GRANT) ' "$WORK/rights.sql")"
apply "$WORK/rights.sql" "20260617 (droits des fonctions présentes)"
assert "corps de départ = corps live (md5)" "$LIVE_MD5" "$(body_md5 "$SIG")"
assert "droits de départ = droits live" "{postgres=X/postgres,service_role=X/postgres}" "$(acl)"
echo

# =============================================================================
echo "=== 1. AVANT 20260924 — le défaut, reproduit ==="
seed B-S1-FLAG  "'1'" "'1'" "'2026-09-01 10:00:00'"
seed B-S1-DATE  "'1'" "'0'" "'2026-09-01 10:00:00'"
seed B-S3-FLAG  "'3'" "'1'" "'2026-09-01 10:00:00'"
seed B-S4-FLAG  "'4'" "'1'" "'2026-09-01 10:00:00'"
seed B-NOSTATUS NULL  "'0'" NULL
seed B-S6       "'6'" "'0'" NULL
seed B-RACE     "'1'" "'0'" NULL
assert "statut 1 payée : ANNULÉE (défaut)" "OK" "$(cancel "'B-S1-FLAG'")"
assert "statut 1, date de paiement seule : ANNULÉE (défaut)" "OK" "$(cancel "'B-S1-DATE'")"
assert "statut 3 payée : ANNULÉE (défaut)" "OK" "$(cancel "'B-S3-FLAG'")"
assert "statut 4 payée : ANNULÉE (défaut)" "OK" "$(cancel "'B-S4-FLAG'")"
assert_has "statut absent : signalé « introuvable » (message trompeur)" "not found" "$(cancel "'B-NOSTATUS'")"
assert_has "statut '6' : violation de clé étrangère sur l'historique" "foreign key" "$(cancel "'B-S6'")"
race B-RACE
assert "course : paiement confirmé pendant l'attente → ANNULÉE quand même (défaut)" "OK" "$RACE_MSG"
assert "course : la commande payée finit au statut 2 (défaut)" "2|1" "$(q "SELECT ord_ords_id || '|' || ord_is_pay FROM public.___xtr_order WHERE ord_id = 'B-RACE'")"
echo

# =============================================================================
echo "=== 2. Application de 20260924 ==="
BEFORE_CREATE="$(body_md5 'public.create_order_atomic(jsonb, jsonb, uuid)')"
BEFORE_APPEND="$(body_md5 'public.append_order_event(text, text, text, text, jsonb, text, uuid, bigint)')"
BEFORE_ORDERS="$(orders_md5)"
BEFORE_HIST="$(q "SELECT count(*) FROM public.___xtr_order_history")"
apply "$MIGRATION" "20260924"
NEW_MD5="$(body_md5 "$SIG")"
assert "le corps a changé" "true" "$([[ "$NEW_MD5" != "$LIVE_MD5" ]] && echo true || echo false)"
assert "create_order_atomic non touchée" "$BEFORE_CREATE" "$(body_md5 'public.create_order_atomic(jsonb, jsonb, uuid)')"
assert "append_order_event non touchée" "$BEFORE_APPEND" "$(body_md5 'public.append_order_event(text, text, text, text, jsonb, text, uuid, bigint)')"
assert "aucune commande modifiée par la migration" "$BEFORE_ORDERS" "$(orders_md5)"
assert "aucun événement écrit par la migration" "$BEFORE_HIST" "$(q "SELECT count(*) FROM public.___xtr_order_history")"
echo

# =============================================================================
echo "=== 3. APRÈS — annulations légitimes (canon 1|3|4 → 2, non payée) ==="
seed A-S1       "'1'" "'0'" NULL
seed A-S3       "'3'" "'0'" NULL
seed A-S4       "'4'" "'0'" NULL
seed A-BLANK    "'1'" "'0'" "'   '"
seed A-WS       "'1'" "'0'" "E' \t\n '"
seed A-PAYNULL  "'1'" NULL  NULL
expect_ok "statut 1 non payée" A-S1 1
expect_ok "statut 3 non payée" A-S3 3
expect_ok "statut 4 non payée" A-S4 4
expect_ok "date de paiement faite d'espaces (= vide pour l'app)" A-BLANK 1
expect_ok "date de paiement faite de blancs (tab, saut de ligne)" A-WS 1
expect_ok "ord_is_pay absent, sans date (non payée pour l'app aussi)" A-PAYNULL 1
assert_has "deuxième annulation de la même commande" "already cancelled" "$(cancel "'A-S1'")"
assert "deuxième annulation : toujours un seul événement" "1" "$(n_ev A-S1)"
echo

# =============================================================================
echo "=== 4. APRÈS — refus : commande payée, quel que soit son statut ==="
seed R-S1-FLAG     "'1'" "'1'" "'2026-09-01 10:00:00'"
seed R-S1-DATE     "'1'" "'0'" "'2026-09-01 10:00:00'"
seed R-S1-FLAGONLY "'1'" "'1'" NULL
seed R-S1-PADDED   "'1'" "'0'" "'  2026-09-01  '"
seed R-S3-FLAG     "'3'" "'1'" "'2026-09-01 10:00:00'"
seed R-S4-FLAG     "'4'" "'1'" "'2026-09-01 10:00:00'"
seed R-S5-FLAG     "'5'" "'1'" "'2026-09-01 10:00:00'"
seed R-S5-BARE     "'5'" "'0'" NULL
seed R-S6-FLAG     "'6'" "'1'" "'2026-09-01 10:00:00'"
seed R-NOST-FLAG   NULL  "'1'" "'2026-09-01 10:00:00'"
RW="refund workflow required"
expect_refused "statut 1, drapeau + date"            R-S1-FLAG     "$RW"
expect_refused "statut 1, date seule"                R-S1-DATE     "$RW"
expect_refused "statut 1, drapeau seul"              R-S1-FLAGONLY "$RW"
expect_refused "statut 1, date entourée d'espaces"   R-S1-PADDED   "$RW"
expect_refused "statut 3 payée"                      R-S3-FLAG     "$RW"
expect_refused "statut 4 payée"                      R-S4-FLAG     "$RW"
expect_refused "statut 5 payée"                      R-S5-FLAG     "$RW"
expect_refused "statut 5 sans champ de paiement"     R-S5-BARE     "$RW"
expect_refused "statut '6' payée"                    R-S6-FLAG     "$RW"
expect_refused "statut absent, payée"                R-NOST-FLAG   "$RW"
echo

# =============================================================================
echo "=== 5. APRÈS — refus : déjà annulée, hors canon, entrées invalides ==="
seed R-S2        "'2'" "'0'" NULL
seed R-S2-PAID   "'2'" "'1'" "'2026-09-01 10:00:00'"
seed R-S6        "'6'" "'0'" NULL
seed R-NOSTATUS  NULL  "'0'" NULL
seed R-NOCORR    "'1'" "'0'" NULL
expect_refused "déjà annulée"                           R-S2       "already cancelled"
expect_refused "déjà annulée ET payée : « déjà annulée » d'abord" R-S2-PAID "already cancelled"
for id in R-S6 R-NOSTATUS; do
  msg="$(cancel "'$id'")"
  assert_has   "$id : transition hors canon" "invalid transition" "$msg"
  # OrdersService.cancelOrder traduit le message par fragments : aucun des
  # fragments des autres cas ne doit y figurer.
  assert_lacks "$id : message distinct de « payée »"        "paid"              "$msg"
  assert_lacks "$id : message distinct de « introuvable »"  "not found"         "$msg"
  assert_lacks "$id : message distinct de « déjà annulée »" "already cancelled" "$msg"
  assert "$id : statut inchangé" "$([[ $id == R-S6 ]] && echo 6 || echo NULL)" "$(st "$id")"
  assert "$id : aucun événement" "0" "$(n_ev "$id")"
done
assert_has "commande inexistante" "not found" "$(cancel "'R-DOES-NOT-EXIST'")"
assert_has "identifiant vide"     "p_ord_id is required" "$(cancel "''")"
assert_has "identifiant NULL"     "p_ord_id is required" "$(cancel "NULL")"
assert_has "corrélation NULL"     "p_correlation_id is required" "$(cancel "'R-NOCORR'" "NULL")"
assert "corrélation NULL : commande annulable laissée intacte" "1" "$(st R-NOCORR)"
echo

# =============================================================================
echo "=== 6. APRÈS — course « paiement confirmé pendant l'annulation » ==="
seed A-RACE "'1'" "'0'" NULL
race A-RACE
assert_has "course : l'annulation relit la ligne verrouillée et refuse" "$RW" "$RACE_MSG"
assert "course : la commande reste au statut 1, payée" "1|1" "$(q "SELECT ord_ords_id || '|' || ord_is_pay FROM public.___xtr_order WHERE ord_id = 'A-RACE'")"
assert "course : aucun événement" "0" "$(n_ev A-RACE)"
echo

# =============================================================================
echo "=== 7. Droits et structure ==="
assert "anon : EXECUTE refusé"          "REFUSE" "$(probe anon          "SELECT public.cancel_order_atomic('A-S3', 'x', 1, gen_random_uuid());")"
assert "authenticated : EXECUTE refusé" "REFUSE" "$(probe authenticated "SELECT public.cancel_order_atomic('A-S3', 'x', 1, gen_random_uuid());")"
assert "service_role : EXECUTE accordé" "t" "$(q "SELECT has_function_privilege('service_role', '$SIG', 'EXECUTE')")"
assert "droits = droits live, sans PUBLIC" "{postgres=X/postgres,service_role=X/postgres}" "$(acl)"
assert "SECURITY DEFINER conservé" "t" "$(q "SELECT prosecdef FROM pg_proc WHERE oid = '$SIG'::regprocedure")"
assert "search_path conservé" "{search_path=public}" "$(q "SELECT proconfig::text FROM pg_proc WHERE oid = '$SIG'::regprocedure")"
assert "signature et retour conservés" "p_ord_id text, p_reason text, p_user_id bigint, p_correlation_id uuid|void" \
  "$(q "SELECT pg_get_function_identity_arguments(oid) || '|' || prorettype::regtype FROM pg_proc WHERE oid = '$SIG'::regprocedure")"
assert "une seule surcharge" "1" "$(q "SELECT count(*) FROM pg_proc WHERE proname = 'cancel_order_atomic'")"
assert_has "commentaire à jour" "Since 20260924" "$(q "SELECT obj_description('$SIG'::regprocedure, 'pg_proc')")"
echo

# =============================================================================
echo "=== 8. Idempotence et fermeture d'une ouverture de droits préexistante ==="
q "GRANT EXECUTE ON FUNCTION $SIG TO PUBLIC, anon, authenticated" >/dev/null
assert "ouverture simulée : anon peut appeler" "t" "$(q "SELECT has_function_privilege('anon', '$SIG', 'EXECUTE')")"
apply "$MIGRATION" "20260924 ré-appliquée"
assert "ré-application : même corps" "$NEW_MD5" "$(body_md5 "$SIG")"
assert "ré-application : ouverture refermée, droits live" "{postgres=X/postgres,service_role=X/postgres}" "$(acl)"
assert "ré-application : anon refusé" "REFUSE" "$(probe anon "SELECT public.cancel_order_atomic('A-S3', 'x', 1, gen_random_uuid());")"
echo

# =============================================================================
echo "=== 9. Rollback puis ré-application ==="
apply "$DOWN" "20260924 .down.sql"
assert "rollback : corps live restauré à l'identique" "$LIVE_MD5" "$(body_md5 "$SIG")"
assert "rollback : droits live" "{postgres=X/postgres,service_role=X/postgres}" "$(acl)"
assert_lacks "rollback : commentaire d'origine" "Since 20260924" "$(q "SELECT obj_description('$SIG'::regprocedure, 'pg_proc')")"
seed D-S1-FLAG "'1'" "'1'" "'2026-09-01 10:00:00'"
assert "rollback : la fenêtre est rouverte (payée annulée)" "OK" "$(cancel "'D-S1-FLAG'")"
apply "$MIGRATION" "20260924 ré-appliquée après rollback"
assert "ré-application : corps corrigé" "$NEW_MD5" "$(body_md5 "$SIG")"
seed D-S1-FLAG2 "'1'" "'1'" "'2026-09-01 10:00:00'"
expect_refused "ré-application : payée refusée de nouveau" D-S1-FLAG2 "$RW"
echo

echo "=== Résultat : $pass PASS, $fail FAIL ==="
[[ $fail -eq 0 ]]
