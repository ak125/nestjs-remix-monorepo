#!/usr/bin/env bash
# =============================================================================
# Test de comportement de 20260930_kg_maintenance_schedule_fuel_filter_aligned.sql
#
# Prouve le défaut PUIS sa correction :
#   1. AVANT (corps live verbatim, installé depuis le .down.sql et vérifié par
#      md5(prosrc) contre la base live) : un type diesel-électrique reçoit
#      vidange-essence + bougies-essence.
#   2. APRÈS : il reçoit vidange-diesel + bougies-prechauffage ; parmi les 22
#      libellés type_fuel servis par la base live le 2026-09-30, SEULS les deux
#      libellés diesel-électrique changent, ligne pour ligne.
#   3. p_fuel_type = 'hybride' (carburant thermique inconnu) : plus aucune
#      opération liée au carburant, seulement les génériques.
#   4. Invariants « non touchés » VERROUILLÉS : priorité p_fuel_type > p_type_id,
#      appel sans carburant, nœuds inactifs / autres node_type exclus,
#      signature, volatilité, SECURITY INVOKER, search_path, droits EXECUTE,
#      commentaire, idempotence, rollback verbatim.
#
# kg_nodes et auto_type sont réduits aux colonnes lues par la fonction ; les 19
# nœuds MaintenanceInterval actifs et les 22 libellés type_fuel sont ceux de la
# base live du 2026-09-30 (lecture seule).
#
# Environnement : conteneur PostgreSQL jetable (même majeure que la PROD), sans
# réseau (--network none) et sans écoute TCP : psql passe par le socket local.
# Ne lit aucune variable de connexion Supabase, ne touche aucune base réelle.
#
# Usage : bash scripts/db/test-kg-maintenance-schedule-fuel-filter.sh
# Sortie : 0 si toutes les assertions passent.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# MIGRATION_UNDER_TEST permet le test de mutation (pointer une copie altérée)
# sans toucher au fichier du dépôt. Par défaut : la migration réelle.
MIGRATION="${MIGRATION_UNDER_TEST:-$ROOT/backend/supabase/migrations/20260930_kg_maintenance_schedule_fuel_filter_aligned.sql}"
DOWN="$ROOT/backend/supabase/migrations/20260930_kg_maintenance_schedule_fuel_filter_aligned.down.sql"
# Empreinte du corps live lue le 2026-09-30 (pg_get_functiondef, lecture seule).
LIVE_PROSRC_MD5="4a56e0a246598a51e7e847861ba69d9b"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="kg-schedule-fuel-test-$$"

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

pass=0; fail=0
assert() { # assert <libelle> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  PASS  $1 → $3"; pass=$((pass+1));
  else echo "  FAIL  $1 → obtenu '$3', attendu '$2'"; fail=$((fail+1)); fi
}

apply() { # apply <fichier> <libelle> — transaction unique, comme le runner
  if docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$1"; then
    echo "  ok  $2"
  else
    echo "  FAIL  $2 en échec"; fail=$((fail+1))
  fi
}

