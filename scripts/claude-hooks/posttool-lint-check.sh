#!/usr/bin/env bash
# PostToolUse hook for Edit/Write tools
# After editing backend/frontend/skills/CLAUDE.md/AGENTS.md files, warns if validators fail.
# Exit 0 = ok (file already written ; warn-only contract).

# Rollback rapide : si CLAUDE_HOOKS_DISABLE=1, court-circuiter sans git revert.
if [ "${CLAUDE_HOOKS_DISABLE:-0}" = "1" ]; then
  exit 0
fi

if ! command -v jq &>/dev/null; then
  echo "WARN: jq not installed — hook bypassed. Install: apt install jq" >&2
  exit 0
fi

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

REPO_ROOT="/opt/automecanik/app"

# .claude/skills/**/*.md → validate-skills-frontmatter.js
# Branche le validateur existant au PostToolUse pour feedback immédiat (sinon il ne tourne
# qu'en CI : skills-canon-gate.yml ; ni .husky/pre-commit ni lint-staged ne l'appellent).
# Validators existants réutilisés tels quels — no wrapper.
# Le validateur ignore tout argument positionnel : il prend `--skill <nom>` et résout
# `.claude/skills/` depuis son propre emplacement. Racine et nom sont donc lus dans le
# chemin édité (worktree compris) ; les skills de workspace n'ont pas de validateur → sautés.
if [[ "$FILE_PATH" =~ ^(.*)/\.claude/skills/([^/]+)/.*\.md$ ]]; then
  SKILL_ROOT="${BASH_REMATCH[1]}"
  SKILL_NAME="${BASH_REMATCH[2]}"
  VALIDATOR="$SKILL_ROOT/scripts/governance/validate-skills-frontmatter.js"
  if [ -f "$FILE_PATH" ] && [ -f "$VALIDATOR" ]; then
    if ! node "$VALIDATOR" --skill "$SKILL_NAME" >/tmp/skills-frontmatter.log 2>&1; then
      echo "WARN skill frontmatter: $FILE_PATH" >&2
      tail -5 /tmp/skills-frontmatter.log >&2
      echo "→ corriger avant pre-commit (validate-skills-frontmatter.js)" >&2
    fi
  fi
  exit 0
fi

# CLAUDE.md | AGENTS.md → validate-agents-md.sh --file <path>
# Validateur anti-pattern (pas d'IP/URL/UUID/clé hardcodée) — feedback immédiat.
if echo "$FILE_PATH" | grep -qE '(/|^)(CLAUDE|AGENTS)\.md$'; then
  if [ -f "$REPO_ROOT/scripts/agents/validate-agents-md.sh" ]; then
    if ! bash "$REPO_ROOT/scripts/agents/validate-agents-md.sh" --file "$FILE_PATH" >/tmp/agents-md.log 2>&1; then
      echo "WARN AGENTS/CLAUDE.md: $FILE_PATH" >&2
      tail -5 /tmp/agents-md.log >&2
      echo "→ corriger avant pre-commit (validate-agents-md.sh --file)" >&2
    fi
  fi
  exit 0
fi

# TypeScript backend/frontend (existant)
if ! echo "$FILE_PATH" | grep -qE '\.(ts|tsx)$'; then
  exit 0
fi

# Backend: quick eslint check on the modified file
if echo "$FILE_PATH" | grep -q '/backend/'; then
  if [ -f "$FILE_PATH" ]; then
    RESULT=$(cd "$REPO_ROOT/backend" && npx eslint --no-eslintrc --rule '{"no-unused-vars":"warn","@typescript-eslint/no-unused-vars":"warn"}' --parser @typescript-eslint/parser "$FILE_PATH" 2>/dev/null | tail -1 || true)
    if echo "$RESULT" | grep -qE '[0-9]+ error'; then
      echo "LINT: $RESULT — Pense a verifier avec 'npm run lint' dans backend/" >&2
    fi
  fi
  exit 0
fi

# Frontend: quick check
if echo "$FILE_PATH" | grep -q '/frontend/'; then
  if [ -f "$FILE_PATH" ]; then
    RESULT=$(cd "$REPO_ROOT/frontend" && npx eslint "$FILE_PATH" 2>/dev/null | tail -1 || true)
    if echo "$RESULT" | grep -qE '[0-9]+ error'; then
      echo "LINT: $RESULT — Pense a verifier avec 'npm run lint' dans frontend/" >&2
    fi
  fi
  exit 0
fi

exit 0
