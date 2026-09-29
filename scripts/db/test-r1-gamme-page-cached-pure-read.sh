#!/usr/bin/env bash
# =============================================================================
# Test de comportement de 20260929_r1_gamme_page_cached_pure_read.sql
#
# Prouve le défaut PUIS sa correction, dans le contexte où il se produit :
# PostgREST exécute une fonction STABLE en transaction READ ONLY.
#   1. AVANT (corps live verbatim, installé depuis le .down.sql et vérifié par
#      md5(prosrc) contre la base live) : un cache absent (payload construit ou
#      NULL) ou périmé lève 25006 en transaction READ ONLY ; un cache présent
#      est servi.
#   2. APRÈS : cache absent -> payload du builder, NULL si le builder renvoie
#      NULL ; cache périmé -> payload reconstruit ; cache présent -> ligne
#      stockée ; AUCUNE écriture dans __gamme_page_cache ; même chemin sous le
#      rôle anon (PREPROD READ_ONLY) grâce à SECURITY DEFINER.
#   3. Invariants VERROUILLÉS : STABLE, DEFINER, search_path, ACL identique à la
#      base live, commentaire, idempotence, rebuild_gamme_page_cache toujours
#      écrivain pour les rôles autorisés.
#   4. Les gardes de la migration sont VIVANTES (mutations) : un builder
#      VOLATILE est refusé au precheck ; un corps qui écrit par un détour que
#      l'analyse statique ne voit pas est refusé par la sonde READ ONLY ; un
#      changement d'ACL est refusé.
#   5. Rollback : corps live verbatim, commentaire NULL, et 25006 revient
#      (preuve que le test voit le défaut).
#
# build_gamme_page_payload est remplacée par un DOUBLE de test (payload lu dans
# une table de fixture) : la migration ne touche QUE get_gamme_page_data_cached.
# rebuild_gamme_page_cache est installée avec son corps live verbatim (vérifié
# par md5) : c'est elle qui écrit, donc c'est elle qui déclenche 25006 AVANT.
#
# Environnement : conteneur PostgreSQL jetable (même majeure que la PROD), sans
# réseau (--network none) et sans écoute TCP : psql passe par le socket local.
# Ne lit aucune variable de connexion Supabase, ne touche aucune base réelle.
#
# Usage : bash scripts/db/test-r1-gamme-page-cached-pure-read.sh
# Sortie : 0 si toutes les assertions passent.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATION="$ROOT/backend/supabase/migrations/20260929_r1_gamme_page_cached_pure_read.sql"
DOWN="$ROOT/backend/supabase/migrations/20260929_r1_gamme_page_cached_pure_read.down.sql"
# Empreintes lues sur la base live le 2026-09-29 (pg_proc, lecture seule).
LIVE_CACHED_MD5="d576e9b9fd198d4d832661b2371aa57d"
LIVE_REBUILD_MD5="c97b9a5e8241bc2104a6a195f607b57d"
LIVE_CACHED_ACL="{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="r1-gamme-cached-test-$$"
WORK="$(mktemp -d)"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
for f in "$MIGRATION" "$DOWN"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done

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
# exec_sql <sql> → code retour de psql, sortie (stdout+stderr) dans $LAST_OUT
exec_sql() {
  LAST_OUT=$(docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -tAq -c "$1" 2>&1)
  return $?
}
# ro <pg_id> [role] → appel en transaction READ ONLY, comme PostgREST
ro() {
  local role_sql=""
  [[ -n "${2:-}" ]] && role_sql="SET LOCAL ROLE $2;"
  exec_sql "BEGIN READ ONLY; $role_sql SELECT coalesce(public.get_gamme_page_data_cached($1)::text, 'NULL'); COMMIT;"
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
# refused <fichier> <libelle> <motif> — l'application DOIT échouer avec ce motif
refused() {
  LAST_OUT=$(docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$1" 2>&1)
  assert "$2 : migration refusée" "1" "$([[ $? -ne 0 ]] && echo 1 || echo 0)"
  assert_contains "$2 : motif" "$3" "$LAST_OUT"
}

FN="'public.get_gamme_page_data_cached(integer)'::regprocedure"
prosrc_md5() { q "SELECT md5(prosrc) FROM pg_proc WHERE oid = $FN"; }
proacl()     { q "SELECT proacl::text FROM pg_proc WHERE oid = $FN"; }
props()      { q "SELECT provolatile::text || '|' || prosecdef::text || '|' || array_to_string(proconfig, ',') FROM pg_proc WHERE oid = $FN"; }
comment()    { q "SELECT coalesce(obj_description($FN, 'pg_proc'), 'NULL')"; }
cache_rows() { q "SELECT count(*) FROM public.__gamme_page_cache"; }
cache_of()   { q "SELECT coalesce((SELECT payload::text || '|' || stale::text FROM public.__gamme_page_cache WHERE pg_id = $1), 'ABSENT')"; }

echo "=== Fixture (rôles Supabase, cache, double du builder, rebuild live, corps live) ==="
psql_file -f - <<'SQL' || { echo "FATAL: fixture en échec"; exit 2; }
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

-- Colonnes, clé et droits de la table live (RLS activée, aucune politique).
CREATE TABLE public.__gamme_page_cache (
  pg_id        INTEGER PRIMARY KEY,
  payload      JSONB NOT NULL,
  source_hash  TEXT NOT NULL,
  built_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  stale        BOOLEAN NOT NULL DEFAULT false,
  stale_reason TEXT
);
ALTER TABLE public.__gamme_page_cache ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.__gamme_page_cache TO anon, authenticated, service_role;

-- Double du builder : payload lu dans une table de fixture, NULL si absent.
-- Même signature, volatilité, mode et droits que la fonction live.
CREATE TABLE public._t_build (pg_id INTEGER PRIMARY KEY, payload JSONB NOT NULL);
CREATE FUNCTION public.build_gamme_page_payload(p_pg_id integer)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT payload FROM public._t_build WHERE pg_id = p_pg_id $$;
REVOKE ALL ON FUNCTION public.build_gamme_page_payload(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_gamme_page_payload(integer) TO service_role;

-- rebuild_gamme_page_cache : corps live VERBATIM (md5 vérifié plus bas).
CREATE OR REPLACE FUNCTION public.rebuild_gamme_page_cache(p_pg_id integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payload  JSONB;
  v_hash     TEXT;
  v_old_hash TEXT;
BEGIN
  v_payload := public.build_gamme_page_payload(p_pg_id);

  IF v_payload IS NULL THEN
    DELETE FROM public.__gamme_page_cache WHERE pg_id = p_pg_id;
    RETURN FALSE;
  END IF;

  v_hash := md5(v_payload::TEXT);

  SELECT source_hash INTO v_old_hash
    FROM public.__gamme_page_cache
    WHERE pg_id = p_pg_id;

  IF v_old_hash IS NOT DISTINCT FROM v_hash THEN
    UPDATE public.__gamme_page_cache
       SET built_at = NOW(),
           stale = FALSE,
           stale_reason = NULL
     WHERE pg_id = p_pg_id;
  ELSE
    INSERT INTO public.__gamme_page_cache (pg_id, payload, source_hash, built_at, stale, stale_reason)
    VALUES (p_pg_id, v_payload, v_hash, NOW(), FALSE, NULL)
    ON CONFLICT (pg_id) DO UPDATE
      SET payload      = EXCLUDED.payload,
          source_hash  = EXCLUDED.source_hash,
          built_at     = EXCLUDED.built_at,
          stale        = FALSE,
          stale_reason = NULL;
  END IF;

  RETURN TRUE;
END;
$function$;
REVOKE ALL ON FUNCTION public.rebuild_gamme_page_cache(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_gamme_page_cache(integer) TO service_role;

-- 14  : absent du cache, payload construit      (cas de 3 973 gammes live)
-- 97  : absent du cache, payload NULL           (cas pg_id 97 live)
-- 200 : présent et frais ; le builder diverge  (prouve que le cache est servi)
-- 300 : présent mais périmé ; le builder diverge
INSERT INTO public._t_build VALUES
  (14,  '{"src": "build", "hero": {"h1": "G14"}}'),
  (200, '{"src": "build", "hero": {"h1": "G200"}}'),
  (300, '{"src": "build", "hero": {"h1": "G300"}}');
INSERT INTO public.__gamme_page_cache (pg_id, payload, source_hash, stale) VALUES
  (200, '{"src": "cache", "hero": {"h1": "G200"}}', 'h200', false),
  (300, '{"src": "stale", "hero": {"h1": "G300"}}', 'h300', true);
SQL
apply "$DOWN" "corps live installé depuis le .down.sql"
# ACL live : PUBLIC implicite (défaut) + anon, authenticated, service_role.
psql_file -c "GRANT EXECUTE ON FUNCTION public.get_gamme_page_data_cached(integer) TO anon, authenticated, service_role;" \
  || { echo "FATAL: ACL fixture"; exit 2; }
assert "fixture : corps live verbatim" "$LIVE_CACHED_MD5" "$(prosrc_md5)"
assert "fixture : rebuild live verbatim" "$LIVE_REBUILD_MD5" \
  "$(q "SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.rebuild_gamme_page_cache(integer)'::regprocedure")"
assert "fixture : ACL live" "$LIVE_CACHED_ACL" "$(proacl)"
echo

echo "=== AVANT : le défaut, en transaction READ ONLY ==="
ro 14; rc=$?
assert "absent + payload : erreur" "1" "$([[ $rc -ne 0 ]] && echo 1 || echo 0)"
assert_contains "absent + payload : 25006 sur INSERT" "cannot execute INSERT in a read-only transaction" "$LAST_OUT"
ro 97; rc=$?
assert "absent + NULL : erreur" "1" "$([[ $rc -ne 0 ]] && echo 1 || echo 0)"
assert_contains "absent + NULL : 25006 sur DELETE" "cannot execute DELETE in a read-only transaction" "$LAST_OUT"
ro 300; rc=$?
assert "périmé : erreur" "1" "$([[ $rc -ne 0 ]] && echo 1 || echo 0)"
assert_contains "périmé : 25006" "read-only transaction" "$LAST_OUT"
ro 200
assert "présent : servi" '{"src": "cache", "hero": {"h1": "G200"}}' "$LAST_OUT"
echo

echo "=== Migration ==="
rows_before=$(cache_rows)
apply "$MIGRATION" "migration appliquée (precheck + postcheck inclus)"
assert "migration : aucune ligne de cache écrite" "$rows_before" "$(cache_rows)"
echo

echo "=== APRÈS : lecture pure, en transaction READ ONLY ==="
ro 14
assert "absent + payload : payload du builder" '{"src": "build", "hero": {"h1": "G14"}}' "$LAST_OUT"
assert "absent + payload : toujours pas de ligne" "ABSENT" "$(cache_of 14)"
ro 97
assert "absent + NULL : NULL (le backend répond 404)" "NULL" "$LAST_OUT"
assert "absent + NULL : pas de ligne" "ABSENT" "$(cache_of 97)"
ro 300
assert "périmé : payload reconstruit" '{"src": "build", "hero": {"h1": "G300"}}' "$LAST_OUT"
assert "périmé : ligne intacte" '{"src": "stale", "hero": {"h1": "G300"}}|true' "$(cache_of 300)"
ro 200
assert "présent : ligne stockée, pas le builder" '{"src": "cache", "hero": {"h1": "G200"}}' "$LAST_OUT"
ro 14 anon
assert "anon (PREPROD READ_ONLY) : absent servi via DEFINER" '{"src": "build", "hero": {"h1": "G14"}}' "$LAST_OUT"
ro 200 anon
assert "anon : présent servi" '{"src": "cache", "hero": {"h1": "G200"}}' "$LAST_OUT"
assert "aucune écriture sur l'ensemble des lectures" "$rows_before" "$(cache_rows)"
echo

echo "=== Invariants ==="
assert "STABLE | DEFINER | search_path" "s|true|search_path=public" "$(props)"
assert "ACL inchangée (base live)" "$LIVE_CACHED_ACL" "$(proacl)"
assert_contains "commentaire posé" "SANS écriture" "$(comment)"
assert "rebuild : toujours fermé à anon" "f" \
  "$(q "SELECT has_function_privilege('anon', 'public.rebuild_gamme_page_cache(integer)', 'EXECUTE')")"
exec_sql "BEGIN; SET LOCAL ROLE service_role; SELECT public.rebuild_gamme_page_cache(14); COMMIT;"
assert "rebuild : service_role écrit toujours" "t" "$LAST_OUT"
ro 14
assert "après rebuild : la ligne est servie" '{"src": "build", "hero": {"h1": "G14"}}' "$LAST_OUT"
assert "après rebuild : ligne fraîche" '{"src": "build", "hero": {"h1": "G14"}}|false' "$(cache_of 14)"
psql_file -c "DELETE FROM public.__gamme_page_cache WHERE pg_id = 14;" || { echo "FATAL: remise à zéro"; exit 2; }
echo

echo "=== Idempotence ==="
md5_after=$(prosrc_md5)
apply "$MIGRATION" "migration ré-appliquée"
assert "corps stable après ré-application" "$md5_after" "$(prosrc_md5)"
assert "ACL stable après ré-application" "$LIVE_CACHED_ACL" "$(proacl)"
echo

echo "=== Les gardes de la migration sont vivantes (mutations) ==="
# Precheck : un builder VOLATILE pourrait écrire — refus.
psql_file -c "ALTER FUNCTION public.build_gamme_page_payload(integer) VOLATILE;" || exit 2
refused "$MIGRATION" "builder VOLATILE" "r1 precheck"
psql_file -c "ALTER FUNCTION public.build_gamme_page_payload(integer) STABLE;" || exit 2

# Sonde READ ONLY : écriture par un détour que l'analyse statique ne voit pas.
psql_file -f - <<'SQL' || { echo "FATAL: écrivain de détour"; exit 2; }
CREATE FUNCTION public._t_detour(p integer) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
BEGIN
  INSERT INTO public._t_build VALUES (p + 100000, '{}') ON CONFLICT DO NOTHING;
  RETURN public.build_gamme_page_payload(p);
END; $$;
SQL
sed 's/RETURN public\.build_gamme_page_payload(p_pg_id)::JSON;/RETURN public._t_detour(p_pg_id)::JSON;/' \
  "$MIGRATION" > "$WORK/mut-detour.sql"
assert "mutation détour : le texte a bien changé" "1" "$(grep -c '_t_detour' "$WORK/mut-detour.sql")"
refused "$WORK/mut-detour.sql" "écriture de détour" "en transaction READ ONLY"
assert "écriture de détour : corps d'avant conservé (atomicité)" "$md5_after" "$(prosrc_md5)"

# ACL : une migration qui toucherait un droit est refusée.
awk '/^DO \$postcheck\$/ { print "REVOKE EXECUTE ON FUNCTION public.get_gamme_page_data_cached(integer) FROM authenticated;" } { print }' \
  "$MIGRATION" > "$WORK/mut-acl.sql"
refused "$WORK/mut-acl.sql" "changement d'ACL" "ACL a changé"
assert "changement d'ACL : ACL live conservée (atomicité)" "$LIVE_CACHED_ACL" "$(proacl)"

# Analyse statique : réintroduire l'appel au rebuild — refus.
sed 's/RETURN public\.build_gamme_page_payload(p_pg_id)::JSON;/PERFORM public.rebuild_gamme_page_cache(p_pg_id); RETURN NULL;/' \
  "$MIGRATION" > "$WORK/mut-rebuild.sql"
refused "$WORK/mut-rebuild.sql" "appel au rebuild réintroduit" "r1 postcheck"
echo

echo "=== Rollback (.down.sql) ==="
apply "$DOWN" "rollback appliqué"
assert "rollback : corps live verbatim" "$LIVE_CACHED_MD5" "$(prosrc_md5)"
assert "rollback : STABLE | DEFINER | search_path" "s|true|search_path=public" "$(props)"
assert "rollback : commentaire live (aucun)" "NULL" "$(comment)"
assert "rollback : ACL inchangée" "$LIVE_CACHED_ACL" "$(proacl)"
ro 14; rc=$?
assert "rollback : 25006 revient (preuve que le test voit le défaut)" "1" "$([[ $rc -ne 0 ]] && echo 1 || echo 0)"
assert_contains "rollback : message 25006" "read-only transaction" "$LAST_OUT"
echo

echo "Résultat : $pass réussi(s), $fail échec(s)."
[[ $fail -eq 0 ]]
