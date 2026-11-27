#!/usr/bin/env bash
# =============================================================================
# Test de 20261116_soft_404_alternatives_sargable_modele.sql
#
# Prouve, sur une base jetable :
#   1. AVANT (corps live verbatim, installé depuis le .down.sql et vérifié par
#      md5(prosrc) contre la base live) : les prédicats
#      `t.type_modele_id::int = …` empêchent toute condition d'index sur
#      auto_type.type_modele_id dans related_models_pre / rep_types.
#   2. APRÈS : ces deux sous-requêtes s'appuient sur idx_at_modele_id
#      (Index Cond sur type_modele_id), et le jsonb rendu est IDENTIQUE à
#      l'avant sur chaque cas de la fixture (tiers véhicules, modèle masqué,
#      type non suivi, type de marque différente de celle de son modèle,
#      LIMIT 4 des modèles frères, choix du type représentatif, gamme sans
#      relation, type inconnu).
#   3. Invariants non touchés : signature, SECURITY DEFINER, search_path,
#      propriétaire, droits EXECUTE (anon / authenticated / service_role),
#      commentaire, idempotence, rollback verbatim.
#
# Les plans sont lus avec auto_explain (log_nested_statements) et
# enable_seqscan = off : sur une fixture de quelques lignes, le planner
# préférerait sinon un parcours séquentiel dans les deux versions. Le test
# vérifie donc qu'une condition d'index EST POSSIBLE, pas le choix de coût ;
# les durées réelles sont dans l'en-tête de la migration.
#
# Environnement : conteneur PostgreSQL jetable (même majeure que la PROD), sans
# réseau (--network none) et sans écoute TCP : psql passe par le socket local.
# Ne lit aucune variable de connexion Supabase, ne touche aucune base réelle.
#
# Usage : bash scripts/db/test-soft-404-alternatives-sargable.sh
# Sortie : 0 si toutes les assertions passent.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# MIGRATION_UNDER_TEST permet le test de mutation (pointer une copie altérée)
# sans toucher au fichier du dépôt. Par défaut : la migration réelle.
MIGRATION="${MIGRATION_UNDER_TEST:-$ROOT/backend/supabase/migrations/20261116_soft_404_alternatives_sargable_modele.sql}"
DOWN="$ROOT/backend/supabase/migrations/20261116_soft_404_alternatives_sargable_modele.down.sql"
# Empreinte du corps live lue le 2026-11-15T23:53:59Z (pg_proc.prosrc, lecture seule).
LIVE_PROSRC_MD5="5baf9c8ef3a4f61c9091709b01842fb7"
LIVE_COMMENT="Soft-404 R2 : ranking multi-tier compat-aware (véhicules / gammes / modèles frères). Bypass RLS via SECURITY DEFINER. ADR-076-soft-404-r2-strategy. Cf. memoire feedback_seo_methodology_canon_20260506."
FN="public.get_soft_404_alternatives(bigint, bigint, integer)"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="soft404-alt-test-$$"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
for f in "$MIGRATION" "$DOWN"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done

# Only remove the container created by this invocation and its anonymous data.
CT_ID=""
cleanup() { if [[ -n "$CT_ID" ]]; then docker rm -fv "$CT_ID" >/dev/null 2>&1 || true; fi; }
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
apply() { # apply <fichier> <libelle> — transaction unique, comme le runner
  if docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$1" >/dev/null 2>&1; then
    echo "  ok  $2"
  else
    echo "  FAIL  $2 en échec"; fail=$((fail+1))
  fi
}

prosrc_md5() { q "SELECT md5(prosrc) FROM pg_proc WHERE oid = '$FN'::regprocedure"; }
fn_meta() {
  q "SELECT prosecdef::text || '|' || provolatile::text || '|' || array_to_string(proconfig, ',') || '|' || pg_get_userbyid(proowner)
       || '|' || pg_get_function_result(oid) || '|' || pg_get_function_identity_arguments(oid)
     FROM pg_proc WHERE oid = '$FN'::regprocedure"
}
can_exec() { q "SELECT has_function_privilege('$1', '$FN', 'EXECUTE')"; }
comment()  { q "SELECT obj_description('$FN'::regprocedure, 'pg_proc')"; }

