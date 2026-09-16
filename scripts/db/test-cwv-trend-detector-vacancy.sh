#!/usr/bin/env bash
# =============================================================================
# Test de comportement de 20260916_seo_cwv_trend_detector_vacancy_signal.sql
#
# Prouve le défaut PUIS sa correction, sur des jeux de données déterministes :
#   1. AVANT la migration, un jeu SANS référence (l'état réel de la PROD le
#      2026-09-16) fait retourner alerts_inserted = 0 et n'écrit RIEN : la
#      garde est verte et aveugle, indiscernable de « aucune régression ».
#   2. APRÈS, le même jeu retourne toujours 0 (contrat inchangé) MAIS émet
#      anomaly_detected / alert_kind='cwv_trend_detector_blind_keys' portant
#      le plancher fautif et la liste des clés aveugles.
#   3. Cécité PARTIELLE : dès qu'une clé observée est sans référence, le signal
#      tient — même si d'autres clés sont couvertes. C'est le cas du run du
#      2026-09-19 (1 clé couverte sur 8) ; un déclencheur « vacance totale »
#      s'y serait tu.
#   4. AUTO-RÉSOLUTION : couverture complète ⇒ les événements ouverts sont
#      refermés (doctrine OPEN → STILL_OPEN → RESOLVED, miroir 20260626).
#   5. Les invariants déclarés « non touchés » sont VERROUILLÉS : planchers
#      100 / 300 / n·7≥300 et seuil 1,30 testés à leurs bornes exactes, plus
#      les filtres de périmètre (ua_class, priority_tier, metric).
#   6. Dédup 7 j, non-étouffement par le détecteur frère, droits, search_path,
#      idempotence, rollback.
#
# Réutilise la fixture de 20260911 (schéma + chaîne RUM + corps verbatim des
# fonctions live) : aucune duplication de schéma dans ce fichier.
#
# Environnement : conteneur PostgreSQL jetable (même majeure que la PROD), sans
# réseau (--network none) et sans écoute TCP : psql passe par le socket local.
# Ne lit aucune variable de connexion Supabase, ne touche aucune base réelle.
#
# Usage : bash scripts/db/test-cwv-trend-detector-vacancy.sh
# Sortie : 0 si toutes les assertions passent.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE="$ROOT/scripts/db/cwv-daily-rum-exact-p75-fixture.sql"
BASE="$ROOT/backend/supabase/migrations/20260911_seo_cwv_daily_rum_exact_p75.sql"
# MIGRATION_UNDER_TEST permet le test de mutation (pointer une copie altérée)
# sans toucher au fichier du dépôt. Par défaut : la migration réelle.
MIGRATION="${MIGRATION_UNDER_TEST:-$ROOT/backend/supabase/migrations/20260916_seo_cwv_trend_detector_vacancy_signal.sql}"
DOWN="$ROOT/backend/supabase/migrations/20260916_seo_cwv_trend_detector_vacancy_signal.down.sql"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="cwv-vacancy-test-$$"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
for f in "$FIXTURE" "$BASE" "$MIGRATION" "$DOWN"; do
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
q() { docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -tAq -c "$1" 2>&1 | tr -d '\r'; }

