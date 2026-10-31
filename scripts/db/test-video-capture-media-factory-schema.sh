#!/usr/bin/env bash
# =============================================================================
# Test adversarial de la migration 20261031_video_capture_media_factory_schema.sql
#
# La migration CAPTURE les 6 tables __video_* de media-factory, qui existent déjà
# en base. Le banc joue RÉELLEMENT le fichier comme le moteur d'application (une
# transaction pour le fichier entier) et vérifie le COMPORTEMENT :
#   - base vierge : les 6 tables sont créées dans l'ordre de colonnes de la base,
#     RLS active (anon refusé, service_role accepté), clé étrangère et CHECK
#     actifs ; un rejeu ne change rien ;
#   - base à la forme réelle (objets créés hors du dépôt, autrement que par la
#     capture, avec données, RLS et politiques) : la capture n'y change RIEN
#     (catalogue, fichiers de table, droits, politiques, données) ;
#   - toute dérive de forme (dont politique hors service_role, index invalide,
#     trigger, triggers internes de la clé étrangère désactivés, règle) fait
#     échouer l'application, sans aucun effet partiel ;
#   - une fonction homonyme d'un builtin, placée dans public et en tête du
#     search_path de la session, n'est jamais appelée ;
#   - seules écritures possibles, épinglées : commentaire de colonne, RLS
#     désactivée et index absent sont ramenés à la forme capturée ;
#   - un état partiel (une partie seulement des 6 tables) est refusé avant toute
#     création, même quand les tables présentes sont conformes ;
#   - une lecture concurrente ne bloque pas la capture ; une écriture concurrente
#     la fait échouer, borné par lock_timeout ; une table supprimée pendant que la
#     capture attend un verrou la fait échouer, sans recréer la table vide ;
#   - le .down.sql n'a aucun effet ;
#   - les deux fichiers de types du dépôt décrivent exactement les colonnes
#     capturées (Row, Insert, Update, Relationships).
#
# Environnement : conteneur PostgreSQL jetable, sans réseau (même majeure que la
# PROD). Ne touche JAMAIS une base réelle : aucune variable de connexion Supabase
# n'est lue, l'hôte est un conteneur local créé et détruit ici.
#
# Usage   : bash scripts/db/test-video-capture-media-factory-schema.sh
# Mutation: MIGRATION_UNDER_TEST=<variante.sql> bash scripts/db/test-video-capture-media-factory-schema.sh
# Sortie  : 0 si toutes les assertions passent, 1 si une échoue, 2 si fatal.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGS="$ROOT/backend/supabase/migrations"
FIXTURE="$ROOT/scripts/db/video-capture-media-factory-schema-fixture.sql"
# Une mutation ne vise que la migration ; le rollback est toujours celui du dépôt.
MIGRATION="${MIGRATION_UNDER_TEST:-$MIGS/20261031_video_capture_media_factory_schema.sql}"
DOWN="$MIGS/20261031_video_capture_media_factory_schema.down.sql"
TYPES_BACKEND="$ROOT/backend/src/database/types/database.types.ts"
TYPES_PACKAGE="$ROOT/packages/database-types/src/supabase-generated.types.ts"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="video-capture-test-$$"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
command -v python3 >/dev/null || { echo "FATAL: python3 requis"; exit 2; }
for f in "$FIXTURE" "$MIGRATION" "$DOWN" "$TYPES_BACKEND" "$TYPES_PACKAGE"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done