# Cas couverts : <type> <gamme> <limite>
CASES=(
  "1 7 24"    # cible CLIO III : tiers 1/2/3, frères, gammes compatibles
  "1 7 3"     # p_limit < 6 : coupe vehicle_top
  "3 7 24"    # cible dans un modèle frère (même parent)
  "12 7 24"   # autre marque : seul son modèle porte la gamme
  "1 8 24"    # gamme sans aucune relation
  "999 7 24"  # type inconnu : retour anticipé
)
snapshot() { # snapshot <préfixe> — un jsonb par cas dans _t_results
  local c t g l
  for c in "${CASES[@]}"; do
    read -r t g l <<< "$c"
    q "INSERT INTO _t_results VALUES ('$1', '$t/$g/$l', public.get_soft_404_alternatives($t, $g, $l))" >/dev/null
  done
}
# plan_lines <type> <gamme> — plans des instructions imbriquées (auto_explain)
plan_lines() {
  docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -tAq 2>&1 <<SQL | tr -d '\r'
LOAD 'auto_explain';
SET auto_explain.log_min_duration = 0;
SET auto_explain.log_nested_statements = on;
SET auto_explain.log_format = text;
SET client_min_messages = log;
SET enable_seqscan = off;
SELECT public.get_soft_404_alternatives($1, $2, 24) IS NOT NULL;
SQL
}

# sargable_keys <plan> — nombre d'alias distincts parmi {m, rmp} dont la
# jointure vers auto_type compare la COLONNE NUE type_modele_id à modele_id::text
# (Index Cond en nested loop, Merge/Hash Cond sinon) : seule cette forme peut
# s'appuyer sur idx_at_modele_id. La forme d'origine, (type_modele_id)::integer,
# ne compte pas.
sargable_keys() {
  grep -oE "type_modele_id = \((m|rmp)(_[0-9]+)?\.modele_id\)::text|\(\((m|rmp)(_[0-9]+)?\.modele_id\)::text\) = t(_[0-9]+)?\.type_modele_id" <<< "$1" \
    | grep -oE "(m|rmp)(_[0-9]+)?\.modele_id" | sed -E 's/_[0-9]+\././' | sort -u | wc -l | tr -d ' '
}

echo "=== Fixture (rôles Supabase, catalogue minimal aux types live) ==="
psql_file -f - <<'SQL' || { echo "FATAL: fixture en échec"; exit 2; }
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

-- Colonnes lues par la fonction, aux types live (information_schema, 2026-11-15).
CREATE TABLE public.auto_marque (marque_id integer, marque_alias text, marque_name text);
CREATE TABLE public.auto_modele (
  modele_id integer, modele_parent integer, modele_marque_id smallint,
  modele_alias varchar(40), modele_name varchar(40), modele_display smallint DEFAULT 0
);
CREATE TABLE public.auto_type (
  type_id text, type_id_i integer, type_alias text, type_modele_id text, type_marque_id text,
  type_name text, type_fuel text, type_power_ps text, type_year_from text, type_year_to text,
  type_display text, type_relfollow text
);
CREATE TABLE public.pieces_gamme (pg_id integer, pg_alias text, pg_name text, pg_pic text, pg_display text, pg_top text);
CREATE TABLE public.pieces_relation_type (rtp_type_id integer, rtp_piece_id integer, rtp_pg_id integer);
-- Index live sur auto_type.type_modele_id (pg_indexes, 2026-11-15).
CREATE INDEX idx_at_modele_id ON public.auto_type USING btree (type_modele_id);
CREATE INDEX idx_at_marque_modele ON public.auto_type USING btree (type_marque_id, type_modele_id);

INSERT INTO public.auto_marque VALUES (10, 'renault', 'RENAULT'), (20, 'dacia', 'DACIA');
INSERT INTO public.auto_modele VALUES
  (100, 1000, 10, 'clio-iii', 'CLIO III', 1),
  (101, 1000, 10, 'clio-iii-estate', 'CLIO III Estate', 1),
  (102, NULL, 10, 'megane-ii', 'MEGANE II', 1),
  (103, NULL, 10, 'kangoo', 'KANGOO', 1),
  (104, NULL, 10, 'twingo', 'TWINGO', 1),
  (105, NULL, 10, 'scenic', 'SCENIC', 1),
  (106, NULL, 10, 'laguna', 'LAGUNA', 1),
  (107, NULL, 10, 'safrane', 'SAFRANE', 0),
  (200, NULL, 20, 'logan', 'LOGAN', 1);
