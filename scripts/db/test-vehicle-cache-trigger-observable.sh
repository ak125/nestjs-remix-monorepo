#!/usr/bin/env bash
# =============================================================================
# Test de comportement de 20260924_vehicle_cache_trigger_rebuild_failure_observable.sql
#
# Prouve le défaut PUIS sa correction :
#   1. AVANT (corps live verbatim, installé depuis le .down.sql et vérifié par
#      md5(prosrc) contre la base live) : un rebuild en EXCEPTION ou qui renvoie
#      FALSE laisse un type affichable SANS ligne de cache et n'écrit RIEN.
#   2. APRÈS : même activation, toujours non bloquante, mais un événement
#      anomaly_detected / alert_kind='vehicle_page_cache_trigger_rebuild_failed'
#      est écrit (exception ET payload NULL), avec reason/source/count lisibles
#      par rpc_seo_alerts_v1 (source B).
#   3. Dédup sur événements ouverts < 7 j, isolation par type_id, auto-résolution
#      au rebuild réussi suivant.
#   4. Activation en masse : un type en échec ne bloque pas les autres.
#   5. Atomicité : une activation annulée n'écrit aucun événement.
#   6. Refus (fail-closed) : si l'événement ne peut pas être écrit, l'activation
#      échoue avec les deux messages — aucun chemin muet.
#   7. Invariants « non touchés » VERROUILLÉS : condition de déclenchement
#      (2 -> 1 et INSERT 0 ne reconstruisent pas), UPDATE d'une autre colonne
#      ne déclenche pas, droits, search_path, idempotence, rollback verbatim.
#
# rebuild_vehicle_page_cache est remplacée par un DOUBLE de test pilotable
# (ok / null / raise) : la migration ne touche QUE le corps du trigger, c'est
# lui qu'on éprouve. La vraie fonction (inchangée) dépend de tout le catalogue.
#
# Environnement : conteneur PostgreSQL jetable (même majeure que la PROD), sans
# réseau (--network none) et sans écoute TCP : psql passe par le socket local.
# Ne lit aucune variable de connexion Supabase, ne touche aucune base réelle.
#
# Usage : bash scripts/db/test-vehicle-cache-trigger-observable.sh
# Sortie : 0 si toutes les assertions passent.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# MIGRATION_UNDER_TEST permet le test de mutation (pointer une copie altérée)
# sans toucher au fichier du dépôt. Par défaut : la migration réelle.
MIGRATION="${MIGRATION_UNDER_TEST:-$ROOT/backend/supabase/migrations/20260924_vehicle_cache_trigger_rebuild_failure_observable.sql}"
DOWN="$ROOT/backend/supabase/migrations/20260924_vehicle_cache_trigger_rebuild_failure_observable.down.sql"
# Empreinte du corps live lue le 2026-09-24 (pg_get_functiondef, lecture seule).
LIVE_PROSRC_MD5="44ce0363e9a0fd31919c6d0bb0bc56db"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="vehicle-cache-trg-test-$$"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
for f in "$MIGRATION" "$DOWN"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done

cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; }
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
# exec_sql <sql> → code retour de psql, sortie (stdout+stderr) dans $LAST_OUT
exec_sql() {
  LAST_OUT=$(docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -tAq -c "$1" 2>&1)
  return $?
}

pass=0; fail=0
assert() { # assert <libelle> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  PASS  $1 → $3"; pass=$((pass+1));
  else echo "  FAIL  $1 → obtenu '$3', attendu '$2'"; fail=$((fail+1)); fi
}
assert_contains() { # assert_contains <libelle> <motif> <texte>
  if [[ "$3" == *"$2"* ]]; then echo "  PASS  $1 → contient « $2 »"; pass=$((pass+1));
  else echo "  FAIL  $1 → « $2 » absent de : $3"; fail=$((fail+1)); fi
}

apply() { # apply <fichier> <libelle> — transaction unique, comme le runner
  if docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$1"; then
    echo "  ok  $2"
  else
    echo "  FAIL  $2 en échec"; fail=$((fail+1))
  fi
}

