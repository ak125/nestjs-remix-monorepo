#!/usr/bin/env bash
# PreToolUse hook for Edit/Write tools
# Blocks editing of protected system files (owner-only paths)
# Warns on payment module changes
# Exit 0 = allow, Exit 2 = block (stderr shown to user)

if ! command -v jq &>/dev/null; then
  echo "BLOCKED: jq requis pour les hooks de securite. Installer: apt install jq" >&2
  exit 2
fi

set -euo pipefail

# Read tool input from stdin (JSON): exactly one object, argument in tool_input.
# Unreadable envelope → block (fail closed): allowing it would silence every guard
# below on the first envelope format change.
INPUT=$(cat)
if ! FILE_PATH=$(jq -ers '
    if length == 1 and (.[0] | type) == "object" and (.[0].tool_input | type) == "object"
    then .[0].tool_input.file_path else error("envelope") end
    | select(type == "string" and test("\\S"))' <<<"$INPUT" 2>/dev/null); then
  echo "BLOCKED: enveloppe PreToolUse illisible (objet JSON avec tool_input.file_path non vide attendu). Garde en echec ferme." >&2
  exit 2
fi

# Guard 1: Block editing blast-radius / system files
if echo "$FILE_PATH" | grep -qE '(^|/)\.env($|/)|\.github/|docker-compose|Caddyfile$|Dockerfile$|\.dockerignore$'; then
  echo "BLOCKED: Fichier protege ($FILE_PATH). Modification reservee a l'owner : fournir le diff, il l'applique." >&2
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
