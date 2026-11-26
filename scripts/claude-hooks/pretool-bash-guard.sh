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

# Guard 5b: Block npm commands that rebuild node_modules through a symbolic link
# Incident DEV 2026-11-15 : `npm ci` dans un worktree dont node_modules est un lien vers le
# checkout servi vide la CIBLE du lien, et le backend DEV perd ses dépendances. Un script
# preinstall ne protège pas : npm 11.13 vide node_modules avant de le lancer (essai du
# 2026-11-15). Répertoires contrôlés : le cwd de l'enveloppe et chaque argument de cd, pushd,
# --prefix ou -C de la commande ; pour chacun, sa racine git. Refus si node_modules du
# répertoire, de la racine, d'un dossier de premier niveau ou de packages/* est un lien.
# Les verbes listés sont ceux de npm qui réécrivent node_modules, alias compris.
NPM_REIFY_RE='(^|[^[:alnum:]_./-])npm([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+(ci|clean-install|ic|install-clean|isntall-clean|install-ci-test|cit|clean-install-test|sit|i|in|ins|inst|insta|instal|install|isnt|isnta|isntal|isntall|add|install-test|it|uninstall|unlink|remove|rm|r|un|update|up|upgrade|udpate|dedupe|ddp|prune)([[:space:];&|)]|$)'
if grep -qE "$NPM_REIFY_RE" <<<"$COMMAND"; then
  HOOK_CWD=$(jq -r 'if (.cwd | type) == "string" then .cwd else empty end' <<<"$INPUT")
  [ -n "$HOOK_CWD" ] || HOOK_CWD=$PWD
  NPM_DIRS=("$HOOK_CWD")
  while IFS= read -r d; do
    [ -n "$d" ] || continue
    d=${d//\"/}; d=${d//\'/}; d=${d/#\~/$HOME}
    case "$d" in /*) ;; *) d="$HOOK_CWD/$d" ;; esac
    NPM_DIRS+=("$d")
  done < <(
    { grep -oE '(^|[[:space:];&|(])(cd|pushd)[[:space:]]+[^[:space:];&|)]+' <<<"$COMMAND" | awk '{print $NF}'
      grep -oE -- '(--prefix|-C)(=|[[:space:]]+)[^[:space:];&|)]+' <<<"$COMMAND" | sed -E 's/^(--prefix|-C)(=|[[:space:]]+)//'
    } || true
  )
  for dir in "${NPM_DIRS[@]}"; do
    [ -d "$dir" ] || continue
    NM_CANDIDATES=("$dir/node_modules")
    # Hors dépôt git (ex. /tmp) : le répertoire seul, sans parcourir ses voisins.
    if top=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) && [ -n "$top" ]; then
      NM_CANDIDATES+=("$top/node_modules" "$top"/*/node_modules "$top"/packages/*/node_modules)
    fi
    for nm in "${NM_CANDIDATES[@]}"; do
      if [ -L "$nm" ]; then
        echo "BLOCKED: cette commande npm réinstallerait node_modules à travers un lien symbolique ($nm -> $(readlink "$nm")). npm vide la cible du lien, ici le node_modules d'un autre checkout (incident DEV 2026-11-15). Retirer d'abord le lien (rm \"$nm\", sans / final : la cible reste intacte), ou travailler sans installer." >&2
        exit 2
      fi
    done
  done
fi

# Guard 5: Block npm install/uninstall without confirmation
if grep -qE 'npm\s+(install|uninstall|update|remove|add)\s' <<<"$COMMAND"; then
  echo "BLOCKED: Gestion de paquets (npm install/uninstall) necessite confirmation explicite. Risque: breaking changes, lock file corruption." >&2
  exit 2
fi

# Guard 6: Block every way of starting a PROD deploy (owner GO only)
# Any tag matching v* (not only vX.Y.Z) starts release-prod.yml, which deploys that tag's
# commit to PROD (voir .claude/rules/deployment.md). This hook is a tripwire for agent
# commands, not the security boundary: GitHub permissions and a v* tag ruleset are. It
# cannot see a command built indirectly (variable, script, here-document fed to a shell).
# Floor, unchanged from the first version of this guard: whole-command match on vX.Y.Z.
if grep -qE 'git\s+tag\b.*\bv[0-9]+(\.[0-9]+){1,3}\b|git\s+push\b.*(--tags|\bv[0-9]+(\.[0-9]+){1,3}\b)' <<<"$COMMAND"; then
  echo "BLOCKED: tag v* = declencheur deploy PROD (voir .claude/rules/deployment.md). GO owner explicite requis." >&2
  exit 2
fi
# Every v* name and every PROD workflow, read on shell words by prod-trigger-check.py (next
# to this hook): quotes, comments, operators, redirections, here-document bodies (data),
# words that read as commands themselves (bash -c '...', "$(...)"). Covers:
# - git tag with a v* argument (list/query forms -l, -n, --contains, -v... allowed; option
#   values such as -m <message> are read as values, never as a mode);
# - git push of tags: --tags, --follow-tags, --mirror, a refspec side that starts with v
#   (after +) or contains refs/tags/ (branch refspecs here carry a slash: fix/vlevel-x);
# - gh release create|edit; gh api writes (-f, -F, --field, --raw-field, --input, -X or
#   --method other than GET, attached forms included) to git/refs, git/tags or releases,
#   and graphql createRef/updateRef/createRelease;
# - gh workflow run|enable, gh api .../dispatches|enable, of release-prod.yml or of the
#   retired deploy-prod.yml, by file name, display name (any case) or numeric id
#   (417610500 = release-prod.yml, 224452325 = deploy-prod.yml).
# Same analyser, same words: an agent session never merges a pull request, never arms its
# merge and never approves it (CLAUDE.md, Gouvernance: "Un agent ne fusionne jamais et
# n'arme jamais l'auto-fusion" ; journal des principes, P20). gh on this host carries the
# owner's login, so the command would run with the owner's rights. Covers:
# - gh pr merge in every form (--auto, --squash, --merge, --rebase, --admin, no option);
#   gh api writes to .../pulls/<n>/merge; graphql mergePullRequest,
#   enablePullRequestAutoMerge, enqueuePullRequest;
# - gh pr review --approve / -a; gh api writes to .../pulls/<n>/reviews with event=APPROVE
#   (field, here-document or pipe); graphql add/submitPullRequestReview with APPROVE.
# Allowed: reads (gh pr view|list|checks|diff|status, GET on the same endpoints), comments
# (gh pr comment, gh pr review --comment|--request-changes), gh pr create|edit|ready|close,
# a branch push, and disarming (gh pr merge --disable-auto, disablePullRequestAutoMerge).
# It cannot see: a command built indirectly (variable, script file, gh alias or extension),
# a body or a query read from a file (--input f.json, -F query=@f.graphql), another HTTP
# client (curl), the branch merge API (POST .../merges, mergeBranch). A message that only
# quotes such a command (commit, PR body) is read as the command: write it to a file.
# Fail closed: no python3, a non-zero exit, or a command it cannot read = block.
if { grep -qE '\b(git|gh)\b' <<<"$COMMAND" \
     && grep -qE '\b(tag|push|release|api|workflow)\b' <<<"$COMMAND"; } \
   || { grep -qE '\bgh\b' <<<"$COMMAND" && grep -qE '\b(merge|review)\b' <<<"$COMMAND"; }; then
  if ! command -v python3 &>/dev/null; then
    echo "BLOCKED: python3 requis pour le Guard 6 (git/gh tag, push, release, api, workflow ; gh merge, review). Garde en echec ferme." >&2
    exit 2
  fi
  if ! GUARD6=$(python3 -I "$(dirname "${BASH_SOURCE[0]}")/prod-trigger-check.py" <<<"$COMMAND"); then
    echo "BLOCKED: analyseur du Guard 6 en erreur (scripts/claude-hooks/prod-trigger-check.py). Garde en echec ferme." >&2
    exit 2
  fi
  case " $GUARD6 " in
    *" unparsable "*)
      echo "BLOCKED: commande illisible (guillemet ou here-document non fermes) qui cite git/gh tag, push, release, api ou workflow, ou gh merge ou review : le Guard 6 ne peut pas la verifier. Ecrire le texte dans un fichier." >&2
      exit 2 ;;
    *" tag "*)
      echo "BLOCKED: tag v* = declencheur deploy PROD (voir .claude/rules/deployment.md). GO owner explicite requis." >&2
      exit 2 ;;
    *" workflow "*)
      echo "BLOCKED: lancement manuel ou reactivation d'un workflow de deploiement PROD (voir .claude/rules/deployment.md). GO owner explicite requis." >&2
      exit 2 ;;
    *" merge "*)
      echo "BLOCKED: fusion d'une PR ou armement de sa fusion (gh pr merge, --auto compris ; gh api .../pulls/<n>/merge ; mergePullRequest, enablePullRequestAutoMerge). Un agent ne fusionne jamais et n'arme jamais l'auto-fusion (CLAUDE.md, Gouvernance) : remettre a l'owner le numero de la PR et le SHA de tete. Desarmer reste permis (gh pr merge --disable-auto). Si la commande ne fait que citer ce texte, l'ecrire dans un fichier." >&2
      exit 2 ;;
    *" approve "*)
      echo "BLOCKED: approbation d'une PR (gh pr review --approve ; revue APPROVE par gh api). L'approbation est un acte de l'owner : un agent n'approuve pas. Une revue en commentaire reste permise (gh pr review --comment). Si la commande ne fait que citer ce texte, l'ecrire dans un fichier." >&2
      exit 2 ;;
  esac
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
