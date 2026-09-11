#!/usr/bin/env bash
# =============================================================================
# Test de comportement de la migration 20260911_seo_cwv_daily_rum_exact_p75.sql
#
# Rejoue la chaîne RUM CWV (raw → hourly → daily_rum → détecteur) AVANT puis
# APRÈS la migration et vérifie le COMPORTEMENT :
#   - le p75 quotidien historique (moyenne pondérée de p75 horaires) est
#     reproduit tel quel sur les valeurs réelles du 2026-09-09, puis inchangé ;
#   - p75_exact = percentile_disc(0.75) du brut, compteurs good / NI / poor aux
#     seuils du canon (.spec/00-canon/seo-runtime/cwv-taxonomy.yaml §metrics),
#     bornes comprises (good ≤ seuil good, poor > seuil poor) ;
#   - un recalcul après disparition du brut ne remplace jamais un bloc exact
#     complet ; une journée non close ne produit pas de bloc exact ;
#   - le détecteur compare p75_exact avec les planchers de n, et ignore les
#     jours sans bloc exact ;
#   - droits EXECUTE, search_path figé, idempotence, rollback documenté.
#
# Environnement : conteneur PostgreSQL jetable (même majeure que la PROD), sans
# réseau (--network none) et sans écoute TCP (listen_addresses vide) : psql passe
# par le socket local du conteneur. Ne lit aucune variable de connexion Supabase.
#
# Usage : bash scripts/db/test-cwv-daily-rum-exact-p75.sh
# Sortie : 0 si toutes les assertions passent.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$ROOT/scripts/db/cwv-daily-rum-exact-p75-fixture.sql"
MIGRATION="$ROOT/backend/supabase/migrations/20260911_seo_cwv_daily_rum_exact_p75.sql"
DOWN="$ROOT/backend/supabase/migrations/20260911_seo_cwv_daily_rum_exact_p75.down.sql"
CANON="$ROOT/.spec/00-canon/seo-runtime/cwv-taxonomy.yaml"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="cwv-exact-p75-test-$$"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
command -v node   >/dev/null || { echo "FATAL: node requis (lecture du canon YAML)"; exit 2; }
for f in "$FIXTURE" "$MIGRATION" "$CANON"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done

# Les dates du test sont relatives au jour UTC courant : refuser de démarrer
# juste avant minuit plutôt que de produire un résultat instable.
if [[ "$(date -u +%H%M)" > "2350" ]]; then
  echo "FATAL: moins de 10 minutes avant minuit UTC — relancer après 00:00 UTC"; exit 2
fi

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
# q <sql> → sortie brute (une valeur), ou la ligne d'erreur
q() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -tAq -c "$1" 2>&1 | tr -d '\r'; }

pass=0; fail=0
assert() { # assert <libelle> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  PASS  $1 → $3"; pass=$((pass+1));
  else echo "  FAIL  $1 → obtenu '$3', attendu '$2'"; fail=$((fail+1)); fi
}

