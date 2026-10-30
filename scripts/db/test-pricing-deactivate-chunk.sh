#!/usr/bin/env bash
# =============================================================================
# Test de comportement de 20261019_pricing_deactivate_chunk.sql (+ .down.sql)
#
# Prouve, sur les VRAIES migrations du dépôt :
#   1. Forme et droits : SECURITY INVOKER, search_path épinglé, EXECUTE retiré à
#      PUBLIC, anon et authenticated (la fixture reproduit le défaut Supabase qui
#      l'accorde à toute nouvelle fonction), service_role seul.
#   2. Refus avant toute écriture : lot non COMMITTING, lot d'import, fournisseur
#      différent du lot, chunk d'un autre lot, anon, authenticated.
#   3. Retrait : seules les lignes vendables (dispo 1/2/3) de la marque du lot
#      passent à '0'. FROZEN, MANUAL_OVERRIDE, dispo 0 ou nulle, motif déjà posé,
#      motif invalide, autre marque, autre pri_type : intacts. Aucun prix ne bouge
#      (empreinte md5 de toutes les colonnes de prix). Historique : ancienne
#      dispo, prix old = new, rattaché au chunk.
#   4. Rejeu idempotent ; une erreur en cours de chunk annule tout l'appel,
#      chunk compris (témoin : le handler FAILED de l'activation l'est aussi).
#   5. Annulation dédiée : restaure la dispo, laisse une ligne réécrite depuis
#      (activation journalisée, édition manuelle, entrée d'historique postérieure,
#      autre marque ; chaque garde testée seule), conserve le prix affiché
#      texte quand la colonne numérique est vide ; ROLLBACK_PARTIAL puis
#      ROLLED_BACK ; second rollback refusé. Témoin : l'annulation générique
#      pricing_rollback_batch EFFACE ce prix affiché.
#   6. Down : refusé tant qu'un retrait est en COMMITTING ; sinon retire les deux
#      fonctions et garde l'historique ; la migration se rejoue ensuite.
#
# Fixture : scripts/db/pricing-deactivate-chunk-fixture.sql (synthétique).
# Scénarios : scripts/db/pricing-deactivate-chunk-scenarios.sql.
# pricing_rollback_batch et pricing_activate_chunk viennent de leurs migrations
# d'origine ; leur corps est comparé au corps live, relevé le 2026-10-19 en
# lecture seule. Empreinte hors commentaires et blancs : le live de
# pricing_activate_chunk a été appliqué sans ses commentaires `--`. Le test part
# de ces corps-là, ou ne part pas.
#
# Environnement : conteneur PostgreSQL jetable, sans réseau ni écoute TCP,
# données sur tmpfs. Le conteneur n'exécute que ce test et disparaît avec lui
# (--rm). Ne lit aucune variable de connexion Supabase, ne touche aucune base.
#
# Usage : bash scripts/db/test-pricing-deactivate-chunk.sh
# Sortie : 0 si toutes les assertions passent ; 1 assertion fausse ; 2 environnement.
#
# Test de mutation (le test doit ÉCHOUER sur une migration affaiblie) :
#   sed '/-- brand-lock$/d' \
#     backend/supabase/migrations/20261019_pricing_deactivate_chunk.sql > /tmp/mut.sql
#   MIGRATION_UNDER_TEST=/tmp/mut.sql bash scripts/db/test-pricing-deactivate-chunk.sh
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG="backend/supabase/migrations"
FIXTURE="scripts/db/pricing-deactivate-chunk-fixture.sql"
SCENARIOS="scripts/db/pricing-deactivate-chunk-scenarios.sql"
V1_FUNCTIONS="$MIG/20260522_pricing_control_plane_v1_functions.sql"
ACTIVATE="$MIG/20260606_pricing_activate_chunk.sql"
DOWN="$MIG/20261019_pricing_deactivate_chunk.down.sql"
# MIGRATION_UNDER_TEST permet le test de mutation (pointer une copie altérée)
# sans toucher au fichier du dépôt. Par défaut : la migration réelle.
MIGRATION="${MIGRATION_UNDER_TEST:-$ROOT/$MIG/20261019_pricing_deactivate_chunk.sql}"
IMAGE="${PGIMAGE:-postgres:17-alpine}"

ROLLBACK_LIVE_MD5="f1cd66779bcf03124bb7323d0547fc41"
ACTIVATE_LIVE_MD5="ecf91526140cd0c751cf192c4a5a09ce"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
for f in "$ROOT/$FIXTURE" "$ROOT/$SCENARIOS" "$ROOT/$V1_FUNCTIONS" "$ROOT/$ACTIVATE" "$ROOT/$DOWN" "$MIGRATION"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done
MIGRATION="$(cd "$(dirname "$MIGRATION")" && pwd)/$(basename "$MIGRATION")"

