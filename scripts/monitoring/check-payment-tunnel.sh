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
# Règles (3, indépendantes — évaluées dans cet ordre) :
#   1. CREATION   : des tentatives de commande échouent et aucune n'aboutit.
#   2. SUSTAINED  : aucun paiement depuis MIN_SILENCE_DAYS jours alors que
#                   >= MAX_UNPAID_SINCE_LAST_PAYMENT commandes se sont accumulées.
#                   Règle CUMULATIVE : c'est elle qui voit une rupture lente que
#                   la fenêtre glissante ne peut pas voir (cf. panne 8 semaines
#                   du 2026-05-19 au 07-22, jamais alertée).
#   3. BURST      : >= MIN_ORDERS_THRESHOLD commandes dans WINDOW_HOURS, 0 payée.
# Anti-spam : dédup sur le CONTENU de l'alerte (re-notification après
# DEDUP_MAX_HOURS si la situation persiste, immédiate si elle change).
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
#   WINDOW_HOURS=2  MIN_ORDERS_THRESHOLD=2  OC_WINDOW_HOURS=48
#   MAX_UNPAID_SINCE_LAST_PAYMENT=5  MIN_SILENCE_DAYS=2  DEDUP_MAX_HOURS=24
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
# Dedup is keyed on the alert's CONTENT (see "Anti-spam" below), not on elapsed
# time alone. The old time-only window was shorter than WINDOW_HOURS, so the very
# same orders were still inside the observation window when the cooldown expired
# and every incident produced a duplicate email (2026-09-07: 16:45 + 18:00 CEST).
# DEDUP_MAX_HOURS is the re-notify ceiling for an UNCHANGED situation, so a
# genuine sustained outage still pings once a day instead of going quiet forever.
DEDUP_MAX_HOURS="${DEDUP_MAX_HOURS:-24}"

# Sustained-outage rule (cumulative). See the rule block below for the rationale.
MAX_UNPAID_SINCE_LAST_PAYMENT="${MAX_UNPAID_SINCE_LAST_PAYMENT:-5}"
MIN_SILENCE_DAYS="${MIN_SILENCE_DAYS:-2}"

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

# --- Generic PostgREST exact-count helper ----------------------------------
pg_count() {  # $1 = "table?filters" ; echoes the exact count, or "" on error
  curl -sS -I --max-time 15 "${SUPABASE_URL}/rest/v1/$1" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H 'Prefer: count=exact' -H 'Range: 0-0' 2>/dev/null \
    | awk 'tolower($0) ~ /^content-range:/ { n=$0; sub(/.*\//,"",n); gsub(/[^0-9]/,"",n); print n }'
}

