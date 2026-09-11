#!/usr/bin/env bash
# =============================================================================
# Test des migrations 20260911_seo_gsc_multilevel_page_totals{,_rpc_low_ctr_v4}
#
# Exécute RÉELLEMENT le SQL (pas une analyse statique : squawk ne remplace pas
# ce banc) sur un conteneur PostgreSQL jetable, même majeure que la PROD (17),
# à partir d'une fixture qui reproduit l'état PROD avant migration.
#
# Couvre : ordre des migrations, idempotence, structure + RLS + privilèges joués
# par rôle (anon / authenticated / service_role), compatibilité ancien code /
# nouveau schéma, comportement quand le schéma manque, rpc_seo_low_ctr_v4 sur les
# cas complet / partiel / vide / grain indisponible / écart d'agrégation / jour
# zéro confirmé / plancher / queue non finalisée / fuseau de session, reprise
# interrompue rejouée côté base, rollbacks (.down) dans le bon et le mauvais ordre.
#
# Ne touche JAMAIS une base persistante : aucune variable de connexion Supabase
# n'est lue ; l'hôte est un conteneur local créé et détruit ici.
#
# Usage : bash scripts/db/test-seo-gsc-page-totals-migrations.sh
# Sortie : 0 si toutes les assertions passent.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$ROOT/scripts/db/seo-gsc-page-totals-fixture.sql"
MIG_DIR="$ROOT/backend/supabase/migrations"
M1="$MIG_DIR/20260911_seo_gsc_multilevel_page_totals.sql"
M1_DOWN="$MIG_DIR/20260911_seo_gsc_multilevel_page_totals.down.sql"
M2="$MIG_DIR/20260911_seo_gsc_multilevel_page_totals_rpc_low_ctr_v4.sql"
M2_DOWN="$MIG_DIR/20260911_seo_gsc_multilevel_page_totals_rpc_low_ctr_v4.down.sql"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="seo-gsc-page-totals-test-$$"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
for f in "$FIXTURE" "$M1" "$M1_DOWN" "$M2" "$M2_DOWN"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done

TMPD="$(mktemp -d)"
cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; rm -rf "$TMPD"; }
trap cleanup EXIT

echo "Image : $IMAGE"
docker run -d --name "$CT" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test "$IMAGE" >/dev/null || exit 2
for _ in $(seq 1 60); do
  docker exec "$CT" pg_isready -U postgres -d test >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CT" pg_isready -U postgres -d test >/dev/null 2>&1 || { echo "FATAL: postgres non prêt"; exit 2; }
echo "PostgreSQL : $(docker exec "$CT" psql -U postgres -d test -tAc 'SHOW server_version')"
echo

# sql <texte> → sortie brute (tuples only), postgres
sql() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -tAq 2>&1 <<<"$1"; }
# apply <fichier> → migration en transaction unique (comme le runner), 0 si succès
apply() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - <"$1" >"$TMPD/apply.log" 2>&1; }

# probe <rôle> <sql> → OUI | ERR:<SQLSTATE>
probe() {
  local out rc code
  out=$(docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -tAq 2>&1 <<SQL
\set VERBOSITY verbose
BEGIN;
SET LOCAL ROLE $1;
$2
ROLLBACK;
SQL
)
  rc=$?
  if [[ $rc -eq 0 ]]; then echo "OUI"; return; fi
  code=$(grep -oE 'ERROR:  [0-9A-Z]{5}' <<<"$out" | head -1 | awk '{print $2}')
  echo "ERR:${code:-?}"
}

pass=0; fail=0
assert() { # assert <libellé> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  PASS  $1 → $3"; pass=$((pass+1));
  else echo "  FAIL  $1"; echo "        attendu : $2"; echo "        obtenu  : $3"; fail=$((fail+1)); fi
}