# probe <role> <sql> → OUI / REFUSE / ERREUR
probe() {
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

# --- Seuils : lus dans le canon YAML, jamais recopiés dans ce test ------------
THRESHOLDS_VALUES=$(cd "$ROOT" && node -e '
  const yaml = require("js-yaml"); const fs = require("fs");
  const m = yaml.load(fs.readFileSync(process.argv[1], "utf8")).metrics;
  const rows = Object.entries(m).map(([k, v]) => `(\x27${k}\x27, ${v.good_threshold}::real, ${v.poor_threshold}::real)`);
  process.stdout.write(rows.join(", "));
' "$CANON") || { echo "FATAL: lecture du canon YAML"; exit 2; }
echo "Seuils du canon : $THRESHOLDS_VALUES"
echo

echo "=== Application de la fixture (état PROD avant migration) ==="
psql_file -f - < "$FIXTURE" || { echo "FATAL: fixture en échec"; exit 2; }
echo "ok"; echo

T=$(q "SELECT (now() AT TIME ZONE 'UTC')::date")
D1=$(q "SELECT (now() AT TIME ZONE 'UTC')::date - 1")
D2=$(q "SELECT (now() AT TIME ZONE 'UTC')::date - 2")
D3=$(q "SELECT (now() AT TIME ZONE 'UTC')::date - 3")
echo "Jour courant UTC : $T — jours clos utilisés : $D1, $D2, $D3"

# raw_insert <date> <surface> <route_group> <tier> <device> <metric> <"(heure, valeur), ...">
raw_insert() {
  psql_file <<SQL
INSERT INTO public.__seo_cwv_raw (received_at, session_id, surface, route_group, priority_tier,
  funnel_step, url, metric, value, device, ua_class, nav_type)
SELECT ('$1'::date::timestamp AT TIME ZONE 'UTC') + make_interval(hours => v.h, mins => 1 + (row_number() OVER ())::int % 50),
       'fixture-session-' || row_number() OVER (), '$2', '$3', '$4',
       'view_other', 'https://example.test/fixture', '$6', v.val, '$5', 'human', 'navigate'
FROM (VALUES $7) AS v(h, val);
SQL
}
hourly() { # hourly <date> <heure>...
  local d="$1"; shift
  for h in "$@"; do
    q "SELECT public.aggregate_cwv_hourly(('$d'::date::timestamp AT TIME ZONE 'UTC') + make_interval(hours => $h))" >/dev/null
  done
}
daily() { q "SELECT rows_upserted FROM public.aggregate_cwv_daily_rum('$1'::date)"; }
row() { # row <date> <route_group> <device> <metric> <colonnes>
  q "SELECT $5 FROM public.__seo_cwv_daily_rum WHERE date = '$1' AND route_group = '$2' AND device = '$3' AND metric = '$4' AND ua_class = 'human'"
}

# --- Données brutes -----------------------------------------------------------
# A. Valeurs réelles pieces_product / mobile / INP du 2026-09-09 (13 beacons humains,
#    heure UTC : valeur). En PROD : p75 stocké 1588.3, percentile_disc du brut 512.
raw_insert "$D1" R2_PRODUCT pieces_product CWV_P0 mobile INP \
  "(1,104::real),(7,56),(7,72),(9,16),(10,72),(11,8),(12,512),(13,24),(14,1184),(18,416),(21,72),(21,6408),(22,8528)"
# B. Bornes des seuils, pour chaque métrique du canon : good, good×1.01, poor, poor×1.01.
for m in LCP INP CLS FCP TTFB; do
  raw_insert "$D1" HOME home CWV_P2 desktop "$m" \
    "$(q "SELECT format('(3,%s::real),(3,%s),(3,%s),(3,%s)', g, g * 1.01, p, p * 1.01) FROM (VALUES $THRESHOLDS_VALUES) t(metric, g, p) WHERE metric = '$m'")"
done
# C. Petit n où l'interpolation contredit la règle « ≥ 75 % des expériences » :
#    4/6 good (< 75 %), percentile_cont = 175.75 ≤ 200, percentile_disc = 201 > 200.
raw_insert "$D1" R8_VEHICLE r8_vehicle CWV_P1 desktop INP "(4,50::real),(4,60),(4,70),(4,100),(4,201),(4,300)"
# F. Horaire en retard : 2 lignes brutes, heure 6 jamais agrégée (témoin horaire = 1).
raw_insert "$D1" R2_PRODUCT pieces_product CWV_P0 desktop INP "(5,90::real),(6,110)"
# D. Couverture : 6 lignes sur 2 heures, puis disparition partielle et totale du brut.
raw_insert "$D2" R2_PRODUCT pieces_product CWV_P0 mobile LCP "(8,1000::real),(8,2000),(8,3000),(8,5000),(9,1500),(9,2600)"
# D'. Journée dont le brut disparaîtra avant tout calcul exact.
raw_insert "$D3" R2_PRODUCT pieces_product CWV_P0 mobile CLS "(2,0.01::real),(2,0.02)"

hourly "$D1" 0 1 2 3 4 5 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
hourly "$D2" 8 9
hourly "$D3" 2
daily "$D1" >/dev/null; daily "$D2" >/dev/null; daily "$D3" >/dev/null

# --- Détecteur : 35 jours de lignes quotidiennes (dates relatives à CURRENT_DATE) ---
# Fenêtres du détecteur : récente J-7..J-1, 3 j J-3..J-1, référence J-35..J-9.
psql_file <<'SQL'
INSERT INTO public.__seo_cwv_daily_rum (date, surface, route_group, priority_tier, device, metric, ua_class, sample_count, p75_value)
SELECT CURRENT_DATE - d, k.surface, k.route_group, 'CWV_P0', k.device, k.metric, 'human',
       CASE WHEN d <= 3 THEN k.n_3d WHEN d <= 7 THEN k.n_recent ELSE 20 END,
       CASE WHEN k.spike AND d <= 3 THEN 900 WHEN k.spike AND d <= 7 THEN 500 WHEN k.spike THEN 400 ELSE 2000 END
FROM generate_series(1, 35) AS d
CROSS JOIN (VALUES
  -- K : pic du seul estimateur historique (le cas de l'alerte du 2026-09-11)
  ('R2_PRODUCT', 'pieces_product', 'tablet',  'INP', true,  20, 20),
  -- G3 : même pic historique, mais aucun bloc exact
  ('R2_PRODUCT', 'pieces_product', 'unknown', 'INP', true,  20, 20),
  -- G2 : historique plat, régression réelle dans le bloc exact
  ('R2_PRODUCT', 'pieces_product', 'tablet',  'LCP', false, 20, 20),
  -- G4 : régression exacte, n sur 3 j sous le plancher (3×14 = 42)
  ('R2_PRODUCT', 'pieces_product', 'unknown', 'LCP', false, 30, 14),
  -- G5 : régression exacte, n sur 3 j au plancher (3×15 = 45)
  ('CHECKOUT',   'checkout',       'tablet',  'LCP', false, 30, 15)
) AS k(surface, route_group, device, metric, spike, n_recent, n_3d)
WHERE d <> 8;
SQL

echo "=== AVANT migration — le comportement live est reproduit ==="
assert "A : n quotidien = 13 (comme en PROD le 2026-09-09)" "13" "$(row "$D1" pieces_product mobile INP sample_count)"
assert "A : p75 historique = 1588.3 (valeur stockée en PROD)" "1588.3" "$(row "$D1" pieces_product mobile INP 'round(p75_value::numeric, 1)')"
assert "précondition fixture : EXECUTE par défaut sur aggregate_cwv_daily_rum" OUI "$(probe anon "SELECT public.aggregate_cwv_daily_rum(CURRENT_DATE - 30);")"
assert "détecteur historique : 2 alertes (pics de l'estimateur)" "2" "$(q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()")"
assert "détecteur historique : p75_3d_ms = 900 sur le pic" "900" "$(q "SELECT payload->>'p75_3d_ms' FROM public.__seo_event_log WHERE payload->>'device' = 'tablet' AND payload->>'metric' = 'INP'")"
q "DELETE FROM public.__seo_event_log" >/dev/null
echo

echo "=== Application de la migration ==="
# -1 : transaction unique, comme le runner de migration (la migration n'ouvre pas de BEGIN).
if docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION"; then
  echo "ok"
else
  echo "  FAIL  migration en échec"; fail=$((fail+1))
fi
echo

echo "=== APRÈS migration — bloc exact sur une journée close ==="
daily "$D1" >/dev/null
assert "A : p75 historique inchangé" "1588.3" "$(row "$D1" pieces_product mobile INP 'round(p75_value::numeric, 1)')"
assert "A : sample_count historique inchangé" "13" "$(row "$D1" pieces_product mobile INP sample_count)"
assert "A : p75_exact = percentile_disc du brut" "512" "$(row "$D1" pieces_product mobile INP p75_exact)"
assert "A : n_exact / raw_sample_count / version" "13|13|1" "$(row "$D1" pieces_product mobile INP "concat_ws('|', n_exact, raw_sample_count, estimator_version)")"
assert "A : good / NI / poor (seuils INP du canon)" "8|1|4" "$(row "$D1" pieces_product mobile INP "concat_ws('|', n_good, n_needs_improvement, n_poor)")"
for m in LCP INP CLS FCP TTFB; do
  assert "B : $m bornes → good 1 / NI 2 / poor 1" "1|2|1" "$(row "$D1" home desktop "$m" "concat_ws('|', n_good, n_needs_improvement, n_poor)")"
  assert "B : $m p75_exact = seuil poor (rang 3 sur 4)" "t" \
    "$(q "SELECT d.p75_exact = t.p FROM public.__seo_cwv_daily_rum d JOIN (VALUES $THRESHOLDS_VALUES) t(metric, g, p) USING (metric) WHERE d.date = '$D1' AND d.route_group = 'home' AND d.device = 'desktop' AND d.metric = '$m'")"
done
assert "C : p75_exact = 201 (rang ⌈0,75·6⌉ = 5)" "201" "$(row "$D1" r8_vehicle desktop INP p75_exact)"
assert "C : percentile_cont aurait donné 175.75 malgré 4/6 good" "175.75|4" \
  "$(q "SELECT concat_ws('|', percentile_cont(0.75) WITHIN GROUP (ORDER BY value), count(*) FILTER (WHERE value <= 200)) FROM public.__seo_cwv_raw WHERE route_group = 'r8_vehicle' AND metric = 'INP'")"
assert "F : horaire en retard → bloc exact sur tout le brut" "1|2|2|1" "$(row "$D1" pieces_product desktop INP "concat_ws('|', sample_count, raw_sample_count, n_exact, estimator_version)")"
assert "invariants p75 ⇔ parts (règle des 75 %) sur toutes les lignes exactes" "0" \
  "$(q "SELECT count(*) FROM public.__seo_cwv_daily_rum d JOIN (VALUES $THRESHOLDS_VALUES) t(metric, g, p) USING (metric)
        WHERE d.date = '$D1' AND d.estimator_version IS NOT NULL
          AND NOT ((d.p75_exact <= t.g) = (d.n_good >= 0.75 * d.n_exact)
               AND (d.p75_exact >  t.p) = (d.n_poor > 0.25 * d.n_exact)
               AND d.n_good + d.n_needs_improvement + d.n_poor = d.n_exact)")"
# Les lignes « détecteur » (tablet / unknown) sont insérées directement, sans brut ni horaire.
assert "toutes les lignes agrégées du jour clos (8) ont un bloc exact" "8|0" \
  "$(q "SELECT concat_ws('|', count(*), count(*) FILTER (WHERE estimator_version IS NULL)) FROM public.__seo_cwv_daily_rum WHERE date = '$D1' AND device NOT IN ('tablet', 'unknown')")"
echo

echo "=== APRÈS migration — couverture du brut ==="
daily "$D2" >/dev/null
assert "D : bloc exact complet" "3000|6|3|2|1|1" "$(row "$D2" pieces_product mobile LCP "concat_ws('|', p75_exact, n_exact, n_good, n_needs_improvement, n_poor, estimator_version)")"
q "DELETE FROM public.__seo_cwv_raw WHERE received_at >= ('$D2'::date::timestamp AT TIME ZONE 'UTC') + interval '9 hours' AND received_at < ('$D2'::date::timestamp AT TIME ZONE 'UTC') + interval '10 hours'" >/dev/null
daily "$D2" >/dev/null
assert "D : brut partiel (4/6) → bloc exact conservé, couverture tracée" "3000|6|4|6|1" "$(row "$D2" pieces_product mobile LCP "concat_ws('|', p75_exact, n_exact, raw_sample_count, sample_count, estimator_version)")"
q "DROP TABLE public.__seo_cwv_raw_p$(echo "$D2" | tr -d '-')" >/dev/null
daily "$D2" >/dev/null
assert "D : brut purgé (rotation) → bloc exact conservé, raw_sample_count 0" "3000|6|0|1" "$(row "$D2" pieces_product mobile LCP "concat_ws('|', p75_exact, n_exact, raw_sample_count, estimator_version)")"
q "DROP TABLE public.__seo_cwv_raw_p$(echo "$D3" | tr -d '-')" >/dev/null
daily "$D3" >/dev/null
assert "D' : brut absent sans calcul antérieur → pas de bloc exact" "2|0|t|t" "$(row "$D3" pieces_product mobile CLS "concat_ws('|', sample_count, raw_sample_count, p75_exact IS NULL, estimator_version IS NULL)")"
raw_insert "$T" HOME home CWV_P2 mobile LCP "(0,1234::real)"
hourly "$T" 0
daily "$T" >/dev/null
assert "E : journée non close → historique calculé, pas de bloc exact" "1|1|t|t" "$(row "$T" home mobile LCP "concat_ws('|', sample_count, raw_sample_count, p75_exact IS NULL, estimator_version IS NULL)")"
echo

echo "=== APRÈS migration — métrique admise par les CHECK mais absente des seuils ==="
# H. Le brut de cette métrique compte dans raw_sample_count (sinon il passerait pour purgé),
#    p75_exact et n_exact sont écrits, et les compteurs good / NI / poor restent NULL :
#    jamais 0, qui affirmerait « aucune valeur good ».
psql_file <<'SQL'
ALTER TABLE public.__seo_cwv_raw       DROP CONSTRAINT __seo_cwv_raw_metric_check;
ALTER TABLE public.__seo_cwv_hourly    DROP CONSTRAINT __seo_cwv_hourly_metric_check;
ALTER TABLE public.__seo_cwv_daily_rum DROP CONSTRAINT __seo_cwv_daily_rum_metric_check;
SQL
raw_insert "$D1" SEARCH search CWV_P2 mobile SANS_SEUIL "(2,10::real),(2,20),(3,30)"
hourly "$D1" 2 3
daily "$D1" >/dev/null
assert "H : brut compté, p75_exact et n écrits, compteurs NULL" "3|3|3|30|t|t|t|1" \
  "$(row "$D1" search mobile SANS_SEUIL "concat_ws('|', sample_count, raw_sample_count, coalesce(n_exact::text, 'NULL'), coalesce(p75_exact::text, 'NULL'), n_good IS NULL, n_needs_improvement IS NULL, n_poor IS NULL, coalesce(estimator_version::text, 'NULL'))")"
echo

echo "=== APRÈS migration — détecteur sur p75_exact ==="
psql_file <<'SQL'
UPDATE public.__seo_cwv_daily_rum SET
  p75_exact = CASE
    WHEN device = 'tablet' AND metric = 'INP' THEN CASE WHEN date >= CURRENT_DATE - 7 THEN 420 ELSE 400 END
    ELSE CASE WHEN date >= CURRENT_DATE - 7 THEN 3000 ELSE 2000 END
  END,
  n_exact = sample_count, raw_sample_count = sample_count,
  n_good = 0, n_needs_improvement = sample_count, n_poor = 0,
  estimator_version = 1
WHERE date >= CURRENT_DATE - 35 AND date < CURRENT_DATE AND priority_tier = 'CWV_P0'
  AND device IN ('tablet', 'unknown') AND NOT (route_group = 'pieces_product' AND device = 'unknown' AND metric = 'INP');
SQL
assert "2 alertes exactement (G2, G5)" "2" "$(q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()")"
assert "K : pic de l'estimateur historique seul → pas d'alerte" "0" "$(q "SELECT count(*) FROM public.__seo_event_log WHERE payload->>'route_group' = 'pieces_product' AND payload->>'device' = 'tablet' AND payload->>'metric' = 'INP'")"
assert "G3 : aucun bloc exact → pas d'alerte (pas de repli sur p75_value)" "0" "$(q "SELECT count(*) FROM public.__seo_event_log WHERE payload->>'device' = 'unknown' AND payload->>'metric' = 'INP'")"
assert "G4 : n sur 3 j sous le plancher → pas d'alerte" "0" "$(q "SELECT count(*) FROM public.__seo_event_log WHERE payload->>'route_group' = 'pieces_product' AND payload->>'device' = 'unknown' AND payload->>'metric' = 'LCP'")"
assert "G5 : n sur 3 j au plancher → alerte" "1" "$(q "SELECT count(*) FROM public.__seo_event_log WHERE payload->>'route_group' = 'checkout'")"
assert "G2 : charge utile (récent, référence, 3 j, %, n)" "3000|2000|3000|50.0|140|60|540" \
  "$(q "SELECT concat_ws('|', payload->>'p75_recent_ms', payload->>'p75_reference_ms', payload->>'p75_3d_ms', payload->>'degradation_pct', payload->>'samples_recent', payload->>'samples_3d', payload->>'samples_reference') FROM public.__seo_event_log WHERE payload->>'route_group' = 'pieces_product' AND payload->>'device' = 'tablet' AND payload->>'metric' = 'LCP'")"
assert "dédup : second passage sans nouvelle alerte" "0" "$(q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()")"
echo