FN="public.kg_get_smart_maintenance_schedule(text, integer, uuid, jsonb, integer, text)"
prosrc_md5() { q "SELECT md5(prosrc) FROM pg_proc WHERE oid = '$FN'::regprocedure"; }
# Identité complète de la fonction hors corps : arguments, résultat, langage,
# volatilité, SECURITY, search_path, droits, commentaire.
fn_identity() {
  q "SELECT concat_ws(' # ', pg_get_function_arguments(p.oid), pg_get_function_result(p.oid),
            l.lanname, p.provolatile, p.prosecdef, array_to_string(p.proconfig, ','),
            p.proacl::text, obj_description(p.oid, 'pg_proc'))
       FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
      WHERE p.oid = '$FN'::regprocedure"
}
# Nœuds liés au carburant rendus pour un type (triés, séparés par des virgules).
fuel_ops_type() {
  q "SELECT coalesce(string_agg(rule_alias, ',' ORDER BY rule_alias), '')
       FROM public.kg_get_smart_maintenance_schedule(p_type_id := $1, p_current_km := 50000)
      WHERE applies_to_fuel IS NOT NULL OR rule_alias LIKE 'bougies-%'"
}
fuel_ops_fuel() {
  q "SELECT coalesce(string_agg(rule_alias, ',' ORDER BY rule_alias), '')
       FROM public.kg_get_smart_maintenance_schedule(p_fuel_type := $1, p_current_km := 50000)
      WHERE applies_to_fuel IS NOT NULL OR rule_alias LIKE 'bougies-%'"
}
# Photographie ligne à ligne (ordre de sortie compris) de chaque appel observé.
snapshot() { # snapshot <table>
  psql_file -c "
    CREATE TABLE public.$1 AS
    SELECT c.label, (
             SELECT string_agg(concat_ws('|', s.rule_alias, s.rule_label, s.km_interval,
                                         s.month_interval, s.maintenance_priority,
                                         s.applies_to_fuel, s.km_remaining, s.status),
                               ';' ORDER BY s.ord)
               FROM public.kg_get_smart_maintenance_schedule(
                      p_type_id := c.type_id, p_fuel_type := c.fuel, p_current_km := c.km)
                    WITH ORDINALITY AS s(rule_alias, rule_label, km_interval, month_interval,
                                         maintenance_priority, applies_to_fuel, km_remaining,
                                         status, ord)
           ) AS rows
      FROM public._t_calls c;" || { echo "FATAL: snapshot $1"; exit 2; }
}

echo "=== Fixture (rôles Supabase, kg_nodes, auto_type, appels observés) ==="
psql_file -f - <<'SQL' || { echo "FATAL: fixture en échec"; exit 2; }
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE TABLE public.kg_nodes (
  node_type            TEXT NOT NULL,
  node_label           TEXT NOT NULL,
  node_alias           TEXT,
  is_active            BOOLEAN DEFAULT TRUE,
  km_interval          INTEGER,
  month_interval       INTEGER,
  maintenance_priority TEXT
);
-- Les 19 nœuds MaintenanceInterval actifs de la base live (2026-09-30).
INSERT INTO public.kg_nodes (node_type, node_label, node_alias, is_active, km_interval, month_interval, maintenance_priority) VALUES
  ('MaintenanceInterval', 'amortisseur',                         'amortisseur',                         TRUE,  90000,   72, 'important'),
  ('MaintenanceInterval', 'batterie',                            'batterie',                            TRUE,   NULL,   60, 'important'),
  ('MaintenanceInterval', 'bougies-essence',                     'bougies-essence',                     TRUE,  60000, NULL, 'important'),
  ('MaintenanceInterval', 'bougies-prechauffage',                'bougies-prechauffage',                TRUE, 100000, NULL, 'important'),
  ('MaintenanceInterval', 'controle-freinage',                   'controle-freinage',                   TRUE,  20000,   12, 'critical'),
  ('MaintenanceInterval', 'distribution',                        'distribution',                        TRUE, 120000,   72, 'critical'),
  ('MaintenanceInterval', 'filtre-air',                          'filtre-air',                          TRUE,  30000,   24, 'recommended'),
  ('MaintenanceInterval', 'filtre-habitacle',                    'filtre-habitacle',                    TRUE,  15000,   12, 'recommended'),
  ('MaintenanceInterval', 'filtre-huile',                        'filtre-huile',                        TRUE,  15000,   12, 'critical'),
  ('MaintenanceInterval', 'liquide-frein',                       'liquide-frein',                       TRUE,   NULL,   24, 'critical'),
  ('MaintenanceInterval', 'liquide-refroidissement',             'liquide-refroidissement',             TRUE,  60000,   48, 'important'),
  ('MaintenanceInterval', 'pneu',                                'pneu',                                TRUE,  45000,   60, 'critical'),
  ('MaintenanceInterval', 'recharge-clim',                       'recharge-clim',                       TRUE,   NULL,   24, 'optional'),
  ('MaintenanceInterval', 'remplacement-disques-frein-avant',    'remplacement-disques-frein-avant',    TRUE,  70000, NULL, 'critical'),
  ('MaintenanceInterval', 'remplacement-plaquettes-frein-avant', 'remplacement-plaquettes-frein-avant', TRUE,  40000, NULL, 'critical'),
  ('MaintenanceInterval', 'vidange-bva',                         'vidange-bva',                         TRUE,  60000, NULL, 'important'),
  ('MaintenanceInterval', 'vidange-bvm',                         'vidange-bvm',                         TRUE,  60000, NULL, 'recommended'),
  ('MaintenanceInterval', 'vidange-diesel',                      'vidange-diesel',                      TRUE,  20000,   24, 'important'),
  ('MaintenanceInterval', 'vidange-essence',                     'vidange-essence',                     TRUE,  15000,   12, 'important'),
  -- Témoins : jamais rendus (inactif ; autre node_type).
  ('MaintenanceInterval', 'temoin-inactif-diesel',               'temoin-inactif-diesel',               FALSE, 10000, NULL, 'critical'),
  ('Part',                'temoin-part-essence',                 'temoin-part-essence',                 TRUE,  10000, NULL, 'critical');

