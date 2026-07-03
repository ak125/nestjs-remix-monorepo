#!/usr/bin/env bash
# check-payment-tunnel.sh — PREV-1 alerting interne pour le tunnel Paybox.
#
# Contexte : incident 2026-03-20 → 2026-04-14 (25 jours, 14 commandes unpaid,
# ~2 500 € GMV bloquée, 3 bugs cumulés). Détection externe à J+25. Ce script
# détecte la rupture en < 2h.
#
# Architecture : zéro dépendance système (psql/sendmail/mail), python3 stdlib.
#   - Supabase PostgREST : RPC check_payment_tunnel_health (curl POST)
#   - Gmail SMTP OAuth2  : envoi email alerte (python3 urllib + smtplib XOAUTH2)
#   - python3            : parsing JSON + OAuth2 + SMTP (pré-installé Ubuntu)
#
# Règle : alerte si >= MIN_ORDERS_THRESHOLD commandes créées dans la fenêtre
# WINDOW_HOURS ET 0 payée. Anti-spam DEDUP_WINDOW_MIN.
#
# Env requis (voir scripts/monitoring/README.md) :
#   SUPABASE_URL                  https://xxx.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY     <secret>
#   GMAIL_CLIENT_ID               <OAuth2 client ID>
#   GMAIL_CLIENT_SECRET           <OAuth2 client secret>
#   GMAIL_REFRESH_TOKEN           <OAuth2 refresh token>
#   GMAIL_USER_EMAIL              contact@automecanik.com (ou équivalent)
#   ALERT_EMAIL_TO                admin@automecanik.com
#   EMAIL_FROM                    Automecanik <alerts@automecanik.com>
#
# Env optionnel :
#   WINDOW_HOURS=2  MIN_ORDERS_THRESHOLD=2  DEDUP_WINDOW_MIN=60
#
# Exit codes :
#   0 = OK (tunnel sain ou signal insuffisant)
#   1 = erreur technique (API down, creds manquants, parsing)
#   2 = alerte envoyée (dedup actif)

set -euo pipefail

SCRIPT_NAME="check-payment-tunnel"
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [${SCRIPT_NAME}] $*" >&2; }

# --- Validation env --------------------------------------------------------
: "${SUPABASE_URL:?SUPABASE_URL manquant}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY manquant}"
: "${GMAIL_CLIENT_ID:?GMAIL_CLIENT_ID manquant}"
: "${GMAIL_CLIENT_SECRET:?GMAIL_CLIENT_SECRET manquant}"
: "${GMAIL_REFRESH_TOKEN:?GMAIL_REFRESH_TOKEN manquant}"
: "${GMAIL_USER_EMAIL:?GMAIL_USER_EMAIL manquant (ex: contact@automecanik.com)}"
: "${ALERT_EMAIL_TO:?ALERT_EMAIL_TO manquant (ex: admin@automecanik.com)}"
: "${EMAIL_FROM:?EMAIL_FROM manquant (ex: Automecanik <alerts@automecanik.com>)}"

WINDOW_HOURS="${WINDOW_HOURS:-2}"
MIN_ORDERS_THRESHOLD="${MIN_ORDERS_THRESHOLD:-2}"
DEDUP_CACHE="${DEDUP_CACHE:-/var/tmp/check-payment-tunnel.last-alert}"
DEDUP_WINDOW_MIN="${DEDUP_WINDOW_MIN:-60}"

# --- Appel RPC Supabase via PostgREST --------------------------------------
RPC_URL="${SUPABASE_URL}/rest/v1/rpc/check_payment_tunnel_health"
RPC_PAYLOAD="{\"p_window_hours\": ${WINDOW_HOURS}}"

RESP=$(curl -sS -w $'\n%{http_code}' \
  -X POST "$RPC_URL" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H 'Content-Type: application/json' \
  -d "$RPC_PAYLOAD" 2>&1) || {
    log "ERROR: curl vers $RPC_URL a échoué"
    exit 1
  }

HTTP_CODE=$(printf '%s\n' "$RESP" | tail -n1)
BODY=$(printf '%s\n' "$RESP" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  log "ERROR: RPC HTTP ${HTTP_CODE} — body: ${BODY}"
  exit 1
fi

# --- Parse JSON (python3) --------------------------------------------------
# Le RPC renvoie un array PostgREST: [{"orders_count":N,"paid_count":M,"last_paid_at":"..."}]
METRICS=$(printf '%s' "$BODY" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception as e:
    print("ERROR_PARSE:" + str(e), end="")
    sys.exit(1)
if isinstance(data, list) and data:
    d = data[0]
elif isinstance(data, dict):
    d = data
else:
    print("ERROR_SHAPE", end="")
    sys.exit(1)
oc = d.get("orders_count", 0)
pc = d.get("paid_count", 0)
lp = d.get("last_paid_at") or "never"
print("{}|{}|{}".format(oc, pc, lp), end="")
') || {
    log "ERROR: parsing JSON échoué — body: ${BODY}"
    exit 1
  }

orders_count=$(echo "$METRICS" | cut -d'|' -f1)
paid_count=$(echo "$METRICS" | cut -d'|' -f2)
last_paid_at=$(echo "$METRICS" | cut -d'|' -f3-)

# Valider que les compteurs sont numériques
case "$orders_count" in ''|*[!0-9]*) log "ERROR: orders_count non numérique: $orders_count"; exit 1;; esac
case "$paid_count"   in ''|*[!0-9]*) log "ERROR: paid_count non numérique: $paid_count";     exit 1;; esac

