#!/usr/bin/env bash
# PreToolUse hook for Bash commands
# Blocks dangerous operations: git push main, destructive docker commands
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
if ! COMMAND=$(jq -ers '
    if length == 1 and (.[0] | type) == "object" and (.[0].tool_input | type) == "object"
    then .[0].tool_input.command else error("envelope") end
    | select(type == "string" and test("\\S"))' <<<"$INPUT" 2>/dev/null); then
  echo "BLOCKED: enveloppe PreToolUse illisible (objet JSON avec tool_input.command non vide attendu). Garde en echec ferme." >&2
  exit 2
fi

# Tests via here-string, never `echo "$X" | grep -q`: under pipefail, grep -q exits
# on the first matching line, echo gets SIGPIPE on long multi-line input, and the
# match reads as "no match" — the guard let it through (scripts/test-claude-hooks.sh, 1 Mo).

# Guard 1: Block git push to main
if grep -qE 'git\s+push\s+.*\b(origin\s+main|main)\b' <<<"$COMMAND"; then
  echo "BLOCKED: git push origin main est interdit. Pousse une branche et ouvre une PR." >&2
  exit 2
fi

# Guard 2: Block destructive docker commands on production containers
if grep -qE '(docker[- ]compose\s+down|docker\s+stop\s|docker\s+rm\s)' <<<"$COMMAND"; then
  if grep -qE '(prod|nestjs-remix|automecanik)' <<<"$COMMAND"; then
    echo "BLOCKED: Commande Docker destructive sur containers production detectee. Demande confirmation explicite a l'utilisateur." >&2
    exit 2
  fi
fi

# Guard 3: Block force push
if grep -qE 'git\s+push\s+.*--force' <<<"$COMMAND"; then
  echo "BLOCKED: git push --force est interdit. Risque de perte de code en production." >&2
  exit 2
fi

# Guard 4: Block git reset --hard
if grep -qE 'git\s+reset\s+--hard' <<<"$COMMAND"; then
  echo "BLOCKED: git reset --hard est interdit sans confirmation explicite." >&2
  exit 2
fi

# Guard 5: Block npm install/uninstall without confirmation
if grep -qE 'npm\s+(install|uninstall|update|remove|add)\s' <<<"$COMMAND"; then
  echo "BLOCKED: Gestion de paquets (npm install/uninstall) necessite confirmation explicite. Risque: breaking changes, lock file corruption." >&2
  exit 2
fi

# Guard 6: Block every way of starting a PROD deploy (owner GO only)
# Any tag matching v* (not only vX.Y.Z) starts release-prod.yml, which deploys that tag's
# commit to PROD (voir .claude/rules/deployment.md). This hook is a tripwire for agent
# commands, not the security boundary: a v* tag ruleset on GitHub is. Covers:
# - git tag with a v* name (list/query forms allowed);
# - git push of tags: --tags, --follow-tags, any refs/tags/ refspec, a bare v* token
#   (branch refspecs here always carry a slash, e.g. fix/vlevel-x, and stay allowed);
# - gh release create (any), gh api writes to git/refs or releases;
# - gh workflow run|enable, or gh api dispatches|enable, of release-prod.yml or of the
#   retired deploy-prod.yml, by file name, display name (any case) or numeric id
#   (417610500 = release-prod.yml, 224452325 = deploy-prod.yml).
# Each test reads one sub-command (cut at ; & | or newline): a word of another command,
# like `gh pr view` after `git push`, must not count as a v* token.
segments() { grep -oE "$1[^;&|]*" <<<"$COMMAND" || true; }
TAG_V=0
while IFS= read -r seg; do
  [ -n "$seg" ] || continue
  if grep -qE '(\s|=)["'"'"']?v[^[:space:]/"'"'"']*' <<<"${seg#git*tag}" \
     && ! grep -qE '\s(-l|--list|--contains|--no-contains|--merged|--no-merged|--points-at|-v|--verify)(\s|=|$)' <<<"$seg"; then
    TAG_V=1
  fi
done <<<"$(segments 'git\s+tag\b')"
API_WRITE=0
while IFS= read -r seg; do
  [ -n "$seg" ] || continue
  if grep -qE '(git/refs|/releases)\b' <<<"$seg" \
     && grep -qE '\s((-f|-F|--field|--raw-field|--input)\s|(-X|--method)\s*(POST|PATCH|PUT|DELETE))' <<<"$seg"; then
    API_WRITE=1
  fi
done <<<"$(segments 'gh\s+api\b')"
if [ "$TAG_V" = 1 ] || [ "$API_WRITE" = 1 ] \
   || grep -qE '(--tags|--follow-tags|refs/tags/|\sv[^[:space:]/]*(\s|$))' <<<"$(segments 'git\s+push\b')" \
   || grep -qE 'gh\s+release\s+create\b' <<<"$COMMAND"; then
  echo "BLOCKED: tag v* = declencheur deploy PROD (voir .claude/rules/deployment.md). GO owner explicite requis." >&2
  exit 2
fi
if grep -iqE '((release|deploy)[- ]prod|417610500|224452325)' <<<"$(segments 'gh\s+workflow\s+(run|enable)\b')" \
   || grep -iqE 'actions/workflows/((release|deploy)-prod\.yml|417610500|224452325)/(dispatches|enable)\b' <<<"$(segments 'gh\s+api\b')"; then
  echo "BLOCKED: lancement manuel ou reactivation d'un workflow de deploiement PROD (voir .claude/rules/deployment.md). GO owner explicite requis." >&2
  exit 2
fi

# Guard 7: WARN on full-content dump of a giant GENERATED registry artifact (token blow-up)
# audit/registry/*.json = Repository Control Plane projections, meant to be queried with jq
# FILTERS (CLAUDE.md "Query via jq"). canonical.json ~770k tok, files.json ~515k tok — a raw
# `cat`/`jq .` with no downstream reducer dumps the WHOLE file into the agent context
# (~77% of a 1M window). The Read tool caps at 2000 lines; cat/jq . via Bash do not.
# Non-blocking WARN (falls through to exit 0): a jq-FILTERED read or ANY piped/reduced read
# (contains '|') is legitimate and NOT warned. Ref: token-consumption audit 2026-07-04.
if grep -qE 'audit/registry/[A-Za-z0-9_.-]+\.json' <<<"$COMMAND" \
   && ! grep -qF '|' <<<"$COMMAND"; then
  if grep -qE '(^|[|&; ])(cat|bat|less|more|nl|tac)[ ]' <<<"$COMMAND" \
     || grep -qE "jq[ ]+(-[A-Za-z]+[ ]+)*'?\.'?[ ]" <<<"$COMMAND"; then
    echo "WARNING: lecture PLEINE d'un artefact registry genere (audit/registry/*.json). canonical.json ~770k tokens (~77% d'un contexte 1M), files.json ~515k. Utilise jq avec un FILTRE, ex: jq '.files[] | select(.path|contains(\"payments\"))' audit/registry/canonical.json — voir CLAUDE.md (Query via jq)." >&2
  fi
fi

exit 0