CREATE TABLE public.auto_type (type_id TEXT PRIMARY KEY, type_fuel TEXT);
-- Les 22 libellés type_fuel distincts de la base live (2026-09-30), casse et
-- accents d'origine.
INSERT INTO public.auto_type (type_id, type_fuel) VALUES
  ('1',  'Essence'),                ('2',  'Diesel'),
  ('3',  'Essence-Électrique'),     ('4',  'Essence-Éthanol'),
  ('5',  'Essence-Electrique'),     ('6',  'Essence-Gaz GPL'),
  ('7',  'Electrique'),             ('8',  'Diesel-Électrique'),
  ('9',  'Électrique'),             ('10', 'Essence-Gaz GNC'),
  ('11', 'Diesel-Electrique'),      ('12', 'Éthanol'),
  ('13', 'GPL/GNV'),                ('14', 'Gaz GNC'),
  ('15', 'Gaz GPL'),                ('16', 'Hydrogène'),
  ('17', 'Essence-Électrique-Éthanol'), ('18', 'Gasoil-Gaz GPL'),
  ('19', 'Essence-Méthanol'),       ('20', 'Essence-Gaz-Éthanol'),
  ('21', 'Essence-Gaz GNC-Éthanol'), ('22', 'Essence-Gaz GNL');

-- Appels observés : un par libellé (résolution par p_type_id), plus les
-- chemins explicites.
CREATE TABLE public._t_calls (label TEXT PRIMARY KEY, type_id INTEGER, fuel TEXT, km INTEGER);
INSERT INTO public._t_calls
  SELECT 'type:' || type_fuel, type_id::int, NULL, 50000 FROM public.auto_type;
INSERT INTO public._t_calls VALUES
  ('sans carburant ni type',          NULL, NULL,       0),
  ('type absent de auto_type',        999,  NULL,   50000),
  ('override diesel sur type essence', 1,   'Diesel', 95000),
  ('override essence sur type diesel', 2,   'essence', 19000),
  ('fuel explicite diesel-électrique', NULL, 'Diesel-Électrique', 50000),
  ('fuel explicite hybride',          NULL, 'hybride', 50000);
SQL
echo "ok"; echo

echo "=== État AVANT : corps live verbatim (installé depuis le .down.sql) ==="
apply "$DOWN" "corps live installé"
# Droits et commentaire tels que servis par la base live le 2026-09-30.
psql_file -f - <<'SQL' || { echo "FATAL: droits live"; exit 2; }
GRANT EXECUTE ON FUNCTION public.kg_get_smart_maintenance_schedule(text, integer, uuid, jsonb, integer, text)
  TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.kg_get_smart_maintenance_schedule(text, integer, uuid, jsonb, integer, text) IS
  'ADR-032 D2/D3: schedule entretien par véhicule. p_type_id résout fuel_type via auto_type.type_fuel. p_fuel_type explicite override. Pas de mapping engine_family_code (coverage 0%). API legacy p_engine_family_code restera présente mais NO-OP en attendant refactor consumers.';
SQL
assert "md5(prosrc) du .down.sql = corps live du 2026-09-30" "$LIVE_PROSRC_MD5" "$(prosrc_md5)"
assert "AVANT Diesel-Électrique : opérations essence (défaut)" "bougies-essence,vidange-essence" "$(fuel_ops_type 8)"
assert "AVANT Diesel-Electrique : opérations essence (défaut)" "bougies-essence,vidange-essence" "$(fuel_ops_type 11)"
assert "AVANT hybride explicite : opérations essence" "bougies-essence,vidange-essence" "$(fuel_ops_fuel "'hybride'")"
identity_before=$(fn_identity)
snapshot _t_before
echo