echo "Image : $IMAGE"
echo "Migration : $MIGRATION"
exec timeout 300 docker run --rm -i --network none --user postgres \
  --tmpfs /tmp:rw,size=256m \
  -v "$ROOT":/repo:ro -v "$MIGRATION":/t/migration.sql:ro \
  -e FIXTURE="/repo/$FIXTURE" -e SCENARIOS="/repo/$SCENARIOS" \
  -e V1_FUNCTIONS="/repo/$V1_FUNCTIONS" -e ACTIVATE="/repo/$ACTIVATE" -e DOWN="/repo/$DOWN" \
  -e ROLLBACK_LIVE_MD5="$ROLLBACK_LIVE_MD5" -e ACTIVATE_LIVE_MD5="$ACTIVATE_LIVE_MD5" \
  "$IMAGE" bash -s <<'INNER'
set -uo pipefail
fail() { echo "  FAIL  $*"; exit 1; }
export PGDATA=/tmp/pgdata
initdb -D "$PGDATA" -U postgres --auth=trust --no-locale -E UTF8 >/tmp/initdb.log 2>&1 \
  || { cat /tmp/initdb.log; echo "FATAL: initdb"; exit 2; }
pg_ctl -D "$PGDATA" -w -o "-c listen_addresses=''" -l /tmp/pg.log start >/dev/null \
  || { echo "FATAL: postgres non démarré"; exit 2; }
# P : résultats jetés, erreurs (dont les ÉCHEC d'assertion) sur stderr.
P() { psql -X -q -tA -o /dev/null -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
q() { psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 -tA -c "$1"; }
apply() { # apply <fichier> <libelle> — transaction unique, comme le runner
  P -1 -f "$1" || fail "$2 en échec"
  echo "  ok  $2"
}

echo "PostgreSQL : $(q 'SHOW server_version')"
echo
P -f "$FIXTURE" || { echo "FATAL: fixture"; exit 2; }
apply "$V1_FUNCTIONS" "20260522_pricing_control_plane_v1_functions (pricing_rollback_batch)"
apply "$ACTIVATE" "20260606_pricing_activate_chunk"
for pair in "pricing_rollback_batch(uuid,text)=$ROLLBACK_LIVE_MD5" \
            "pricing_activate_chunk(uuid,uuid,text,text,jsonb)=$ACTIVATE_LIVE_MD5"; do
  sig="${pair%%=*}"; want="${pair##*=}"
  got=$(q "SELECT md5(regexp_replace(regexp_replace(prosrc, '--[^\n]*', '', 'g'), '\s+', '', 'g'))
           FROM pg_proc WHERE oid = 'public.$sig'::regprocedure")
  [[ "$got" == "$want" ]] || { echo "FATAL: corps de $sig différent du corps live ($got / $want)"; exit 2; }
  echo "  ok  corps identique au live : $sig"
done

echo
apply /t/migration.sql "migration, 1er passage"
apply /t/migration.sql "migration, 2e passage (idempotence)"

echo
echo "Scénarios"
P -f "$SCENARIOS" || fail "scénarios (assertion ci-dessus)"
echo "  ok  $(q 'SELECT count(*) FROM t_ok') assertions"

echo
echo "Down"
q "INSERT INTO price_import_batches(batch_id, status, supplier_id, operation)
   VALUES ('b6000000-0000-0000-0000-000000000000','COMMITTING','MARQUE_C','DISPO_DEACTIVATION')" >/dev/null \
  || fail "lot COMMITTING du test de down"
if out=$(P -f "$DOWN" 2>&1); then fail "down accepté alors qu'un retrait est en COMMITTING"; fi
[[ "$out" == *"ABORT: un lot DISPO_DEACTIVATION est en COMMITTING"* ]] || fail "down : refus inattendu : $out"
P <<'SQL' || fail "down (assertion ci-dessus)"
SELECT eq('down refusé tant qu''un retrait est en COMMITTING : 2 fonctions restent', (SELECT count(*) FROM pg_proc WHERE proname IN ('pricing_deactivate_chunk','pricing_deactivate_rollback')), 2::bigint);
UPDATE price_import_batches SET status='FAILED' WHERE batch_id='b6000000-0000-0000-0000-000000000000';
SQL
P -f "$DOWN" || fail "down en échec"
P <<'SQL' || fail "après down (assertion ci-dessus)"
SELECT eq('down : 2 fonctions retirées', (SELECT count(*) FROM pg_proc WHERE proname IN ('pricing_deactivate_chunk','pricing_deactivate_rollback')), 0::bigint);
SELECT eq('down : historique intact (5 lot 1 + 1 activation + 2 lot 4 + 3 lot 7 + 1 simulée)', (SELECT count(*) FROM pieces_price_history), 12::bigint);
SQL
echo "  ok  down"

echo
apply /t/migration.sql "migration rejouée après down"
P <<'SQL' || fail "après ré-application (assertion ci-dessus)"
SELECT eq('ré-application : 2 fonctions', (SELECT count(*) FROM pg_proc WHERE proname IN ('pricing_deactivate_chunk','pricing_deactivate_rollback')), 2::bigint);
SELECT eq('ré-application : anon sans EXECUTE', (SELECT bool_or(has_function_privilege('anon', oid, 'EXECUTE')) FROM pg_proc WHERE proname IN ('pricing_deactivate_chunk','pricing_deactivate_rollback')), false);
SQL

echo
echo "OK — $(q 'SELECT count(*) FROM t_ok') assertions réussies, 0 échec."
INNER