pass=0; fail=0
assert() { # assert <libelle> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  PASS  $1 → $3"; pass=$((pass+1));
  else echo "  FAIL  $1 → obtenu '$3', attendu '$2'"; fail=$((fail+1)); fi
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

KIND=cwv_trend_detector_blind_keys
run()          { q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()"; }
n_blind()      { q "SELECT count(*) FROM public.__seo_event_log WHERE event_type = 'anomaly_detected' AND payload->>'alert_kind' = '$KIND'"; }
n_open_blind() { q "SELECT count(*) FROM public.__seo_event_log WHERE event_type = 'anomaly_detected' AND payload->>'alert_kind' = '$KIND' AND resolved_at IS NULL"; }
n_regression() { q "SELECT count(*) FROM public.__seo_event_log WHERE event_type = 'cwv.alert.internal_regression'"; }
ev()           { q "SELECT payload->>'$1' FROM public.__seo_event_log WHERE payload->>'alert_kind' = '$KIND' ORDER BY created_at DESC LIMIT 1"; }
reset_log()    { q "TRUNCATE public.__seo_event_log" >/dev/null; }

# --- Jeux de données déterministes -------------------------------------------
#   recent    : date >= CURRENT_DATE-7 et < CURRENT_DATE → plancher sum(n_exact) >= 100
#   recent_3d : date >= CURRENT_DATE-3                   → plancher sum(n_exact)*7 >= 300
#   reference : date <  CURRENT_DATE-8                   → plancher sum(n_exact) >= 300
# Helper : une ligne jour×clé. add <offset_jours> <route_group> <device> <metric> <n> <p75> [ua_class] [tier]
add() {
  psql_file -c "INSERT INTO public.__seo_cwv_daily_rum
    (date, surface, route_group, priority_tier, device, metric, ua_class, sample_count, p75_value, p75_exact, n_exact)
    VALUES (CURRENT_DATE - $1, 'R2_PRODUCT', '$2', '${8:-CWV_P0}', '$3', '$4', '${7:-human}', $5, $6, $6, $5)" >/dev/null
}
clear_rum() { q "TRUNCATE public.__seo_cwv_daily_rum" >/dev/null; }

# Clé « standard » observée : 6 j × 60 = 360 (>= 100) ; 3 j = 180, ×7 = 1260 (>= 300)
seed_live() { # seed_live <route_group> <device> <metric> <p75>
  for g in 1 2 3 4 5 6; do add "$g" "$1" "$2" "$3" 60 "$4"; done
}
# Référence : 5 j × 70 = 350 (>= 300), tous < CURRENT_DATE-8
seed_ref() { # seed_ref <route_group> <device> <metric> <p75>
  for g in 10 11 12 13 14; do add "$g" "$1" "$2" "$3" 70 "$4"; done
}

echo "=== Fixture (schéma + chaîne RUM + fonctions live pré-20260911) ==="
psql_file -f - < "$FIXTURE" || { echo "FATAL: fixture en échec"; exit 2; }
echo "ok"; echo

echo "=== État de départ = PROD d'aujourd'hui (20260911 appliquée) ==="
apply "$BASE" "20260911"
echo

# =============================================================================
echo "=== 1. AVANT 20260916 — le défaut, reproduit ==="
clear_rum; seed_live pieces_product mobile INP 500; reset_log
assert "jeu aveugle : la garde retourne 0 alerte" "0" "$(run)"
assert "jeu aveugle : AUCUN événement écrit (défaut : muet)" "0" "$(q "SELECT count(*) FROM public.__seo_event_log")"
echo "  → indiscernable de « aucune régression » : c'est le défaut corrigé ci-dessous."
echo

echo "=== 2. Application de 20260916 ==="
apply "$MIGRATION" "20260916"
echo

echo "=== 3. APRÈS — la cécité est émise, le contrat de retour est inchangé ==="
clear_rum; seed_live pieces_product mobile INP 500; reset_log
assert "alerts_inserted toujours 0 (contrat inchangé)" "0" "$(run)"
assert "1 événement de cécité émis" "1" "$(n_blind)"
assert "AUCUNE alerte de régression parasite" "0" "$(n_regression)"
assert "charge utile : live_keys = 1" "1" "$(ev live_keys)"
assert "charge utile : comparable_keys = 0" "0" "$(ev comparable_keys)"
assert "charge utile : count = 1 clé aveugle" "1" "$(ev count)"
assert "charge utile : reference_keys = 0 (le plancher fautif)" "0" "$(ev reference_keys)"
assert "charge utile : recent_keys = 1 (le récent, lui, passe)" "1" "$(ev recent_keys)"
assert "charge utile : blind_keys nomme la clé" "pieces_product|mobile|INP" \
  "$(q "SELECT concat_ws('|', b->>'route_group', b->>'device', b->>'metric') FROM public.__seo_event_log e, jsonb_array_elements(e.payload->'blind_keys') b WHERE e.payload->>'alert_kind' = '$KIND'")"
assert "charge utile : reason survit à la projection rpc_seo_alerts_v1" "t" \
  "$(q "SELECT (payload ? 'reason') FROM public.__seo_event_log WHERE payload->>'alert_kind' = '$KIND'")"
assert "sévérité high (miroir 20260601)" "high" \
  "$(q "SELECT severity::text FROM public.__seo_event_log WHERE payload->>'alert_kind' = '$KIND'")"
echo

echo "=== 4. CÉCITÉ PARTIELLE — le cas du run du 2026-09-19 (1 couverte sur N) ==="
clear_rum
seed_live pieces_product desktop LCP 500; seed_ref pieces_product desktop LCP 500   # couverte
seed_live pieces_product mobile  INP 500                                            # aveugle
seed_live checkout       mobile  LCP 500                                            # aveugle
reset_log
assert "1 clé comparable sur 3 observées : le signal TIENT" "1" "$(run >/dev/null; n_blind)"
assert "charge utile : live_keys = 3" "3" "$(ev live_keys)"
assert "charge utile : comparable_keys = 1" "1" "$(ev comparable_keys)"
assert "charge utile : count = 2 clés aveugles" "2" "$(ev count)"
assert "blind_keys liste exactement les 2 aveugles" "checkout|mobile|LCP;pieces_product|mobile|INP" \
  "$(q "SELECT string_agg(concat_ws('|', b->>'route_group', b->>'device', b->>'metric'), ';' ORDER BY b->>'route_group') FROM public.__seo_event_log e, jsonb_array_elements(e.payload->'blind_keys') b WHERE e.payload->>'alert_kind' = '$KIND'")"
echo "  → un déclencheur « comparable = 0 » se serait tu ici : c'est le défaut que la revue a trouvé."
echo

echo "=== 5. AUTO-RÉSOLUTION (doctrine OPEN → STILL_OPEN → RESOLVED, miroir 20260626) ==="
assert "précondition : 1 événement OUVERT" "1" "$(n_open_blind)"
clear_rum; seed_live pieces_product mobile INP 500; seed_ref pieces_product mobile INP 500
assert "couverture complète : 0 alerte de régression" "0" "$(run)"
assert "couverture complète : aucun NOUVEL événement de cécité" "1" "$(n_blind)"
assert "couverture complète : l'événement ouvert est REFERMÉ" "0" "$(n_open_blind)"
assert "resolution_kind = detector_rearmed" "detector_rearmed" "$(ev resolution_kind)"
assert "resolved_by nommé" "detect_cwv_trend_divergence" "$(ev resolved_by)"
echo

echo "=== 6. Dédup 7 j et non-étouffement par le détecteur frère ==="
clear_rum; seed_live pieces_product mobile INP 500; reset_log
run >/dev/null; run >/dev/null; run >/dev/null
assert "3 exécutions consécutives → 1 seul événement" "1" "$(n_blind)"
reset_log
psql_file -c "INSERT INTO public.__seo_event_log (event_type, severity, payload)
  VALUES ('anomaly_detected', 'high', jsonb_build_object('alert_kind','cwv_aggregation_coverage_gap'))" >/dev/null
assert "un événement OUVERT du détecteur frère n'étouffe pas le signal" "1" "$(run >/dev/null; n_blind)"
assert "et le frère n'est pas refermé par erreur" "1" \
  "$(q "SELECT count(*) FROM public.__seo_event_log WHERE payload->>'alert_kind' = 'cwv_aggregation_coverage_gap' AND resolved_at IS NULL")"
echo

echo "=== 7. Invariants déclarés « non touchés » — verrouillés à leurs bornes ==="
# BL_IN  : recent = 43 (j-1) + 57 (j-5) = 100 pile  → DANS recent ; 3j = 43, ×7 = 301 → DANS recent_3d
# BL_OUT : recent = 43 + 56 = 99                    → HORS recent, donc hors live
# REF_IN : idem BL_IN + référence 300 pile          → comparable
# REF_OUT: idem BL_IN + référence 299               → aveugle
clear_rum; reset_log
add 1 bl_in       mobile INP 43 500;  add 5 bl_in       mobile INP 57 500
add 1 bl_out      mobile INP 43 500;  add 5 bl_out      mobile INP 56 500
add 1 ref_in      mobile INP 43 500;  add 5 ref_in      mobile INP 57 500;  add 10 ref_in  mobile INP 300 500
add 1 ref_out     mobile INP 43 500;  add 5 ref_out     mobile INP 57 500;  add 10 ref_out mobile INP 299 500
# Plancher 3 j (n·7 >= 300) à la borne : d3_in 43→301 DANS ; d3_out 42→294 DEHORS.
# Les deux passent recent (100), seul le plancher 3 j les sépare.
add 1 d3_in       mobile INP 43 500;  add 5 d3_in       mobile INP 57 500
add 1 d3_out      mobile INP 42 500;  add 5 d3_out      mobile INP 58 500
# Périmètre : ces 3 lignes ne doivent JAMAIS entrer dans le dénominateur
add 1 scope_bot   mobile INP 500 500 bot_search
add 1 scope_tier  mobile INP 500 500 human CWV_P1
add 1 scope_cls   mobile CLS 500 500
assert "planchers recent (100 pile) ET 3 j (n·7>=300) : live = 4" "4" "$(run >/dev/null; ev live_keys)"
assert "plancher 3 j : d3_out passe recent mais est exclu de live → recent_keys = 5" "5" "$(ev recent_keys)"
assert "plancher référence = 300 pile : ref_in comparable, ref_out non → comparable = 1" "1" "$(ev comparable_keys)"
assert "clés aveugles = bl_in + d3_in + ref_out" "bl_in|mobile|INP;d3_in|mobile|INP;ref_out|mobile|INP" \
  "$(q "SELECT string_agg(concat_ws('|', b->>'route_group', b->>'device', b->>'metric'), ';' ORDER BY b->>'route_group') FROM public.__seo_event_log e, jsonb_array_elements(e.payload->'blind_keys') b WHERE e.payload->>'alert_kind' = '$KIND'")"
# Les 3 lignes hors-périmètre portent n=500 : si l'une entrait, recent_keys passerait de 3 à 4+.
assert "périmètre : bot_search / CWV_P1 / CLS écartés (sinon recent_keys > 5)" "5" "$(ev recent_keys)"
assert "périmètre : aucune clé scope_* parmi les clés aveugles" "0" \
  "$(q "SELECT count(*) FROM public.__seo_event_log e, jsonb_array_elements(e.payload->'blind_keys') b WHERE e.payload->>'alert_kind' = '$KIND' AND b->>'route_group' LIKE 'scope_%'")"
echo

echo "=== 8. Seuil de divergence 1,30 — testé de part et d'autre ==="
clear_rum; reset_log
seed_live ratio_low  mobile INP 645; seed_ref ratio_low  mobile INP 500   # 1,29 → pas d'alerte
seed_live ratio_high mobile INP 655; seed_ref ratio_high mobile INP 500   # 1,31 → alerte
assert "ratio 1,31 alerte / ratio 1,29 non → exactement 1 alerte" "1" "$(run)"
assert "l'alerte porte bien sur ratio_high" "ratio_high" \
  "$(q "SELECT payload->>'route_group' FROM public.__seo_event_log WHERE event_type = 'cwv.alert.internal_regression'")"
assert "couverture complète ⇒ aucun événement de cécité" "0" "$(n_blind)"
assert "dédup régression 14 j inchangé (2e passage : 0)" "0" "$(run)"
echo

echo "=== 9. Droits et durcissement ==="
assert "anon ne peut pas exécuter le détecteur" "REFUSE" "$(probe anon "SELECT public.detect_cwv_trend_divergence();")"
assert "authenticated ne peut pas exécuter le détecteur" "REFUSE" "$(probe authenticated "SELECT public.detect_cwv_trend_divergence();")"
assert "service_role conserve EXECUTE" "t" \
  "$(q "SELECT has_function_privilege('service_role', 'public.detect_cwv_trend_divergence()', 'execute')")"
assert "search_path figé à vide" 'search_path=""' \
  "$(q "SELECT unnest(proconfig) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'detect_cwv_trend_divergence'")"
assert "SECURITY DEFINER conservé" "t" \
  "$(q "SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'detect_cwv_trend_divergence'")"
assert "aucun second détecteur créé" "1" \
  "$(q "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname LIKE 'detect_cwv_trend%'")"
assert "aucune valeur d'enum ajoutée (rollback intégral possible)" "2" \
  "$(q "SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'seo_event_type'")"
echo

echo "=== 10. Idempotence ==="
apply "$MIGRATION" "20260916 (2e application)"
clear_rum; seed_live pieces_product mobile INP 500; reset_log
assert "après ré-application : comportement identique" "1" "$(run >/dev/null; n_blind)"
echo

echo "=== 11. Rollback documenté (.down.sql) puis réapplication ==="
before_down="$(n_blind)"
apply "$DOWN" "rollback"
assert "après down : les événements déjà écrits ne sont PAS supprimés" "$before_down" "$(n_blind)"
assert "après down : la garde redevient muette (défaut restauré)" "$before_down" "$(run >/dev/null; n_blind)"
apply "$MIGRATION" "réapplication après down"
reset_log
assert "réapplication : le signal revient" "1" "$(run >/dev/null; n_blind)"
echo

echo "----------------------------------------"
echo "PASS=$pass  FAIL=$fail"
[[ "$fail" -eq 0 ]] || exit 1
exit 0