echo "=== Migration 20260930 ==="
apply "$MIGRATION" "migration appliquée"
assert "identité hors corps inchangée (arguments, résultat, STABLE, INVOKER, search_path, droits, commentaire)" \
  "$identity_before" "$(fn_identity)"
snapshot _t_after
echo

echo "=== APRÈS : hybrides diesel ==="
assert "Diesel-Électrique : opérations diesel" "bougies-prechauffage,vidange-diesel" "$(fuel_ops_type 8)"
assert "Diesel-Electrique : opérations diesel" "bougies-prechauffage,vidange-diesel" "$(fuel_ops_type 11)"
assert "fuel explicite diesel-électrique : opérations diesel" "bougies-prechauffage,vidange-diesel" "$(fuel_ops_fuel "'Diesel-Électrique'")"
assert "Diesel-Électrique : lignes génériques identiques à AVANT" \
  "$(q "SELECT string_agg(r, ';' ORDER BY n) FROM public._t_before b, regexp_split_to_table(b.rows, ';') WITH ORDINALITY AS t(r, n) WHERE b.label = 'type:Diesel-Électrique' AND r !~ '^(bougies|vidange-(essence|diesel))'")" \
  "$(q "SELECT string_agg(r, ';' ORDER BY n) FROM public._t_after a, regexp_split_to_table(a.rows, ';') WITH ORDINALITY AS t(r, n) WHERE a.label = 'type:Diesel-Électrique' AND r !~ '^(bougies|vidange-(essence|diesel))'")"
echo

echo "=== APRÈS : périmètre exact du changement ==="
assert "seuls les appels diesel-électrique et hybride changent" \
  "fuel explicite diesel-électrique,fuel explicite hybride,type:Diesel-Electrique,type:Diesel-Électrique" \
  "$(q "SELECT string_agg(b.label, ',' ORDER BY b.label) FROM public._t_before b JOIN public._t_after a USING (label) WHERE a.rows IS DISTINCT FROM b.rows")"
assert "hybride explicite : aucune opération liée au carburant" "" "$(fuel_ops_fuel "'hybride'")"
assert "hybride explicite : 15 opérations génériques" "15" \
  "$(q "SELECT count(*) FROM public.kg_get_smart_maintenance_schedule(p_fuel_type := 'hybride')")"
assert "hybrides essence inchangés (Essence-Électrique)" "bougies-essence,vidange-essence" "$(fuel_ops_type 3)"
assert "sans carburant ni type : les 19 nœuds actifs, témoins exclus" "19" \
  "$(q "SELECT count(*) FROM public.kg_get_smart_maintenance_schedule()")"
assert "témoins inactif / autre node_type jamais rendus" "0" \
  "$(q "SELECT count(*) FROM public._t_after WHERE rows LIKE '%temoin-%'")"
assert "p_fuel_type prime sur p_type_id" "bougies-prechauffage,vidange-diesel" \
  "$(q "SELECT coalesce(string_agg(rule_alias, ',' ORDER BY rule_alias), '') FROM public.kg_get_smart_maintenance_schedule(p_type_id := 1, p_fuel_type := 'Diesel') WHERE applies_to_fuel IS NOT NULL OR rule_alias LIKE 'bougies-%'")"
echo

echo "=== Idempotence ==="
md5_first=$(prosrc_md5)
apply "$MIGRATION" "migration ré-appliquée"
assert "corps stable après ré-application" "$md5_first" "$(prosrc_md5)"
assert "identité hors corps stable après ré-application" "$identity_before" "$(fn_identity)"
echo

echo "=== Rollback (.down.sql) ==="
apply "$DOWN" "rollback appliqué"
assert "rollback : corps live verbatim" "$LIVE_PROSRC_MD5" "$(prosrc_md5)"
assert "rollback : identité hors corps conservée" "$identity_before" "$(fn_identity)"
assert "rollback : le défaut revient (preuve que le test le voit)" "bougies-essence,vidange-essence" "$(fuel_ops_type 8)"
echo

echo "Résultat : $pass réussi(s), $fail échec(s)."
[[ $fail -eq 0 ]]
