#!/usr/bin/env bash
# PostToolUse hook for Edit/Write tools
# After editing backend/frontend files, warns if lint issues are likely
# Exit 0 = ok, Exit 2 = send feedback (file was still written)

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // empty' 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only check .ts and .tsx files
if ! echo "$FILE_PATH" | grep -qE '\.(ts|tsx)$'; then
  exit 0
fi

# Backend: quick eslint check on the modified file
if echo "$FILE_PATH" | grep -q '/backend/'; then
  if [ -f "$FILE_PATH" ]; then
    RESULT=$(cd /opt/automecanik/app/backend && npx eslint --no-eslintrc --rule '{"no-unused-vars":"warn","@typescript-eslint/no-unused-vars":"warn"}' --parser @typescript-eslint/parser "$FILE_PATH" 2>/dev/null | tail -1 || true)
    if echo "$RESULT" | grep -qE '[0-9]+ error'; then
      echo "LINT: $RESULT — Pense a verifier avec 'npm run lint' dans backend/" >&2
    fi
  fi
  exit 0
fi

# Frontend: quick check
if echo "$FILE_PATH" | grep -q '/frontend/'; then
  if [ -f "$FILE_PATH" ]; then
    RESULT=$(cd /opt/automecanik/app/frontend && npx eslint "$FILE_PATH" 2>/dev/null | tail -1 || true)
    if echo "$RESULT" | grep -qE '[0-9]+ error'; then
      echo "LINT: $RESULT — Pense a verifier avec 'npm run lint' dans frontend/" >&2
    fi
  fi
  exit 0
fi

exit 0