P_NOW="TIMESTAMPTZ '2026-09-11 02:00:00+00'"
v4() { echo "public.rpc_seo_low_ctr_v4(${1:-10}, $P_NOW, 100, 0.01, 50, ${2:-NULL})"; }
# Synthèse : statut|attendus|commités|manquants|récupération|trous|qualifiantes|from|to
summary() {
  echo "(SELECT concat_ws('|', v->>'coverage_status', v->>'days_expected', v->>'days_present', (v->'missing_dates')::text, v->>'retrieval_status', (v->'retrieval_gap_dates')::text, v->>'total_qualifying', COALESCE(v->>'data_from','null'), COALESCE(v->>'data_to','null')) FROM (SELECT $1 AS v) x)"
}
# scen <seed> <expr> [TimeZone] → exécuté en service_role sur des tables vidées, ROLLBACK
scen() {
  sql "BEGIN;
DELETE FROM public.__seo_gsc_daily_page_totals;
DELETE FROM public.__seo_gsc_daily_property_total;
$1
SET LOCAL ROLE service_role;
${3:+SET LOCAL TimeZone = '$3';}
SELECT $2;
ROLLBACK;"
}

PAGE_A="https://www.automecanik.com/pieces/filtre-a-huile-7.html"
PAGE_B="https://www.automecanik.com/pieces/plaquette-de-frein-402.html"
SEED_COMPLETE="INSERT INTO public.__seo_gsc_daily_property_total (date, clicks, impressions, ctr, position, commit_version)
SELECT d::date, 80, 5500, 0.0145, 11, 1 FROM generate_series(DATE '2026-09-01', DATE '2026-09-10', INTERVAL '1 day') d;
INSERT INTO public.__seo_gsc_daily_page_totals (date, page, clicks, impressions, ctr, position)
SELECT d::date, p.page, p.clicks, p.impressions, p.ctr, p.position
FROM generate_series(DATE '2026-09-01', DATE '2026-09-10', INTERVAL '1 day') d
CROSS JOIN (VALUES ('$PAGE_A', 0, 3000, 0::real, 4::real), ('$PAGE_B', 80, 2700, 0.0296::real, 8::real))
  AS p(page, clicks, impressions, ctr, position);"

# =============================================================================
echo "=== Fixture (état PROD avant migration) ==="
docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -f - <"$FIXTURE" >"$TMPD/fixture.log" 2>&1 \
  || { cat "$TMPD/fixture.log"; echo "FATAL: fixture en échec"; exit 2; }
echo "ok"; echo

FN_SRC_BEFORE=$(sql "SELECT regexp_replace(prosrc, '\s+', ' ', 'g') FROM pg_proc WHERE proname = '__seo_ensure_monthly_partitions';")
FN_ACL_BEFORE=$(sql "SELECT proacl::text FROM pg_proc WHERE proname = '__seo_ensure_monthly_partitions';")
PAGES_COMMENT_BEFORE=$(sql "SELECT obj_description('public.__seo_gsc_daily_pages'::regclass, 'pg_class');")
PT_DATA_BEFORE=$(sql "SELECT md5(string_agg(concat_ws(',', date, clicks, impressions, ctr, position, fetched_at), ';' ORDER BY date)) FROM public.__seo_gsc_daily_property_total;")
V3_CALL="public.rpc_seo_low_ctr_v3(30, $P_NOW)"
V3_BEFORE=$(sql "BEGIN; SET LOCAL ROLE service_role; SELECT $V3_CALL::text; ROLLBACK;")

echo "=== AVANT migration — comportement quand le nouveau schéma manque ==="
assert "fetcher (lecture commit_version) → 42703, classé schema_drift côté code" \
  "ERR:42703" "$(probe service_role "SELECT date FROM public.__seo_gsc_daily_property_total WHERE commit_version >= 1;")"
assert "Command Center (appel v4) → 42883, repli v3 journalisé côté code" \
  "ERR:42883" "$(probe service_role "SELECT $(v4);")"
assert "v3 (ancien consommateur) répond" "OUI" "$(probe service_role "SELECT $V3_CALL;")"

echo; echo "=== Ordre : v4 AVANT la table → échec bruyant, rien de créé ==="
apply "$M2"; rc=$?
assert "migration v4 seule refusée (corps SQL validé à la création)" "1" "$([[ $rc -ne 0 ]] && echo 1 || echo 0)"
assert "  cause citée" "1" "$(grep -cE 'commit_version|__seo_gsc_daily_page_totals' "$TMPD/apply.log" | awk '{print ($1>0)?1:0}')"
assert "  v4 toujours absente" "ERR:42883" "$(probe service_role "SELECT $(v4);")"

echo; echo "=== Migration 1 (table + marqueur + partitions + RLS), 2 applications ==="
apply "$M1"; assert "1re application" "0" "$?"
apply "$M1"; assert "2e application (idempotente)" "0" "$?"

