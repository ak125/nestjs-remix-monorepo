#!/usr/bin/env bash
# =============================================================================
# Test adversarial de la migration 20261011_diag_capture_maintenance_schema.sql
#
# La migration CAPTURE deux tables et 5 colonnes de __diag_cause qui existent déjà
# en base. Le banc joue RÉELLEMENT le fichier comme le moteur d'application (une
# transaction pour le fichier entier) et vérifie le COMPORTEMENT :
#   - base vierge : 20260308 → capture → 20260321 → 20260422 passe ; les 18
#     opérations et 49 liens de 20260321 s'insèrent dans la forme capturée, clés
#     étrangères actives ; un rejeu ne change rien. La chaîne du dépôt n'est PAS
#     rejouable seule : 20260321 référence 6 lignes créées hors du dépôt (épinglé
#     ici, puis fourni par la fixture, passe `prealables`) ;
#   - base à la forme réelle (objets créés hors du dépôt, autrement que par la
#     capture, avec données, RLS et politiques) : la capture n'y change RIEN
#     (catalogue, fichiers de table, droits, politiques, données) ;
#   - toute dérive de forme fait échouer l'application, sans aucun effet partiel ;
#   - un verrou concurrent sur __diag_cause : échec borné par lock_timeout ;
#   - le .down.sql n'a aucun effet.
#
# Environnement : conteneur PostgreSQL jetable, sans réseau (même majeure que la
# PROD). Ne touche JAMAIS une base réelle : aucune variable de connexion Supabase
# n'est lue, l'hôte est un conteneur local créé et détruit ici.
#
# Usage   : bash scripts/db/test-diag-capture-maintenance-schema.sh
# Mutation: MIGRATION_UNDER_TEST=<variante.sql> bash scripts/db/test-diag-capture-maintenance-schema.sh
# Sortie  : 0 si toutes les assertions passent, 1 si une échoue, 2 si fatal.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGS="$ROOT/backend/supabase/migrations"
FIXTURE="$ROOT/scripts/db/diag-capture-maintenance-schema-fixture.sql"
# Une mutation ne vise que la migration ; le rollback est toujours celui du dépôt.
MIGRATION="${MIGRATION_UNDER_TEST:-$MIGS/20261011_diag_capture_maintenance_schema.sql}"
DOWN="$MIGS/20261011_diag_capture_maintenance_schema.down.sql"
# Migrations du dépôt autour de la capture : création du moteur, données de
# référence (qui insèrent dans les objets capturés), RLS.
MVP="$MIGS/20260308_diagnostic_engine_mvp.sql"
SEED="$MIGS/20260321_diagnostic_engine_10_systems.sql"
RLS="$MIGS/20260422_enable_rls_diag_tables.sql"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="diag-maint-capture-test-$$"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
for f in "$FIXTURE" "$MIGRATION" "$DOWN" "$MVP" "$SEED" "$RLS"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done

TMP="$(mktemp -d)"
cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

echo "Image     : $IMAGE"
echo "Migration : ${MIGRATION#"$ROOT"/}"
docker run -d --network none --memory 512m --memory-swap 512m --cpus 1 --pids-limit 128 --name "$CT" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null || exit 2
# Prêt = le serveur DÉFINITIF répond sur TCP. Le serveur temporaire que l'image
# lance pour son initialisation n'écoute que la socket Unix : sonder la socket
# rend la main pendant l'init, puis le serveur s'arrête sous la fixture.
ready() { docker exec "$CT" pg_isready -h 127.0.0.1 -U postgres -d postgres >/dev/null 2>&1; }
for _ in $(seq 1 60); do ready && break; sleep 1; done
ready || { echo "FATAL: postgres non prêt"; exit 2; }
echo "PostgreSQL: $(docker exec "$CT" psql -U postgres -d postgres -tAc 'SHOW server_version')"
echo