INSERT INTO public.auto_type VALUES
  ('1',  1,  '1-5-dci',  '100', '10', '1.5 dCi',  'Diesel',  '85',  '2005', '2012', '1', '1'),
  ('2',  2,  '1-2-16v',  '100', '10', '1.2 16V',  'Essence', '105', '2005', '2012', '1', '1'),
  ('3',  3,  '1-5-dci',  '101', '10', '1.5 dCi',  'Diesel',  '90',  '2008', '2012', '1', '1'),
  ('4',  4,  '2-0-16v',  '101', '10', '2.0 16V',  'Essence', '120', '2008', '2012', '1', '1'),
  ('5',  5,  '1-6',      '102', '10', '1.6',      'Essence', '70',  '2002', '2008', '1', '1'),
  ('6',  6,  '1-5-dci',  '103', '10', '1.5 dCi',  'Diesel',  '68',  '2008', '2013', '1', '0'),
  ('7',  7,  '1-2',      '104', '20', '1.2',      'Essence', '60',  '2007', '2014', '1', '1'),
  ('8',  8,  '1-9-dci',  '105', '10', '1.9 dCi',  'Diesel',  '130', '2003', '2009', '1', '1'),
  ('9',  9,  '1-6-16v',  '105', '10', '1.6 16V',  'Essence', '115', '2003', '2009', '1', '1'),
  ('10', 10, '2-0-dci',  '106', '10', '2.0 dCi',  'Diesel',  '150', '2007', '2015', '1', '1'),
  ('11', 11, '3-0',      '107', '10', '3.0',      'Essence', '170', '1993', '2000', '1', '1'),
  ('12', 12, '1-4',      '200', '20', '1.4',      'Essence', '75',  '2004', '2012', '1', '1'),
  ('13', 13, '1-9-dti',  '102', '10', '1.9 dTi',  'Diesel',  '80',  '2002', '2008', '0', '1');
INSERT INTO public.pieces_gamme VALUES
  (7,  'disque-de-frein', 'Disque de frein', 'disque.webp', '1', '1'),
  (8,  'joint-spi',       'Joint spi',       NULL,          '1', '0'),
  (50, 'plaquette',       'Plaquette',       'plaq.webp',   '1', '1'),
  (51, 'filtre-a-huile',  'Filtre à huile',  NULL,          '1', '0'),
  (52, 'courroie',        'Courroie',        NULL,          '1', '0'),
  (53, 'masquee',         'Masquée',         NULL,          '0', '0');