echo; echo "=== APRÈS migration 1 — structure, RLS, privilèges joués ==="
assert "parent + partitions 2026_06..2026_12 créés" "8" \
  "$(sql "SELECT count(*) FROM pg_class WHERE relname ~ '^__seo_gsc_daily_page_totals(_2026_(06|07|08|09|10|11|12))?\$' AND relkind IN ('p','r');")"
assert "RLS activée sur parent + 7 partitions" "8" \
  "$(sql "SELECT count(*) FROM pg_class WHERE relname LIKE '\_\_seo\_gsc\_daily\_page\_totals%' AND relkind IN ('p','r') AND relrowsecurity;")"
for r in anon authenticated; do
  assert "$r SELECT parent → refusé" "ERR:42501" "$(probe $r "SELECT 1 FROM public.__seo_gsc_daily_page_totals LIMIT 1;")"
  assert "$r SELECT partition 2026_09 → refusé" "ERR:42501" "$(probe $r "SELECT 1 FROM public.__seo_gsc_daily_page_totals_2026_09 LIMIT 1;")"
  assert "$r INSERT → refusé" "ERR:42501" "$(probe $r "INSERT INTO public.__seo_gsc_daily_page_totals (date, page) VALUES ('2026-09-01', 'x');")"
  assert "$r UPDATE commit_version → refusé" "ERR:42501" "$(probe $r "UPDATE public.__seo_gsc_daily_property_total SET commit_version = 1;")"
done
assert "service_role INSERT + SELECT page_totals" "OUI" \
  "$(probe service_role "INSERT INTO public.__seo_gsc_daily_page_totals (date, page, clicks, impressions) VALUES ('2026-09-01', '$PAGE_A', 1, 10); SELECT count(*) FROM public.__seo_gsc_daily_page_totals;")"
assert "commit_version : bigint, nullable" "bigint|YES" \
  "$(sql "SELECT data_type || '|' || is_nullable FROM information_schema.columns WHERE table_name = '__seo_gsc_daily_property_total' AND column_name = 'commit_version';")"
assert "lignes existantes : toutes sans marqueur (NULL = pas une preuve)" "12|12" \
  "$(sql "SELECT count(*) || '|' || count(*) FILTER (WHERE commit_version IS NULL) FROM public.__seo_gsc_daily_property_total;")"
assert "données property_total inchangées (empreinte hors nouvelle colonne)" "$PT_DATA_BEFORE" \
  "$(sql "SELECT md5(string_agg(concat_ws(',', date, clicks, impressions, ctr, position, fetched_at), ';' ORDER BY date)) FROM public.__seo_gsc_daily_property_total;")"
assert "fonction partitions : pas de surcharge (appel pg_cron non ambigu)" "1" \
  "$(sql "SELECT count(*) FROM pg_proc WHERE proname = '__seo_ensure_monthly_partitions';")"
assert "fonction partitions : search_path épinglé" "{search_path=public}" \
  "$(sql "SELECT proconfig::text FROM pg_proc WHERE proname = '__seo_ensure_monthly_partitions';")"
assert "fonction partitions : corps PROD + 1 table (espaces normalisés)" "$FN_SRC_BEFORE" \
  "$(sql "SELECT replace(regexp_replace(prosrc, '\s+', ' ', 'g'), ', ''__seo_gsc_daily_page_totals''', '') FROM pg_proc WHERE proname = '__seo_ensure_monthly_partitions';")"
assert "fonction partitions : ACL inchangée (CREATE OR REPLACE)" "$FN_ACL_BEFORE" \
  "$(sql "SELECT proacl::text FROM pg_proc WHERE proname = '__seo_ensure_monthly_partitions';")"