DB=postgres   # base courante ; chaque scénario a la sienne
psql_db() { docker exec -i "$CT" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }
q() { docker exec -i "$CT" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -qtA -c "$1"; }
# Joue un fichier comme le moteur : une seule transaction (-1), arrêt à la 1re
# erreur. Imprime la sortie (avis compris), rend le code psql.
migrate() { docker exec -i "$CT" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -1 -f - < "$1" 2>&1; }
# new_db <nom> : base neuve, rôles et privilèges par défaut, puis le moteur (20260308).
new_db() {
  docker exec "$CT" createdb -U postgres "$1" || { echo "FATAL: createdb $1"; exit 2; }
  DB=$1
  psql_db -f - < "$FIXTURE" >/dev/null || { echo "FATAL: fixture ($1)"; exit 2; }
  migrate "$MVP" >/dev/null || { echo "FATAL: 20260308 ($1)"; exit 2; }
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
# assert_same <libellé> <instantané A> <instantané B>
assert_same() {
  if cmp -s "$TMP/$2" "$TMP/$3"; then echo "  PASS  $1 → identique ($(wc -l < "$TMP/$2") lignes)"; pass=$((pass+1))
  else echo "  FAIL  $1 → différences :"; diff "$TMP/$2" "$TMP/$3" | head -20 | sed 's/^/          /'; fail=$((fail+1)); fi
}

# Instantané du catalogue de public : relations (dont relfilenode, qui change à
# toute réécriture de table), colonnes, défauts, contraintes, index, séquences,
# droits, RLS, politiques, commentaires.
SNAP_SQL=$(cat <<'SQL'
SELECT x FROM (
  SELECT format('rel %s kind=%s file=%s acl=%s rls=%s comment=%s', c.relname, c.relkind,
                c.relfilenode, c.relacl, c.relrowsecurity, obj_description(c.oid, 'pg_class'))
    FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'S', 'i')
  UNION ALL
  SELECT format('col %s.%s #%s %s notnull=%s default=%s comment=%s acl=%s', c.relname, a.attname,
                a.attnum, format_type(a.atttypid, a.atttypmod), a.attnotnull,
                pg_get_expr(d.adbin, d.adrelid), col_description(a.attrelid, a.attnum), a.attacl)
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
     AND a.attnum > 0 AND NOT a.attisdropped
  UNION ALL
  SELECT format('con %s %s %s', k.conrelid::regclass, k.conname, pg_get_constraintdef(k.oid))
    FROM pg_constraint k WHERE k.connamespace = 'public'::regnamespace
  UNION ALL
  SELECT format('idx %s', pg_get_indexdef(i.indexrelid))
    FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
   WHERE c.relnamespace = 'public'::regnamespace
  UNION ALL
  SELECT format('seq %s %s start=%s inc=%s max=%s cache=%s cycle=%s', s.seqrelid::regclass,
                format_type(s.seqtypid, NULL), s.seqstart, s.seqincrement, s.seqmax, s.seqcache, s.seqcycle)
    FROM pg_sequence s
  UNION ALL
  SELECT format('pol %s %s cmd=%s roles=%s using=%s check=%s', p.polrelid::regclass, p.polname,
                p.polcmd, p.polroles::regrole[], pg_get_expr(p.polqual, p.polrelid),
                pg_get_expr(p.polwithcheck, p.polrelid))
    FROM pg_policy p
) AS s(x) ORDER BY x COLLATE "C"
SQL
)
# Contenu des trois tables touchées et position des deux séquences.
DATA_SQL=$(cat <<'SQL'
SELECT 'data op '    || count(*) || ' ' || md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM public.__diag_maintenance_operation t
UNION ALL
SELECT 'data link '  || count(*) || ' ' || md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM public.__diag_maintenance_symptom_link t
UNION ALL
SELECT 'data cause ' || count(*) || ' ' || md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM public.__diag_cause t
UNION ALL
SELECT 'seq op '   || last_value || ' ' || is_called FROM public.__diag_maintenance_operation_id_seq
UNION ALL
SELECT 'seq link ' || last_value || ' ' || is_called FROM public.__diag_maintenance_symptom_link_id_seq
SQL
)
# snap <nom> [data] : instantané du catalogue (et des données) de la base courante.
snap() { { q "$SNAP_SQL"; if [[ ${2:-} == data ]]; then q "$DATA_SQL"; fi; } > "$TMP/$1"; }

OP=public.__diag_maintenance_operation
LINK=public.__diag_maintenance_symptom_link
CAUSE_COLS="'plausible_km_min', 'plausible_km_max', 'plausible_age_min', 'plausible_age_max', 'workshop_priority'"
COMMENT_OP='Operations entretien preventif. Recherche deleguee a /api/rag/search (pivot 2026-04-18).'
# Droits des séquences mesurés en base le 2026-10-11 (défauts Supabase).
SEQ_ACL='{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}'

