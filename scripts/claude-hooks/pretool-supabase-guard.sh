#!/usr/bin/env bash
# PreToolUse hook for Supabase MCP tools (apply_migration, execute_sql)
# Blocks destructive DDL without confirmation
# Exit 0 = allow, Exit 2 = block (stderr shown to user)

if ! command -v jq &>/dev/null; then
  echo "WARN: jq not installed — hook bypassed. Install: apt install jq" >&2
  exit 0
fi

set -euo pipefail

# Read tool input from stdin (JSON)
INPUT=$(cat)
QUERY=$(echo "$INPUT" | jq -r '.query // empty' 2>/dev/null || echo "")

if [ -z "$QUERY" ]; then
  exit 0
fi

# Normalize to uppercase for matching
QUERY_UPPER=$(echo "$QUERY" | tr '[:lower:]' '[:upper:]')

# Guard 1: Block DROP TABLE/INDEX/FUNCTION without IF EXISTS
if echo "$QUERY_UPPER" | grep -qE 'DROP\s+(TABLE|INDEX|FUNCTION|TRIGGER|VIEW|SCHEMA)' && \
   ! echo "$QUERY_UPPER" | grep -qE 'IF\s+EXISTS'; then
  echo "BLOCKED: DROP sans IF EXISTS detecte. Ajouter 'IF EXISTS' pour securiser: $QUERY" >&2
  exit 2
fi

# Guard 2: Block disabling RLS
if echo "$QUERY_UPPER" | grep -qE 'DISABLE\s+ROW\s+LEVEL\s+SECURITY'; then
  echo "BLOCKED: Desactivation RLS detectee. Les tables avec donnees utilisateur doivent garder RLS actif." >&2
  exit 2
fi

# Guard 3: Block TRUNCATE on production tables
if echo "$QUERY_UPPER" | grep -qE 'TRUNCATE\s+'; then
  echo "BLOCKED: TRUNCATE detecte. Risque de perte de donnees. Confirmer explicitement avec l'utilisateur." >&2
  exit 2
fi

# Guard 4: Warn on ALTER TABLE DROP COLUMN (data loss potential)
if echo "$QUERY_UPPER" | grep -qE 'ALTER\s+TABLE.*DROP\s+COLUMN'; then
  echo "WARNING: ALTER TABLE DROP COLUMN detecte. Verifier qu'aucune donnee critique n'est perdue." >&2
  exit 0
fi

# Guard 5: Warn on CREATE TABLE without RLS
if echo "$QUERY_UPPER" | grep -qE 'CREATE\s+TABLE' && \
   ! echo "$QUERY_UPPER" | grep -qE 'ENABLE\s+ROW\s+LEVEL\s+SECURITY'; then
  echo "WARNING: CREATE TABLE sans ENABLE ROW LEVEL SECURITY. Penser a ajouter RLS apres creation." >&2
  exit 0
fi

exit 0
