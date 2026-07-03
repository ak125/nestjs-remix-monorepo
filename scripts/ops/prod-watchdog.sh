#!/usr/bin/env bash
#
# prod-watchdog.sh — Production health watchdog (cron */5 min) for the PROD
#   container stack on 49.12.233.2 (app + Caddy, public www.automecanik.com).
#
# WHY THIS EXISTS:
#   A watchdog that DETECTS a problem but cannot TELL anyone is worse than none —
#   it manufactures a false sense of safety. The prior ad-hoc version alerted only
#   via a Slack webhook read from ${SLACK_WEBHOOK_URL}, but cron runs with a minimal
#   environment: shell-profile vars are NOT loaded, so the webhook was empty and
#   every alert fell silently into a log file nobody reads. It also had no
#   dead-man's-switch (silence == assumed healthy) and no public end-to-end check.
#
# BEHAVIOUR (no-silent-fallback): silent + exit 0 when every check passes. On any
#   failure it (a) prints ONE consolidated line to STDOUT so cron's
#   MAILTO=automecanik.seo@gmail.com delivers it, (b) logs to syslog via `logger`
#   (shipped by the vector->loki stack, reusing internal observability), (c) posts
#   to Slack if a webhook is configured, and (d) pings a dead-man's-switch /fail.
#   On success it pings the dead-man's-switch so an EXTERNAL monitor alarms on the
#   SILENCE if this cron ever stops. All checks run (failures are aggregated), and
#   it exits non-zero.
#
# OBSERVE-ONLY: never restarts or mutates anything. Deploy-time rollback is the job
#   of .github/workflows/deploy-prod.yml; a cron that restarts PROD would mask real
#   failures and risk flapping.
#
# SCOPE: "is the site serving users?" — app container + image + internal health +
#   Caddy + public e2e (Cloudflare -> Caddy -> app). Origin TLS-cert expiry is
#   monitored separately by scripts/ops/check-origin-cert-expiry.sh (don't duplicate).
#
# CONFIG (env overrides, sane defaults matching the repo — no hardcoded secrets):
#   Push-alert secrets live in an explicitly-sourced file (cron-safe), NOT the shell
#   profile. Copy scripts/ops/watchdog.env.example to the box and chmod 600 it.
#     WATCHDOG_CONFIG     sourced config file      (default /home/deploy/production/watchdog.env)
#     APP_CONTAINER       prod app container name  (default nestjs-remix-monorepo-prod)
#     CADDY_CONTAINER     Caddy container name     (default nestjs-remix-caddy)
#     EXPECTED_IMAGE      expected app image       (default massdoc/nestjs-remix-monorepo:production)
#     PUBLIC_HEALTH_URL   public e2e health URL    (default https://www.automecanik.com/health)
#     SLACK_WEBHOOK_URL   opt-in Slack push        (default empty)
#     HEARTBEAT_URL       opt-in dead-man's-switch (default empty; e.g. https://hc-ping.com/<uuid>)
#     LOG / WATCHDOG_LOG  audit log path           (default /tmp/prod-watchdog.log)
#
# INSTALL (on the PROD box 49.12.233.2 — manual ops action, never written by CI):
#   cp scripts/ops/prod-watchdog.sh /home/deploy/production/
#   chmod +x /home/deploy/production/prod-watchdog.sh
#   cp scripts/ops/watchdog.env.example /home/deploy/production/watchdog.env  # then fill + chmod 600
#   crontab -e  ->  add:
#       MAILTO=automecanik.seo@gmail.com
#       */5 * * * * /home/deploy/production/prod-watchdog.sh
#
set -uo pipefail   # NOT -e: check failures are handled explicitly (a failing check
                   # must reach the alert path, not abort the script early).

# ---- Config (explicitly-sourced file = cron-safe, independent of the shell profile) ----
CONFIG_FILE="${WATCHDOG_CONFIG:-/home/deploy/production/watchdog.env}"
# shellcheck disable=SC1090
[ -f "$CONFIG_FILE" ] && . "$CONFIG_FILE"

APP_CONTAINER="${APP_CONTAINER:-nestjs-remix-monorepo-prod}"
CADDY_CONTAINER="${CADDY_CONTAINER:-nestjs-remix-caddy}"
EXPECTED_IMAGE="${EXPECTED_IMAGE:-massdoc/nestjs-remix-monorepo:production}"
INTERNAL_HEALTH_URL="${INTERNAL_HEALTH_URL:-http://localhost:3000/health}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-https://www.automecanik.com/health}"
LOG="${WATCHDOG_LOG:-${LOG:-/tmp/prod-watchdog.log}}"
LOCK="${WATCHDOG_LOCK:-/tmp/prod-watchdog.lock}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"     # opt-in (from watchdog.env, never the shell profile)
HEARTBEAT_URL="${HEARTBEAT_URL:-}"         # opt-in: dead-man's-switch
EXEC_TIMEOUT="${EXEC_TIMEOUT:-15}"
CURL_TIMEOUT="${CURL_TIMEOUT:-10}"
MAX_LOG_LINES="${MAX_LOG_LINES:-1000}"

