#!/usr/bin/env bash
# PreToolUse hook for Bash commands
# Blocks dangerous operations: git push main, destructive docker commands
# Exit 0 = allow, Exit 2 = block (stderr shown to user)

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

exit 0
