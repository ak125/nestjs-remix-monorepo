#!/usr/bin/env bash
#
# PROD SEO collector config — write the GSC/GA4 daily-ingestion config from
# GitHub into ~/production/.env as ONE group decision, BEFORE any PROD mutation.
#
# WHY THIS EXISTS (2026-09-23)
# ----------------------------
# The GSC/GA4 daily ingestion (Bull queue `seo-monitor`, job `daily-fetch`) does
# external I/O, so it needs exactly ONE orchestrator, and a PROD data chain must
# not depend on the DEV workstation. PROD had no collector credentials: every
# ingestion run journaled in __seo_event_log came from node_env=development, so
# the measurement lived and died with the DEV backend (runs fired only when DEV
# was up at the cron minute or restarted; whole days were missed).
# Outside this pipeline the PROD host is reachable only through an owner root
# session: a hand edit there is unvalidated and untracked, and is read only at
# the next container recreation. The deploy job is the existing writer of
# ~/production/.env (JWT_SECRET, SEO_CP_* in deploy-prod.yml); this script is
# that writer for the collector config.
#
# WHY THIS IS A SCRIPT (not inline YAML)
# --------------------------------------
# A private key has to survive two parsers (bash `.` in the deploy step, docker
# compose `env_file` in the container). Inline YAML cannot be executed against a
# test .env; this script can — see `prod-seo-collector-env.test.mjs`.
#
# CONTRACT
# --------
#   GSC group — enables the collector:
#     GSC_CLIENT_EMAIL_OVERRIDE   secret   PROD_GSC_CLIENT_EMAIL
#     GSC_PRIVATE_KEY_OVERRIDE    secret   PROD_GSC_PRIVATE_KEY
#     GSC_SITE_URL_OVERRIDE       variable PROD_GSC_SITE_URL
#   GA4 group — optional:
#     GA4_CLIENT_EMAIL_OVERRIDE   secret   PROD_GA4_CLIENT_EMAIL
#     GA4_PRIVATE_KEY_OVERRIDE    secret   PROD_GA4_PRIVATE_KEY
#     GA4_PROPERTY_ID_OVERRIDE    variable PROD_GA4_PROPERTY_ID
#
#   GSC complete → GSC_* written + SEO_MONITORING_ENABLED=true
#   GSC unset    → SEO_MONITORING_ENABLED=false, written explicitly: deleting the
#                  secrets and redeploying IS the rollback, nothing lingers on
#   any partial group, or a value of the wrong shape
#                → exit 1 and the .env is left byte-identical (the step aborts
#                  before the point of no return; the running container is kept)
#   GA4 complete → GA4_* written (collected only while the GSC group enables it)
#
# GSC_SITE_URL is required, never defaulted: the code's fallback is a URL-prefix
# property, a different measurement scope from the sc-domain: property the
# collected series is built on.
#
# FORMAT: values are written single-quoted, which is literal for bash `.` and for
# compose `env_file` alike. A private key keeps its line breaks as literal `\n`
# (google-credentials.service.ts converts them); real newlines are normalised to
# `\n`. Values are NEVER printed — output carries key names and group states only.
#
# Usage: prod-seo-collector-env.sh <path/to/.env>
set -euo pipefail

ENV_FILE="${1:?usage: prod-seo-collector-env.sh <path/to/.env>}"
if [ ! -f "$ENV_FILE" ]; then
  echo "::error::SEO collector: $ENV_FILE not found"
  exit 1
fi

group_state() {
  local n=0 v
  for v in "$@"; do
    if [ -n "$v" ]; then n=$((n + 1)); fi
  done
  if [ "$n" -eq 0 ]; then
    echo none
  elif [ "$n" -eq "$#" ]; then
    echo complete
  else
    echo partial
  fi
}

# Carriage returns dropped, trailing newlines trimmed (a value set with `echo`
# must not gain a literal \n), inner newlines → literal \n.
to_single_line() {
  local v="${1//$'\r'/}"
  while [[ "$v" == *$'\n' ]]; do v="${v%$'\n'}"; done
  printf '%s' "${v//$'\n'/\\n}"
}

GSC_EMAIL="$(to_single_line "${GSC_CLIENT_EMAIL_OVERRIDE:-}")"
GSC_KEY="$(to_single_line "${GSC_PRIVATE_KEY_OVERRIDE:-}")"
GSC_SITE="$(to_single_line "${GSC_SITE_URL_OVERRIDE:-}")"
GA4_EMAIL="$(to_single_line "${GA4_CLIENT_EMAIL_OVERRIDE:-}")"
GA4_KEY="$(to_single_line "${GA4_PRIVATE_KEY_OVERRIDE:-}")"
GA4_PROP="$(to_single_line "${GA4_PROPERTY_ID_OVERRIDE:-}")"

GSC_STATE="$(group_state "$GSC_EMAIL" "$GSC_KEY" "$GSC_SITE")"
GA4_STATE="$(group_state "$GA4_EMAIL" "$GA4_KEY" "$GA4_PROP")"

