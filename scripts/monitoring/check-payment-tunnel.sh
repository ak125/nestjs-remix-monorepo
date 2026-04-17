#!/usr/bin/env bash
# check-payment-tunnel.sh — PREV-1 alerting interne pour le tunnel Paybox
#
# Contexte : incident 2026-03-20 → 2026-04-14 (25 jours, 14 commandes unpaid,
# ~2 500 € GMV bloquée) causé par 3 bugs cumulés (Cloudflare WAF + Gate
# errorCode + RPC type error). Détection externe via monitoring tiers à J+25.
# Ce script garantit une détection en < 2h en cas de récidive.
#
# Règle : alerte Slack si >= 2 commandes créées dans les 2h ET 0 payée.
#
# Déploiement :
#   - Installer sur prod 49.12.233.2
#   - Requires psql (client postgres) ou curl + supabase REST API
#   - Env vars : SUPABASE_DB_URL (connection string) ET SLACK_WEBHOOK_URL
#   - Cron : */15 * * * * /opt/automecanik/scripts/monitoring/check-payment-tunnel.sh
#
# Exit codes :
#   0 = OK (tunnel sain OU pas assez de signal pour alerter)
#   1 = erreur technique (DB down, creds manquants) — traité par cron comme MAILTO
#   2 = alerte envoyée (paiement tunnel suspect)

set -euo pipefail

SCRIPT_NAME="check-payment-tunnel"
LOG_PREFIX="[${SCRIPT_NAME}]"

# --- Config via env ---------------------------------------------------------
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL manquant (postgres connection string)}"
: "${SLACK_WEBHOOK_URL:?SLACK_WEBHOOK_URL manquant (Slack incoming webhook)}"

# Seuils configurables
MIN_ORDERS_THRESHOLD="${MIN_ORDERS_THRESHOLD:-2}"   # >= 2 commandes pour déclencher
WINDOW_HOURS="${WINDOW_HOURS:-2}"                   # fenêtre d'observation
DEDUP_CACHE="${DEDUP_CACHE:-/var/tmp/check-payment-tunnel.last-alert}"
DEDUP_WINDOW_MIN="${DEDUP_WINDOW_MIN:-60}"          # ne pas ré-alerter < 60 min

# --- Logging ----------------------------------------------------------------
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ${LOG_PREFIX} $*" >&2; }

# --- Requête DB -------------------------------------------------------------
# Utilise psql en mode -tA pour une sortie compacte "orders_2h|paid_2h"
QUERY="SELECT
  COUNT(*) FILTER (WHERE ord_date::timestamptz >= NOW() - INTERVAL '${WINDOW_HOURS} hours'),
  COUNT(*) FILTER (WHERE ord_date::timestamptz >= NOW() - INTERVAL '${WINDOW_HOURS} hours' AND ord_is_pay = '1'),
  (SELECT MAX(ord_date_pay)::text FROM ___xtr_order WHERE ord_is_pay = '1')
FROM ___xtr_order;"

RESULT=$(psql "$SUPABASE_DB_URL" -tA -F '|' -c "$QUERY" 2>&1) || {
  log "ERROR: psql failed: $RESULT"
  exit 1
}

orders_window=$(echo "$RESULT" | awk -F '|' '{print $1}')
paid_window=$(echo "$RESULT" | awk -F '|' '{print $2}')
last_paid=$(echo "$RESULT" | awk -F '|' '{print $3}')

log "INFO: orders_${WINDOW_HOURS}h=${orders_window} paid_${WINDOW_HOURS}h=${paid_window} last_paid=${last_paid:-never}"

# --- Évaluation règle -------------------------------------------------------
if [ "$orders_window" -lt "$MIN_ORDERS_THRESHOLD" ]; then
  log "OK: pas assez de commandes dans la fenêtre (${orders_window} < ${MIN_ORDERS_THRESHOLD}), pas de signal"
  exit 0
fi

if [ "$paid_window" -gt 0 ]; then
  log "OK: tunnel sain (${paid_window}/${orders_window} paid dans ${WINDOW_HOURS}h)"
  exit 0
fi

# --- Anti-spam : ne pas ré-alerter trop fréquemment -------------------------
if [ -f "$DEDUP_CACHE" ]; then
  last_alert_ts=$(cat "$DEDUP_CACHE" 2>/dev/null || echo "0")
  now_ts=$(date +%s)
  dedup_seconds=$((DEDUP_WINDOW_MIN * 60))
  if [ $((now_ts - last_alert_ts)) -lt "$dedup_seconds" ]; then
    log "OK: alerte déjà envoyée < ${DEDUP_WINDOW_MIN} min, skip dedup"
    exit 0
  fi
fi

# --- Payload alerte ---------------------------------------------------------
HOSTNAME_SAFE=$(hostname)
ALERT_TITLE=":rotating_light: SEV1 — Payment tunnel possibly broken"
ALERT_TEXT="orders_${WINDOW_HOURS}h=${orders_window} · paid_${WINDOW_HOURS}h=${paid_window} · last_paid=${last_paid:-never}"
RUNBOOK_HINT="Runbook: .spec/runbooks/payments-tunnel-debug.md (TODO)"
HINT="Historical incident: .spec/reports/incident-2026-04-14-payments-sev1.md"

# Slack Block Kit payload
PAYLOAD=$(cat <<JSON
{
  "text": "${ALERT_TITLE}",
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "${ALERT_TITLE}" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Host:*\n${HOSTNAME_SAFE}" },
        { "type": "mrkdwn", "text": "*Window:*\n${WINDOW_HOURS}h" },
        { "type": "mrkdwn", "text": "*Orders:*\n${orders_window}" },
        { "type": "mrkdwn", "text": "*Paid:*\n${paid_window} (expected: > 0)" }
      ]
    },
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": "*Last known paid order:* \`${last_paid:-never}\`\n\n*Immediate checks:*\n1. Backend callback logs: \`docker logs nestjs-remix-monorepo-prod --since 30m | grep -E 'Callback IPN|GATE'\`\n2. __paybox_gate_log DB: row récente avec rejected=true ?\n3. Cloudflare Security Events filter path=/api/paybox" }
    },
    {
      "type": "context",
      "elements": [
        { "type": "mrkdwn", "text": "${HINT}" }
      ]
    }
  ]
}
JSON
)

# --- Envoi Slack ------------------------------------------------------------
HTTP_CODE=$(curl -sS -o /tmp/${SCRIPT_NAME}-slack.out -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  --data-raw "$PAYLOAD" \
  "$SLACK_WEBHOOK_URL" 2>&1) || {
  log "ERROR: curl to Slack failed"
  exit 1
}

if [ "$HTTP_CODE" = "200" ]; then
  log "ALERT: Slack notification sent (HTTP 200)"
  date +%s > "$DEDUP_CACHE"
  exit 2
else
  log "ERROR: Slack returned HTTP ${HTTP_CODE} — body: $(cat /tmp/${SCRIPT_NAME}-slack.out)"
  exit 1
fi
