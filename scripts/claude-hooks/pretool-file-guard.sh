#!/usr/bin/env bash
# PreToolUse hook for Edit/Write tools
# Blocks editing of protected system files (Airlock forbidden paths)
# Warns on payment module changes
# Exit 0 = allow, Exit 2 = block (stderr shown to user)

if ! command -v jq &>/dev/null; then
  echo "WARN: jq not installed — hook bypassed. Install: apt install jq" >&2
  exit 0
fi

set -euo pipefail

# Read tool input from stdin (JSON)
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // empty' 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Guard 1: Block editing blast-radius / system files
if echo "$FILE_PATH" | grep -qE '(^|/)\.env($|/)|\.github/|docker-compose|Caddyfile$|Dockerfile$|\.dockerignore$'; then
  echo "BLOCKED: Fichier protege ($FILE_PATH). Ces fichiers necessitent une review Airlock." >&2
  exit 2
fi

# Guard 2: Block editing package lock files
if echo "$FILE_PATH" | grep -qE 'package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$'; then
  echo "BLOCKED: Fichier lock ($FILE_PATH). Ne pas modifier manuellement." >&2
  exit 2
fi

# Guard 3: Warn on payment module changes (allow but warn)
if echo "$FILE_PATH" | grep -qE 'modules/payments/'; then
  echo "WARNING: Modification du module paiement. Verifier que la logique HMAC signature est preservee." >&2
  exit 0
fi

# Guard 4: Block editing build config files
if echo "$FILE_PATH" | grep -qE '(^|/)turbo\.json$|(^|/)tsconfig[^/]*\.json$|(^|/)package\.json$'; then
  echo "BLOCKED: Fichier de config build ($FILE_PATH). Modification manuelle requise pour securite du build." >&2
  exit 2
fi

# Guard 5: Block editing module rm/ (production-banned, incident 2026-01-11)
if echo "$FILE_PATH" | grep -qE 'backend/src/modules/rm/'; then
  echo "BLOCKED: Module rm/ est BANNI de production (incident 2026-01-11). Docker build echoue sur import @monorepo/shared-types." >&2
  exit 2
fi

exit 0
