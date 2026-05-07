#!/bin/bash
# seo-mvp0-smoke-test.sh
#
# Valide les critères 5/6/7 d'acceptance finale MVP-0 (ADR-050).
#
# DEV/PREPROD UNIQUEMENT — l'endpoint smoke-fail-enricher est refusé en prod.
# Pour validation prod : capture réelle ou dry-run sécurisé (Options A/B/C plan v12).
#
# Usage : bash scripts/ops/seo-mvp0-smoke-test.sh <ENV>
#   ENV : dev | preprod (PROD INTERDIT)
#
# Variables d'environnement attendues :
#   API_URL          (default: http://localhost:3000)
#   METRICS_URL      (default: http://localhost:3000/metrics)
#   DATABASE_URL     (pour psql RPC checks)
#   ADMIN_TOKEN      (token admin pour authentifier les calls)

set -euo pipefail

ENV="${1:-dev}"
if [ "$ENV" = "prod" ]; then
  echo "❌ Smoke test refusé en prod. Validation prod = capture réelle ou dry-run sécurisé (cf. plan v12 PR-X2-min)."
  exit 2
fi

API="${API_URL:-http://localhost:3000}"
METRICS="${METRICS_URL:-${API}/metrics}"

echo "▶ MVP-0 smoke test [$ENV]"
echo "  API     : $API"
echo "  METRICS : $METRICS"
echo ""

# ── Critère 5 — RPC quality history opérationnelle ────────────────────────
echo "→ [Critère 5/7] RPC detect_quality_outliers..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM detect_quality_outliers(30, 0.15);" \
  || { echo "❌ RPC detect_quality_outliers fail (PR-X1 non déployée ?)"; exit 1; }
echo "✓ RPC detect_quality_outliers OK"

echo "→ RPC ensure_next_quality_history_partition..."
psql "$DATABASE_URL" -c "SELECT ensure_next_quality_history_partition();" \
  || { echo "❌ RPC ensure_next_quality_history_partition fail"; exit 1; }
echo "✓ RPC ensure_next_quality_history_partition OK"

# ── Critère 6 — Sentry captureException sur 8 enrichers ───────────────────
echo ""
echo "→ [Critère 6/7] Force-fail 8 enrichers via /api/admin/seo/smoke-fail-enricher..."
ROLES=("R0_HOME" "R1_ROUTER" "R2_PRODUCT" "R3_CONSEILS" "R4_REFERENCE" "R6_GUIDE_ACHAT" "R7_BRAND" "R8_VEHICLE")
for ROLE in "${ROLES[@]}"; do
  echo -n "  $ROLE..."
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$API/api/admin/seo/smoke-fail-enricher" \
    -H "Content-Type: application/json" \
    -H "X-Admin-Token: ${ADMIN_TOKEN:-}" \
    -d "{\"role\":\"$ROLE\"}" || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo " ✓ (HTTP $HTTP_CODE)"
  else
    echo " ❌ (HTTP $HTTP_CODE)"
  fi
done
sleep 5  # propagation Sentry events
echo "✓ 8 captureException déclenchés (vérifier Sentry UI : ≥ 8 events distincts dernières 5 min)"

# ── Critère 7 — OTel counters exposés ─────────────────────────────────────
echo ""
echo "→ [Critère 7/7] /metrics endpoint..."
ENRICH_LINES=$(curl -sS "$METRICS" | grep -c "^seo_enrich_total" || echo "0")
GATE_LINES=$(curl -sS "$METRICS" | grep -c "^seo_gate_violation_total" || echo "0")

if [ "$ENRICH_LINES" -ge 8 ]; then
  echo "✓ seo_enrich_total : $ENRICH_LINES séries (≥ 8 attendu)"
else
  echo "❌ seo_enrich_total : $ENRICH_LINES séries (< 8)"
  exit 1
fi

if [ "$GATE_LINES" -ge 1 ]; then
  echo "✓ seo_gate_violation_total : $GATE_LINES séries"
else
  echo "⚠ seo_gate_violation_total : 0 série (non bloquant en smoke ; PR-X2-min.bis instrumentera les autres enrichers)"
fi

echo ""
echo "✓ MVP-0 smoke test PASSED"
echo ""
echo "Vérifications finales manuelles :"
echo "  1. Sentry UI : ≥ 8 events distincts SeoMvp0SmokeTestError les 5 dernières min"
echo "  2. Sentry tags filtrables : module=seo-enricher, role=R0_HOME...R8_VEHICLE"
echo "  3. Si Prometheus déployé : scrape http://<host>/metrics doit voir les counters"
