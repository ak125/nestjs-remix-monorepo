#!/usr/bin/env bash
# =============================================================================
# Test de comportement de 20260916_seo_cwv_trend_detector_vacancy_signal.sql
#
# Prouve le défaut PUIS sa correction, sur des jeux de données déterministes :
#   1. AVANT la migration, un jeu SANS référence (l'état réel de la PROD le
#      2026-09-16) fait retourner alerts_inserted = 0 et n'écrit RIEN : la
#      garde est verte et vide, indiscernable de « aucune régression ».
#   2. APRÈS, le même jeu retourne toujours 0 (contrat inchangé) MAIS émet
#      anomaly_detected / alert_kind='cwv_trend_detector_vacant' portant le
#      plancher fautif (reference_keys = 0).
#   3. Pas de faux positif : dès qu'une clé est comparable, aucun signal de
#      vacance, et la détection de régression est inchangée (mêmes alertes
#      qu'avant la migration, sur le même jeu).
#   4. Dédup 7 j, droits EXECUTE, search_path figé, idempotence, rollback.
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
MIGRATION="$ROOT/backend/supabase/migrations/20260916_seo_cwv_trend_detector_vacancy_signal.sql"
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

# apply <fichier> <libelle> — transaction unique, comme le runner de migration.
apply() {
  if docker exec -i "$CT" psql -U postgres -d test -v ON_ERROR_STOP=1 -q -1 -f - < "$1"; then
    echo "  ok  $2"
  else
    echo "  FAIL  $2 en échec"; fail=$((fail+1))
  fi
}

# Compteurs d'événements
n_vacancy()    { q "SELECT count(*) FROM public.__seo_event_log WHERE event_type = 'anomaly_detected' AND payload->>'alert_kind' = 'cwv_trend_detector_vacant'"; }
n_regression() { q "SELECT count(*) FROM public.__seo_event_log WHERE event_type = 'cwv.alert.internal_regression'"; }
vac()          { q "SELECT payload->>'$1' FROM public.__seo_event_log WHERE payload->>'alert_kind' = 'cwv_trend_detector_vacant' ORDER BY created_at DESC LIMIT 1"; }
reset_log()    { q "TRUNCATE public.__seo_event_log" >/dev/null; }

# --- Jeux de données déterministes -------------------------------------------
# Une seule clé (pieces_product, mobile, INP), dates relatives à CURRENT_DATE.
#   recent    : date >= CURRENT_DATE-7 et < CURRENT_DATE   → plancher n_exact >= 100
#   recent_3d : date >= CURRENT_DATE-3                     → plancher n*7 >= 300
#   reference : date <  CURRENT_DATE-8                     → plancher n_exact >= 300
seed() { # seed <mode: vacant|comparable|regression>
  local mode="$1" recent_p75=500
  [[ "$mode" == "regression" ]] && recent_p75=900
  q "TRUNCATE public.__seo_cwv_daily_rum" >/dev/null
  # Fenêtre récente : 6 jours × 60 = 360 (>= 100) ; 3 j = 180, 180*7 = 1260 (>= 300)
  psql_file <<SQL
INSERT INTO public.__seo_cwv_daily_rum
  (date, surface, route_group, priority_tier, device, metric, ua_class,
   sample_count, p75_value, p75_exact, n_exact)
SELECT CURRENT_DATE - g, 'R2_PRODUCT', 'pieces_product', 'CWV_P0', 'mobile', 'INP', 'human',
       60, ${recent_p75}, ${recent_p75}, 60
FROM generate_series(1, 6) g;
SQL
  if [[ "$mode" != "vacant" ]]; then
    # Référence : 5 jours × 70 = 350 (>= 300), tous < CURRENT_DATE-8
    psql_file <<'SQL'
INSERT INTO public.__seo_cwv_daily_rum
  (date, surface, route_group, priority_tier, device, metric, ua_class,
   sample_count, p75_value, p75_exact, n_exact)
SELECT CURRENT_DATE - g, 'R2_PRODUCT', 'pieces_product', 'CWV_P0', 'mobile', 'INP', 'human',
       70, 500, 500, 70
FROM generate_series(10, 14) g;
SQL
  fi
}

echo "=== Fixture (schéma + chaîne RUM + fonctions live pré-20260911) ==="
psql_file -f - < "$FIXTURE" || { echo "FATAL: fixture en échec"; exit 2; }
echo "ok"; echo

echo "=== État de départ = PROD d'aujourd'hui (20260911 appliquée) ==="
apply "$BASE" "20260911"
echo

