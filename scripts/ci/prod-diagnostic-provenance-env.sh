#!/usr/bin/env bash
#
# PROD diagnostic provenance flags — write the three diagnostic provenance
# rollout flags from GitHub into ~/production/.env as ONE decision, BEFORE any
# PROD mutation.
#
# WHY THIS EXISTS (2026-09-30)
# ----------------------------
# The WIKI → diagnostic provenance chain is rolled out on PROD by three flags the
# backend reads from its environment (feature-flags.service.ts): the projection
# writer (diagnostic-projection-scheduler.service.ts / .processor.ts), the
# exposure of the provenance in the evidence pack, and the primary mode that
# lets `diagnostic_safe` weigh the ranking (diagnostic-provenance.service.ts).
# Outside this pipeline the PROD host is reachable only through an owner root
# session: a hand edit there is unvalidated and untracked. The deploy job is the
# existing writer of ~/production/.env (prod-seo-projection-env.sh is the sibling
# this script follows); this script is that writer for these flags.
#
# WHY THIS IS A SCRIPT (not inline YAML)
# --------------------------------------
# The code never fails on a bad value: `bool()` reads anything but the literal
# `true` as false. A wrong value would be a silent OFF. This script refuses it at
# deploy time, and it can be executed against a test .env — see
# `prod-diagnostic-provenance-env.test.mjs`.
#
# CONTRACT
# --------
#   DIAGNOSTIC_PROJECTION_ENABLED_OVERRIDE          variable PROD_DIAGNOSTIC_PROJECTION_ENABLED
#   DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED_OVERRIDE   variable PROD_DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED
#   DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED_OVERRIDE  variable PROD_DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED
#   Variables, not secrets: none is a credential, and `gh variable list` shows
#   what PROD will run with.
#
#   unset/empty          → KEY=false, written explicitly: deleting the variable
#                          and redeploying IS the rollback, nothing lingers on
#   true|false           → written as is
#   any other spelling (True, yes, 1, " true")
#                        → exit 1: the code would read it as false, silently
#   PRIMARY true while EXPOSE is not true
#                        → exit 1: the primary mode would weigh the ranking by
#                          an information the evidence pack does not show (the
#                          runtime also ignores it, with a warning — this makes
#                          the refusal visible at deploy time instead)
#   any refusal          → exit 1 and the .env is left byte-identical (the step
#                          aborts before the point of no return; the running
#                          container is kept)
#
# FORMAT: values are written single-quoted, as in prod-seo-projection-env.sh:
# literal for bash `.` and for compose `env_file` alike. Values ARE printed —
# they are not secrets, and the log is the record of what PROD was given.
#
# Usage: prod-diagnostic-provenance-env.sh <path/to/.env>
set -euo pipefail

export LC_ALL=C

ENV_FILE="${1:?usage: prod-diagnostic-provenance-env.sh <path/to/.env>}"
if [ ! -f "$ENV_FILE" ]; then
  echo "::error::Diagnostic provenance: $ENV_FILE not found"
  exit 1
fi

PROJECTION="${DIAGNOSTIC_PROJECTION_ENABLED_OVERRIDE:-}"
EXPOSE="${DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED_OVERRIDE:-}"
PRIMARY="${DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED_OVERRIDE:-}"

# Messages quote the offending value with its line breaks visible: a stray
# space or newline is the usual cause of a refusal.
show() {
  local v="${1//$'\r'/\\r}"
  printf "'%s'" "${v//$'\n'/\\n}"
}

ERRORS=0
reject() { # $1 = message
  echo "::error::Diagnostic provenance: $1 — .env left untouched"
  ERRORS=$((ERRORS + 1))
}

# Only the literal `true` is true for the code (feature-flags.service.ts bool()):
# any other spelling would be a silent OFF, so it is refused instead of written.
check_bool() { # $1 = key name, $2 = value
  case "$2" in
    '' | true | false) ;;
    *) reject "$1 is $(show "$2") — only true or false (unset = false); the code would read it as false" ;;
  esac
}
check_bool DIAGNOSTIC_PROJECTION_ENABLED "$PROJECTION"
check_bool DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED "$EXPOSE"
check_bool DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED "$PRIMARY"
PROJECTION="${PROJECTION:-false}"
EXPOSE="${EXPOSE:-false}"
PRIMARY="${PRIMARY:-false}"

if [ "$PRIMARY" = true ] && [ "$EXPOSE" != true ]; then
  reject "DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED=true requires DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED=true (is $(show "$EXPOSE"))"
fi

if [ "$ERRORS" -gt 0 ]; then
  exit 1
fi

# Edit a same-directory copy (same filesystem → atomic mv, `cp -p` keeps mode and
# owner), and replace the real file only once every write has read back intact.
TMP="$(mktemp "${ENV_FILE}.diagnostic-provenance.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
cp -p "$ENV_FILE" "$TMP"
# A last line without its newline would be glued to the first appended key.
if [ -s "$TMP" ] && [ -n "$(tail -c 1 "$TMP")" ]; then
  echo >> "$TMP"
fi

declare -A EXPECTED=()
set_kv() { # $1 = key, $2 = value (already checked: true or false)
  sed -i "/^$1=/d" "$TMP"
  printf "%s='%s'\n" "$1" "$2" >> "$TMP"
  EXPECTED["$1"]="$2"
}

set_kv DIAGNOSTIC_PROJECTION_ENABLED "$PROJECTION"
set_kv DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED "$EXPOSE"
set_kv DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED "$PRIMARY"

# Read-back through the same parser the deploy step uses (`set -a; . .env`).
if ! (
  set +u
  set -a
  # shellcheck disable=SC1090
  . "$TMP"
  set +a
  for k in "${!EXPECTED[@]}"; do
    if [ "${!k-}" != "${EXPECTED[$k]}" ]; then
      echo "::error::Diagnostic provenance: $k does not read back identically from .env — .env left untouched"
      exit 1
    fi
  done
); then
  echo "::error::Diagnostic provenance: .env does not read back cleanly after the write — .env left untouched"
  exit 1
fi

mv "$TMP" "$ENV_FILE"
trap - EXIT

echo "✅ Diagnostic provenance flags written to .env:"
echo "   DIAGNOSTIC_PROJECTION_ENABLED=$PROJECTION"
echo "   DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED=$EXPOSE"
echo "   DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED=$PRIMARY"