TMP="$(mktemp -d)"
# Only remove the container created by this invocation and its anonymous data.
# --cidfile : la CLI y écrit l'ID dès la création, avant le démarrage. Un
# démarrage raté laisse ainsi un ID à nettoyer même si stdout n'en a rendu aucun ;
# une création ratée (nom déjà pris) n'en écrit aucun.
CT_ID=""
cleanup() {
  [[ -n "$CT_ID" ]] || CT_ID="$(cat "$TMP/cid" 2>/dev/null)"
  if [[ -n "$CT_ID" ]]; then docker rm -fv "$CT_ID" >/dev/null 2>&1 || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "Image     : $IMAGE"
echo "Migration : ${MIGRATION#"$ROOT"/}"
CT_ID="$(docker run -d --cidfile "$TMP/cid" --network none --memory 512m --memory-swap 512m --cpus 1 --pids-limit 128 --name "$CT" -e POSTGRES_PASSWORD=test "$IMAGE")" || exit 2
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
# new_db <nom> : base neuve, rôles et privilèges par défaut.
new_db() {
  docker exec "$CT" createdb -U postgres "$1" || { echo "FATAL: createdb $1"; exit 2; }
  DB=$1
  psql_db -f - < "$FIXTURE" >/dev/null || { echo "FATAL: fixture ($1)"; exit 2; }
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
# applied <libellé> <sortie> <code> : la capture passe ; sinon, montre pourquoi.
applied() {
  assert "$1" 0 "$3"
  [[ "$3" -eq 0 ]] || printf '%s\n' "$2" | tail -40 | sed 's/^/          /'
}

# Instantané du catalogue de public : relations (dont relfilenode, qui change à
# toute réécriture de table), colonnes, défauts, contraintes, index, séquences,
# droits, RLS, politiques, commentaires.
SNAP_SQL=$(cat <<'SQL'
SELECT x FROM (
  SELECT format('rel %s kind=%s file=%s acl=%s rls=%s force=%s comment=%s', c.relname, c.relkind,
                c.relfilenode, c.relacl, c.relrowsecurity, c.relforcerowsecurity,
                obj_description(c.oid, 'pg_class'))
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
TABLES="__video_execution_log __video_productions __video_variants __video_assets __video_audio_cache __video_templates"
TABLES_ARR="ARRAY['public.__video_execution_log', 'public.__video_productions', 'public.__video_variants', 'public.__video_assets', 'public.__video_audio_cache', 'public.__video_templates']::regclass[]"
# data_sql <tables…> : contenu des tables et position de leurs séquences.
data_sql() {
  local sql="SELECT x FROM (" t
  for t in "$@"; do
    [[ "$sql" == *SELECT\ \'data* ]] && sql+=" UNION ALL "
    sql+="SELECT 'data $t ' || count(*) || ' ' || md5(coalesce(string_agg(r::text, '|' ORDER BY r.id), '')) FROM public.$t r"
    sql+=" UNION ALL SELECT 'seq $t ' || last_value || ' ' || is_called FROM public.${t}_id_seq"
  done
  printf '%s' "$sql) AS s(x) ORDER BY x COLLATE \"C\""
}
# shellcheck disable=SC2086 # noms sans espace
DATA_SQL=$(data_sql $TABLES)
# snap <nom> [data] : instantané du catalogue (et des données) de la base courante.
snap() { { q "$SNAP_SQL"; if [[ ${2:-} == data ]]; then q "$DATA_SQL"; fi; } > "$TMP/$1"; }

EL=public.__video_execution_log
PROD=public.__video_productions
VAR=public.__video_variants
ASSETS=public.__video_assets
AUDIO=public.__video_audio_cache
TPL=public.__video_templates
COMMENT_RETRYABLE='P4.1.x: whether this failed execution can be retried'
# Ordre des colonnes relevé en base le 2026-10-31 (attnum), en lecture seule.
declare -A ORDER=(
  [__video_execution_log]="id,brief_id,video_type,vertical,gamme_alias,pg_id,status,bullmq_job_id,trigger_source,trigger_job_id,created_at,started_at,completed_at,artefact_check,gate_results,can_publish,quality_score,quality_flags,error_message,duration_ms,attempt_number,feature_flags,engine_name,engine_version,render_status,render_output_path,render_metadata,render_duration_ms,render_error_code,engine_resolution,retryable,is_canary,canary_fallback,canary_error_message,canary_error_code,tts_audio_url,tts_duration_secs,tts_cached,tts_cost_chars,postprocess_variants,postprocess_duration_ms,srt_s3_path,parent_brief_id,derivative_index,batch_id"
  [__video_productions]="id,brief_id,video_type,vertical,gamme_alias,pg_id,status,template_id,knowledge_contract,claim_table,evidence_pack,disclaimer_plan,approval_record,quality_score,quality_flags,gate_results,created_by,created_at,updated_at,script_text,script_generated_at,script_model,narrative_style_pack,derivative_policy,master_audio_url,tts_voice,tts_speed,parent_brief_id,derivative_index,content_role"
  [__video_variants]="id,execution_log_id,brief_id,variant_name,s3_path,codec,resolution,file_size_bytes,duration_secs,loudness_lufs,created_at"
  [__video_assets]="id,asset_key,visual_type,truth_dependency,tags,file_path,validated,validated_by,created_at"
  [__video_audio_cache]="id,cache_key,url,duration_secs,voice,speed,char_count,created_at"
  [__video_templates]="id,template_id,version,video_type,platform,allowed_use_cases,forbidden_use_cases,duration_range,structure,created_at"
)
# Droits mesurés en base le 2026-10-31 (défauts Supabase). Un rôle de lecture
# propre à la base partagée, en plus sur les tables, n'est pas reproduit ici.
SEQ_ACL='{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}'
TBL_ACL='{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'

echo "1. Base vierge : la capture crée les 6 tables"
new_db vierge
out=$(migrate "$MIGRATION"); rc=$?
applied "capture appliquée" "$out" "$rc"
assert "pré-condition : base vierge reconnue" oui \
  "$([[ "$out" == *"0 table(s) présente(s) sur 6"* ]] && echo oui || echo non)"
assert "6 tables créées" 6 "$(q "SELECT count(*) FROM pg_class WHERE oid = ANY ($TABLES_ARR)")"
for t in $TABLES; do
  assert "ordre des colonnes de $t = ordre en base" "${ORDER[$t]}" \
    "$(q "SELECT string_agg(attname, ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'public.$t'::regclass AND attnum > 0 AND NOT attisdropped")"
done
assert "droits des 6 séquences = ceux de la base" "$SEQ_ACL|$SEQ_ACL|$SEQ_ACL|$SEQ_ACL|$SEQ_ACL|$SEQ_ACL" \
  "$(q "SELECT string_agg(c.relacl::text, '|' ORDER BY c.relname) FROM unnest($TABLES_ARR) AS t JOIN pg_class c ON c.oid = pg_get_serial_sequence(t::text, 'id')::regclass")"
assert "droits des 6 tables = défauts de la base" "$TBL_ACL|$TBL_ACL|$TBL_ACL|$TBL_ACL|$TBL_ACL|$TBL_ACL" \
  "$(q "SELECT string_agg(relacl::text, '|' ORDER BY relname) FROM pg_class WHERE oid = ANY ($TABLES_ARR)")"
assert "RLS active, non forcée, sur les 6 tables" "6|0" \
  "$(q "SELECT count(*) FILTER (WHERE relrowsecurity) || '|' || count(*) FILTER (WHERE relforcerowsecurity) FROM pg_class WHERE oid = ANY ($TABLES_ARR)")"
assert "aucune politique créée" 0 "$(q "SELECT count(*) FROM pg_policy WHERE polrelid = ANY ($TABLES_ARR)")"
assert "quality_score nullable dans les 2 tables" "null|null" \
  "$(q "SELECT string_agg(CASE WHEN attnotnull THEN 'not null' ELSE 'null' END, '|' ORDER BY attrelid) FROM pg_attribute WHERE attrelid IN ('$EL'::regclass, '$PROD'::regclass) AND attname = 'quality_score'")"
out=$(q "SET ROLE anon; INSERT INTO $AUDIO (cache_key, url, voice, speed, char_count) VALUES ('k', 'u', 'v', 1, 1)" 2>&1); rc=$?
assert_err "anon : insertion refusée par la RLS" "row-level security" "$out" "$rc"
assert "anon : lecture vide" 0 "$(q "SET ROLE anon; SELECT count(*) FROM $EL")"
assert "service_role : insertion, défaut de status" "1|pending" \
  "$(q "SET ROLE service_role; INSERT INTO $EL (brief_id, video_type, vertical, trigger_source) VALUES ('b', 'short', 'v', 'manual') RETURNING id || '|' || status")"
out=$(q "INSERT INTO $VAR (execution_log_id, brief_id, variant_name, s3_path, codec, resolution) VALUES (999, 'b', 'n', 'p', 'c', 'r')" 2>&1); rc=$?
assert_err "clé étrangère active (variants → execution_log)" "__video_variants_execution_log_id_fkey" "$out" "$rc"
out=$(q "INSERT INTO $PROD (brief_id, video_type, vertical) VALUES ('b', 'teaser', 'v')" 2>&1); rc=$?
assert_err "CHECK actif (productions.video_type)" "__video_productions_video_type_check" "$out" "$rc"

echo
echo "2. Rejeu sur la base vierge : sans effet"
snap v0 data
out=$(migrate "$MIGRATION"); rc=$?
applied "rejeu sans erreur" "$out" "$rc"
snap v1 data
assert_same "catalogue, droits, politiques et données inchangés" v0 v1
# Le fichier fixe son search_path en tête : le rendu des défauts ne dépend pas de
# celui de la session qui applique.
out=$(docker exec -i -e PGOPTIONS='-c search_path=pg_catalog' "$CT" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" 2>&1); rc=$?
applied "rejeu avec search_path de session = pg_catalog" "$out" "$rc"
# Homonyme hostile d'un builtin appelé par la pré-condition, avec public avant
# pg_catalog dans le search_path de la session : pg_catalog reste en tête une fois
# le search_path du fichier posé, la fonction de public n'est jamais appelée.
q "CREATE FUNCTION public.to_regclass(text) RETURNS regclass LANGUAGE plpgsql AS \$\$BEGIN RAISE EXCEPTION 'fonction hostile appelée'; END\$\$" >/dev/null \
  || { echo "FATAL: fonction hostile non créée"; exit 2; }
snap v2 data
out=$(docker exec -i -e PGOPTIONS='-c search_path=public,pg_catalog' "$CT" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION" 2>&1); rc=$?
applied "rejeu avec search_path de session = public,pg_catalog et homonyme hostile" "$out" "$rc"
assert "homonyme hostile jamais appelé" non "$([[ "$out" == *"hostile"* ]] && echo oui || echo non)"
snap v3 data
assert_same "aucun effet" v2 v3
q "DROP FUNCTION public.to_regclass(text)" >/dev/null || { echo "FATAL: fonction hostile non retirée"; exit 2; }

echo
echo "3. Base à la forme réelle (objets créés hors du dépôt, avec données, RLS et politiques)"
new_db reelle
psql_db -v forme_reelle=1 -f - < "$FIXTURE" >/dev/null || { echo "FATAL: forme réelle"; exit 2; }
assert "données en place (execution_log, productions, variants, assets, audio_cache, templates)" "3|2|1|0|1|1" \
  "$(q "SELECT (SELECT count(*) FROM $EL) || '|' || (SELECT count(*) FROM $PROD) || '|' || (SELECT count(*) FROM $VAR) || '|' || (SELECT count(*) FROM $ASSETS) || '|' || (SELECT count(*) FROM $AUDIO) || '|' || (SELECT count(*) FROM $TPL)")"
assert "6 politiques service_role en place" 6 \
  "$(q "SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE '\_\_video\_%' AND roles = '{service_role}'")"
snap r0 data
out=$(migrate "$MIGRATION"); rc=$?
applied "capture appliquée" "$out" "$rc"
assert "pré-condition : les 6 tables reconnues" oui \
  "$([[ "$out" == *"6 table(s) présente(s) sur 6"* ]] && echo oui || echo non)"
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
derive "quality_score passée NOT NULL (execution_log)" \
  "ALTER TABLE $EL ALTER COLUMN quality_score SET NOT NULL" \
  "ALTER TABLE $EL ALTER COLUMN quality_score DROP NOT NULL"
derive "quality_score passée en bigint (productions)" \
  "ALTER TABLE $PROD ALTER COLUMN quality_score TYPE bigint" \
  "ALTER TABLE $PROD ALTER COLUMN quality_score TYPE integer"
derive "défaut de status modifié (execution_log)" \
  "ALTER TABLE $EL ALTER COLUMN status SET DEFAULT 'queued'" \
  "ALTER TABLE $EL ALTER COLUMN status SET DEFAULT 'pending'"
derive "numeric élargi (audio_cache.speed)" \
  "ALTER TABLE $AUDIO ALTER COLUMN speed TYPE numeric(4,2)" \
  "ALTER TABLE $AUDIO ALTER COLUMN speed TYPE numeric(3,2)"
derive "index en plus (templates)" \
  "CREATE INDEX drift_idx ON $TPL (platform)" \
  "DROP INDEX public.drift_idx"
derive "valeur de CHECK ajoutée (productions.video_type)" \
  "ALTER TABLE $PROD DROP CONSTRAINT __video_productions_video_type_check, ADD CONSTRAINT __video_productions_video_type_check CHECK (video_type IN ('film_socle', 'film_gamme', 'short', 'teaser'))" \
  "ALTER TABLE $PROD DROP CONSTRAINT __video_productions_video_type_check, ADD CONSTRAINT __video_productions_video_type_check CHECK (video_type IN ('film_socle', 'film_gamme', 'short'))"
derive "clé étrangère retirée (variants → execution_log)" \
  "ALTER TABLE $VAR DROP CONSTRAINT __video_variants_execution_log_id_fkey" \
  "ALTER TABLE $VAR ADD CONSTRAINT __video_variants_execution_log_id_fkey FOREIGN KEY (execution_log_id) REFERENCES $EL (id)"
derive "RLS forcée (assets)" \
  "ALTER TABLE $ASSETS FORCE ROW LEVEL SECURITY" \
  "ALTER TABLE $ASSETS NO FORCE ROW LEVEL SECURITY"
derive "colonne en plus (audio_cache)" \
  "ALTER TABLE $AUDIO ADD COLUMN drift integer" \
  "ALTER TABLE $AUDIO DROP COLUMN drift"
derive "séquence en cache 2 (variants)" \
  "ALTER SEQUENCE public.__video_variants_id_seq CACHE 2" \
  "ALTER SEQUENCE public.__video_variants_id_seq CACHE 1"
derive "commentaire posé sur une colonne non commentée (execution_log.brief_id)" \
  "COMMENT ON COLUMN $EL.brief_id IS 'derive'" \
  "COMMENT ON COLUMN $EL.brief_id IS NULL"
derive "commentaire posé sur une table (templates)" \
  "COMMENT ON TABLE $TPL IS 'derive'" \
  "COMMENT ON TABLE $TPL IS NULL"
derive "politique permissive pour anon (productions)" \
  "CREATE POLICY drift_pol ON $PROD FOR SELECT TO anon USING (true)" \
  "DROP POLICY drift_pol ON $PROD"
# Index homonyme laissé invalide par une création concurrente interrompue :
# simulé par le catalogue, seul moyen d'obtenir la même définition invalide.
derive "index homonyme invalide (execution_log.status)" \
  "UPDATE pg_index SET indisvalid = false WHERE indexrelid = 'public.idx_vel_status'::regclass" \
  "UPDATE pg_index SET indisvalid = true WHERE indexrelid = 'public.idx_vel_status'::regclass"
derive "trigger qui réécrit status (execution_log)" \
  "CREATE FUNCTION public.drift_fn() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN NEW.status := ''pending''; RETURN NEW; END'; CREATE TRIGGER drift_trg BEFORE UPDATE ON $EL FOR EACH ROW EXECUTE FUNCTION public.drift_fn()" \
  "DROP TRIGGER drift_trg ON $EL; DROP FUNCTION public.drift_fn()"
derive "règle sur DELETE (templates)" \
  "CREATE RULE drift_rule AS ON DELETE TO $TPL DO INSTEAD NOTHING" \
  "DROP RULE drift_rule ON $TPL"
# La contrainte reste au catalogue, mais ses triggers internes ne l'appliquent plus.
derive "triggers internes de la clé étrangère désactivés (variants)" \
  "ALTER TABLE $VAR DISABLE TRIGGER ALL" \
  "ALTER TABLE $VAR ENABLE TRIGGER ALL"
out=$(migrate "$MIGRATION"); rc=$?
applied "dérives retirées : la capture repasse" "$out" "$rc"
q "$DATA_SQL" > "$TMP/rdata2"
assert_same "données intactes après les 17 dérives" rdata rdata2

echo
echo "5. Seules écritures possibles : ramener commentaire, RLS et index à la forme capturée"
# La post-condition passe APRÈS COMMENT ON, ENABLE ROW LEVEL SECURITY et CREATE
# INDEX IF NOT EXISTS : ces trois écarts ne sont pas refusés, ils sont corrigés.
# Comportement épinglé ici, pas masqué.
q "COMMENT ON COLUMN $EL.retryable IS 'derive'" >/dev/null
q "ALTER TABLE $ASSETS DISABLE ROW LEVEL SECURITY" >/dev/null
q "DROP INDEX public.idx_vel_status" >/dev/null
out=$(migrate "$MIGRATION"); rc=$?
applied "capture appliquée" "$out" "$rc"
assert "commentaire ramené au texte capturé" "$COMMENT_RETRYABLE" \
  "$(q "SELECT col_description('$EL'::regclass, attnum) FROM pg_attribute WHERE attrelid = '$EL'::regclass AND attname = 'retryable'")"
assert "RLS réactivée (assets)" t "$(q "SELECT relrowsecurity FROM pg_class WHERE oid = '$ASSETS'::regclass")"
assert "index recréé à l'identique" "CREATE INDEX idx_vel_status ON public.__video_execution_log USING btree (status)" \
  "$(q "SELECT pg_get_indexdef('public.idx_vel_status'::regclass)")"
q "$DATA_SQL" > "$TMP/rdata3"
assert_same "données intactes" rdata rdata3

echo
echo "6. État partiel : refusé avant toute création"
new_db partielle
q "CREATE TABLE $AUDIO (id serial PRIMARY KEY, cache_key text NOT NULL, url text NOT NULL, duration_secs numeric(6,2), voice text NOT NULL, speed numeric(4,2) NOT NULL, char_count integer NOT NULL, created_at timestamptz DEFAULT now())" >/dev/null
snap p0
out=$(migrate "$MIGRATION"); rc=$?
assert_err "une seule table, de forme étrangère" "état partiel" "$out" "$rc"
snap p1
assert_same "catalogue inchangé" p0 p1
assert "les 5 autres tables non créées" 0 \
  "$(q "SELECT count(*) FROM unnest(ARRAY['$EL', '$PROD', '$VAR', '$ASSETS', '$TPL']) AS t WHERE to_regclass(t) IS NOT NULL")"
# Une table perdue parmi des tables conformes : la recréer vide masquerait la perte.
FIVE="__video_execution_log __video_variants __video_assets __video_audio_cache __video_templates"
new_db perte
psql_db -v forme_reelle=1 -f - < "$FIXTURE" >/dev/null || { echo "FATAL: forme réelle (perte)"; exit 2; }
q "DROP TABLE $PROD" >/dev/null || { echo "FATAL: productions non retirée"; exit 2; }
snap p2
# shellcheck disable=SC2086 # noms sans espace
q "$(data_sql $FIVE)" > "$TMP/p2data"
out=$(migrate "$MIGRATION"); rc=$?
assert_err "5 tables conformes, avec données, productions absente" "état partiel" "$out" "$rc"
snap p3
assert_same "catalogue inchangé" p2 p3
# shellcheck disable=SC2086 # noms sans espace
q "$(data_sql $FIVE)" > "$TMP/p3data"
assert_same "données des 5 tables inchangées" p2data p3data
assert "productions non recréée" "" "$(q "SELECT to_regclass('$PROD')")"

echo
echo "7. Accès concurrents"
DB=reelle
# hold <SQL> [table] [secondes] : une session de la base courante tient le verrou
# du SQL sur la table (__video_execution_log par défaut) pendant 12 s par défaut ;
# rend la main quand le verrou est accordé et la session endormie.
hold() {
  local rel=${2:-$EL}
  docker exec -i "$CT" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -qtA >"$TMP/hold" 2>&1 <<SQL &
BEGIN;
$1;
SELECT pg_sleep(${3:-12});
ROLLBACK;
SQL
  HOLDER=$!
  local held=0
  for _ in $(seq 1 50); do
    held=$(q "SELECT count(*) FROM pg_stat_activity a WHERE a.wait_event = 'PgSleep' AND EXISTS (SELECT 1 FROM pg_locks l WHERE l.pid = a.pid AND l.relation = '$rel'::regclass AND l.granted)")
    [[ "$held" == 1 ]] && return 0
    sleep 0.1
  done
  echo "FATAL: la session concurrente n'a pas pris son verrou"; wait "$HOLDER"; exit 2
}
# Lecture (ACCESS SHARE) : compatible avec le SHARE ROW EXCLUSIVE que la
# pré-condition prend sur __video_execution_log ; ENABLE ROW LEVEL SECURITY n'est
# pas exécuté, la RLS étant active.
hold "SELECT count(*) FROM $EL"
snap l0 data
t0=$(date +%s)
out=$(migrate "$MIGRATION"); rc=$?
elapsed=$(( $(date +%s) - t0 ))
applied "lecture concurrente : capture appliquée" "$out" "$rc"
alive=$(kill -0 "$HOLDER" 2>/dev/null && echo oui || echo non)
assert "rendue pendant la lecture concurrente" oui "$alive"
assert "sans attendre lock_timeout (au plus 3 s)" oui "$( (( elapsed <= 3 )) && echo oui || echo "non (${elapsed} s)")"
snap l1 data
assert_same "aucun effet" l0 l1
wait "$HOLDER"
# Écriture (ROW EXCLUSIVE) : en conflit avec le SHARE ROW EXCLUSIVE de la pré-condition.
hold "UPDATE $EL SET status = status WHERE false"
snap l2 data
t0=$(date +%s)
out=$(migrate "$MIGRATION"); rc=$?
elapsed=$(( $(date +%s) - t0 ))
assert_err "écriture concurrente : capture refusée" "lock timeout" "$out" "$rc"
alive=$(kill -0 "$HOLDER" 2>/dev/null && echo oui || echo non)
assert "rendue pendant l'écriture concurrente (pas après)" oui "$alive"
assert "attente bornée (4 à 8 s pour lock_timeout = 5s)" oui "$( (( elapsed >= 4 && elapsed <= 8 )) && echo oui || echo "non (${elapsed} s)")"
wait "$HOLDER"
snap l3 data
assert_same "aucun effet" l2 l3
# Suppression concurrente : la pré-condition a vu les 6 tables, puis attend son
# verrou sur productions (écriture tenue 4 s) pendant qu'une autre session
# supprime templates. Le LOCK de templates échoue : la table n'est pas recréée vide.
new_db course
psql_db -v forme_reelle=1 -f - < "$FIXTURE" >/dev/null || { echo "FATAL: forme réelle (course)"; exit 2; }
FIVE_NO_TPL="__video_execution_log __video_productions __video_variants __video_assets __video_audio_cache"
# shellcheck disable=SC2086 # noms sans espace
q "$(data_sql $FIVE_NO_TPL)" > "$TMP/c0data"
hold "UPDATE $PROD SET status = status WHERE false" "$PROD" 4
migrate "$MIGRATION" > "$TMP/course" &
MIG=$!
waiting=0
for _ in $(seq 1 30); do
  waiting=$(q "SELECT count(*) FROM pg_stat_activity WHERE datname = 'course' AND wait_event_type = 'Lock'")
  [[ "$waiting" == 1 ]] && break
  sleep 0.1
done
[[ "$waiting" == 1 ]] || { echo "FATAL: la capture n'attend pas le verrou de productions"; wait "$MIG"; wait "$HOLDER"; exit 2; }
q "DROP TABLE $TPL" >/dev/null || { echo "FATAL: templates non supprimée"; exit 2; }
wait "$MIG"; rc=$?
wait "$HOLDER"
assert_err "table supprimée pendant l'attente : capture refusée" "does not exist" "$(cat "$TMP/course")" "$rc"
assert "templates non recréée" "" "$(q "SELECT to_regclass('$TPL')")"
# shellcheck disable=SC2086 # noms sans espace
q "$(data_sql $FIVE_NO_TPL)" > "$TMP/c1data"
assert_same "données des 5 autres tables inchangées" c0data c1data
DB=reelle

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
echo "9. Types : les deux fichiers du dépôt décrivent les colonnes capturées"
DB=vierge
# Colonnes (type, NOT NULL, défaut) et clés étrangères des 6 tables créées par la
# capture, confrontées aux blocs Row / Insert / Update / Relationships.
q "SELECT format('col|%s|%s|%s|%s|%s', c.relname, a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull, a.atthasdef)
     FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.oid = ANY ($TABLES_ARR) AND a.attnum > 0 AND NOT a.attisdropped
   UNION ALL
   SELECT format('fk|%s|%s|%s|%s|%s|%s', c.relname, k.conname,
            (SELECT string_agg(a.attname, ',' ORDER BY u.o) FROM unnest(k.conkey) WITH ORDINALITY AS u(n, o)
               JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.n),
            k.confrelid::regclass,
            (SELECT string_agg(a.attname, ',' ORDER BY u.o) FROM unnest(k.confkey) WITH ORDINALITY AS u(n, o)
               JOIN pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = u.n),
            EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = k.conrelid AND i.indisunique
                       AND i.indkey::int2[] = k.conkey))
     FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
    WHERE k.contype = 'f' AND k.conrelid = ANY ($TABLES_ARR)" > "$TMP/catalog"
assert "catalogue relevé : 113 colonnes, 1 clé étrangère" "113|1" \
  "$(echo "$(grep -c '^col|' "$TMP/catalog")|$(grep -c '^fk|' "$TMP/catalog")")"
# Rendu de supabase gen types pour les types présents ; int4range sort en
# `unknown`, qui absorbe `| null`.
TYPES_PY=$(cat <<'PY'
import re, sys
catalog, path = sys.argv[1], sys.argv[2]
cols, fks = {}, {}
for line in open(catalog, encoding="utf-8"):
    p = line.rstrip("\n").split("|")
    if p[0] == "col":
        cols.setdefault(p[1], {})[p[2]] = (p[3], p[4] == "t", p[5] == "t")
    elif p[0] == "fk":
        fks.setdefault(p[1], []).append((p[2], p[3].split(","), p[6] == "t", p[4], p[5].split(",")))
TS = {"integer": "number", "bigint": "number", "numeric": "number", "text": "string",
      "character varying": "string", "timestamp with time zone": "string",
      "boolean": "boolean", "jsonb": "Json", "int4range": "unknown"}
def ts(pg):
    return ts(pg[:-2]) + "[]" if pg.endswith("[]") else TS[pg.split("(")[0]]
src = open(path, encoding="utf-8").read()
errors = []
for t in sorted(cols):
    blocks = re.findall(r"\n      %s: \{\n(.*?)\n      \};?\n" % re.escape(t), src, re.S)
    if len(blocks) != 1:
        errors.append(f"{t} : {len(blocks)} bloc(s)")
        continue
    block = blocks[0]
    for part in ("Row", "Insert", "Update"):
        m = re.search(r"        %s: \{\n(.*?)\n        \};?\n" % part, block + "\n", re.S)
        got = {}
        for l in (m.group(1).split("\n") if m else []):
            f = re.fullmatch(r"\s+(\w+)(\??): (.+?);?", l)
            got[f.group(1)] = (f.group(2) == "?", f.group(3))
        want = {}
        for c, (pg, notnull, hasdef) in cols[t].items():
            base = ts(pg)
            typ = base if base == "unknown" or notnull else base + " | null"
            want[c] = ({"Row": False, "Insert": not notnull or hasdef, "Update": True}[part], typ)
        for c in sorted(set(got) | set(want)):
            if got.get(c) != want.get(c):
                errors.append(f"{t}.{part}.{c} : fichier {got.get(c)}, schéma {want.get(c)}")
    rels = block.split("Relationships: [", 1)[1] if "Relationships: [" in block else None
    if rels is None:
        errors.append(f"{t} : Relationships absent")
        continue
    lst = lambda s: [x.strip(" '\"") for x in s.split(",") if x.strip()]
    got = sorted((n, lst(c), o == "true", r, lst(rc)) for n, c, o, r, rc in re.findall(
        r"foreignKeyName: ['\"]([^'\"]+)['\"];?\s+columns: \[([^\]]*)\];?\s+isOneToOne: (true|false);?\s+"
        r"referencedRelation: ['\"]([^'\"]+)['\"];?\s+referencedColumns: \[([^\]]*)\]", rels))
    if got != sorted(fks.get(t, [])):
        errors.append(f"{t}.Relationships : fichier {got}, schéma {sorted(fks.get(t, []))}")
print("\n".join(errors) if errors else "OK")
PY
)
for f in "$TYPES_BACKEND" "$TYPES_PACKAGE"; do
  assert "${f#"$ROOT"/} : Row, Insert, Update, Relationships" OK "$(python3 -I -c "$TYPES_PY" "$TMP/catalog" "$f" 2>&1)"
done

echo
echo "Résultat : $pass PASS, $fail FAIL"
[[ $fail -eq 0 ]] || exit 1
