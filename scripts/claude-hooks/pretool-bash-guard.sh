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
# commands, not the security boundary: GitHub permissions and a v* tag ruleset are. It
# cannot see a command built indirectly (variable, script, here-document fed to a shell).
# Floor, unchanged from the first version of this guard: whole-command match on vX.Y.Z.
if grep -qE 'git\s+tag\b.*\bv[0-9]+(\.[0-9]+){1,3}\b|git\s+push\b.*(--tags|\bv[0-9]+(\.[0-9]+){1,3}\b)' <<<"$COMMAND"; then
  echo "BLOCKED: tag v* = declencheur deploy PROD (voir .claude/rules/deployment.md). GO owner explicite requis." >&2
  exit 2
fi
# Every v* name, read on shell words (shlex: quotes, ; & | ( ) and newlines), so that a
# quoted separator or a flag inside a message cannot change the verdict. Covers:
# - git tag with a v* argument (list/query forms -l, --contains, -v... allowed);
# - git push of tags: --tags, --follow-tags, --mirror, a refspec side that starts with v
#   (after +) or contains refs/tags/ (branch refspecs here carry a slash: fix/vlevel-x);
# - gh release create|edit; gh api writes (-f, -F, --field, --raw-field, --input, -X or
#   --method other than GET, attached forms included) to git/refs, git/tags or releases,
#   and graphql createRef/updateRef/createRelease;
# - gh workflow run|enable, gh api .../dispatches|enable, of release-prod.yml or of the
#   retired deploy-prod.yml, by file name, display name (any case) or numeric id
#   (417610500 = release-prod.yml, 224452325 = deploy-prod.yml).
# Here-document bodies are data, removed before parsing. Unparsable command: block.
if grep -qE '\b(git|gh)\b' <<<"$COMMAND" \
   && grep -qE '\b(tag|push|release|api|workflow)\b' <<<"$COMMAND"; then
  if ! command -v python3 &>/dev/null; then
    echo "BLOCKED: python3 requis pour le Guard 6 (git/gh tag, push, release, api, workflow). Garde en echec ferme." >&2
    exit 2
  fi
  GUARD6=$(python3 -I -c '
import re, shlex, sys
cmd = sys.stdin.read().replace("\\\n", " ")
lines, kept, i = cmd.split("\n"), [], 0
while i < len(lines):
    kept.append(lines[i]); i += 1
    for m in re.finditer(r"(?<!<)<<(?!<)(-?)\s*([\x27\x22]?)([A-Za-z_][A-Za-z0-9_]*)\2", kept[-1]):
        while i < len(lines):
            i += 1
            if (lines[i - 1].lstrip("\t") if m.group(1) else lines[i - 1]) == m.group(3):
                break
try:
    lex = shlex.shlex("\n".join(kept), posix=True, punctuation_chars="();&|\n")
    lex.whitespace, lex.whitespace_split, lex.commenters = " \t\r", True, ""
    toks = list(lex)
except ValueError:
    print("unparsable"); sys.exit()
SEP = set("();&|\n")
cmds, cur = [], []
for t in toks:
    if t and set(t) <= SEP:
        cmds.append(cur); cur = []
    else:
        cur.append(t)
cmds.append(cur)
LIST = {"-l", "--list", "--contains", "--no-contains", "--merged", "--no-merged", "--points-at", "-v", "--verify"}
PROD = r"(release|deploy)[- ]prod|417610500|224452325"
def method(a):
    for j, t in enumerate(a):
        if t in ("-X", "--method") and j + 1 < len(a): return a[j + 1].upper()
        if t.startswith("--method="): return t.split("=", 1)[1].upper()
        if t.startswith("-X") and len(t) > 2: return t[2:].upper()
    return None
def fields(a):
    return any(t in ("-f", "-F", "--field", "--raw-field", "--input") or re.match(r"-[fF].|--(field|raw-field|input)=", t) for t in a)
out = set()
for c in cmds:
    for k, w in enumerate(c):
        base = w.rsplit("/", 1)[-1]
        if base == "git":
            j = k + 1
            while j < len(c) and c[j].startswith("-"):
                j += 2 if c[j] in ("-C", "-c", "--git-dir", "--work-tree", "--namespace") else 1
            if j >= len(c): continue
            sub, a = c[j], c[j + 1:]
            if sub == "tag" and not any(t.split("=", 1)[0] in LIST for t in a) \
               and any(t.startswith("v") or "refs/tags/v" in t for t in a):
                out.add("tag")
            if sub == "push":
                if any(t.split("=", 1)[0] in ("--tags", "--follow-tags", "--mirror") for t in a):
                    out.add("tag")
                for t in a:
                    if t.startswith("-"): continue
                    for side in t.lstrip("+").split(":"):
                        if side.startswith("v") or "refs/tags/" in side: out.add("tag")
        elif base == "gh" and k + 1 < len(c):
            a = c[k + 1:]
            if a[0] == "release" and ("create" in a or "edit" in a): out.add("tag")
            if a[0] == "workflow" and ("run" in a or "enable" in a) and re.search(PROD, " ".join(a), re.I):
                out.add("workflow")
            if a[0] == "api":
                m = method(a)
                write = m != "GET" if m else fields(a)
                if write and any(re.search(r"git/(refs|tags)\b|/releases\b", t) for t in a): out.add("tag")
                if "graphql" in a and any(re.search(r"create(Ref|Release)|updateRef", t) for t in a): out.add("tag")
                if any(re.search(r"actions/workflows/[^/]*(" + PROD + r")[^/]*/(dispatches|enable)\b", t, re.I) for t in a):
                    out.add("workflow")
print(" ".join(sorted(out)))
' <<<"$COMMAND")
  case " $GUARD6 " in
    *" unparsable "*)
      echo "BLOCKED: commande illisible (guillemets non fermes) qui cite git/gh tag, push, release, api ou workflow : le Guard 6 ne peut pas la verifier. Ecrire le texte dans un fichier." >&2
      exit 2 ;;
    *" tag "*)
      echo "BLOCKED: tag v* = declencheur deploy PROD (voir .claude/rules/deployment.md). GO owner explicite requis." >&2
      exit 2 ;;
    *" workflow "*)
      echo "BLOCKED: lancement manuel ou reactivation d'un workflow de deploiement PROD (voir .claude/rules/deployment.md). GO owner explicite requis." >&2
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