# ---- Single-instance guard: prevents stacking if a run hangs ----
exec 9>"$LOCK" 2>/dev/null || { logger -t prod-watchdog "FATAL: cannot open lock $LOCK"; exit 1; }
flock -n 9 || { logger -t prod-watchdog "previous run still active — skipping"; exit 0; }

log_line() {                                # syslog (-> vector/loki) ALWAYS; file best-effort
  logger -t prod-watchdog -- "$1"
  echo "$(date -Iseconds) $1" >> "$LOG" 2>/dev/null || true
}

# Best-effort log rotation
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG" 2>/dev/null || echo 0)" -gt "$MAX_LOG_LINES" ]; then
  tail -n 500 "$LOG" > "${LOG}.tmp" 2>/dev/null && mv "${LOG}.tmp" "$LOG" 2>/dev/null || true
fi

FAILURES=()
fail() { FAILURES+=("$1"); }

# ---- Checks: run them ALL and aggregate (one actionable alert, not a single symptom) ----

# 1. App container up  (grep -Fqx = fixed-string, whole-line -> robust vs metacharacters)
if ! docker ps --format '{{.Names}}' | grep -Fqx "$APP_CONTAINER"; then
  fail "app container '$APP_CONTAINER' not running"
else
  # 2. Expected image
  actual_image="$(docker inspect "$APP_CONTAINER" --format='{{.Config.Image}}' 2>/dev/null || echo '?')"
  [ "$actual_image" = "$EXPECTED_IMAGE" ] || fail "wrong image '$actual_image' (expected '$EXPECTED_IMAGE')"
  # 3. Internal health (timeout: a hung `docker exec` must not block the cron slot)
  health="$(timeout "$EXEC_TIMEOUT" docker exec "$APP_CONTAINER" wget -qO- "$INTERNAL_HEALTH_URL" 2>/dev/null || echo '')"
  echo "$health" | grep -q '"status":"ok"' || fail "internal /health KO (got: ${health:0:120})"
fi

# 4. Caddy up
docker ps --format '{{.Names}}' | grep -Fqx "$CADDY_CONTAINER" || fail "caddy container '$CADDY_CONTAINER' not running"

# 5. Public end-to-end (Cloudflare -> Caddy -> app, incl. DNS + TLS) — authoritative
#    user-facing signal. A 5xx/526/down at the edge fails `curl -f` here and alerts.
pub="$(curl -fsS --max-time "$CURL_TIMEOUT" "$PUBLIC_HEALTH_URL" 2>/dev/null || echo '')"
if ! echo "$pub" | grep -q '"status":"ok"'; then
  fail "public $PUBLIC_HEALTH_URL KO (got: ${pub:0:120})"
  # Diagnostic only (not a gate): do app + caddy share a docker network?
  app_nets="$(docker inspect "$APP_CONTAINER"   --format '{{range $k,$_ := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null)"
  caddy_nets="$(docker inspect "$CADDY_CONTAINER" --format '{{range $k,$_ := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null)"
  shared=""; for n in $app_nets; do case " $caddy_nets " in *" $n "*) shared="$n" ;; esac; done
  [ -n "$shared" ] || fail "app/caddy share NO docker network (app=[$app_nets] caddy=[$caddy_nets])"
fi

# ---- Result ----
if [ "${#FAILURES[@]}" -eq 0 ]; then
  # Dead-man's-switch: signal liveness -> external monitor alarms on SILENCE
  [ -n "$HEARTBEAT_URL" ] && curl -fsS --max-time "$CURL_TIMEOUT" "$HEARTBEAT_URL" >/dev/null 2>&1 || true
  exit 0
fi

msg="PROD WATCHDOG — ${#FAILURES[@]} failure(s): $(printf '%s | ' "${FAILURES[@]}")"
log_line "$msg"          # syslog + file
echo "$msg"              # stdout -> email via cron MAILTO (+ MTA): native channel, zero deps

if [ -n "$SLACK_WEBHOOK" ]; then
  esc="$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  curl -fsS --max-time "$CURL_TIMEOUT" -X POST "$SLACK_WEBHOOK" \
    -H 'Content-Type: application/json' --data "{\"text\":\"$esc\"}" >/dev/null 2>&1 \
    || log_line "slack notify FAILED"
fi
[ -n "$HEARTBEAT_URL" ] && curl -fsS --max-time "$CURL_TIMEOUT" "${HEARTBEAT_URL}/fail" >/dev/null 2>&1 || true
[ -z "$SLACK_WEBHOOK$HEARTBEAT_URL" ] && log_line "WARN: no push channel (Slack/heartbeat) configured in $CONFIG_FILE"

exit 1