log "INFO: orders_${WINDOW_HOURS}h=${orders_count} paid_${WINDOW_HOURS}h=${paid_count} last_paid=${last_paid_at}"

# === Order-CREATION health (NEW — closes the blind spot) ====================
# The payment rule below only fires on "orders created but UNPAID". It is BLIND
# to "0 orders CREATED" — exactly what silently broke checkout for 24 days
# (2026-05-22 → 06-15, create_order_atomic PGRST203 overload). This rule reads
# order_idempotency directly (attempts vs completions) — no RPC needed.
OC_WINDOW_HOURS="${OC_WINDOW_HOURS:-48}"
oc_since="$(date -u -d "${OC_WINDOW_HOURS} hours ago" +%Y-%m-%dT%H:%M:%S)"
oc_count() {  # $1 = status ; echoes the PostgREST exact count (empty on error)
  curl -sS -I --max-time 15 \
    "${SUPABASE_URL}/rest/v1/order_idempotency?status=eq.$1&created_at=gte.${oc_since}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H 'Prefer: count=exact' -H 'Range: 0-0' 2>/dev/null \
    | awk 'tolower($0) ~ /^content-range:/ { n=$0; sub(/.*\//,"",n); gsub(/[^0-9]/,"",n); print n }'
}
oc_completed="$(oc_count completed)"
oc_failed="$(oc_count failed)"
case "$oc_completed" in ''|*[!0-9]*) oc_completed=-1 ;; esac
case "$oc_failed"    in ''|*[!0-9]*) oc_failed=-1 ;; esac
log "INFO: order_creation_${OC_WINDOW_HOURS}h completed=${oc_completed} failed=${oc_failed}"

ALERT_SUBJECT=""
ALERT_BODY=""
HOST_SAFE=$(hostname)

# Rule: attempts failed (>=1) AND none completed ⇒ order CREATION is broken.
# Quiet/low-volume windows have failed=0 ⇒ no false positive.
if [ "$oc_completed" = "0" ] && [ "$oc_failed" -ge 1 ] 2>/dev/null; then
  ALERT_SUBJECT="[SEV1] AutoMecanik — ORDER CREATION broken (${oc_failed} failed, 0 completed / ${OC_WINDOW_HOURS}h)"
  ALERT_BODY=$(cat <<EOF
SEV1 : order CREATION is failing — customers cannot place orders.

Host                  : ${HOST_SAFE}
Window                : ${OC_WINDOW_HOURS}h
Order attempts failed : ${oc_failed}
Orders completed      : ${oc_completed}   (expected > 0 when attempts > 0)

This rule closes the blind spot that hid the 2026-05-22 → 06-15 outage
(24 days, 100% order failure, no alert). Likely root-cause family:
create_order_atomic RPC overload (PGRST203) or another order-write break.

=== Immediate checks ===
1. docker logs nestjs-remix-monorepo-prod --since 1h 2>&1 | grep -iE 'Error creating order|create_order_atomic|PGRST'
2. SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc
     WHERE proname='create_order_atomic';   -- must be EXACTLY ONE row
3. SELECT * FROM order_idempotency WHERE status='failed' ORDER BY created_at DESC LIMIT 10;

-- Auto-generated by scripts/monitoring/check-payment-tunnel.sh
EOF
)
fi

# === Payment-tunnel rule (only if creation is healthy) ======================
if [ -z "$ALERT_SUBJECT" ]; then
  if [ "$orders_count" -lt "$MIN_ORDERS_THRESHOLD" ]; then
    log "OK: signal paiement insuffisant (${orders_count} < ${MIN_ORDERS_THRESHOLD})"
    exit 0
  fi
  if [ "$paid_count" -gt 0 ]; then
    log "OK: tunnel paiement sain (${paid_count}/${orders_count} paid)"
    exit 0
  fi
  ALERT_SUBJECT="[SEV1] AutoMecanik — Payment tunnel possibly broken (${orders_count} orders, 0 paid)"
  ALERT_BODY=$(cat <<EOF
SEV1 alert : payment tunnel health check failed.

Host             : ${HOST_SAFE}
Window           : ${WINDOW_HOURS}h
Orders created   : ${orders_count}
Orders paid      : ${paid_count}   (expected: > 0)
Last paid order  : ${last_paid_at}

=== Immediate checks ===
1. Backend callback logs :
   docker logs nestjs-remix-monorepo-prod --since 30m 2>&1 | grep -iE 'Callback IPN|GATE'

2. Check __paybox_gate_log for recent rejected callbacks :
   SELECT * FROM __paybox_gate_log ORDER BY created_at DESC LIMIT 10;

3. Cloudflare dashboard :
   Security -> Events -> filter Path contains "/api/paybox" -> 24h

=== References ===
- Incident historique : .spec/reports/incident-2026-04-14-payments-sev1.md
- Runbook             : .spec/runbooks/payments-tunnel-debug.md (TODO)
- 3 bugs connus       : Cloudflare WAF / RPC type / Gate errorCode

-- Auto-generated by scripts/monitoring/check-payment-tunnel.sh
EOF
)
fi