-- gamme 7 : un ou plusieurs liens par type ; type 4 en a 3 (représentant de 101),
-- types 8 et 9 à égalité (départage par type_id_i).
INSERT INTO public.pieces_relation_type (rtp_type_id, rtp_piece_id, rtp_pg_id)
SELECT t, 1000 + row_number() OVER (), 7
FROM unnest(ARRAY[2, 3, 4, 4, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) AS t;
-- gammes du type cible 1 (alternativeGammes)
INSERT INTO public.pieces_relation_type (rtp_type_id, rtp_piece_id, rtp_pg_id) VALUES
  (1, 2001, 50), (1, 2002, 50), (1, 2003, 50), (1, 2004, 51), (1, 2005, 52), (1, 2006, 52), (1, 2007, 53),
  (3, 2008, 50);
ANALYZE;

CREATE TABLE public._t_results (version text, case_key text, payload jsonb);
SQL
echo "  ok  fixture chargée"
echo

echo "=== AVANT : corps live verbatim (depuis le .down.sql) ==="
apply "$DOWN" "corps live installé"
assert "corps installé = corps live (md5 prosrc)" "$LIVE_PROSRC_MD5" "$(prosrc_md5)"
# droits live (proacl 2026-11-15) et commentaire live
psql_file -c "REVOKE ALL ON FUNCTION $FN FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION $FN TO anon, authenticated, service_role;
  COMMENT ON FUNCTION $FN IS \$c\$$LIVE_COMMENT\$c\$;" >/dev/null
meta_before="$(fn_meta)"
snapshot before
plan_before="$(plan_lines 1 7)"
assert "avant : aucune clé de jointure sur la colonne nue type_modele_id (frères + représentant)" "0" \
  "$(sargable_keys "$plan_before")"
echo

echo "=== APRÈS : migration ==="
apply "$MIGRATION" "migration appliquée"
snapshot after
plan_after="$(plan_lines 1 7)"
[[ -n "${SHOW_PLANS:-}" ]] && { echo "--- plan avant"; echo "$plan_before"; echo "--- plan après"; echo "$plan_after"; }
assert "après : idx_at_modele_id parcouru (frères + représentant)" "ok" \
  "$(n=$(grep -cE "Index (Only )?Scan using idx_at_modele_id on auto_type" <<< "$plan_after"); [[ $n -ge 2 ]] && echo ok || echo "$n")"
assert "après : clé de jointure sur la colonne nue pour m.modele_id ET rmp.modele_id" "2" \
  "$(sargable_keys "$plan_after")"

for c in "${CASES[@]}"; do
  read -r t g l <<< "$c"
  k="$t/$g/$l"
  same=$(q "SELECT (SELECT payload FROM _t_results WHERE version='before' AND case_key='$k')
                 = (SELECT payload FROM _t_results WHERE version='after'  AND case_key='$k')")
  assert "jsonb identique avant/après — cas $k" "t" "$same"
done
# la fixture exerce bien les deux sous-requêtes modifiées
assert "cas 1/7/24 : modèles frères (LIMIT 4, masqué/non suivi exclus, marque divergente incluse)" \
  "101,102,104,105" \
  "$(q "SELECT string_agg(e->>'modele_id', ',' ORDER BY (e->>'modele_id')::int) FROM _t_results, jsonb_array_elements(payload->'relatedModels') e WHERE version='after' AND case_key='1/7/24'")"
assert "cas 1/7/24 : types représentatifs (plus de pièces, puis type_id_i)" \
  "4,5,7,8" \
  "$(q "SELECT string_agg(e->>'representative_type_id', ',' ORDER BY (e->>'modele_id')::int) FROM _t_results, jsonb_array_elements(payload->'relatedModels') e WHERE version='after' AND case_key='1/7/24'")"
assert "cas 1/7/24 : véhicules non vides" "t" \
  "$(q "SELECT jsonb_array_length(payload->'alternativeVehicles') > 0 FROM _t_results WHERE version='after' AND case_key='1/7/24'")"
assert "cas 1/7/24 : gammes (masquée exclue)" "50,52,51" \
  "$(q "SELECT string_agg(e->>'pg_id', ',' ORDER BY ord) FROM _t_results, jsonb_array_elements(payload->'alternativeGammes') WITH ORDINALITY x(e, ord) WHERE version='after' AND case_key='1/7/24'")"

echo
echo "=== Invariants ==="
assert "signature, retour, DEFINER, volatilité, search_path, propriétaire inchangés" "$meta_before" "$(fn_meta)"
assert "valeurs attendues (live 2026-11-15)" "true|v|search_path=public|postgres|jsonb|p_type_id bigint, p_pg_id bigint, p_limit integer" "$(fn_meta)"
assert "commentaire conservé" "$LIVE_COMMENT" "$(comment)"
for r in anon authenticated service_role; do
  assert "EXECUTE conservé pour $r" "t" "$(can_exec "$r")"
done
assert "aucun prédicat type_modele_id::int restant dans les frères / représentants" "0" \
  "$(q "SELECT (length(prosrc) - length(replace(prosrc, 'type_modele_id::int = m.modele_id', ''))) / length('type_modele_id::int = m.modele_id')
            + (length(prosrc) - length(replace(prosrc, 'type_modele_id::int = rmp.modele_id', ''))) / length('type_modele_id::int = rmp.modele_id')
          FROM pg_proc WHERE oid = '$FN'::regprocedure")"
echo

echo "=== Idempotence ==="
md5_first=$(prosrc_md5)
apply "$MIGRATION" "migration ré-appliquée"
assert "corps stable après ré-application" "$md5_first" "$(prosrc_md5)"
echo

echo "=== Rollback (.down.sql) ==="
apply "$DOWN" "rollback appliqué"
assert "rollback : corps live verbatim" "$LIVE_PROSRC_MD5" "$(prosrc_md5)"
assert "rollback : commentaire conservé" "$LIVE_COMMENT" "$(comment)"
assert "rollback : EXECUTE anon conservé" "t" "$(can_exec anon)"
echo

echo "Résultat : $pass réussi(s), $fail échec(s)."
[[ $fail -eq 0 ]]
