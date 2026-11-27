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
#   enablePullRequestAutoMerge, enqueuePullRequest (query in a field, a here-document or
#   a pipe);
# - gh pr review --approve / -a; gh api writes to .../pulls/<n>/reviews with event=APPROVE
#   (field, here-document or pipe); graphql add/submitPullRequestReview with APPROVE.
# Allowed: reads (gh pr view|list|checks|diff|status, GET on the same endpoints), comments
# (gh pr comment, gh pr review --comment|--request-changes), gh pr create|edit|ready|close,
# a branch push, and disarming (gh pr merge --disable-auto, disablePullRequestAutoMerge).
# It cannot see: a command built indirectly (variable, script file, gh alias or extension),
# a body or a query read from a file (--input f.json, -F query=@f.graphql), another HTTP
# client (curl), the branch merge API (POST .../merges, mergeBranch), a word whose letters
# are split by quotes or escapes (mer''ge, as ta''g above). A message that only quotes
# such a command (commit, PR body) is read as the command: write it to a file.
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

# Guard 8 : client direct vers la base Supabase, lecture d'un fichier .env par le shell.
# Décision de Marwane du 27 nov. 2026 (mandat FU) : la voie psql et CLI vers la vraie base est
# fermée aux sessions ; les bases d'essai locales restent ouvertes.
#
# Refuse (exit 2) :
#   a. un client de PostgreSQL (psql, pgcli, pg_dump, pg_restore et les autres outils clients) ou
#      la CLI supabase, quand la commande vise un hôte *.supabase.co ou *.supabase.com, porte
#      l'utilisateur du pooler (postgres.<ref du projet>), passe une variable SUPABASE_* (les
#      noms de connexion de backend/.env.example en font partie) ou lit sa cible dans un fichier
#      .env. Pour la CLI : toute commande avec une option de projet hébergé (--linked, --remote,
#      --project-ref, --project-id, --password, --db-url vers Supabase) et les sous-commandes
#      qui visent le projet hébergé par défaut (db push, db pull, db dump, db remote, migration
#      list, repair et fetch, gen types, inspect, link, pull, backups, branches, postgres-config) ;
#   b. la lecture par le shell d'un fichier .env ou .env.<suffixe> : afficheurs, filtres, copie,
#      déplacement, lien, archive, source et « . », redirection d'entrée, find -exec, xargs.
#      Compter ou tester une ligne lit le fichier : refusé aussi. Les modèles (.env.example,
#      .env.*.template) se lisent.
# Laisse passer : localhost, 127.0.0.1, socket Unix, docker exec <conteneur> psql, une commande
# sans cible, la CLI sur la pile locale ; ls, stat, test, wc, sha256sum, chmod, find -name et les
# chargeurs (--env-file, dotenv) sur un .env ; une commande qui ne fait que citer ces mots
# (message de commit, recherche dans le code, texte écrit dans un fichier).
#
# LIMITES. Lecture lexicale du texte de la commande : un garde-fou d'agent, pas une frontière
# de sécurité. Ne voit pas :
#   - un pilote ou un client HTTP (node, python, tsx, curl vers l'API REST ou l'API de gestion) ;
#   - un fichier de script qui lit lui-même un .env ou appelle psql (forme sweep-psql.sh) ;
#   - une cible tenue par une variable définie hors de la commande (psql "$DATABASE_URL",
#     psql -h "$HOTE"), PGSERVICE, ~/.pgpass ;
#   - un nom reconstruit par le shell (${f%.example}, lettres coupées par des guillemets, glob
#     qui n'écrit pas le nom, nom lu sur l'entrée standard), une recherche récursive sur un
#     dossier qui contient un .env, l'outil Read, les fichiers nom.env.
# Faux positifs connus : un texte SQL ou un message qui nomme une variable SUPABASE_* ou un hôte
# Supabase dans une commande cliente ; .env.{example,template}. Écrire alors le texte dans un
# fichier.
# Frontière réelle : le bac à sable natif de Claude Code (réseau, lecture des fichiers) ou une
# identité des sessions séparée des secrets de l'application ; côté base, un rôle en lecture seule.
# Échec fermé : python3 absent, analyseur en erreur ou commande illisible = refus.
# Le programme réutilise le lexer du Guard 6 (prod-trigger-check.py, lu à côté de ce fichier) ;
# il est porté par un here-document lu sur le descripteur 3 : stdin reste à la commande.
# Cas d'épreuve : scripts/claude-hooks/pretool-bash-guard.test.sh.
guard8_scan() {
  python3 -I -B /dev/fd/3 "$(dirname "${BASH_SOURCE[0]}")/prod-trigger-check.py" 3<<'GUARD8_PY'
# Analyseur du Guard 8. Commande sur stdin, chemin du lexer en argument. Écrit les constats,
# séparés par des espaces :
#   unparsable      commande illisible (guillemet ou here-document non fermés)
#   db:<client>     client de PostgreSQL ou CLI supabase vers la base Supabase
#   env:<lecteur>   lecture d'un fichier .env par le shell
# Méthode : découper en commandes simples avec le lexer du Guard 6, résoudre le mot de commande,
# suivre les variables affectées dans le texte, et relire comme des commandes les seuls textes
# que le shell lit : $( ), accents graves, bash -c, here-document ou tube donnés à un shell, eval.
import importlib.util
import re
import sys

ptc = None
BT = chr(96)  # accent grave
# Cibles : hôte *.supabase.co ou *.supabase.com, utilisateur du pooler postgres.<ref du projet>,
# variable SUPABASE_* (les noms de connexion de backend/.env.example en font partie).
HOST = re.compile(r"(^|[^A-Za-z0-9-])([A-Za-z0-9_${}-]+\.)+supabase\.(co|com)([^A-Za-z0-9.-]|$)", re.I)
POOLER = re.compile(r"(^|[^A-Za-z0-9_.-])postgres\.[a-z0-9]{20}([^A-Za-z0-9]|$)")
CONNVAR = re.compile(r"(^|[^A-Za-z0-9_])SUPABASE_[A-Z0-9_]+")
# Cibles locales nommées (pour --db-url et --remote=<url> de la CLI).
LOCAL = re.compile(r"(^|[^A-Za-z0-9.-])(localhost|127\.0\.0\.1|::1|host\.docker\.internal)([^A-Za-z0-9.-]|$)")
# Fichier .env ou .env.<suffixe>, écrit tel quel, avec un glob ou entre accolades ; modèles exclus.
ENVFILE = re.compile(r"(^|[/{,])\.env([.*?\[{][^/]*|[,}].*)?$")
TEMPLATE = re.compile(r"\.(example|template)$")
LINEREF = re.compile(r"(:[0-9]+(-[0-9]+)?)+$")
ASSIGN = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\+?=(.*)", re.S)
ARRAY = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\+?=")
REF = re.compile(r"\$(?:([A-Za-z_][A-Za-z0-9_]*)|\{[#!]?([A-Za-z_][A-Za-z0-9_]*)([^}]*)\})")
DEFAULT = re.compile(r":?[-=+](.*)", re.S)
NUM = re.compile(r"0x[0-9A-Fa-f]+|[0-9][0-9.,:-]*[smhdkKMG]?")
HEREDOC = re.compile(r"<<-?[ \t]*[\x22\x27\\]?([A-Za-z_][A-Za-z0-9_]*)")
SHELLC = re.compile(r"-[A-Za-z]*c[A-Za-z]*")
SHELLO = re.compile(r"[-+][A-Za-z]*[oO]")
PROJECT = re.compile(r"[a-z]{20}")

RESERVED = {"{", "}", "!", "if", "then", "else", "elif", "fi", "do", "done", "while", "until", "time", "coproc"}
NOCMD = {"for", "case", "select"}
# Outils clients de PostgreSQL (même liste que le préfiltre du hook).
CLIENTS = {"psql", "pgcli", "pg_dump", "pg_dumpall", "pg_restore", "pg_basebackup", "pgbench",
           "createdb", "dropdb", "createuser", "dropuser", "clusterdb", "reindexdb", "vacuumdb"}
SHELLS = {"bash", "sh", "zsh", "dash", "ksh", "ash"}
# Enveloppes : elles lancent la commande qui suit.
WRAP = {"sudo", "doas", "env", "command", "builtin", "exec", "nohup", "nice", "ionice", "timeout",
        "stdbuf", "setsid", "xargs", "strace", "chrt", "taskset", "busybox", "flock", "chroot",
        "dotenv", "dotenvx", "dotenv-cli"}
NPX = {"npx", "pnpx", "bunx"}
PKG = {"npm", "pnpm", "yarn", "bun"}
NPXVAL = {"-p", "--package", "-c", "--call", "-w", "--workspace", "--filter", "-F", "-C", "--dir", "--prefix"}
DOCKER = {"docker", "podman", "docker-compose", "podman-compose", "nerdctl"}
# Lecteurs dont chaque argument est un fichier ; puis lecteurs à motif et copieurs, avec leurs
# options à valeur.
WHOLE = {"cat", "tac", "nl", "less", "more", "most", "head", "tail", "bat", "batcat", "strings", "xxd",
         "od", "hexdump", "base64", "base32", "rev", "fold", "fmt", "pr", "column", "paste", "cut",
         "sort", "uniq", "diff", "cmp", "comm", "sdiff", "source", ".", "tar", "zip", "gzip", "zcat",
         "iconv", "expand", "split", "shuf", "join"}
GREP = ("efmABCdD", {"--regexp", "--file", "--max-count", "--after-context", "--before-context",
                     "--context", "--include", "--exclude", "--exclude-dir", "--exclude-from",
                     "--label", "--binary-files", "--devices", "--directories"}, {"-e", "-f", "--regexp", "--file"})
RG = ("efmABCgtTjMrEd", {"--regexp", "--file", "--glob", "--iglob", "--type", "--type-not", "--type-add",
                         "--type-clear", "--threads", "--max-columns", "--replace", "--encoding",
                         "--max-depth", "--max-count", "--max-filesize", "--after-context",
                         "--before-context", "--context", "--sort", "--sortr", "--pre", "--pre-glob",
                         "--ignore-file", "--colors", "--engine", "--path-separator",
                         "--context-separator", "--field-match-separator", "--field-context-separator"},
      {"-e", "-f", "--regexp", "--file"})
SED = ("efl", {"--expression", "--file", "--line-length"}, {"-e", "-f", "--expression", "--file"})
AWK = ("Fvf", {"--field-separator", "--assign", "--file"}, {"-f", "--file"})
PATTERN = {"grep": GREP, "egrep": GREP, "fgrep": GREP, "rg": RG, "ag": RG, "ack": RG, "sed": SED,
           "awk": AWK, "gawk": AWK, "mawk": AWK, "nawk": AWK, "perl": ("eEIMmF", set(), {"-e", "-E"})}
GLOBOPT = {"--include", "-g", "--glob", "--iglob"}
CPLV = {"--target-directory", "--suffix"}
RSLV = {"--rsh", "--exclude", "--exclude-from", "--include", "--include-from", "--files-from",
        "--backup-dir", "--suffix", "--chmod", "--chown", "--rsync-path", "--partial-dir", "--temp-dir",
        "--compare-dest", "--copy-dest", "--link-dest", "--log-file", "--password-file", "--port",
        "--bwlimit", "--max-size", "--min-size", "--timeout", "--filter"}
COPY = {"cp": ("tS", CPLV), "mv": ("tS", CPLV), "ln": ("tS", CPLV),
        "install": ("tSmog", CPLV | {"--mode", "--owner", "--group"}),
        "rsync": ("efTB", RSLV), "scp": ("PioFcSlJ", set())}
EXCL = {"-x", "-X", "--exclude", "--exclude-from", "--exclude-dir", "--ignore", "--ignore-file"}
# Ne rendent que taille ou empreinte : une redirection d'entrée vers eux n'est pas une lecture.
META = {"wc", "sha256sum", "sha1sum", "sha512sum", "md5sum", "cksum", "b2sum"}
READERS = WHOLE | set(PATTERN) | set(COPY) | {"dd", "git", "curl"}
TARGETS = CLIENTS | READERS | SHELLS | {"supabase"}
KNOWN = TARGETS | WRAP | NPX | PKG | DOCKER | {"find", "eval"}
# CLI supabase : options à valeur, sous-commandes qui visent le projet hébergé par défaut
# (lu dans les sources de la CLI, v2.122.1 et v3.4.0).
SUPA_SV = "sopjftx"
SUPA_LV = {"--workdir", "--output", "--profile", "--network-id", "--dns-resolver", "--db-url", "--schema",
           "--file", "--password", "--project-ref", "--project-id", "--stack", "--from", "--to", "--level",
           "--fail-on", "--type", "--agent", "--output-format", "--env-file", "--template", "--version",
           "--name", "--lang"}
SUPA_PAIRS = {("db", "push"), ("db", "pull"), ("db", "dump"), ("db", "remote"), ("migration", "list"),
              ("migration", "repair"), ("migration", "fetch"), ("gen", "types")}
SUPA_HOSTED = {"link", "pull", "backups", "postgres-config", "branches"}
FALSY = {"false", "no", "off", "0", "n"}
LABEL = {"<": "redirection", ".": "source"}


# Charge le lexer du Guard 6 par son chemin (python3 -B : aucun bytecode écrit).
def load(path):
    spec = importlib.util.spec_from_file_location("ptc", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def base(w):
    return w.rsplit("/", 1)[-1]


# Vrai si le mot nomme un fichier .env ou .env.<suffixe>, modèles (.example, .template) exclus ;
# une référence fichier:ligne est ramenée au fichier.
def guarded(w):
    w = LINEREF.sub("", w)
    return bool(ENVFILE.search(w)) and not TEMPLATE.search(w)


# Une commande simple : ses mots (w), les mots de ses substitutions (sub), ses redirections (red),
# ses here-documents et here-strings (here), la commande en amont du tube (up).
class Cmd:
    def __init__(self, up=None):
        self.w, self.sub, self.red, self.here, self.up = [], [], [], [], up

    def empty(self):
        return not (self.w or self.sub or self.red or self.here)


# Ce que l'analyse accumule : commandes, valeurs des variables affectées dans le texte, constats.
class State:
    def __init__(self):
        self.cmds, self.vars, self.hits, self.clients, self.supa, self.unparsable = [], {}, [], [], [], None


# Découpe la suite du lexer en commandes simples. Une substitution $( ), <( ) ou entre accents
# graves rend ses mots à la commande qui la porte (sub) ; « | » relie une commande à son amont.
def simple(toks):
    out, stack, cur, prev = [], [], Cmd(), ("op", ";")
    i, n = 0, len(toks)
    while i < n:
        kind, t = toks[i]
        if kind == "w":
            cur.w.append(t)
        elif kind == "body":
            cur.here.append(t)
        elif kind == "redir":
            if i + 1 < n and toks[i + 1][0] == "w":
                i += 1
                cur.red.append((t, toks[i][1]))
                if t == "<<<":
                    cur.here.append(toks[i][1])
                kind = "target"
        elif t == "(":
            last = cur.w[-1] if prev[0] == "w" and cur.w else ""
            if prev[0] == "redir" or last.endswith("$") or ARRAY.fullmatch(last):
                stack.append(("sub", cur, len(out)))
            else:
                if not cur.empty():
                    out.append(cur)
                stack.append(("par", None, len(out)))
            cur = Cmd()
        elif t == ")" or (t == BT and stack and stack[-1][0] == "bt"):
            if not cur.empty():
                out.append(cur)
            cur = Cmd()
            if stack and (t == BT or stack[-1][0] != "bt"):
                saved, mark = stack.pop()[1:]
                if saved is not None:
                    cur = saved
                    cur.sub += [w for c in out[mark:] for w in c.w + c.sub]
        elif t == BT:
            stack.append(("bt", cur, len(out)))
            cur = Cmd()
        elif t == "|":
            if prev == ("op", "|"):
                cur.up = None
            elif not cur.empty():
                out.append(cur)
                cur = Cmd(cur)
        elif not (t == "&" and prev == ("op", "|")) and not cur.empty():
            out.append(cur)
            cur = Cmd()
        prev = (kind, t)
        i += 1
    if not cur.empty():
        out.append(cur)
    for frame in stack:
        if frame[1] is not None and not frame[1].empty():
            out.append(frame[1])
    return out


# Ajoute des valeurs possibles à une variable (64 au plus).
def add(vars, name, vals):
    known = vars.setdefault(name, [])
    for v in vals:
        if v not in known and len(known) < 64:
            known.append(v)


# Relève les affectations (NOM=valeur, NOM=$( ), for NOM in …) : valeurs possibles de NOM.
def taint(c, vars):
    ws, i = c.w, 0
    while i < len(ws) and ws[i] in RESERVED:
        i += 1
    if len(ws) - i >= 3 and ws[i] == "for" and ws[i + 2] == "in":
        add(vars, ws[i + 1], ws[i + 3:] + c.sub)
    for w in ws:
        m = ASSIGN.fullmatch(w)
        if m:
            val = m.group(2)
            vals = [val] if val else []
            if (not val or val.endswith("$")) and c.sub:
                vals += c.sub + [" ".join(c.sub)]
            add(vars, m.group(1), vals)


# Formes possibles d'un mot une fois ses variables remplacées par leurs valeurs connues
# (valeur par défaut ${NOM:-x} comprise ; ${NOM%motif} n'est pas évalué).
def variants(w, vars):
    seen, front = {w}, [w]
    for _ in range(3):
        nxt = []
        for s in front:
            for m in REF.finditer(s):
                vals = list(vars.get(m.group(1) or m.group(2), []))
                d = DEFAULT.match(m.group(3) or "")
                if d:
                    vals.append(d.group(1))
                for v in vals:
                    t = s[:m.start()] + v + s[m.end():]
                    if t not in seen and len(seen) < 200:
                        seen.add(t)
                        nxt.append(t)
        front = nxt
    return seen


# Les mots et toutes les valeurs de variables qu'ils citent, de proche en proche.
def reach(words, vars):
    seen, front = set(words), list(words)
    for _ in range(4):
        nxt = []
        for s in front:
            for m in REF.finditer(s):
                for v in vars.get(m.group(1) or m.group(2), []):
                    if v not in seen:
                        seen.add(v)
                        nxt.append(v)
        front = nxt
    return seen


# Vrai si un mot ou une valeur atteinte porte une cible Supabase.
def signal(words, vars):
    return any(HOST.search(s) or POOLER.search(s) or CONNVAR.search(s) for s in reach(words, vars))


# Les mots d'un texte (valeur d'une variable qui tient une commande).
def lexwords(text):
    try:
        toks = ptc.lex(text)
    except ptc.Unparsable as e:
        toks = e.toks
    return [t for k, t in toks if k == "w"]


# Résout le mot de commande : saute mots réservés et affectations, traverse les enveloppes
# (sudo, env, timeout, xargs…), npx et les gestionnaires de paquets, docker exec et run, find -exec,
# et une variable qui tient la commande. Rend des quadruplets (nom, arguments, lancé par un find
# qui cherche un .env, alimenté par xargs).
def resolve(words, vars, depth=0, found=False, piped=False):
    i, n = 0, len(words)
    while i < n:
        if words[i] == "function":
            i += 2
        elif words[i] in RESERVED or ASSIGN.fullmatch(words[i]):
            i += 1
        else:
            break
    if i >= n or words[i] in NOCMD:
        return []
    head, args = words[i], words[i + 1:]
    m = REF.fullmatch(head)
    if m:
        out = []
        if depth < 3:
            for v in vars.get(m.group(1) or m.group(2), [])[:8]:
                out += resolve(lexwords(v) + args, vars, depth + 1, found, piped)
        return out
    name = base(head)
    if name in WRAP:
        j = 0
        while j < len(args):
            a = args[j]
            if a == "--":
                j += 1
                break
            if ASSIGN.fullmatch(a) or NUM.fullmatch(a) or (a == "run" and name.startswith("dotenv")):
                j += 1
            elif a.startswith("-") and len(a) > 1:
                j += 1
                if "=" not in a and j < len(args) and not args[j].startswith("-") and base(args[j]) not in KNOWN:
                    j += 1
            else:
                break
        if name in ("flock", "chroot") and j < len(args) and base(args[j]) not in KNOWN:
            j += 1
        return resolve(args[j:], vars, depth, found, piped or name == "xargs")
    if name in NPX or name in PKG:
        j, direct, call = 0, name in NPX, None
        while j < len(args):
            a = args[j]
            if a == "--":
                j += 1
                break
            if a in ("exec", "x", "dlx") and name in PKG and not direct:
                direct = True
                j += 1
            elif a.startswith("-") and len(a) > 1:
                if a in ("-c", "--call") and j + 1 < len(args):
                    call = args[j + 1]
                j += 2 if a in NPXVAL else 1
            else:
                break
        if call is not None:
            return [("eval", [call], found, piped)]
        if j >= len(args) or (name == "npm" and not direct):
            return []
        tool = base(args[j]).split("@")[0]
        if direct or tool == "supabase" or tool in CLIENTS:
            return resolve([tool] + args[j + 1:], vars, depth, found, piped)
        return []
    if name in DOCKER:
        for k, a in enumerate(args):
            if a in ("exec", "run"):
                for q in range(k + 1, len(args)):
                    if base(args[q]) in TARGETS and args[q] != ".":
                        return resolve([base(args[q])] + args[q + 1:], vars, depth, found, piped)
                break
        return []
    if name == "find":
        spans, own, k = [], [], 0
        while k < len(args):
            if args[k] in ("-exec", "-execdir", "-ok", "-okdir"):
                q = k + 1
                while q < len(args) and args[q] != ";" and not (args[q] == "+" and args[q - 1] == "{}"):
                    q += 1
                spans.append(args[k + 1:q])
                k = q + 1
            else:
                own.append(args[k])
                k += 1
        hit = found or any(guarded(v) for a in own for v in variants(a, vars))
        out = []
        for s in spans:
            out += resolve(s, vars, depth, hit, piped)
        return out
    return [(name, args, found, piped)]


# Sépare options, arguments et valeurs d'options (sv : lettres des options courtes à valeur ;
# lv : options longues à valeur).
def split(args, sv, lv):
    names, pos, vals, j, n = set(), [], [], 0, len(args)
    while j < n:
        t = args[j]
        if t == "--":
            pos += args[j + 1:]
            break
        if t.startswith("--"):
            key, eq, val = t.partition("=")
            names.add(key)
            if eq:
                vals.append((key, val))
            elif key in lv and j + 1 < n:
                j += 1
                vals.append((key, args[j]))
        elif t.startswith("-") and len(t) > 1:
            for k in range(1, len(t)):
                key = "-" + t[k]
                names.add(key)
                if t[k] in sv:
                    if k + 1 < len(t):
                        vals.append((key, t[k + 1:]))
                    elif j + 1 < n:
                        j += 1
                        vals.append((key, args[j]))
                    break
        else:
            pos.append(t)
        j += 1
    return names, pos, vals


# Les arguments qu'une commande de lecture ouvre comme fichiers : ni le motif de grep, sed ou awk,
# ni la destination de cp ou mv, ni les valeurs d'options.
def read_files(name, args):
    if name in PATTERN:
        sv, lv, pat = PATTERN[name]
        names, pos, vals = split(args, sv, lv)
        if (name == "rg" and "--files" in names) or (name == "perl" and not names & pat):
            return []
        files = pos if names & pat else pos[1:]
        return files + [v for k, v in vals if k in GLOBOPT and not v.startswith("!")]
    if name in COPY:
        names, pos, vals = split(args, COPY[name][0], COPY[name][1])
        if names & {"-t", "--target-directory"} or len(pos) < 2:
            return pos
        return pos[:-1]
    if name == "dd":
        return [a[3:] for a in args if a.startswith("if=")]
    if name == "git":
        if "--no-index" in args or "--untracked" in args:
            return [a for a in args if not a.startswith("-")]
        return []
    if name == "curl":
        out = [a.rsplit("@", 1)[1] for a in args if "@" in a]
        return out + [args[k + 1] for k in range(len(args) - 1) if args[k] in ("-T", "--upload-file", "-K", "--config")]
    out, skip = [], False
    for a in args:
        if skip:
            skip = False
        elif a in EXCL:
            skip = True
        elif not (a.startswith("-") and len(a) > 1):
            out.append(a)
    return out


# Fin d'une substitution $( ) dans un mot, here-document compris.
def span_end(w, i):
    depth, j, n = 0, i, len(w)
    while j < n:
        ch = w[j]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return j
        elif ch == "<" and w.startswith("<<<", j):
            j += 2
        elif ch == "<" and w.startswith("<<", j):
            m = HEREDOC.match(w, j)
            eol = w.find("\n", m.end()) if m else -1
            if eol >= 0:
                end = re.compile(r"^\t*" + re.escape(m.group(1)) + r"[ \t]*$", re.M).search(w, eol + 1)
                if end:
                    j = end.end()
                    continue
        j += 1
    return n


# Textes des substitutions de commande d'un mot : $( ) et accents graves.
def substitutions(w):
    out, rest, i = [], [], 0
    while True:
        j = w.find("$(", i)
        if j < 0:
            rest.append(w[i:])
            break
        if w.startswith("$((", j):
            rest.append(w[i:j + 3])
            i = j + 3
            continue
        rest.append(w[i:j])
        k = span_end(w, j + 1)
        out.append(w[j + 2:k])
        i = k + 1
    return out + "\n".join(rest).split(BT)[1::2]


# Textes qu'un shell lit comme programme : argument de -c ; sinon here-document, here-string, ou
# sortie d'echo et de printf reçue par un tube.
def shell_texts(args, c, vars):
    pos, k = [], 0
    while k < len(args):
        a = args[k]
        if SHELLC.fullmatch(a):
            return args[k + 1:k + 2]
        if SHELLO.fullmatch(a) or a in ("--rcfile", "--init-file"):
            k += 1
        elif not (a[:1] in ("-", "+") and len(a) > 1):
            pos.append(a)
        k += 1
    if pos and "-s" not in args:
        return []
    texts, u, hops = list(c.here), c.up, 0
    while u is not None and hops < 20:
        texts += u.here
        for name, uargs, _f, _p in resolve(u.w, vars):
            if name in ("echo", "printf"):
                texts.append(" ".join(uargs))
        u, hops = u.up, hops + 1
    return texts


# Vrai si une commande en amont du tube nomme un fichier .env (ls … | xargs cat).
def upstream(c, vars):
    u, hops = c.up, 0
    while u is not None and hops < 20:
        if any(guarded(v) for w in u.w for v in variants(w, vars)):
            return True
        u, hops = u.up, hops + 1
    return False


# Vrai si une commande de la CLI supabase atteint le projet hébergé, par option ou par défaut.
def supa_remote(args):
    names, pos, vals = split(args, SUPA_SV, SUPA_LV)

    def val(key):
        return [v for k, v in vals if k == key]

    remote = val("--remote")
    if "--remote" in names and (not remote or any(v.lower() not in FALSY and not LOCAL.search(v) for v in remote)):
        return True
    for key in ("--linked", "--project-ref", "--project-id", "--password"):
        if key in names and not any(v.lower() in FALSY for v in val(key)):
            return True
    if any(v in ("remote", "linked") or PROJECT.fullmatch(v) for k, v in vals if k in ("--from", "--to")):
        return True
    group = pos[0] if pos else ""
    if group in SUPA_HOSTED or ("-p" in names and group in ("db", "migration", "inspect")):
        return True
    if names & {"--local", "--db-url"} or any(LOCAL.search(v) for v in remote):
        return False
    return group == "inspect" or any((pos[k], pos[k + 1]) in SUPA_PAIRS for k in range(len(pos) - 1))


# Lit un texte de commande puis, comme des commandes, les textes que le shell lit (4 niveaux au plus).
def collect(text, depth, S):
    try:
        toks = ptc.lex(text)
    except ptc.Unparsable as e:
        if depth == 0:
            S.unparsable = str(e)
            return
        toks = e.toks
    cmds = simple(toks)
    S.cmds += cmds
    for c in cmds:
        taint(c, S.vars)
    nested = []
    for c in cmds:
        for w in c.w + [t for _op, t in c.red]:
            nested += substitutions(w)
        for name, args, _f, _p in resolve(c.w, S.vars):
            if name in SHELLS:
                nested += shell_texts(args, c, S.vars)
            elif name == "eval":
                nested.append(" ".join(args))
    if depth < 4:
        for t in nested:
            if t.strip() and t != text:
                collect(t, depth + 1, S)


# Constats : client de base vers Supabase (db), lecture d'un fichier .env (env).
def judge(S):
    pg = [k + "=" + v for k, vs in S.vars.items() if k.startswith("PG") for v in vs]
    sb = [k + "=" for k in S.vars if k.startswith("SUPABASE_")]
    for c in S.cmds:
        res = resolve(c.w, S.vars)
        for name, args, found, piped in res:
            if name in CLIENTS:
                S.clients.append((name, c))
                if signal(c.w + c.sub + pg, S.vars) or any(guarded(v) for w in c.w for v in variants(w, S.vars)):
                    S.hits.append(("db", name, c))
            elif name == "supabase":
                S.supa.append((args, c))
                if signal(c.w + c.sub + sb, S.vars) or supa_remote(args):
                    S.hits.append(("db", name, c))
            elif name in READERS:
                files = read_files(name, args)
                if (any(guarded(v) for f in files for v in variants(f, S.vars))
                        or (found and "{}" in args) or (piped and upstream(c, S.vars))):
                    S.hits.append(("env", name, c))
            elif name in SHELLS and found:
                S.hits.append(("env", "find", c))
        names = {r[0] for r in res}
        if names and names <= META:
            continue
        for op, target in c.red:
            if op.startswith("<") and op != "<<<" and not op.startswith("<&"):
                if any(guarded(v) for v in variants(target, S.vars)):
                    S.hits.append(("env", "<", c))


# Constats d'une commande, ou « unparsable » si le lexer ne peut pas la lire.
def verdict(text):
    S = State()
    collect(text, 0, S)
    if S.unparsable:
        return {"unparsable"}, S
    judge(S)
    return {k + ":" + LABEL.get(n, n) for k, n, _c in S.hits}, S


if __name__ == "__main__":
    ptc = load(sys.argv[1])
    print(" ".join(sorted(verdict(sys.stdin.buffer.read().decode("utf-8", "replace"))[0])))
GUARD8_PY
}
# Préfiltre : un nom de client (même liste que CLIENTS dans le programme) ou un fichier .env.
if grep -qE '(^|[^A-Za-z0-9_.-])(psql|pgcli|pg_dump|pg_dumpall|pg_restore|pg_basebackup|pgbench|createdb|dropdb|createuser|dropuser|clusterdb|reindexdb|vacuumdb|supabase)($|[^A-Za-z0-9_./-])' <<<"$COMMAND" \
   || grep -qE '(^|[^]A-Za-z0-9_)}])\.env($|[^A-Za-z0-9_])' <<<"$COMMAND"; then
  if ! command -v python3 &>/dev/null; then
    echo "BLOCKED: python3 requis pour le Guard 8 (client de base, fichier .env). Garde en echec ferme." >&2
    exit 2
  fi
  if ! GUARD8=$(guard8_scan <<<"$COMMAND"); then
    echo "BLOCKED: analyseur du Guard 8 en erreur (programme de scripts/claude-hooks/pretool-bash-guard.sh, lexer prod-trigger-check.py). Garde en echec ferme." >&2
    exit 2
  fi
  case " $GUARD8 " in
    *" unparsable "*)
      echo "BLOCKED: commande illisible (guillemet ou here-document non fermes) qui cite un client de base ou un fichier .env : le Guard 8 ne peut pas la verifier. Ecrire le texte dans un fichier." >&2
      exit 2 ;;
    *" db:"*)
      echo "BLOCKED: commande vers la base Supabase par psql, un autre client PostgreSQL ou la CLI supabase ($GUARD8). Decision de Marwane du 27 nov. 2026 : cette voie est fermee aux sessions. Voies permises : lecture par execute_sql (SELECT, EXPLAIN) sous la garde pretool-supabase-guard.sh ; schema, index, RLS, fonction : fichier de migration en PR, essaye sur une base d'essai locale, applique par le workflow Apply Supabase migrations (manual) sur le oui de Marwane ; correction ponctuelle : Marwane, par l'admin ou l'editeur SQL de Supabase. Les bases d'essai locales restent permises (localhost, 127.0.0.1, socket Unix, docker exec <conteneur> psql). Si la commande ne fait que citer ces mots, ecrire le texte dans un fichier." >&2
      exit 2 ;;
    *" env:"*)
      echo "BLOCKED: lecture d'un fichier .env par le shell ($GUARD8). Les noms de variables se lisent dans backend/.env.example ; pour une valeur, demander a Marwane. Passent : ls, stat, test, wc, sha256sum et les chargeurs (--env-file, dotenv). Ne pas contourner par un autre outil de lecture, un script ou un interpreteur. Si la commande ne fait que citer ce nom, ecrire le texte dans un fichier." >&2
      exit 2 ;;
  esac
fi

exit 0
