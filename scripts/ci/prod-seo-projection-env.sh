#!/usr/bin/env bash
#
# PROD SEO Projection flags — write the three SEO Projection rollout flags from
# GitHub into ~/production/.env as ONE decision, BEFORE any PROD mutation.
#
# WHY THIS EXISTS (2026-09-24)
# ----------------------------
# The SEO Projection pipeline (ADR-059) is rolled out on PROD by three flags the
# backend reads from its environment (ADR-099 D5, proposed): the R1 feed
# scheduler (seo-projection-feeder.service.ts), the read master flag and the
# role-scoped read canary (feature-flags.service.ts). Outside this pipeline the
# PROD host is reachable only through an owner root session: a hand edit there
# is unvalidated and untracked, and is read only at the next container
# recreation. The deploy job is the existing writer of ~/production/.env
# (JWT_SECRET, SEO_CP_*, the GSC/GA4 config in prod-seo-collector-env.sh); this
# script is that writer for the SEO Projection flags.
#
# WHY THIS IS A SCRIPT (not inline YAML)
# --------------------------------------
# The code never fails on a bad value: `bool()` reads anything but the literal
# `true` as false, and the canary is an exact-match allowlist, so a mistyped
# token is simply inert. A wrong value would be a silent OFF. This script
# refuses it at deploy time, and it can be executed against a test .env — see
# `prod-seo-projection-env.test.mjs`.
#
# CONTRACT
# --------
#   SEO_PROJECTION_R1_FEED_ENABLED_OVERRIDE  variable PROD_SEO_PROJECTION_R1_FEED_ENABLED
#   SEO_PROJECTION_READ_V1_OVERRIDE          variable PROD_SEO_PROJECTION_READ_V1
#   SEO_PROJECTION_READ_CANARY_OVERRIDE      variable PROD_SEO_PROJECTION_READ_CANARY
#   Variables, not secrets: none is a credential, and `gh variable list` shows
#   what PROD will run with.
#
#   boolean unset/empty → KEY=false, written explicitly: deleting the variable
#                         and redeploying IS the rollback, nothing lingers on
#   boolean true|false  → written as is
#   boolean any other spelling (True, yes, 1, " true")
#                       → exit 1: the code would read it as false, silently
#   canary unset/empty  → SEO_PROJECTION_READ_CANARY='' written explicitly
#                         (empty = fail-closed in code)
#   canary list         → comma-separated tokens, each trimmed of whitespace and
#                         checked, written normalised (comma-joined, no spaces).
#                         An empty token (a,,b / trailing comma) or a malformed
#                         one → exit 1
#   canary set while READ_V1 is not true
#                       → allowed (the master flag keeps every pair inert),
#                         reported with a notice
#   any refusal         → exit 1 and the .env is left byte-identical (the step
#                         aborts before the point of no return; the running
#                         container is kept)
#
# CANARY TOKEN: <ROLE>@<type>:<slug>, e.g. R3_CONSEILS@gamme:filtre-a-huile.
# Derived from the code, not invented:
#   <ROLE>   ^[A-Z][A-Z0-9_]*$   projectionRole, seo-projection-admin.controller.ts
#   <type>   gamme | constructeur | vehicle
#                                entityType, seo-projection-admin.controller.ts
#                                (= seoProjectionWritableTypes default,
#                                feature-flags.service.ts)
#   <slug>   ^[a-z0-9][a-z0-9-]*$
#                                entityId, seo-projection-admin.controller.ts
#   `<type>:<slug>` is the namespaced entity_id the writer stores
#   (seo-projection-feeder.service.ts), and the R3 reader looks up exactly
#   `R3_CONSEILS@gamme:<alias>` (r3-projection-decision.service.ts). The list is
#   compared by exact string match, so a token outside this shape can never
#   select a projection the governed writer produces.
#
# FORMAT: values are written single-quoted, as in prod-seo-collector-env.sh:
# literal for bash `.` and for compose `env_file` alike (no value can contain a
# quote: booleans are literals, tokens are checked above). Values ARE printed —
# they are not secrets, and the log is the record of what PROD was given.
#
# Usage: prod-seo-projection-env.sh <path/to/.env>
set -euo pipefail

# Byte-wise character ranges: [A-Z] must mean ASCII A-Z whatever the runner's
# locale, or a lowercase or accented token could pass the check.
export LC_ALL=C

ENV_FILE="${1:?usage: prod-seo-projection-env.sh <path/to/.env>}"
if [ ! -f "$ENV_FILE" ]; then
  echo "::error::SEO projection: $ENV_FILE not found"
  exit 1
fi

R1_FEED="${SEO_PROJECTION_R1_FEED_ENABLED_OVERRIDE:-}"
READ_V1="${SEO_PROJECTION_READ_V1_OVERRIDE:-}"
CANARY_RAW="${SEO_PROJECTION_READ_CANARY_OVERRIDE:-}"

