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

# Read-only mode — mandate subagents (.claude/agents/mandat/*.md, mandat AB). Claude Code puts the
# calling subagent's name in the envelope (`agent_type`, absent for the main session) ; every
# subagent named mandat-* is read-only. A hook declared in a subagent's frontmatter was not run
# (Claude Code 2.1.327, essai du 2026-11-18) : this hook, wired in settings.json for every Bash
# call, is the guard. Allow-list, fail closed : every command of the line must be a read.
# Refused : command substitution, process substitution, any redirection other than to /dev/null
# or between fds, env assignments, and any program or subcommand not listed. The line is scanned
# left to right by a quote-aware scanner (perl) : quoted and escaped parts become Q, so
# `jq '.a | .b'` stays one command. Also refused : a quoted or escaped word that starts with `-`
# (an option the checks below could not see), brace expansion, $'…' / $"…", `$[`, and any `${…}`
# other than `${NAME}`, an unquoted `#` starting a word (comment) and here-documents. Option checks run on the argument list and refuse short-flag bundles and
# any abbreviation of a dangerous long option (security review of 2026-11-18).
AGENT_TYPE=$(jq -rs '.[0].agent_type // empty | strings' <<<"$INPUT" 2>/dev/null || true)
if [[ "$AGENT_TYPE" == mandat-* ]]; then
  ro_block() { echo "BLOCKED (lecture seule, sous-agent $AGENT_TYPE) : $1. Ce sous-agent n'ecrit rien ; rapporter la commande au lieu de l'executer." >&2; exit 2; }
  if grep -qE '`|\$\(|<\(|>\(' <<<"$COMMAND"; then ro_block "substitution de commande ou de processus"; fi
  RO_PL=$(cat <<'PL'
my $s = $ENV{RO_CMD}; my $n = length $s; my ($i, $out, $w, $wq, $wpre) = (0, '', '', 0, '');
sub bad { print "ERR\t$_[0]"; exit 0 }
# A word starting with - whose quoting begins before its first = hides the option name.
sub fin { bad("option entre guillemets ou echappee : $w") if $wq && $w =~ /^-/ && $wpre !~ /^-[^=]*=/; ($w, $wq) = ('', 0) }
sub q1 { $wpre = $w unless $wq; $wq = 1 }
sub dollar { my $r = substr($s, $_[0]);
  bad("expansion \$[") if $r =~ /^\$\[/;
  bad("expansion \${...} autre que \${NOM}") if $r =~ /^\$\{/ && $r !~ /^\$\{[A-Za-z_][A-Za-z0-9_]*\}/ }
while ($i < $n) {
  my $c = substr($s, $i, 1);
  if ($c eq '\\') { q1(); $out .= 'Q'; $w .= substr($s, $i + 1, 1); $i += 2; next }
  if ($c eq "'") { my $j = index($s, "'", $i + 1); bad("guillemet non ferme") if $j < 0;
    q1(); $out .= 'Q'; $w .= substr($s, $i + 1, $j - $i - 1); $i = $j + 1; next }
  if ($c eq '"') { my ($j, $v) = ($i + 1, '');
    while ($j < $n) { my $d = substr($s, $j, 1);
      if ($d eq '\\') { $v .= substr($s, $j + 1, 1); $j += 2; next }
      last if $d eq '"'; dollar($j) if $d eq '$'; $v .= $d; $j++ }
    bad("guillemet non ferme") if $j >= $n; q1(); $out .= 'Q'; $w .= $v; $i = $j + 1; next }
  if ($c eq '$') { bad("chaine \$'...' ou \$\"...\"") if substr($s, $i + 1, 1) =~ /['"]/; dollar($i) }
  bad("expansion d'accolades") if $c eq '{' && ($i == 0 || substr($s, $i - 1, 1) ne '$');
  bad("commentaire (#) hors guillemets") if $c eq '#' && $w eq '' && !$wq;
  if (substr($s, $i, 3) eq '<<<') { fin(); $out .= '<<<'; $i += 3; next }
  bad("here-document") if substr($s, $i, 2) eq '<<';
  if ($c =~ /[\s;|&<>()]/) { fin() } else { $w .= $c }
  $out .= $c; $i++ }
fin();
$out =~ s{\d*(?:>>?|&>>?)\s*/dev/null(?![^\s;|&)])}{}g;
$out =~ s{\d*>&(?:\d+-?|-)(?![^\s;|&)])}{}g;
print "OK\t$out";
PL
)
  RO_SCAN=$(RO_CMD="$COMMAND" perl -e "$RO_PL" 2>/dev/null) || ro_block "analyse de la commande impossible"
  case "$RO_SCAN" in
    OK$'\t'*) RO_NOREDIR="${RO_SCAN#OK$'\t'}" ;;
    ERR$'\t'*) ro_block "${RO_SCAN#ERR$'\t'}" ;;
    *) ro_block "analyse de la commande impossible" ;;
  esac
  if grep -qE '>' <<<"$RO_NOREDIR"; then ro_block "redirection vers un fichier"; fi
  # ro_long NAME… : an argument --x[=v] where x is a prefix of NAME (getopt abbreviations).
  ro_long() { local a n d; for a in "${W[@]:1}"; do [[ $a == --?* ]] || continue; n=${a#--}; n=${n%%=*}; [ -n "$n" ] || continue
      for d in "$@"; do [[ $d == "$n"* ]] && return 0; done; done; return 1; }
  # ro_short L : a short-option word (-abc, -ovalue) whose flag letters contain L, bundled or
  # with an attached value.
  ro_short() { local a; for a in "${W[@]:1}"; do [[ $a =~ ^-[A-Za-z0-9]*$1 ]] && return 0; done; return 1; }
  while IFS= read -r seg; do
    seg=$(sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' <<<"$seg")
    [ -n "$seg" ] || continue
    read -r -a W <<<"$seg"
    case "${W[0]}" in
      cat|head|tail|wc|cut|tr|jq|grep|sha256sum|ls|stat|date|basename|dirname|readlink|realpath|pwd|echo|true|test|diff|comm|nl|column|cd) ;;
      printf) ro_short v && ro_block "printf -v affecte une variable" ;;
      uniq) # uniq IN OUT writes OUT : at most one file operand.
        k=0; skip=0; for a in "${W[@]:1}"; do
          if [ "$skip" = 1 ]; then skip=0; continue; fi
          case "$a" in -f|-s|-w|--skip-fields|--skip-chars|--check-chars) skip=1 ;; -?*) ;; *) k=$((k+1)) ;; esac
        done; [ "$k" -le 1 ] || ro_block "uniq ENTREE SORTIE ecrit un fichier" ;;
      sort) { ro_short o || ro_long output compress-program; } && ro_block "sort -o ou --compress-program" ;;
      rg) ro_long pre hostname-bin && ro_block "rg --pre ou --hostname-bin execute un programme" ;;
      export) [[ "$seg" =~ ^export[[:space:]]+GIT_OPTIONAL_LOCKS=0$ ]] || ro_block "export autre que GIT_OPTIONAL_LOCKS=0" ;;
      git)
        i=1
        while [ "$i" -lt "${#W[@]}" ]; do
          case "${W[$i]}" in
            -C) i=$((i+2)) ;;
            --no-pager) i=$((i+1)) ;;
            -*) ro_block "option globale git ${W[$i]}" ;;
            *) break ;;
          esac
        done
        sub="${W[$i]:-}"; rest=" ${W[*]:$((i+1))} "
        case "$sub" in
          status|log|show|diff|rev-parse|ls-files|ls-remote|cat-file|merge-base|describe|blame|shortlog|rev-list|for-each-ref|show-ref|name-rev) ;;
          grep) ro_short O && ro_block "git grep -O execute un programme" ;;
          worktree) [ "${W[$((i+1))]:-}" = "list" ] || ro_block "git worktree autre que list" ;;
          branch) grep -qE '^ ((-r|-a|-v|-vv|--list|--show-current|--contains|--merged|--no-merged|--format=[^ ]*|--sort=[^ ]*)( |$))*$' <<<"$rest" || ro_block "git branch hors lecture" ;;
          *) ro_block "git $sub" ;;
        esac
        if grep -qE ' -u ' <<<"$rest" || ro_long output ext-diff textconv upload-pack open-files-in-pager \
          || { [ "$sub" = ls-remote ] && ro_short u; }; then ro_block "option git qui ecrit ou execute"; fi ;;
      gh)
        sub="${W[1]:-} ${W[2]:-}"
        case "$sub" in
          "pr view"|"pr list"|"pr checks"|"pr diff"|"pr status"|"run view"|"run list"|"issue view"|"issue list"|"repo view"|"release view"|"release list") ;;
          "api "*)
            if grep -qE '(^| )(-X|--method)(=| )?[^ ]*' <<<"$seg" && ! grep -qE '(^| )(-X|--method)(=| )?GET( |$)' <<<"$seg"; then ro_block "gh api autre que GET"; fi
            if grep -qE '(^| )(-f|-F|--field|--raw-field|--input)(=| |$)|(^| )-[fF][^ ]' <<<"$seg"; then ro_block "gh api avec corps de requete"; fi
            for a in "${W[@]:2}"; do [[ $a != -X* && $a =~ ^-[A-Za-z]*[fFX] ]] && ro_block "gh api : option groupee $a"; done ;;
          *) ro_block "gh $sub" ;;
        esac
        if grep -qE '(^| )(-o|--output)(=| |$)' <<<"$seg"; then ro_block "option gh qui ecrit un fichier"; fi ;;
      *) ro_block "programme non autorise en lecture seule : ${W[0]}" ;;
    esac
  done < <(sed -E 's/\|\||&&|[;|&]/\n/g' <<<"$RO_NOREDIR")
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
# Fail closed: no python3, a non-zero exit, or a command it cannot read = block.
if grep -qE '\b(git|gh)\b' <<<"$COMMAND" \
   && grep -qE '\b(tag|push|release|api|workflow)\b' <<<"$COMMAND"; then
  if ! command -v python3 &>/dev/null; then
    echo "BLOCKED: python3 requis pour le Guard 6 (git/gh tag, push, release, api, workflow). Garde en echec ferme." >&2
    exit 2
  fi
  if ! GUARD6=$(python3 -I "$(dirname "${BASH_SOURCE[0]}")/prod-trigger-check.py" <<<"$COMMAND"); then
    echo "BLOCKED: analyseur du Guard 6 en erreur (scripts/claude-hooks/prod-trigger-check.py). Garde en echec ferme." >&2
    exit 2
  fi
  case " $GUARD6 " in
    *" unparsable "*)
      echo "BLOCKED: commande illisible (guillemet ou here-document non fermes) qui cite git/gh tag, push, release, api ou workflow : le Guard 6 ne peut pas la verifier. Ecrire le texte dans un fichier." >&2
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