# === Sustained-outage signal (cumulative — rate-independent) ================
# The payment rule below is a BURST detector: it needs >= MIN_ORDERS_THRESHOLD
# orders inside the SAME window. On a low-volume shop (~6 orders / 21 days) a
# real rupture can therefore stay invisible for weeks — exactly what happened
# 2026-05-19 -> 07-22: 8 orders spread too thin to ever put 2 in one 2h window,
# 0 paid, and this script stayed silent for 8 weeks. A per-window threshold and
# a cumulative threshold are DIFFERENT guards; neither subsumes the other.
# This rule counts orders created since the last successful payment, whatever
# the rate. `last_paid_at` was previously read, logged and printed but never
# compared to anything — decoration, not a rule. This is that missing rule.
# `ord_date` is a TEXT column: PostgREST compares it lexicographically, which is
# correct for the ISO-8601 UTC values stored there (verified against live data).
unpaid_since_last=-1
silence_days=-1
if [ -n "$last_paid_at" ] && [ "$last_paid_at" != "never" ]; then
  silence_days=$(LP="$last_paid_at" python3 -c '
import os, sys, datetime
try:
    d = datetime.datetime.fromisoformat(os.environ["LP"].replace("Z", "+00:00"))
    if d.tzinfo is None:
        d = d.replace(tzinfo=datetime.timezone.utc)
    print(int((datetime.datetime.now(datetime.timezone.utc) - d).total_seconds() // 86400))
except Exception:
    print(-1)
' 2>/dev/null) || silence_days=-1
  case "$silence_days" in ''|*[!0-9-]*) silence_days=-1 ;; esac
  unpaid_since_last="$(pg_count "___xtr_order?ord_date=gt.${last_paid_at}&ord_is_pay=eq.0&select=ord_id")"
  case "$unpaid_since_last" in ''|*[!0-9]*) unpaid_since_last=-1 ;; esac
fi
log "INFO: since_last_payment unpaid=${unpaid_since_last} silence_days=${silence_days}"

# --- Diagnostic enrichment (fetched only when the payment rule fires) -------
# Tells a RETRY CLUSTER (one buyer, one cart, N attempts) apart from a FLEET-WIDE
# rupture (N buyers, N carts) at a glance, using the cart fingerprint already
# written by the order-creation path. This does NOT change the firing decision —
# sensitivity is deliberately unchanged (a lost sale stays worth an alert, and
# .claude/rules/guardrails.md forbids loosening a guard to quiet it). It only
# tells the reader WHAT they are looking at, which is what cost an hour on
# 2026-09-07: 3 orders / 1 fingerprint = one buyer retrying, not a broken tunnel.
window_order_ids=""
window_distinct_carts=-1
fetch_window_carts() {
  local since payload
  since="$(date -u -d "${WINDOW_HOURS} hours ago" +%Y-%m-%dT%H:%M:%S)"
  payload=$(curl -sS --max-time 15 \
    "${SUPABASE_URL}/rest/v1/order_idempotency?created_at=gte.${since}&select=order_id,fingerprint&order=created_at.asc" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" 2>/dev/null) || return 1
  printf '%s' "$payload" | python3 -c '
import json, sys
try:
    rows = json.load(sys.stdin)
except Exception:
    sys.exit(1)
if not isinstance(rows, list):
    sys.exit(1)
ids = [r.get("order_id") for r in rows if r.get("order_id")]
carts = {r.get("fingerprint") for r in rows if r.get("fingerprint")}
print("{}|{}".format(",".join(ids), len(carts)))
' 2>/dev/null
}

ALERT_SUBJECT=""
ALERT_BODY=""
ALERT_SIGNATURE=""
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

=== References ===
- Runbook : .spec/runbooks/payments-tunnel-debug.md

-- Auto-generated by scripts/monitoring/check-payment-tunnel.sh
EOF
)
  ALERT_SIGNATURE="creation|${oc_failed}|${oc_completed}"
fi

# === Sustained-outage rule (cumulative — runs BEFORE the burst rule) ========
# Placed before the payment rule on purpose: that rule exits 0 early on a quiet
# window, which would skip this one entirely.
if [ -z "$ALERT_SUBJECT" ] \
   && [ "$unpaid_since_last" -ge "$MAX_UNPAID_SINCE_LAST_PAYMENT" ] 2>/dev/null \
   && [ "$silence_days" -ge "$MIN_SILENCE_DAYS" ] 2>/dev/null; then
  ALERT_SUBJECT="[SEV1] AutoMecanik — No payment for ${silence_days}d (${unpaid_since_last} orders unpaid since)"
  ALERT_BODY=$(cat <<EOF
SEV1 : no successful payment for ${silence_days} days, while orders keep coming in.

Host                       : ${HOST_SAFE}
Last paid order            : ${last_paid_at}
Days since last payment    : ${silence_days}
Orders created since, unpaid: ${unpaid_since_last}   (threshold: ${MAX_UNPAID_SINCE_LAST_PAYMENT})

This is the CUMULATIVE rule. The ${WINDOW_HOURS}h burst rule cannot see a slow
rupture on a low-volume shop: 2026-05-19 -> 07-22 there were 8 unpaid orders
spread too thin to ever put 2 in one window, and nothing alerted for 8 weeks.

=== Immediate checks ===
Follow the runbook — it is written for exactly this shape:
   .spec/runbooks/payments-tunnel-debug.md

Start with STEP 1 (Paybox back-office). If transactions exist there while these
orders are unpaid, customers have been DEBITED and the IPN is blocked upstream.

-- Auto-generated by scripts/monitoring/check-payment-tunnel.sh
EOF
)
  ALERT_SIGNATURE="sustained|${last_paid_at}|${unpaid_since_last}"
fi

# === Payment-tunnel rule (burst — only if nothing above fired) ==============
if [ -z "$ALERT_SUBJECT" ]; then
  if [ "$orders_count" -lt "$MIN_ORDERS_THRESHOLD" ]; then
    log "OK: signal paiement insuffisant (${orders_count} < ${MIN_ORDERS_THRESHOLD})"
    exit 0
  fi
  if [ "$paid_count" -gt 0 ]; then
    log "OK: tunnel paiement sain (${paid_count}/${orders_count} paid)"
    exit 0
  fi

  # Enrich BEFORE composing: distinguishes a retry cluster from a real rupture.
  if enrich="$(fetch_window_carts)"; then
    window_order_ids="${enrich%%|*}"
    window_distinct_carts="${enrich##*|}"
    case "$window_distinct_carts" in ''|*[!0-9]*) window_distinct_carts=-1 ;; esac
  else
    log "WARN: enrichissement paniers indisponible — alerte envoyée sans ce détail"
  fi

  if [ "$window_distinct_carts" = "1" ] && [ "$orders_count" -gt 1 ]; then
    shape="RETRY CLUSTER — ${orders_count} attempts on 1 single cart (one buyer)."
  elif [ "$window_distinct_carts" -gt 1 ] 2>/dev/null; then
    shape="MULTIPLE BUYERS — ${window_distinct_carts} distinct carts affected. Treat as a rupture."
  else
    shape="UNKNOWN — cart fingerprints unavailable this run."
  fi

  ALERT_SUBJECT="[SEV1] AutoMecanik — Payment tunnel possibly broken (${orders_count} orders, 0 paid)"
  ALERT_BODY=$(cat <<EOF
SEV1 alert : payment tunnel health check failed.

Host             : ${HOST_SAFE}
Window           : ${WINDOW_HOURS}h
Orders created   : ${orders_count}
Orders paid      : ${paid_count}   (expected: > 0)
Distinct carts   : ${window_distinct_carts}
Shape            : ${shape}
Order ids        : ${window_order_ids:-(unavailable)}
Last paid order  : ${last_paid_at}   (GLOBAL last payment, NOT windowed — on a
                   low-volume shop a multi-day gap here is normal, not proof of
                   an outage. The cumulative rule owns that question.)

=== Immediate checks ===
Follow the runbook, which is written around the one discriminator that matters
(did the buyer ever reach Paybox?) and lists the traps:
   .spec/runbooks/payments-tunnel-debug.md

Fast triage:
1. Backend logs, while they still exist :
   docker logs nestjs-remix-monorepo-prod --since 1h 2>&1 | grep -iE 'paybox'
2. A RETRY CLUSTER on 1 cart is usually a lost sale, not a broken tunnel —
   confirm the tunnel is alive before escalating :
   SELECT orderid, status, datepayment FROM ic_postback ORDER BY datepayment DESC LIMIT 5;
3. NOTE: __paybox_gate_log only ever stores gate FAILURES. An empty table does
   NOT mean "no callback arrived" — a successful callback writes nothing there.

=== References ===
- Incident historique : .spec/reports/incident-2026-04-14-payments-sev1.md
- Analyse 2026-09-07  : audit/payment-tunnel-sev1-alert-2026-09-07.md
- 3 bugs connus       : Cloudflare WAF / RPC type / Gate errorCode

-- Auto-generated by scripts/monitoring/check-payment-tunnel.sh
EOF
)
  ALERT_SIGNATURE="payment|${orders_count}|${paid_count}|${window_order_ids}"