if [ "$GSC_STATE" = partial ] || [ "$GA4_STATE" = partial ]; then
  echo "::error::SEO collector config incomplete (GSC=$GSC_STATE, GA4=$GA4_STATE) — set every value of a group or none; .env left untouched"
  exit 1
fi

# Shape checks: catch a wrong paste at deploy time instead of a failed run at the
# next cron minute. Messages name the key, never the value.
ERRORS=0
reject() {
  echo "::error::SEO collector: $1 $2 — .env left untouched"
  ERRORS=$((ERRORS + 1))
}
check_common() { # $1 = key name, $2 = value
  case "$2" in *"'"*) reject "$1" "contains a single quote (cannot be written single-quoted)" ;; esac
}
check_token() { # single-token values: e-mail, site URL, property id
  check_common "$1" "$2"
  case "$2" in *[[:space:]]* | *'\n'*) reject "$1" "contains whitespace or a line break" ;; esac
}
check_email() {
  check_token "$1" "$2"
  case "$2" in *@*) ;; *) reject "$1" "is not an e-mail address" ;; esac
}
PEM_LABEL='PRIVATE KEY' # PKCS#8 PEM, the form of a Google service-account key
check_key() {
  check_common "$1" "$2"
  case "$2" in
    "-----BEGIN ${PEM_LABEL}-----"*"-----END ${PEM_LABEL}-----"*) ;;
    *) reject "$1" "is not a PKCS#8 PEM private key" ;;
  esac
}
if [ "$GSC_STATE" = complete ]; then
  check_email GSC_CLIENT_EMAIL "$GSC_EMAIL"
  check_key GSC_PRIVATE_KEY "$GSC_KEY"
  check_token GSC_SITE_URL "$GSC_SITE"
  case "$GSC_SITE" in
    sc-domain:?* | https://?*) ;;
    *) reject GSC_SITE_URL "is not a Search Console property (sc-domain:… or https://…)" ;;
  esac
fi
if [ "$GA4_STATE" = complete ]; then
  check_email GA4_CLIENT_EMAIL "$GA4_EMAIL"
  check_key GA4_PRIVATE_KEY "$GA4_KEY"
  check_token GA4_PROPERTY_ID "$GA4_PROP"
  case "$GA4_PROP" in
    *[!0-9]*) reject GA4_PROPERTY_ID "is not a numeric GA4 property id" ;;
  esac
fi
if [ "$ERRORS" -gt 0 ]; then
  exit 1
fi

# Edit a same-directory copy (same filesystem → atomic mv, `cp -p` keeps mode and
# owner), and replace the real file only once every write has read back intact.
TMP="$(mktemp "${ENV_FILE}.seo-collector.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
cp -p "$ENV_FILE" "$TMP"

declare -A EXPECTED=()
set_kv() { # $1 = key, $2 = value (already checked: single line, no single quote)
  sed -i "/^$1=/d" "$TMP"
  printf "%s='%s'\n" "$1" "$2" >> "$TMP"
  EXPECTED["$1"]="$2"
}

if [ "$GSC_STATE" = complete ]; then
  set_kv GSC_CLIENT_EMAIL "$GSC_EMAIL"
  set_kv GSC_PRIVATE_KEY "$GSC_KEY"
  set_kv GSC_SITE_URL "$GSC_SITE"
  set_kv SEO_MONITORING_ENABLED true
else
  set_kv SEO_MONITORING_ENABLED false
fi
if [ "$GA4_STATE" = complete ]; then
  set_kv GA4_CLIENT_EMAIL "$GA4_EMAIL"
  set_kv GA4_PRIVATE_KEY "$GA4_KEY"
  set_kv GA4_PROPERTY_ID "$GA4_PROP"
fi

# Read-back through the same parser the deploy step uses (`set -a; . .env`).
if ! (
  set +u
  set -a
  # shellcheck disable=SC1090
  . "$TMP"
  set +a
  for k in "${!EXPECTED[@]}"; do
    if [ "${!k-}" != "${EXPECTED[$k]}" ]; then
      echo "::error::SEO collector: $k does not read back identically from .env — .env left untouched"
      exit 1
    fi
  done
); then
  echo "::error::SEO collector: .env does not read back cleanly after the write — .env left untouched"
  exit 1
fi

mv "$TMP" "$ENV_FILE"
trap - EXIT

if [ "$GSC_STATE" = complete ]; then
  echo "✅ SEO collector ENABLED on PROD — GSC group written (GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE_URL)"
else
  echo "ℹ️ PROD_GSC_* unset — SEO collector DISABLED on PROD (SEO_MONITORING_ENABLED=false)"
fi
if [ "$GA4_STATE" = complete ]; then
  echo "✅ GA4 group written (GA4_CLIENT_EMAIL, GA4_PRIVATE_KEY, GA4_PROPERTY_ID)"
else
  echo "ℹ️ PROD_GA4_* unset — GA4 left as is in .env"
fi