RECREATE=$(sql "BEGIN;
DROP TABLE public.__seo_gsc_daily_page_totals_2026_12;
SELECT 'created=' || public.__seo_ensure_monthly_partitions(3);
SELECT 'rls=' || relrowsecurity FROM pg_class WHERE relname = '__seo_gsc_daily_page_totals_2026_12';
ROLLBACK;")
assert "partition future manquante recréée par la fonction mensuelle" "1" "$(grep -c '^created=1$' <<<"$RECREATE")"
assert "  partition recréée sans RLS jusqu'au reconcile horaire (fenêtre PRÉEXISTANTE, toutes tables __seo)" "1" "$(grep -c '^rls=false$' <<<"$RECREATE")"

echo; echo "=== Compatibilité ANCIEN code / NOUVEAU schéma ==="
assert "ancien upsert property_total (merge-duplicates sans la colonne) → le marqueur n'est PAS remis à NULL" "1" \
  "$(sql "BEGIN;
UPDATE public.__seo_gsc_daily_property_total SET commit_version = 1 WHERE date = '2026-08-25';
SET LOCAL ROLE service_role;
INSERT INTO public.__seo_gsc_daily_property_total (date, clicks, impressions, ctr, position, fetched_at)
VALUES ('2026-08-25', 81, 5501, 0.0147, 11, now())
ON CONFLICT (date) DO UPDATE SET clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions,
  ctr = EXCLUDED.ctr, position = EXCLUDED.position, fetched_at = EXCLUDED.fetched_at;
SELECT commit_version FROM public.__seo_gsc_daily_property_total WHERE date = '2026-08-25';
ROLLBACK;")"
assert "ancien upsert d'un jour neuf → sans marqueur (non certifié)" "t" \
  "$(sql "BEGIN; SET LOCAL ROLE service_role;
INSERT INTO public.__seo_gsc_daily_property_total (date, clicks, impressions, ctr, position) VALUES ('2026-09-01', 1, 2, 0.5, 1)
ON CONFLICT (date) DO UPDATE SET clicks = EXCLUDED.clicks;
SELECT commit_version IS NULL FROM public.__seo_gsc_daily_property_total WHERE date = '2026-09-01';
ROLLBACK;")"
assert "ancien lecteur (colonnes historiques) répond" "OUI" \
  "$(probe service_role "SELECT date, clicks, impressions, ctr, position FROM public.__seo_gsc_daily_property_total;")"
assert "ancien écrivain __seo_gsc_daily_pages répond" "OUI" \
  "$(probe service_role "INSERT INTO public.__seo_gsc_daily_pages (date, page, country, device) VALUES ('2026-09-02', '$PAGE_A', 'fra', 'mobile');")"
assert "v3 : enveloppe identique à l'avant-migration" "$V3_BEFORE" \
  "$(sql "BEGIN; SET LOCAL ROLE service_role; SELECT $V3_CALL::text; ROLLBACK;")"

echo; echo "=== Migration 2 (rpc_seo_low_ctr_v4), 2 applications ==="
apply "$M2"; assert "1re application" "0" "$?"
apply "$M2"; assert "2e application (idempotente)" "0" "$?"
SIG="public.rpc_seo_low_ctr_v4(integer, timestamptz, integer, numeric, integer, date)"
assert "v4 : STABLE, search_path épinglé, SECURITY INVOKER" "s|{search_path=public}|false" \
  "$(sql "SELECT provolatile::text || '|' || proconfig::text || '|' || prosecdef::text FROM pg_proc WHERE oid = '$SIG'::regprocedure;")"
assert "v4 : aucun EXECUTE pour PUBLIC (privilèges par défaut retirés)" "0" \
  "$(sql "SELECT count(*) FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid = '$SIG'::regprocedure)) a WHERE a.grantee = 0;")"
assert "anon → v4 refusé" "ERR:42501" "$(probe anon "SELECT $(v4);")"
assert "authenticated → v4 refusé" "ERR:42501" "$(probe authenticated "SELECT $(v4);")"
assert "service_role → v4 autorisé" "OUI" "$(probe service_role "SELECT $(v4);")"
assert "v4 : une seule signature (pas de surcharge PGRST203)" "1" "$(sql "SELECT count(*) FROM pg_proc WHERE proname = 'rpc_seo_low_ctr_v4';")"
assert "v3 : enveloppe toujours identique" "$V3_BEFORE" \
  "$(sql "BEGIN; SET LOCAL ROLE service_role; SELECT $V3_CALL::text; ROLLBACK;")"

echo; echo "=== rpc_seo_low_ctr_v4 — scénarios (fenêtre 10 j : 09-01..09-10) ==="
assert "S1 complet → ok" 'ok|10|10|[]|complete|[]|1|2026-09-01|2026-09-10' \
  "$(scen "$SEED_COMPLETE" "$(summary "$(v4)")")"