KIND=vehicle_page_cache_trigger_rebuild_failed
seed()      { q "INSERT INTO public.auto_type (type_id, type_modele_id, type_display) VALUES ('$1', '10', '$2')" >/dev/null; }
mode()      { q "INSERT INTO public._t_rebuild_mode (type_id, mode) VALUES ($1, '$2') ON CONFLICT (type_id) DO UPDATE SET mode = EXCLUDED.mode" >/dev/null; }
display()   { q "SELECT type_display FROM public.auto_type WHERE type_id = '$1'"; }
cache_row() { q "SELECT count(*) FROM public.__vehicle_page_cache WHERE type_id = $1"; }
calls()     { q "SELECT count(*) FROM public._t_rebuild_calls WHERE type_id = $1"; }
n_ev()      { q "SELECT count(*) FROM public.__seo_event_log WHERE payload->>'alert_kind' = '$KIND' AND (payload->>'type_id')::int = $1"; }
n_open()    { q "SELECT count(*) FROM public.__seo_event_log WHERE payload->>'alert_kind' = '$KIND' AND (payload->>'type_id')::int = $1 AND resolved_at IS NULL"; }
n_all_ev()  { q "SELECT count(*) FROM public.__seo_event_log"; }
ev()        { q "SELECT payload->>'$2' FROM public.__seo_event_log WHERE payload->>'alert_kind' = '$KIND' AND (payload->>'type_id')::int = $1 ORDER BY created_at DESC LIMIT 1"; }
ev_json()   { q "SELECT payload->'$2' FROM public.__seo_event_log WHERE payload->>'alert_kind' = '$KIND' AND (payload->>'type_id')::int = $1 ORDER BY created_at DESC LIMIT 1"; }
prosrc_md5(){ q "SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.trg_auto_type_rebuild_cache()'::regprocedure"; }
proconfig() { q "SELECT array_to_string(proconfig, ',') FROM pg_proc WHERE oid = 'public.trg_auto_type_rebuild_cache()'::regprocedure"; }
can_exec()  { q "SELECT has_function_privilege('$1', 'public.trg_auto_type_rebuild_cache()', 'EXECUTE')"; }
activate()  { exec_sql "UPDATE public.auto_type SET type_display = '1' WHERE type_id = '$1'"; }
deactivate(){ q "UPDATE public.auto_type SET type_display = '0' WHERE type_id = '$1'" >/dev/null; }

echo "=== Fixture (rôles Supabase, puits, cache, auto_type, double de rebuild) ==="
psql_file -f - <<'SQL' || { echo "FATAL: fixture en échec"; exit 2; }
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
-- Comme sur Supabase : les nouvelles fonctions sont exécutables par tous
-- (PUBLIC) tant qu'on ne révoque pas — c'est ce que les REVOKE doivent fermer.

CREATE TYPE public.seo_event_type AS ENUM ('anomaly_detected', 'alert_sent', 'ingestion_run_failed');
CREATE TYPE public.seo_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');

-- Miroir de 20260425_seo_event_log.sql (colonnes) + index GIN live.
CREATE TABLE public.__seo_event_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  public.seo_event_type NOT NULL,
  entity_url  TEXT,
  severity    public.seo_severity NOT NULL DEFAULT 'info',
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ack_at      TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_seo_event_log_payload_gin ON public.__seo_event_log USING gin (payload);

-- Miroir de 20260420_vehicle_page_cache_schema.sql.
CREATE TABLE public.__vehicle_page_cache (
  type_id      INTEGER PRIMARY KEY,
  payload      JSONB NOT NULL,
  source_hash  TEXT NOT NULL,
  built_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  stale        BOOLEAN NOT NULL DEFAULT FALSE,
  stale_reason TEXT
);

-- Colonnes de auto_type lues par le trigger (types live : text).
CREATE TABLE public.auto_type (
  type_id        TEXT PRIMARY KEY,
  type_modele_id TEXT,
  type_display   TEXT
);