# =============================================================================
echo "=== 1. AVANT 20260916 — le défaut, reproduit ==="
seed vacant
reset_log
assert "jeu vacant : la garde retourne 0 alerte" "0" "$(q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()")"
assert "jeu vacant : AUCUN événement écrit (défaut : muet)" "0" "$(q "SELECT count(*) FROM public.__seo_event_log")"
echo "  → indiscernable de « aucune régression » : c'est le défaut corrigé ci-dessous."
echo

echo "=== 2. Application de 20260916 ==="
apply "$MIGRATION" "20260916"
echo

echo "=== 3. APRÈS — la vacance est émise, le contrat de retour est inchangé ==="
seed vacant
reset_log
assert "jeu vacant : alerts_inserted toujours 0 (contrat inchangé)" "0" "$(q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()")"
assert "jeu vacant : 1 événement de vacance émis" "1" "$(n_vacancy)"
assert "jeu vacant : AUCUNE alerte de régression parasite" "0" "$(n_regression)"
assert "charge utile : comparable_keys = 0" "0" "$(vac comparable_keys)"
assert "charge utile : reference_keys = 0 (le plancher fautif)" "0" "$(vac reference_keys)"
assert "charge utile : recent_keys = 1 (le récent, lui, passe)" "1" "$(vac recent_keys)"
assert "charge utile : recent_3d_keys = 1" "1" "$(vac recent_3d_keys)"
assert "charge utile : exact_day_rows = 6" "6" "$(vac exact_day_rows)"
assert "charge utile : cutoff de référence = CURRENT_DATE - 8" "$(q "SELECT (CURRENT_DATE - 8)::text")" "$(vac reference_cutoff_date)"
assert "sévérité high (miroir de 20260601)" "high" \
  "$(q "SELECT severity::text FROM public.__seo_event_log WHERE payload->>'alert_kind' = 'cwv_trend_detector_vacant'")"
echo

echo "=== 4. Dédup : un seul événement ouvert à la fois ==="
q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()" >/dev/null
q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()" >/dev/null
assert "3 exécutions consécutives → toujours 1 événement" "1" "$(n_vacancy)"
q "UPDATE public.__seo_event_log SET resolved_at = now() WHERE payload->>'alert_kind' = 'cwv_trend_detector_vacant'" >/dev/null
q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()" >/dev/null
assert "après résolution manuelle → ré-armable (2e événement)" "2" "$(n_vacancy)"
echo

echo "=== 5. Pas de faux positif : une clé comparable ⇒ aucun signal de vacance ==="
seed comparable
reset_log
assert "jeu comparable sans dérive : 0 alerte de régression" "0" "$(q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()")"
assert "jeu comparable : AUCUN événement de vacance" "0" "$(n_vacancy)"
echo

echo "=== 6. La détection de régression est inchangée par la migration ==="
seed regression
reset_log
assert "jeu divergent (900 vs 500 = +80 %) : 1 alerte" "1" "$(q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()")"
assert "jeu divergent : AUCUN événement de vacance" "0" "$(n_vacancy)"
assert "alerte : degradation_pct = 80.0" "80.0" \
  "$(q "SELECT payload->>'degradation_pct' FROM public.__seo_event_log WHERE event_type = 'cwv.alert.internal_regression'")"
assert "dédup régression 14 j inchangé (2e passage : 0)" "0" "$(q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()")"
echo

echo "=== 7. Droits et durcissement ==="
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

echo "=== 8. Idempotence : ré-appliquer la migration ne change rien ==="
apply "$MIGRATION" "20260916 (2e application)"
seed vacant
reset_log
assert "après ré-application : comportement identique" "1" \
  "$(q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()" >/dev/null; n_vacancy)"
echo

echo "=== 9. Rollback documenté (.down.sql) puis réapplication ==="
apply "$DOWN" "rollback"
seed vacant
reset_log
assert "après down : la garde redevient muette (défaut restauré)" "0" "$(q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()" >/dev/null; n_vacancy)"
assert "après down : les événements déjà écrits ne sont pas supprimés" "0" "$(n_vacancy)"
apply "$MIGRATION" "réapplication après down"
seed vacant
reset_log
assert "réapplication : le signal revient" "1" \
  "$(q "SELECT alerts_inserted FROM public.detect_cwv_trend_divergence()" >/dev/null; n_vacancy)"
echo

echo "----------------------------------------"
echo "PASS=$pass  FAIL=$fail"
[[ "$fail" -eq 0 ]] || exit 1
exit 0