assert "S1 ligne : page, surface R1 (chemin), impressions, position pondérée, sévérité, score" \
  "$PAGE_A|R1|30000|0|4|critical|1500" \
  "$(scen "$SEED_COMPLETE" "(SELECT concat_ws('|', r->>'page', r->>'surface_key', r->>'impressions', r->>'clicks', r->>'avg_position', r->>'severity', r->>'business_impact_score') FROM (SELECT $(v4)->'rows'->0 AS r) x)")"
assert "S1 écart d'agrégation publié, non bloquant (≠ égalité imposée)" "1|1.0364|false" \
  "$(scen "$SEED_COMPLETE" "(SELECT concat_ws('|', g->>'page_vs_property_clicks_ratio', g->>'page_vs_property_impressions_ratio', g->>'blocking') FROM (SELECT $(v4)->'gsc_aggregation' AS g) x)")"
S2_SEED="$SEED_COMPLETE
DELETE FROM public.__seo_gsc_daily_property_total WHERE date IN ('2026-09-04', '2026-09-05');
UPDATE public.__seo_gsc_daily_property_total SET commit_version = NULL WHERE date = '2026-09-06';
UPDATE public.__seo_gsc_daily_page_totals SET impressions = 99999 WHERE date = '2026-09-06' AND page = '$PAGE_A';"
assert "S2 partiel (2 absents + 1 non commité) → incomplete_days, jours listés" \
  'incomplete_days|10|7|["2026-09-04", "2026-09-05", "2026-09-06"]|complete|[]|1|2026-09-01|2026-09-10' \
  "$(scen "$S2_SEED" "$(summary "$(v4)")")"
assert "S2 lignes page des jours non commités exclues du numérateur" "21000" \
  "$(scen "$S2_SEED" "$(v4)->'rows'->0->>'impressions'")"
assert "S3 vide → insufficient_data, rien d'affirmé" 'insufficient_data|0|0|[]|unknown|[]|0|null|null' \
  "$(scen "" "$(summary "$(v4)")")"
assert "S3 vide → rows []" "[]" "$(scen "" "($(v4)->'rows')::text")"
assert "S4 grain page non récupéré un jour commité → coverage_gap (récupération), pas un jour manquant" \
  'coverage_gap|10|10|[]|gap|["2026-09-03"]|1|2026-09-01|2026-09-10' \
  "$(scen "$SEED_COMPLETE
DELETE FROM public.__seo_gsc_daily_page_totals WHERE date = '2026-09-03';" "$(summary "$(v4)")")"
assert "S4b grain page indisponible sur toute la fenêtre → coverage_gap, 10 jours en trou, 0 ligne" "coverage_gap|gap|10|0" \
  "$(scen "$SEED_COMPLETE
DELETE FROM public.__seo_gsc_daily_page_totals;" "(SELECT concat_ws('|', v->>'coverage_status', v->>'retrieval_status', jsonb_array_length(v->'retrieval_gap_dates'), v->>'total_qualifying') FROM (SELECT $(v4) AS v) x)")"
S5_SEED="$SEED_COMPLETE
UPDATE public.__seo_gsc_daily_page_totals SET impressions = 1500 WHERE page = '$PAGE_A';
UPDATE public.__seo_gsc_daily_page_totals SET impressions = 1250, clicks = 40 WHERE page = '$PAGE_B';"
assert "S5 écart d'agrégation GSC fort (ratios 0,5), grain récupéré → ok (le ratio ne décide pas)" \
  'ok|10|10|[]|complete|[]|1|2026-09-01|2026-09-10' "$(scen "$S5_SEED" "$(summary "$(v4)")")"
assert "S5 ratios publiés" "0.5|0.5" \
  "$(scen "$S5_SEED" "(SELECT concat_ws('|', g->>'page_vs_property_clicks_ratio', g->>'page_vs_property_impressions_ratio') FROM (SELECT $(v4)->'gsc_aggregation' AS g) x)")"
assert "S6 jour zéro CONFIRMÉ (commité 0/0, sans ligne page) → présent, pas un trou" \
  'ok|10|10|[]|complete|[]|1|2026-09-01|2026-09-10' \
  "$(scen "$SEED_COMPLETE
