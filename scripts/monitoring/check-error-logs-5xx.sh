#!/usr/bin/env bash
# check-error-logs-5xx.sh — PREV-2 alerting générique sur les 5xx backend.
#
# Contexte : incident INC-2026-006 (2026-04-21, 67 min 503 sur /constructeurs/*).
# Détection actuelle : manuelle par smoke test ad-hoc. Ce script sonne l'alarme
# en ≤ 5 min sur toute classe d'URLs qui passe en 5xx, sans liste hardcodée.
#
# Architecture : identique à check-payment-tunnel.sh (PREV-1). Zéro dépendance
# système hors python3 + curl. Voir scripts/monitoring/README.md pour l'install.
#   - Supabase PostgREST : RPC check_error_logs_5xx_threshold
#   - Gmail SMTP OAuth2  : envoi alerte (python3 stdlib)
#
# Règle : alerte si total_5xx >= MIN_COUNT_THRESHOLD sur fenêtre glissante
# WINDOW_MINUTES. Anti-spam DEDUP_WINDOW_MIN.
#
# Env requis (identiques à PREV-1, partagés via /etc/default/check-error-logs-5xx) :
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL
#   ALERT_EMAIL_TO, EMAIL_FROM
#
# Env optionnel :
#   WINDOW_MINUTES=5     (fenêtre glissante)
#   MIN_COUNT_THRESHOLD=5 (seuil total 5xx déclenchant alerte)
#   DEDUP_WINDOW_MIN=30   (minutes avant ré-alerte)
#
# Exit codes :
#   0 = OK (pas de breach ou signal insuffisant)
#   1 = erreur technique (API down, creds manquants, parsing)
#   2 = alerte envoyée (dedup activé)

set -euo pipefail

SCRIPT_NAME="check-error-logs-5xx"
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [${SCRIPT_NAME}] $*" >&2; }

# --- Validation env --------------------------------------------------------
: "${SUPABASE_URL:?SUPABASE_URL manquant}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY manquant}"
: "${GMAIL_CLIENT_ID:?GMAIL_CLIENT_ID manquant}"
: "${GMAIL_CLIENT_SECRET:?GMAIL_CLIENT_SECRET manquant}"
: "${GMAIL_REFRESH_TOKEN:?GMAIL_REFRESH_TOKEN manquant}"
: "${GMAIL_USER_EMAIL:?GMAIL_USER_EMAIL manquant (ex: contact@automecanik.com)}"
: "${ALERT_EMAIL_TO:?ALERT_EMAIL_TO manquant}"
: "${EMAIL_FROM:?EMAIL_FROM manquant}"

WINDOW_MINUTES="${WINDOW_MINUTES:-5}"
MIN_COUNT_THRESHOLD="${MIN_COUNT_THRESHOLD:-5}"
DEDUP_CACHE="${DEDUP_CACHE:-/var/tmp/check-error-logs-5xx.last-alert}"
DEDUP_WINDOW_MIN="${DEDUP_WINDOW_MIN:-30}"

# --- Appel RPC Supabase via PostgREST --------------------------------------
RPC_URL="${SUPABASE_URL}/rest/v1/rpc/check_error_logs_5xx_threshold"
RPC_PAYLOAD="{\"p_window_minutes\": ${WINDOW_MINUTES}, \"p_min_count\": ${MIN_COUNT_THRESHOLD}}"

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

# --- Parse JSON ------------------------------------------------------------
# RPC retourne array PostgREST : [{"total_5xx":N, "threshold_breached":bool, ...}]
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
total = d.get("total_5xx", 0)
nb = d.get("distinct_urls", 0)
breached = 1 if d.get("threshold_breached") else 0
# Serialiser top_urls en TSV compact pour le shell
top = d.get("top_urls") or []
if isinstance(top, str):
    try: top = json.loads(top)
    except: top = []
top_encoded = "\n".join(
    f"{u.get(\"count\",0)}\t{u.get(\"url\",\"?\")}\t{(u.get(\"last_code\") or \"?\")[:50]}\t{(u.get(\"last_message\") or \"\")[:200]}"
    for u in top
)
# Fin avec |||END||| pour séparer les champs multiligne
print(f"{total}|||{nb}|||{breached}|||{top_encoded}", end="")
') || {
    log "ERROR: parsing JSON échoué — body: ${BODY}"
    exit 1
  }

total_5xx=$(printf '%s' "$METRICS" | awk -F '[|][|][|]' '{print $1}')
distinct_urls=$(printf '%s' "$METRICS" | awk -F '[|][|][|]' '{print $2}')
breached=$(printf '%s' "$METRICS" | awk -F '[|][|][|]' '{print $3}')
top_urls_raw=$(printf '%s' "$METRICS" | awk -F '[|][|][|]' '{for (i=4; i<=NF; i++) printf "%s%s", $i, (i<NF ? "|||" : "")}')