-- Double de test de rebuild_vehicle_page_cache(integer) RETURNS boolean,
-- même signature que la live. Modes : ok (upsert, TRUE), null (supprime la
-- ligne, FALSE — comme la live quand build_vehicle_page_payload renvoie NULL),
-- raise (exception).
CREATE TABLE public._t_rebuild_mode  (type_id INTEGER PRIMARY KEY, mode TEXT NOT NULL);
CREATE TABLE public._t_rebuild_calls (type_id INTEGER NOT NULL);
CREATE FUNCTION public.rebuild_vehicle_page_cache(p_type_id integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_mode TEXT;
BEGIN
  INSERT INTO _t_rebuild_calls (type_id) VALUES (p_type_id);
  SELECT mode INTO v_mode FROM _t_rebuild_mode WHERE type_id = p_type_id;
  v_mode := COALESCE(v_mode, 'ok');
  IF v_mode = 'raise' THEN
    RAISE EXCEPTION 'stub: build impossible pour %', p_type_id USING ERRCODE = 'XX000';
  END IF;
  IF v_mode = 'null' THEN
    DELETE FROM __vehicle_page_cache WHERE type_id = p_type_id;
    RETURN FALSE;
  END IF;
  INSERT INTO __vehicle_page_cache (type_id, payload, source_hash, built_at, stale)
  VALUES (p_type_id, '{}'::jsonb, 'h', now(), FALSE)
  ON CONFLICT (type_id) DO UPDATE SET built_at = now(), stale = FALSE;
  RETURN TRUE;
END;
$$;
SQL
echo "ok"; echo

echo "=== État AVANT : corps live verbatim (installé depuis le .down.sql) ==="
apply "$DOWN" "corps live installé"
psql_file -c "CREATE TRIGGER trg_auto_type_rebuild_cache AFTER INSERT OR UPDATE OF type_display ON public.auto_type FOR EACH ROW EXECUTE FUNCTION public.trg_auto_type_rebuild_cache();" \
  || { echo "FATAL: trigger"; exit 2; }
assert "md5(prosrc) du .down.sql = corps live du 2026-09-24" "$LIVE_PROSRC_MD5" "$(prosrc_md5)"
assert "search_path live" "search_path=public" "$(proconfig)"

seed 1001 0; mode 1001 raise
activate 1001; assert "AVANT exception : l'activation passe" "0" "$?"
assert "AVANT exception : type affichable" "1" "$(display 1001)"
assert "AVANT exception : aucune ligne de cache" "0" "$(cache_row 1001)"
assert "AVANT exception : AUCUN événement (défaut)" "0" "$(n_all_ev)"

seed 1002 0; mode 1002 null
activate 1002; assert "AVANT payload NULL : l'activation passe" "0" "$?"
assert "AVANT payload NULL : aucune ligne de cache" "0" "$(cache_row 1002)"
assert "AVANT payload NULL : AUCUN événement (défaut)" "0" "$(n_all_ev)"
assert "AVANT payload NULL : aucun WARNING non plus" "" "$(grep -o 'WARNING' <<< "$LAST_OUT")"
echo

echo "=== Migration 20260924 ==="
apply "$MIGRATION" "migration appliquée (transaction unique)"
assert "search_path épinglé vide" "search_path=\"\"" "$(proconfig)"
assert "SECURITY DEFINER conservé" "t" "$(q "SELECT prosecdef FROM pg_proc WHERE oid = 'public.trg_auto_type_rebuild_cache()'::regprocedure")"
assert "EXECUTE anon révoqué" "f" "$(can_exec anon)"
assert "EXECUTE authenticated révoqué" "f" "$(can_exec authenticated)"
assert "EXECUTE service_role accordé" "t" "$(can_exec service_role)"
assert "trigger inchangé (seul trigger, même définition)" \
  "CREATE TRIGGER trg_auto_type_rebuild_cache AFTER INSERT OR UPDATE OF type_display ON public.auto_type FOR EACH ROW EXECUTE FUNCTION trg_auto_type_rebuild_cache()" \
  "$(q "SELECT string_agg(pg_get_triggerdef(oid), ' | ') FROM pg_trigger WHERE tgrelid = 'public.auto_type'::regclass AND NOT tgisinternal")"
echo

echo "=== APRÈS : exception du rebuild ==="
seed 2001 0; mode 2001 raise
activate 2001; assert "exception : l'activation passe (non bloquant)" "0" "$?"
assert_contains "exception : WARNING conservé" "INC-2026-007" "$LAST_OUT"
assert "exception : type affichable" "1" "$(display 2001)"
assert "exception : aucune ligne de cache" "0" "$(cache_row 2001)"
assert "exception : 1 événement ouvert" "1" "$(n_open 2001)"
assert "exception : event_type" "anomaly_detected" "$(q "SELECT event_type FROM public.__seo_event_log WHERE (payload->>'type_id')::int = 2001")"
assert "exception : sévérité" "high" "$(q "SELECT severity FROM public.__seo_event_log WHERE (payload->>'type_id')::int = 2001")"
assert "exception : entity_url NULL (aucune URL inventée)" "t" "$(q "SELECT entity_url IS NULL FROM public.__seo_event_log WHERE (payload->>'type_id')::int = 2001")"
assert "exception : outcome" "exception" "$(ev 2001 outcome)"
assert "exception : sqlstate" "XX000" "$(ev 2001 sqlstate)"
assert_contains "exception : message d'origine" "stub: build impossible pour 2001" "$(ev 2001 error)"
assert "exception : source" "trg_auto_type_rebuild_cache" "$(ev 2001 source)"
assert "exception : count" "1" "$(ev 2001 count)"
assert "exception : tg_op" "UPDATE" "$(ev 2001 tg_op)"
assert "exception : old_type_display" "0" "$(ev 2001 old_type_display)"
assert "exception : new_type_display" "1" "$(ev 2001 new_type_display)"
assert_contains "exception : reason lisible" "Type 2001 rendu affichable" "$(ev 2001 reason)"
assert_contains "exception : hint de reprise" "rebuild_vehicle_page_cache(2001)" "$(ev 2001 hint)"
# Projection exacte de rpc_seo_alerts_v1, source B (live, lue le 2026-09-24).
assert "rpc_seo_alerts_v1 source B : l'événement est collecté" "1" \
  "$(q "SELECT count(*) FROM public.__seo_event_log WHERE resolved_at IS NULL AND severity IN ('critical','high') AND event_type IN ('anomaly_detected','alert_sent','ingestion_run_failed') AND (payload->>'type_id')::int = 2001")"
assert "rpc_seo_alerts_v1 source B : payload_minimal non vide (reason, source, count)" "count,reason,source" \
  "$(q "SELECT string_agg(k, ',' ORDER BY k) FROM public.__seo_event_log, jsonb_object_keys(jsonb_strip_nulls(jsonb_build_object('reason', payload->>'reason', 'source', payload->>'source', 'count', payload->'count'))) k WHERE (payload->>'type_id')::int = 2001")"
echo

echo "=== APRÈS : payload NULL (rebuild renvoie FALSE) ==="
seed 2002 0; mode 2002 null
activate 2002; assert "payload NULL : l'activation passe" "0" "$?"
assert "payload NULL : aucune ligne de cache" "0" "$(cache_row 2002)"
assert "payload NULL : 1 événement ouvert" "1" "$(n_open 2002)"
assert "payload NULL : outcome" "payload_null" "$(ev 2002 outcome)"
assert "payload NULL : error JSON null" "null" "$(ev_json 2002 error)"
assert_contains "payload NULL : reason" "payload_null : payload NULL" "$(ev 2002 reason)"
echo

echo "=== Dédup sur événements ouverts < 7 j ==="
deactivate 2001; activate 2001
assert "ré-activation en échec : toujours 1 événement pour 2001" "1" "$(n_ev 2001)"
q "UPDATE public.__seo_event_log SET created_at = now() - INTERVAL '8 days' WHERE (payload->>'type_id')::int = 2002" >/dev/null
deactivate 2002; activate 2002
assert "événement ouvert de plus de 7 j : un nouvel événement est écrit" "2" "$(n_open 2002)"
echo

echo "=== Auto-résolution au rebuild réussi suivant ==="
mode 2001 ok
deactivate 2001; activate 2001; assert "rebuild réussi : l'activation passe" "0" "$?"
assert "rebuild réussi : ligne de cache présente" "1" "$(cache_row 2001)"
assert "rebuild réussi : 0 événement ouvert pour 2001" "0" "$(n_open 2001)"
assert "rebuild réussi : l'événement est conservé (fait observé)" "1" "$(n_ev 2001)"
assert "rebuild réussi : resolution_kind" "trigger_rebuild_succeeded" "$(ev 2001 resolution_kind)"
assert "rebuild réussi : isolation — 2002 reste ouvert" "2" "$(n_open 2002)"
echo

echo "=== Chemin nominal : aucun événement ==="
seed 2003 0
before=$(n_all_ev)
activate 2003; assert "succès : l'activation passe" "0" "$?"
assert "succès : ligne de cache" "1" "$(cache_row 2003)"
assert "succès : aucun événement écrit" "$before" "$(n_all_ev)"
echo

echo "=== INSERT ==="
mode 2004 raise
exec_sql "INSERT INTO public.auto_type (type_id, type_modele_id, type_display) VALUES ('2004', '10', '1')"
assert "INSERT display=1 en échec : l'insertion passe" "0" "$?"
assert "INSERT : 1 événement ouvert" "1" "$(n_open 2004)"
assert "INSERT : tg_op" "INSERT" "$(ev 2004 tg_op)"
assert "INSERT : old_type_display JSON null" "null" "$(ev_json 2004 old_type_display)"
seed 2006 0
assert "INSERT display=0 : aucun rebuild (condition inchangée)" "0" "$(calls 2006)"
echo

echo "=== Condition de déclenchement inchangée (bit pour bit) ==="
seed 2005 2
activate 2005
assert "2 -> 1 : aucun rebuild (comportement live conservé)" "0" "$(calls 2005)"
assert "2 -> 1 : aucun événement" "0" "$(n_ev 2005)"
seed 2007 0
q "UPDATE public.auto_type SET type_modele_id = '11' WHERE type_id = '2007'" >/dev/null
assert "UPDATE d'une autre colonne : trigger non déclenché" "0" "$(calls 2007)"
echo

echo "=== Activation en masse ==="
seed 2101 0; seed 2102 0; seed 2103 0; mode 2102 raise
exec_sql "UPDATE public.auto_type SET type_display = '1' WHERE type_id IN ('2101','2102','2103')"
assert "masse : l'instruction passe malgré un échec" "0" "$?"
assert "masse : 3 types affichables" "3" "$(q "SELECT count(*) FROM public.auto_type WHERE type_id IN ('2101','2102','2103') AND type_display = '1'")"
assert "masse : cache 2101" "1" "$(cache_row 2101)"
assert "masse : cache 2103" "1" "$(cache_row 2103)"
assert "masse : pas de cache 2102" "0" "$(cache_row 2102)"
assert "masse : événement pour 2102 seulement" "1|0|0" "$(n_open 2102)|$(n_ev 2101)|$(n_ev 2103)"
echo

echo "=== Atomicité : activation annulée ==="
seed 2201 0; mode 2201 raise
exec_sql "BEGIN; UPDATE public.auto_type SET type_display = '1' WHERE type_id = '2201'; ROLLBACK;"
assert "annulée : type non affichable" "0" "$(display 2201)"
assert "annulée : aucun événement persistant" "0" "$(n_ev 2201)"
echo

echo "=== Refus si le puits est indisponible (pas de repli silencieux) ==="
psql_file -f - <<'SQL' || { echo "FATAL: panne simulée"; exit 2; }
CREATE FUNCTION public._t_sink_down() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'puits simulé hors service'; END; $$;
CREATE TRIGGER _t_sink_down BEFORE INSERT ON public.__seo_event_log
  FOR EACH ROW EXECUTE FUNCTION public._t_sink_down();
SQL
seed 2301 0; mode 2301 raise
activate 2301; rc=$?
assert "puits en panne + rebuild en échec : l'activation est REFUSÉE" "1" "$([[ $rc -ne 0 ]] && echo 1 || echo 0)"
assert_contains "refus : message explicite" "NON enregistrable" "$LAST_OUT"
assert_contains "refus : cause du puits" "puits simulé hors service" "$LAST_OUT"
assert_contains "refus : cause du rebuild" "stub: build impossible pour 2301" "$LAST_OUT"
assert "refus : le type reste non affichable" "0" "$(display 2301)"
seed 2302 0
activate 2302
assert "puits en panne + rebuild réussi : l'activation passe" "0" "$?"
assert "puits en panne + rebuild réussi : cache présent" "1" "$(cache_row 2302)"
psql_file -c "DROP TRIGGER _t_sink_down ON public.__seo_event_log; DROP FUNCTION public._t_sink_down();" \
  || { echo "FATAL: nettoyage panne simulée"; exit 2; }
echo

echo "=== Idempotence ==="
md5_first=$(prosrc_md5)
apply "$MIGRATION" "migration ré-appliquée"
assert "corps stable après ré-application" "$md5_first" "$(prosrc_md5)"
echo

echo "=== Rollback (.down.sql) ==="
apply "$DOWN" "rollback appliqué"
assert "rollback : corps live verbatim" "$LIVE_PROSRC_MD5" "$(prosrc_md5)"
assert "rollback : search_path live" "search_path=public" "$(proconfig)"
assert "rollback : commentaire live" \
  "INC-2026-007 Etape 3: pre-rebuild __vehicle_page_cache des qu'un type est insere ou active." \
  "$(q "SELECT obj_description('public.trg_auto_type_rebuild_cache()'::regprocedure, 'pg_proc')")"
assert "rollback : EXECUTE anon révoqué" "f" "$(can_exec anon)"
assert "rollback : EXECUTE service_role accordé" "t" "$(can_exec service_role)"
seed 2401 0; mode 2401 raise
before=$(n_all_ev)
activate 2401
assert "rollback : l'échec redevient muet (preuve que le test voit le défaut)" "$before" "$(n_all_ev)"
echo

echo "Résultat : $pass réussi(s), $fail échec(s)."
[[ $fail -eq 0 ]]