UPDATE public.__seo_gsc_daily_property_total SET clicks = 0, impressions = 0, ctr = 0, position = 0 WHERE date = '2026-09-02';
DELETE FROM public.__seo_gsc_daily_page_totals WHERE date = '2026-09-02';" "$(summary "$(v4)")")"
S7_SEED="$SEED_COMPLETE
DELETE FROM public.__seo_gsc_daily_property_total WHERE date < '2026-09-05';
DELETE FROM public.__seo_gsc_daily_page_totals WHERE date < '2026-09-05';"
assert "S7 plancher p_expected_from = 09-05 → jours antérieurs non attendus" \
  'ok|6|6|[]|complete|[]|1|2026-09-05|2026-09-10' "$(scen "$S7_SEED" "$(summary "$(v4 10 "DATE '2026-09-05'")")")"
assert "S7 sans plancher → 09-01..09-04 manquants" \
  'incomplete_days|10|6|["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]|complete|[]|1|2026-09-05|2026-09-10' \
  "$(scen "$S7_SEED" "$(summary "$(v4)")")"
assert "S8 queue non finalisée (09-09, 09-10 absents) → non comptée manquante, portée par last_data_date" \
  'ok|8|8|[]|complete|[]|1|2026-09-01|2026-09-08|2026-09-08' \
  "$(scen "$SEED_COMPLETE
DELETE FROM public.__seo_gsc_daily_property_total WHERE date > '2026-09-08';
DELETE FROM public.__seo_gsc_daily_page_totals WHERE date > '2026-09-08';" "$(summary "$(v4)") || '|' || ($(v4)->>'last_data_date')")"
S1_UTC=$(scen "$SEED_COMPLETE" "$(summary "$(v4)")")
assert "S9 fuseau de session America/Los_Angeles → même enveloppe qu'en UTC" "$S1_UTC" \
  "$(scen "$SEED_COMPLETE" "$(summary "$(v4)")" "America/Los_Angeles")"
assert "S9 fuseau de session Pacific/Kiritimati → même enveloppe qu'en UTC" "$S1_UTC" \
  "$(scen "$SEED_COMPLETE" "$(summary "$(v4)")" "Pacific/Kiritimati")"
assert "S10 état actuel PROD (lignes legacy sans marqueur) → insufficient_data, jamais certifié" \
  'insufficient_data|0|0|[]|unknown|[]|0|null|null' \
  "$(sql "BEGIN; SET LOCAL ROLE service_role; SELECT $(summary "$(v4 30)"); ROLLBACK;")"