fi

# No rule fired ⇒ order tunnel healthy.
if [ -z "$ALERT_SUBJECT" ]; then
  log "OK: order tunnel sain (creation + payment)"
  exit 0
fi

# --- Anti-spam (keyed on CONTENT, not on elapsed time alone) ---------------
# A time-only cooldown shorter than the observation window re-alerts on the very
# same rows once it expires — that is why 2026-09-07 produced two identical
# emails 75 min apart for one incident. Suppress while the SITUATION is
# unchanged; re-alert as soon as it changes (a new order joins the window), and
# re-notify anyway after DEDUP_MAX_HOURS so a lasting outage is not forgotten.
# An old-format cache (bare timestamp) parses to an empty signature and a zero
# time, so it fails toward ALERTING, never toward silence — then self-migrates.
if [ -f "$DEDUP_CACHE" ]; then
  last_sig=""; last_alert_ts=0
  read -r last_sig last_alert_ts < "$DEDUP_CACHE" 2>/dev/null || true
  case "$last_alert_ts" in ''|*[!0-9]*) last_alert_ts=0 ;; esac
  now_ts=$(date +%s)
  if [ -n "$last_sig" ] && [ "$last_sig" = "$ALERT_SIGNATURE" ] \
     && [ $((now_ts - last_alert_ts)) -lt $((DEDUP_MAX_HOURS * 3600)) ]; then
    log "OK: situation inchangée depuis $(( (now_ts - last_alert_ts) / 60 ))min (sig=${ALERT_SIGNATURE}), skip"
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

log "ALERT: email Gmail envoyé à ${ALERT_EMAIL_TO} (sig=${ALERT_SIGNATURE})"
printf '%s %s\n' "$ALERT_SIGNATURE" "$(date +%s)" > "$DEDUP_CACHE"
exit 2