# No rule fired ⇒ order tunnel healthy.
if [ -z "$ALERT_SUBJECT" ]; then
  log "OK: order tunnel sain (creation + payment)"
  exit 0
fi

# --- Anti-spam -------------------------------------------------------------
if [ -f "$DEDUP_CACHE" ]; then
  last_alert_ts=$(cat "$DEDUP_CACHE" 2>/dev/null || echo 0)
  now_ts=$(date +%s)
  dedup_seconds=$((DEDUP_WINDOW_MIN * 60))
  if [ $((now_ts - last_alert_ts)) -lt "$dedup_seconds" ]; then
    log "OK: alerte déjà envoyée < ${DEDUP_WINDOW_MIN}min, skip"
    exit 0
  fi
fi

# --- Envoi via Gmail SMTP (OAuth2 refresh → access → XOAUTH2) --------------
# 100% Python stdlib (urllib + smtplib + email + base64), aucun pip install.
SEND_RESULT=$(SUBJECT="$ALERT_SUBJECT" EMAIL_FROM="$EMAIL_FROM" \
  ALERT_EMAIL_TO="$ALERT_EMAIL_TO" \
  BODY_TEXT="$ALERT_BODY" \
  GMAIL_CLIENT_ID="$GMAIL_CLIENT_ID" \
  GMAIL_CLIENT_SECRET="$GMAIL_CLIENT_SECRET" \
  GMAIL_REFRESH_TOKEN="$GMAIL_REFRESH_TOKEN" \
  GMAIL_USER_EMAIL="$GMAIL_USER_EMAIL" \
python3 <<'PYEOF' 2>&1
import os, sys, json, base64, smtplib, urllib.request, urllib.parse
from email.message import EmailMessage

body_text = os.environ["BODY_TEXT"]

# 1. Exchange refresh_token -> access_token (Google OAuth2)
try:
    token_req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=urllib.parse.urlencode({
            "client_id": os.environ["GMAIL_CLIENT_ID"],
            "client_secret": os.environ["GMAIL_CLIENT_SECRET"],
            "refresh_token": os.environ["GMAIL_REFRESH_TOKEN"],
            "grant_type": "refresh_token",
        }).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(token_req, timeout=10) as r:
        token_data = json.loads(r.read())
    access_token = token_data["access_token"]
except urllib.error.HTTPError as e:
    err_body = e.read().decode("utf-8", errors="replace")[:300]
    print(f"ERROR_OAUTH:HTTP{e.code}:{err_body}")
    sys.exit(1)
except Exception as e:
    print(f"ERROR_OAUTH:{type(e).__name__}:{e}")
    sys.exit(1)

# 2. Compose RFC5322 message
msg = EmailMessage()
msg["From"] = os.environ["EMAIL_FROM"]
msg["To"] = os.environ["ALERT_EMAIL_TO"]
msg["Subject"] = os.environ["SUBJECT"]
msg.set_content(body_text)

# 3. SMTP STARTTLS + XOAUTH2
try:
    user = os.environ["GMAIL_USER_EMAIL"]
    auth_str = f"user={user}\x01auth=Bearer {access_token}\x01\x01"
    auth_b64 = base64.b64encode(auth_str.encode()).decode()

    with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as s:
        s.ehlo()
        s.starttls()
        s.ehlo()
        code, resp = s.docmd("AUTH", f"XOAUTH2 {auth_b64}")
        if code != 235:
            print(f"ERROR_SMTP_AUTH:{code}:{resp.decode('utf-8', errors='replace')[:200]}")
            sys.exit(1)
        s.send_message(msg)
    print("OK")
except smtplib.SMTPException as e:
    print(f"ERROR_SMTP:{type(e).__name__}:{e}")
    sys.exit(1)
except Exception as e:
    print(f"ERROR_SEND:{type(e).__name__}:{e}")
    sys.exit(1)
PYEOF
) || {
    log "ERROR: envoi email Gmail échoué — ${SEND_RESULT}"
    exit 1
  }

if [ "$SEND_RESULT" != "OK" ]; then
  log "ERROR: envoi email Gmail inattendu — ${SEND_RESULT}"
  exit 1
fi

log "ALERT: email Gmail envoyé à ${ALERT_EMAIL_TO}"
date +%s > "$DEDUP_CACHE"
exit 2