echo "1. Base vierge : 20260308 → capture → 20260321 → 20260422"
new_db vierge
out=$(migrate "$MIGRATION"); rc=$?
assert "capture appliquée" 0 "$rc"
assert "2 tables créées" 2 "$(q "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('__diag_maintenance_operation', '__diag_maintenance_symptom_link')")"
assert "5 colonnes ajoutées à __diag_cause" 5 "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '__diag_cause' AND column_name IN ($CAUSE_COLS)")"
# Ordre relevé en base le 2026-10-11 (attnum), en lecture seule.
assert "ordre des colonnes des opérations = ordre en base" \
  "id,slug,system_id,label,description,interval_km_min,interval_km_max,interval_months_min,interval_months_max,severity_if_overdue,normal_wear_km_min,normal_wear_km_max,related_gamme_slug,related_pg_id,active,created_at" \
  "$(q "SELECT string_agg(attname, ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid = '$OP'::regclass AND attnum > 0 AND NOT attisdropped")"
assert "ordre des colonnes des liens = ordre en base" "id,symptom_id,operation_id,relevance,active,created_at" \
  "$(q "SELECT string_agg(attname, ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid = '$LINK'::regclass AND attnum > 0 AND NOT attisdropped")"
assert "droits des 2 séquences = ceux de la base" "$SEQ_ACL|$SEQ_ACL" \
  "$(q "SELECT string_agg(relacl::text, '|' ORDER BY relname) FROM pg_class WHERE oid IN (pg_get_serial_sequence('$OP', 'id')::regclass, pg_get_serial_sequence('$LINK', 'id')::regclass)")"
# Les liens 57-60 de 20260321 visent l'opération 1 (et 2, 5, 8, symptôme 8),
# créée hors du dépôt le 2026-03-08 : sans elle, le fichier est refusé en entier.
out=$(migrate "$SEED"); rc=$?
assert_err "20260321 seule : refusée sur une ligne hors dépôt" "Key (operation_id)=(1) is not present" "$out" "$rc"
assert "rien n'a été inséré" "0|0" "$(q "SELECT (SELECT count(*) FROM $OP) || '|' || (SELECT count(*) FROM $LINK)")"
psql_db -v prealables=1 -f - < "$FIXTURE" >/dev/null || { echo "FATAL: lignes préalables (vierge)"; exit 2; }
out=$(migrate "$SEED"); rc=$?
assert "20260321 s'insère dans la forme capturée, clés étrangères actives" 0 "$rc"
assert "18 opérations et 49 liens de 20260321 (+ 4 opérations préalables)" "22|49" "$(q "SELECT (SELECT count(*) FROM $OP) || '|' || (SELECT count(*) FROM $LINK)")"
assert "les 5 colonnes de __diag_cause portent les valeurs de 20260321" t "$(q "SELECT count(*) FILTER (WHERE plausible_km_min IS NOT NULL) > 0 AND count(*) FILTER (WHERE workshop_priority IS NOT NULL) = count(*) FROM public.__diag_cause")"
out=$(migrate "$RLS"); rc=$?
assert "20260422 (RLS) passe" 0 "$rc"

echo
echo "2. Rejeu sur la base vierge : sans effet"
snap v0 data
out=$(migrate "$MIGRATION"); rc=$?
assert "rejeu sans erreur" 0 "$rc"
snap v1 data
assert_same "catalogue, droits, politiques et données inchangés" v0 v1
# La post-condition fixe son search_path : le rendu des défauts ne dépend pas de
# celui de la session qui applique.
out=$(docker exec -i -e PGOPTIONS='-c search_path=pg_catalog' "$CT" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" 2>&1); rc=$?
assert "rejeu avec search_path de session = pg_catalog" 0 "$rc"

echo
echo "3. Base à la forme réelle (objets créés hors du dépôt, avec données, RLS et politiques)"
new_db reelle
psql_db -v forme_reelle=1 -f - < "$FIXTURE" >/dev/null || { echo "FATAL: forme réelle"; exit 2; }
psql_db -v prealables=1  -f - < "$FIXTURE" >/dev/null || { echo "FATAL: lignes préalables (reelle)"; exit 2; }
migrate "$SEED" >/dev/null || { echo "FATAL: 20260321 (reelle)"; exit 2; }
migrate "$RLS"  >/dev/null || { echo "FATAL: 20260422 (reelle)"; exit 2; }
assert "données en place : 22 opérations, 49 liens" "22|49" "$(q "SELECT (SELECT count(*) FROM $OP) || '|' || (SELECT count(*) FROM $LINK)")"
assert "2 politiques service_role posées par 20260422" 2 "$(q "SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('__diag_maintenance_operation', '__diag_maintenance_symptom_link') AND roles = '{service_role}'")"
snap r0 data
out=$(migrate "$MIGRATION"); rc=$?
assert "capture appliquée" 0 "$rc"
snap r1 data
assert_same "rien n'a changé : catalogue, fichiers de table, droits, politiques, données" r0 r1
q "$DATA_SQL" > "$TMP/rdata"

echo
echo "4. Dérives de forme : l'application échoue, sans aucun effet"
# derive <libellé> <SQL qui pose la dérive> <SQL qui la retire>
derive() {
  q "$2" >/dev/null || { echo "FATAL: dérive non posée ($1)"; exit 2; }
  snap d0 data
  out=$(migrate "$MIGRATION"); rc=$?
  assert_err "$1" "divergente de la base" "$out" "$rc"
  snap d1 data
  assert_same "$1 : aucun effet" d0 d1
  q "$3" >/dev/null || { echo "FATAL: dérive non retirée ($1)"; exit 2; }
}
derive "défaut modifié (severity_if_overdue)" \
  "ALTER TABLE $OP ALTER COLUMN severity_if_overdue SET DEFAULT 'high'" \
  "ALTER TABLE $OP ALTER COLUMN severity_if_overdue SET DEFAULT 'moderate'"
derive "NOT NULL retiré (label)" \
  "ALTER TABLE $OP ALTER COLUMN label DROP NOT NULL" \
  "ALTER TABLE $OP ALTER COLUMN label SET NOT NULL"
derive "colonne passée en bigint (related_pg_id)" \
  "ALTER TABLE $OP ALTER COLUMN related_pg_id TYPE bigint" \
  "ALTER TABLE $OP ALTER COLUMN related_pg_id TYPE integer"
derive "index en plus" \
  "CREATE INDEX drift_idx ON $OP (label)" \
  "DROP INDEX public.drift_idx"
derive "commentaire de colonne posé" \
  "COMMENT ON COLUMN $OP.slug IS 'derive'" \
  "COMMENT ON COLUMN $OP.slug IS NULL"
derive "séquence en cache 2" \
  "ALTER SEQUENCE public.__diag_maintenance_operation_id_seq CACHE 2" \
  "ALTER SEQUENCE public.__diag_maintenance_operation_id_seq CACHE 1"
derive "colonne en plus (liens)" \
  "ALTER TABLE $LINK ADD COLUMN drift integer" \
  "ALTER TABLE $LINK DROP COLUMN drift"
derive "contrainte CHECK en plus (liens)" \
  "ALTER TABLE $LINK ADD CONSTRAINT drift_chk CHECK (relevance <> '')" \
  "ALTER TABLE $LINK DROP CONSTRAINT drift_chk"
derive "clé étrangère retirée (liens → opérations)" \
  "ALTER TABLE $LINK DROP CONSTRAINT __diag_maintenance_symptom_link_operation_id_fkey" \
  "ALTER TABLE $LINK ADD CONSTRAINT __diag_maintenance_symptom_link_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES $OP (id)"
derive "commentaire posé sur la table des liens" \
  "COMMENT ON TABLE $LINK IS 'derive'" \
  "COMMENT ON TABLE $LINK IS NULL"
derive "__diag_cause.plausible_km_min en bigint" \
  "ALTER TABLE public.__diag_cause ALTER COLUMN plausible_km_min TYPE bigint" \
  "ALTER TABLE public.__diag_cause ALTER COLUMN plausible_km_min TYPE integer"
derive "__diag_cause.workshop_priority : autre défaut" \
  "ALTER TABLE public.__diag_cause ALTER COLUMN workshop_priority SET DEFAULT 'optional'" \
  "ALTER TABLE public.__diag_cause ALTER COLUMN workshop_priority SET DEFAULT 'recommended'"
out=$(migrate "$MIGRATION"); rc=$?
assert "dérives retirées : la capture repasse" 0 "$rc"
q "$DATA_SQL" > "$TMP/rdata2"
assert_same "données intactes après les 12 dérives" rdata rdata2

echo
echo "5. Seule écriture possible : COMMENT ON de la table des opérations"
# La post-condition passe APRÈS le COMMENT ON : un commentaire divergent n'est pas
# détecté, il est ramené au texte capturé. Comportement épinglé ici, pas masqué.
q "COMMENT ON TABLE $OP IS 'derive'" >/dev/null
out=$(migrate "$MIGRATION"); rc=$?
assert "capture appliquée" 0 "$rc"
assert "commentaire ramené au texte capturé" "$COMMENT_OP" "$(q "SELECT obj_description('$OP'::regclass, 'pg_class')")"

echo
echo "6. Pas d'effet partiel : une seule table préexiste, de forme étrangère"
new_db partielle
q "CREATE TABLE $LINK (id serial PRIMARY KEY, symptom_id integer NOT NULL, operation_id integer NOT NULL, relevance text DEFAULT 'other', active boolean DEFAULT true, created_at timestamptz DEFAULT now(), UNIQUE (symptom_id, operation_id))" >/dev/null
snap p0
out=$(migrate "$MIGRATION"); rc=$?
assert_err "dérive détectée (défaut, clés étrangères absentes)" "divergente de la base" "$out" "$rc"
snap p1
assert_same "catalogue inchangé" p0 p1
assert "table des opérations non créée" absente "$(q "SELECT coalesce(to_regclass('$OP')::text, 'absente')")"
assert "aucune des 5 colonnes ajoutée à __diag_cause" 0 "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '__diag_cause' AND column_name IN ($CAUSE_COLS)")"

echo
echo "7. Verrou concurrent sur __diag_cause : échec borné par lock_timeout"
DB=reelle
# Une lecture longue tient ACCESS SHARE sur __diag_cause ; ADD COLUMN IF NOT EXISTS
# demande ACCESS EXCLUSIVE même quand la colonne existe.
docker exec -i "$CT" psql -U postgres -d reelle -v ON_ERROR_STOP=1 -qtA >"$TMP/hold" 2>&1 <<'SQL' &
BEGIN;
SELECT count(*) FROM public.__diag_cause;
SELECT pg_sleep(12);
ROLLBACK;
SQL
HOLDER=$!
# Attente déterministe : la lecture tient son verrou et dort.
held=0
for _ in $(seq 1 50); do
  held=$(q "SELECT count(*) FROM pg_stat_activity a WHERE a.wait_event = 'PgSleep' AND EXISTS (SELECT 1 FROM pg_locks l WHERE l.pid = a.pid AND l.relation = 'public.__diag_cause'::regclass AND l.granted)")
  [[ "$held" == 1 ]] && break; sleep 0.1
done
[[ "$held" == 1 ]] || { echo "FATAL: la lecture concurrente n'a pas pris son verrou"; wait "$HOLDER"; exit 2; }
snap l0 data
t0=$(date +%s)
out=$(migrate "$MIGRATION"); rc=$?
elapsed=$(( $(date +%s) - t0 ))
assert_err "capture refusée" "lock timeout" "$out" "$rc"
alive=$(kill -0 "$HOLDER" 2>/dev/null && echo oui || echo non)
assert "rendue pendant la lecture concurrente (pas après)" oui "$alive"
assert "attente bornée (4 à 8 s pour lock_timeout = 5s)" oui "$( (( elapsed >= 4 && elapsed <= 8 )) && echo oui || echo "non (${elapsed} s)")"
wait "$HOLDER"
snap l1 data
assert_same "aucun effet" l0 l1

echo
echo "8. Rollback : le .down.sql n'a aucun effet"
assert "aucune instruction d'écriture dans le .down.sql" 0 \
  "$(grep -v '^[[:space:]]*--' "$DOWN" | grep -ciE '\b(drop|alter|create|delete|truncate|update|insert|grant|revoke|comment)\b')"
snap b0 data
# Comme à la main : sans -1.
docker exec -i "$CT" psql -U postgres -d reelle -v ON_ERROR_STOP=1 -q -f - < "$DOWN" >/dev/null 2>&1; rc=$?
assert "rollback sans erreur" 0 "$rc"
snap b1 data
assert_same "catalogue et données inchangés" b0 b1

echo
echo "Résultat : $pass PASS, $fail FAIL"
[[ $fail -eq 0 ]] || exit 1