echo "=== APRÈS migration — droits et métadonnées ==="
for fn in "aggregate_cwv_daily_rum(CURRENT_DATE - 30)" "detect_cwv_trend_divergence()"; do
  assert "anon          → $fn" REFUSE "$(probe anon "SELECT public.$fn;")"
  assert "authenticated → $fn" REFUSE "$(probe authenticated "SELECT public.$fn;")"
  assert "service_role  → $fn" OUI    "$(probe service_role "SELECT public.$fn;")"
done
assert "aucun EXECUTE PUBLIC résiduel" "0" \
  "$(q "SELECT count(*) FROM pg_proc WHERE oid IN ('public.aggregate_cwv_daily_rum(date)'::regprocedure, 'public.detect_cwv_trend_divergence()'::regprocedure) AND (proacl IS NULL OR proacl::text ~ '(\{|,)=X')")"
assert "SECURITY DEFINER + search_path figé (vide) sur les 2 fonctions" "2" \
  "$(q "SELECT count(*) FROM pg_proc WHERE oid IN ('public.aggregate_cwv_daily_rum(date)'::regprocedure, 'public.detect_cwv_trend_divergence()'::regprocedure) AND prosecdef AND proconfig = ARRAY['search_path=\"\"']")"
assert "colonnes ajoutées nullables sans défaut" "7" \
  "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '__seo_cwv_daily_rum' AND column_name IN ('p75_exact','n_exact','n_good','n_needs_improvement','n_poor','raw_sample_count','estimator_version') AND is_nullable = 'YES' AND column_default IS NULL")"
