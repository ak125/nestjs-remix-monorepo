#!/usr/bin/env bash
# pretool-agent-guard.sh — Limit subagent spawning per session
# Prevents token exhaustion from unbounded batch spawning (incident 2026-04-04: 340 subagents)
# Exit 0 = allow, Exit 2 = block (stderr shown to user)

if ! command -v jq &>/dev/null; then
  echo "BLOCKED: jq requis pour les hooks de securite. Installer: apt install jq" >&2
  exit 2
fi

set -euo pipefail

# Read tool input from stdin (JSON)
INPUT=$(cat)

# Extract subagent type for informational message
SUBAGENT_TYPE=$(echo "$INPUT" | jq -r '.subagent_type // "unknown"' 2>/dev/null || echo "unknown")

# Session identifier = Claude main process PID (stable for entire session)
SESSION_ID="$PPID"
COUNTER_FILE="/tmp/claude-agent-count-${SESSION_ID}"
MAX_AGENTS="${CLAUDE_MAX_SUBAGENTS:-10}"

# Atomic read-increment-write using flock (prevents race conditions on parallel spawns)
exec 9>>"$COUNTER_FILE"
flock -x 9
CURRENT=$(cat "$COUNTER_FILE" 2>/dev/null | tail -1)
CURRENT=${CURRENT:-0}
COUNT=$((CURRENT + 1))
echo "$COUNT" > "$COUNTER_FILE"
exec 9>&-

if [ "$COUNT" -gt "$MAX_AGENTS" ]; then
  echo "BLOCKED: ${COUNT} subagents deja lances dans cette session (type: ${SUBAGENT_TYPE}). Limite: ${MAX_AGENTS}. Relance la session ou exporte CLAUDE_MAX_SUBAGENTS=N." >&2
  exit 2
fi

exit 0