# Messages quote the offending value with its line breaks visible: a stray
# space or newline is the usual cause of a refusal.
show() {
  local v="${1//$'\r'/\\r}"
  printf "'%s'" "${v//$'\n'/\\n}"
}

ERRORS=0
reject() { # $1 = key name, $2 = reason
  echo "::error::SEO projection: $1 $2 — .env left untouched"
  ERRORS=$((ERRORS + 1))
}

# Only the literal `true` is true for the code (feature-flags.service.ts bool(),
# seo-projection-feeder.service.ts `=== 'true'`): any other spelling would be a
# silent OFF, so it is refused instead of being written.
check_bool() { # $1 = key name, $2 = value
  case "$2" in
    '' | true | false) ;;
    *) reject "$1" "is $(show "$2") — only true or false (unset = false); the code would read it as false" ;;
  esac
}
check_bool SEO_PROJECTION_R1_FEED_ENABLED "$R1_FEED"
check_bool SEO_PROJECTION_READ_V1 "$READ_V1"
R1_FEED="${R1_FEED:-false}"
READ_V1="${READ_V1:-false}"

TOKEN_RE='^[A-Z][A-Z0-9_]*@(gamme|constructeur|vehicle):[a-z0-9][a-z0-9-]*$'
trim() {
  local v="$1"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  printf '%s' "$v"
}
CANARY=""
if [ -n "$CANARY_RAW" ]; then
  # Split by hand: `read -a` would drop a trailing empty field (`a,b,`).
  rest="$CANARY_RAW,"
  n=0
  while [ -n "$rest" ]; do
    raw_token="${rest%%,*}"
    rest="${rest#*,}"
    n=$((n + 1))
    token="$(trim "$raw_token")"
    if [ -z "$token" ]; then
      reject SEO_PROJECTION_READ_CANARY "token #$n is empty (stray comma?) in $(show "$CANARY_RAW")"
    elif ! [[ "$token" =~ $TOKEN_RE ]]; then
      reject SEO_PROJECTION_READ_CANARY "token #$n $(show "$token") is not <ROLE>@<gamme|constructeur|vehicle>:<slug>"
    else
      CANARY="${CANARY:+$CANARY,}$token"
    fi
  done
fi

if [ "$ERRORS" -gt 0 ]; then
  exit 1
fi

# Edit a same-directory copy (same filesystem → atomic mv, `cp -p` keeps mode and
# owner), and replace the real file only once every write has read back intact.
TMP="$(mktemp "${ENV_FILE}.seo-projection.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
cp -p "$ENV_FILE" "$TMP"
# A last line without its newline would be glued to the first appended key.
if [ -s "$TMP" ] && [ -n "$(tail -c 1 "$TMP")" ]; then
  echo >> "$TMP"
fi

declare -A EXPECTED=()
set_kv() { # $1 = key, $2 = value (already checked: no quote, no line break)
  sed -i "/^$1=/d" "$TMP"
  printf "%s='%s'\n" "$1" "$2" >> "$TMP"
  EXPECTED["$1"]="$2"
}

set_kv SEO_PROJECTION_R1_FEED_ENABLED "$R1_FEED"
set_kv SEO_PROJECTION_READ_V1 "$READ_V1"
set_kv SEO_PROJECTION_READ_CANARY "$CANARY"

# Read-back through the same parser the deploy step uses (`set -a; . .env`).
if ! (
  set +u
  set -a
  # shellcheck disable=SC1090
  . "$TMP"
  set +a
  for k in "${!EXPECTED[@]}"; do
    if [ "${!k-}" != "${EXPECTED[$k]}" ]; then
      echo "::error::SEO projection: $k does not read back identically from .env — .env left untouched"
      exit 1
    fi
  done
); then
  echo "::error::SEO projection: .env does not read back cleanly after the write — .env left untouched"
  exit 1
fi

mv "$TMP" "$ENV_FILE"
trap - EXIT

echo "✅ SEO Projection flags written to .env:"
echo "   SEO_PROJECTION_R1_FEED_ENABLED=$R1_FEED"
echo "   SEO_PROJECTION_READ_V1=$READ_V1"
if [ -n "$CANARY" ]; then
  echo "   SEO_PROJECTION_READ_CANARY=$CANARY"
else
  echo "   SEO_PROJECTION_READ_CANARY=(empty — fail-closed, no pair is read)"
fi
if [ -n "$CANARY" ] && [ "$READ_V1" != true ]; then
  echo "::notice::SEO projection: canary set while SEO_PROJECTION_READ_V1=$READ_V1 — every listed pair stays inert until the master flag is true"
fi