echo; echo "=== Reprise interrompue rejouée côté base (séquence d'écritures du fetcher) ==="
RESUME=$(sql "BEGIN;
DELETE FROM public.__seo_gsc_daily_page_totals;
DELETE FROM public.__seo_gsc_daily_property_total;
$SEED_COMPLETE
SET LOCAL ROLE service_role;
SELECT 'T0=' || $(summary "$(v4)");
UPDATE public.__seo_gsc_daily_property_total SET commit_version = NULL WHERE date = '2026-09-07';
SELECT 'T1=' || $(summary "$(v4)");
INSERT INTO public.__seo_gsc_daily_page_totals (date, page, clicks, impressions, ctr, position)
VALUES ('2026-09-07', '$PAGE_A', 0, 99999, 0, 4)
ON CONFLICT (date, page) DO UPDATE SET clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions;
SELECT 'T2=' || $(summary "$(v4)") || '|' || ($(v4)->'rows'->0->>'impressions');
INSERT INTO public.__seo_gsc_daily_page_totals (date, page, clicks, impressions, ctr, position)
VALUES ('2026-09-07', '$PAGE_A', 0, 3000, 0, 4), ('2026-09-07', '$PAGE_B', 80, 2700, 0.0296, 8)
ON CONFLICT (date, page) DO UPDATE SET clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions;
INSERT INTO public.__seo_gsc_daily_property_total (date, clicks, impressions, ctr, position, commit_version)
VALUES ('2026-09-07', 80, 5500, 0.0145, 11, 1)
ON CONFLICT (date) DO UPDATE SET clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions, commit_version = EXCLUDED.commit_version;
SELECT 'T3=' || $(summary "$(v4)") || '|' || ($(v4)->'rows'->0->>'impressions');
ROLLBACK;")
assert "T0 jour 09-07 commité → ok" 'T0=ok|10|10|[]|complete|[]|1|2026-09-01|2026-09-10' "$(grep '^T0=' <<<"$RESUME")"
assert "T1 marqueur retiré avant réécriture → 09-07 exclu, listé manquant" \
  'T1=incomplete_days|10|9|["2026-09-07"]|complete|[]|1|2026-09-01|2026-09-10' "$(grep '^T1=' <<<"$RESUME")"
assert "T2 réécriture partielle puis panne → toujours exclu, valeur partielle NON comptée" \
  'T2=incomplete_days|10|9|["2026-09-07"]|complete|[]|1|2026-09-01|2026-09-10|27000' "$(grep '^T2=' <<<"$RESUME")"
assert "T3 reprise complète + commit en dernier → ok, valeurs complètes" \
  'T3=ok|10|10|[]|complete|[]|1|2026-09-01|2026-09-10|30000' "$(grep '^T3=' <<<"$RESUME")"
assert "Contre-exemple (code avant correctif, sans retrait du marqueur) → reprise partielle CERTIFIÉE" \
  'ok|10|10|[]|complete|[]|1|2026-09-01|2026-09-10|126999' \
  "$(scen "$SEED_COMPLETE
UPDATE public.__seo_gsc_daily_page_totals SET impressions = 99999 WHERE date = '2026-09-07' AND page = '$PAGE_A';" \
    "$(summary "$(v4)") || '|' || ($(v4)->'rows'->0->>'impressions')")"

echo; echo "=== Rollback (.down) — base jetable uniquement ==="
WRONG=$( { echo "BEGIN;"; cat "$M1_DOWN"; cat <<'SQL'
DO $$ BEGIN
  PERFORM public.rpc_seo_low_ctr_v4(10, now(), 100, 0.01, 50, NULL);
  RAISE NOTICE 'RESULT=V4_OK';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RESULT=V4_BROKEN_%', SQLSTATE;
END $$;
ROLLBACK;
SQL
} | docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q 2>&1 | grep -oE 'RESULT=[A-Z0-9_]+')
assert "mauvais ordre (table retirée avant v4) → v4 cassée à l'appel (d'où l'ordre documenté)" "1" \
  "$(grep -cE '^RESULT=V4_BROKEN_42(703|P01)$' <<<"$WRONG")"
apply "$M2_DOWN"; assert "down v4" "0" "$?"
apply "$M1_DOWN"; assert "down table/marqueur" "0" "$?"
assert "v4 absente" "ERR:42883" "$(probe service_role "SELECT 1 FROM pg_proc WHERE oid = 'public.rpc_seo_low_ctr_v4(integer, timestamptz, integer, numeric, integer, date)'::regprocedure;")"
assert "table page_totals et partitions retirées" "0" "$(sql "SELECT count(*) FROM pg_class WHERE relname LIKE '\_\_seo\_gsc\_daily\_page\_totals%';")"
assert "colonne commit_version retirée" "0" "$(sql "SELECT count(*) FROM information_schema.columns WHERE table_name = '__seo_gsc_daily_property_total' AND column_name = 'commit_version';")"
assert "fonction partitions : corps PROD d'origine" "$FN_SRC_BEFORE" "$(sql "SELECT regexp_replace(prosrc, '\s+', ' ', 'g') FROM pg_proc WHERE proname = '__seo_ensure_monthly_partitions';")"
assert "fonction partitions : ACL d'origine" "$FN_ACL_BEFORE" "$(sql "SELECT proacl::text FROM pg_proc WHERE proname = '__seo_ensure_monthly_partitions';")"
assert "commentaire __seo_gsc_daily_pages d'origine" "$PAGES_COMMENT_BEFORE" "$(sql "SELECT obj_description('public.__seo_gsc_daily_pages'::regclass, 'pg_class');")"
assert "données property_total intactes" "$PT_DATA_BEFORE" "$(sql "SELECT md5(string_agg(concat_ws(',', date, clicks, impressions, ctr, position, fetched_at), ';' ORDER BY date)) FROM public.__seo_gsc_daily_property_total;")"
assert "v3 : enveloppe identique" "$V3_BEFORE" "$(sql "BEGIN; SET LOCAL ROLE service_role; SELECT $V3_CALL::text; ROLLBACK;")"
apply "$M1"; assert "ré-application table après rollback" "0" "$?"
apply "$M2"; assert "ré-application v4 après rollback" "0" "$?"
assert "service_role → v4 après ré-application" "OUI" "$(probe service_role "SELECT $(v4);")"

echo
echo "----------------------------------------"
echo "PASS=$pass  FAIL=$fail"
[[ "$fail" -eq 0 ]] || exit 1
exit 0
