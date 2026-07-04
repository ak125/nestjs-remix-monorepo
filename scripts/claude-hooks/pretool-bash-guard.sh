#!/usr/bin/env bash
# PreToolUse hook for Bash commands
# Blocks dangerous operations: git push main, destructive docker commands
# Exit 0 = allow, Exit 2 = block (stderr shown to user)

if ! command -v jq &>/dev/null; then
  echo "BLOCKED: jq requis pour les hooks de securite. Installer: apt install jq" >&2
  exit 2
fi

set -euo pipefail

# Read tool input from stdin (JSON)
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.command // empty' 2>/dev/null || echo "")

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Guard 1: Block git push to main
if echo "$COMMAND" | grep -qE 'git\s+push\s+.*\b(origin\s+main|main)\b'; then
  echo "BLOCKED: git push origin main est interdit. Utilise le workflow Airlock (gov airlock) ou cree une PR." >&2
  exit 2
fi

# Guard 2: Block destructive docker commands on production containers
if echo "$COMMAND" | grep -qE '(docker[- ]compose\s+down|docker\s+stop\s|docker\s+rm\s)'; then
  if echo "$COMMAND" | grep -qE '(prod|nestjs-remix|automecanik)'; then
    echo "BLOCKED: Commande Docker destructive sur containers production detectee. Demande confirmation explicite a l'utilisateur." >&2
    exit 2
  fi
fi

# Guard 3: Block force push
if echo "$COMMAND" | grep -qE 'git\s+push\s+.*--force'; then
  echo "BLOCKED: git push --force est interdit. Risque de perte de code en production." >&2
  exit 2
fi

# Guard 4: Block git reset --hard
if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard'; then
  echo "BLOCKED: git reset --hard est interdit sans confirmation explicite." >&2
  exit 2
fi

# Guard 5: Block npm install/uninstall without confirmation
if echo "$COMMAND" | grep -qE 'npm\s+(install|uninstall|update|remove|add)\s'; then
  echo "BLOCKED: Gestion de paquets (npm install/uninstall) necessite confirmation explicite. Risque: breaking changes, lock file corruption." >&2
  exit 2
fi

# Guard 6: Block version-tag create/push (v* = PROD deploy trigger, owner GO only)
# Covers: git tag v1.2.3 / git tag -a v1.2.3 / git tag -s v1.2.3 / git push origin v1.2.3 / git push --tags
# Rationale: tag v* promeut :preprod -> :production (voir .claude/rules/deployment.md).
if echo "$COMMAND" | grep -qE 'git\s+tag\b.*\bv[0-9]+(\.[0-9]+){1,3}\b|git\s+push\b.*(--tags|\bv[0-9]+(\.[0-9]+){1,3}\b)'; then
  echo "BLOCKED: tag v* = declencheur deploy PROD (voir .claude/rules/deployment.md). GO owner explicite requis." >&2
  exit 2
fi

# Guard 7: WARN on full-content dump of a giant GENERATED registry artifact (token blow-up)
# audit/registry/*.json = Repository Control Plane projections, meant to be queried with jq
# FILTERS (CLAUDE.md "Query via jq"). canonical.json ~770k tok, files.json ~515k tok — a raw
# `cat`/`jq .` with no downstream reducer dumps the WHOLE file into the agent context
# (~77% of a 1M window). The Read tool caps at 2000 lines; cat/jq . via Bash do not.
# Non-blocking WARN (falls through to exit 0): a jq-FILTERED read or ANY piped/reduced read
# (contains '|') is legitimate and NOT warned. Ref: token-consumption audit 2026-07-04.
if echo "$COMMAND" | grep -qE 'audit/registry/[A-Za-z0-9_.-]+\.json' \
   && ! echo "$COMMAND" | grep -qF '|'; then
  if echo "$COMMAND" | grep -qE '(^|[|&; ])(cat|bat|less|more|nl|tac)[ ]' \
     || echo "$COMMAND" | grep -qE "jq[ ]+(-[A-Za-z]+[ ]+)*'?\.'?[ ]"; then
    echo "WARNING: lecture PLEINE d'un artefact registry genere (audit/registry/*.json). canonical.json ~770k tokens (~77% d'un contexte 1M), files.json ~515k. Utilise jq avec un FILTRE, ex: jq '.files[] | select(.path|contains(\"payments\"))' audit/registry/canonical.json — voir CLAUDE.md (Query via jq)." >&2
  fi
fi

exit 0