echo

echo "=== Idempotence : seconde application ==="
if docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION"; then
  daily "$D1" >/dev/null
  assert "A : bloc exact identique après réapplication" "512|13|8|1|4|1" "$(row "$D1" pieces_product mobile INP "concat_ws('|', p75_exact, n_exact, n_good, n_needs_improvement, n_poor, estimator_version)")"
else
  echo "  FAIL  seconde application en échec"; fail=$((fail+1))
fi
echo

echo "=== Rollback documenté (.down.sql) puis réapplication ==="
if [[ -f "$DOWN" ]] && docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$DOWN"; then
  assert "down : colonnes retirées" "0" \
    "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '__seo_cwv_daily_rum' AND column_name IN ('p75_exact','n_exact','n_good','n_needs_improvement','n_poor','raw_sample_count','estimator_version')")"
  assert "down : agrégat historique fonctionnel" "1588.3" "$(daily "$D1" >/dev/null; row "$D1" pieces_product mobile INP 'round(p75_value::numeric, 1)')"
  if docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$MIGRATION"; then
    daily "$D1" >/dev/null
    assert "réapplication après down : bloc exact recalculé" "512|13|1" "$(row "$D1" pieces_product mobile INP "concat_ws('|', p75_exact, n_exact, estimator_version)")"
  else
    echo "  FAIL  réapplication après down en échec"; fail=$((fail+1))
  fi
else
  echo "  FAIL  down absent ou en échec"; fail=$((fail+1))
fi

echo
echo "----------------------------------------"
echo "PASS=$pass  FAIL=$fail"
[[ "$fail" -eq 0 ]] || exit 1
exit 0