case "$total_5xx"      in ''|*[!0-9]*) log "ERROR: total_5xx non numerique: $total_5xx"; exit 1;; esac
case "$distinct_urls"  in ''|*[!0-9]*) log "ERROR: distinct_urls non numerique";          exit 1;; esac

log "INFO: window=${WINDOW_MINUTES}min total_5xx=${total_5xx} distinct_urls=${distinct_urls} breached=${breached}"

# --- Règle d'alerte --------------------------------------------------------
if [ "$breached" != "1" ]; then
  log "OK: pas de breach (${total_5xx} < ${MIN_COUNT_THRESHOLD} sur ${WINDOW_MINUTES}min)"
  exit 0
fi

# --- Anti-spam -------------------------------------------------------------
if [ -f "$DEDUP_CACHE" ]; then
  last_alert_ts=$(cat "$DEDUP_CACHE" 2>/dev/null || echo 0)
  now_ts=$(date +%s)
  dedup_seconds=$((DEDUP_WINDOW_MIN * 60))
  if [ $((now_ts - last_alert_ts)) -lt "$dedup_seconds" ]; then
    log "OK: alerte deja envoyee < ${DEDUP_WINDOW_MIN}min, skip"
    exit 0
  fi
fi

# --- Construction du corps d'email -----------------------------------------
SUBJECT="[PREV-2] ${total_5xx} erreurs 5xx sur ${WINDOW_MINUTES}min — ${distinct_urls} URLs distinctes"
HOST_SAFE=$(hostname 2>/dev/null || echo "?")

# Top URLs formatées en tableau texte
TOP_TABLE=""
if [ -n "$top_urls_raw" ]; then
  TOP_TABLE=$(printf '%s' "$top_urls_raw" \
    | tr '\n' '\001' \
    | sed 's/|||/\n/g' \
    | tr '\001' '\n' \
    | awk -F '\t' 'NF>=3 { printf "  - [%s×] %s\n      code: %s\n      msg : %s\n\n", $1, $2, $3, $4 }')
fi

TXT_BODY=$(cat <<EOF
[PREV-2] Alerte 5xx — seuil dépassé.

Fenêtre         : ${WINDOW_MINUTES} minutes
Total 5xx       : ${total_5xx}   (seuil: ${MIN_COUNT_THRESHOLD})
URLs distinctes : ${distinct_urls}
Host (sonde)    : ${HOST_SAFE}

=== Top URLs affectées ===

${TOP_TABLE:-  (aucune — check l'agrégation RPC)}

=== Diagnostic immédiat ===

1. Supabase MCP — inspection directe :
   SELECT err_created_at, err_status, err_url, err_message, err_code
   FROM __error_logs
   WHERE err_created_at > NOW() - INTERVAL '${WINDOW_MINUTES} minutes'
     AND err_status >= 500
   ORDER BY err_created_at DESC
   LIMIT 50;

2. Backend logs prod :
   docker logs nestjs-remix-monorepo-prod --since ${WINDOW_MINUTES}m 2>&1 \\
     | grep -iE 'error|exception' | tail -30

3. GitHub Actions récents :
   https://github.com/ak125/nestjs-remix-monorepo/actions

=== Références ===

- INC-2026-006 — post-mortem 503 /constructeurs/* (governance-vault)
- Runbook PREV-2 : scripts/monitoring/README.md

-- Auto-generated by scripts/monitoring/check-error-logs-5xx.sh
EOF
)

# --- Envoi Gmail SMTP OAuth2 (identique à PREV-1) --------------------------
SEND_RESULT=$(SUBJECT="$SUBJECT" EMAIL_FROM="$EMAIL_FROM" \
  ALERT_EMAIL_TO="$ALERT_EMAIL_TO" \
  BODY_TEXT="$TXT_BODY" \
  GMAIL_CLIENT_ID="$GMAIL_CLIENT_ID" \
  GMAIL_CLIENT_SECRET="$GMAIL_CLIENT_SECRET" \
  GMAIL_REFRESH_TOKEN="$GMAIL_REFRESH_TOKEN" \
  GMAIL_USER_EMAIL="$GMAIL_USER_EMAIL" \
python3 <<'PYEOF' 2>&1
import os, sys, json, base64, smtplib, urllib.request, urllib.parse
from email.message import EmailMessage

body_text = os.environ["BODY_TEXT"]

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

msg = EmailMessage()
msg["From"] = os.environ["EMAIL_FROM"]
msg["To"] = os.environ["ALERT_EMAIL_TO"]
msg["Subject"] = os.environ["SUBJECT"]
msg.set_content(body_text)

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

log "ALERT: email Gmail envoyé à ${ALERT_EMAIL_TO} (total=${total_5xx}, nb_urls=${distinct_urls})"
date +%s > "$DEDUP_CACHE"
exit 2
