#!/usr/bin/env bash
#
# prune-merged-worktrees.sh — nettoyage sûr des worktrees & branches locales obsolètes
#
# Retire les git worktrees dont la PR est MERGED/CLOSED et dont l'arbre de travail
# est propre, puis supprime les branches locales correspondantes. L'état est
# re-dérivé EN DIRECT à chaque exécution (GitHub PR state + git status) — jamais
# de liste figée. Ne détruit JAMAIS de travail non-mergé, non-commité, OPEN ou
# sans PR. Écrit un manifeste de récupération (SHAs) avant toute suppression.
# Retire enfin, dans les worktrees gérés restants, les caches d'outils marqués
# CACHEDIR.TAG et inactifs (passe 3) : jamais le worktree, jamais un fichier suivi.
# Retire aussi les node_modules autonomes (racine, dossiers de 1er niveau, packages/*) des worktrees
# gérés qui n'ont pas servi depuis IDLE_NM_DAYS jours (passe 4) : le reste du worktree reste.
#
# Périmètre : seuls les worktrees des sessions Claude ($PRUNE_ROOTS, mêmes préfixes que
# dedup-worktree-node-modules.sh) sont candidats, y compris ceux créés dans le scratchpad d'une
# session (${TMPDIR:-/tmp}/claude-<uid>/<projet>/<session>/scratchpad/). Les autres gestionnaires (pont Hermes,
# worktrees Codex directs) gardent leur propre cycle de vie — ce script ne les retire jamais.
#
# Usage:
#   prune-merged-worktrees.sh            # dry-run (par défaut) : n'écrit RIEN dans le dépôt
#   prune-merged-worktrees.sh --apply    # exécute les suppressions
#
# Env (optionnel):
#   REPO            slug GitHub (défaut: ak125/nestjs-remix-monorepo)
#   LOG_DIR         dossier des manifestes (défaut: /tmp)
#   RECENT_MIN      minutes sous lesquelles un worktree récent est épargné (défaut: 180)
#   PRUNE_ROOTS     préfixes de chemin des worktrees gérés, séparés par « : »
#                   (défaut: <dépôt>/.claude/worktrees/:$HOME/worktrees/claude-:${TMPDIR:-/tmp}/claude-<uid>/)
#   CACHE_IDLE_MIN  minutes sans écriture exigées avant de retirer un cache (défaut: 1440)
#   IDLE_NM_DAYS    jours sans usage (index git, node_modules/.package-lock.json) exigés avant de
#                   retirer les node_modules d'un worktree (défaut: 7 ; entier ≥ 1)
#   PR_LIMIT        nombre maximal de PR lues (défaut: 5000) ; plafond atteint = avertissement
#   CRON_REPORT_MAX_AGE_S  silence au-delà duquel le hook SessionStart signale le cron arrêté
#                   (défaut: 93600 = passage quotidien + 2 h de marge)
#
# Observabilité : chaque exécution --apply enregistre son issue via cron_report
# (scripts/cron/lib-supabase-report.sh), lue par le hook SessionStart : error si le script
# s'arrête (état des PR illisible, outil absent, réglage invalide, arrêt imprévu) ; warn si une
# suppression a été refusée (FAIL, CACHE-FAIL, NM-FAIL), si le fetch a échoué ou si le plafond
# PR_LIMIT est atteint ; ok sinon. Un essai à blanc n'enregistre
# rien : lancé à la main, il masquerait l'état du cron. Avant, l'issue n'allait que dans
# /tmp/prune-merged-worktrees.log, sans lecteur (MAILTO sans MTA).
#
# Dépendances: git, gh (authentifié), jq.
set -euo pipefail
# Un GIT_DIR / GIT_WORK_TREE hérité ferait agir chaque commande sur un autre dépôt.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

LOG_TAG=prune-merged-worktrees
START="$(date +%s)"
CRON_REPORT_MAX_AGE_S="${CRON_REPORT_MAX_AGE_S:-93600}"
# shellcheck source=lib-supabase-report.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-supabase-report.sh" 2>/dev/null || true
LOG=""
PRSTATE=""
FAILURE=""
count_log() { # count_log <regex> -> nombre de lignes du manifeste qui correspondent
  if [[ -n "$LOG" && -f "$LOG" ]]; then grep -cE "$1" "$LOG" || true; else echo 0; fi
}
report_outcome() {
  local rc=$? status=ok summary removed branches caches cache_mb nms nm_mb fails fetch_warn pr_cap metrics
  if [[ -n "$PRSTATE" ]]; then rm -f "$PRSTATE"; fi
  [[ $APPLY -eq 1 ]] || return 0
  removed="$(count_log '^REMOVED ')"
  branches="$(count_log '^BRANCH-DEL ')"
  caches="$(count_log '^CACHE-REMOVED ')"
  nms="$(count_log '^NM-REMOVED ')"
  cache_mb=0; nm_mb=0
  if [[ -n "$LOG" && -f "$LOG" ]]; then
    cache_mb="$(awk '$1 == "CACHE-REMOVED" { s += $2 } END { print s + 0 }' "$LOG")"
    nm_mb="$(awk '$1 == "NM-REMOVED" { s += $2 } END { print s + 0 }' "$LOG")"
  fi
  fails="$(count_log '^(FAIL|CACHE-FAIL|NM-FAIL) ')"
  fetch_warn="$(count_log '^WARN +fetch ')"
  pr_cap="$(count_log '^WARN +gh pr list ')"
  summary="worktrees retirés=$removed  branches supprimées=$branches  caches retirés=$caches (${cache_mb} Mo)  node_modules retirés=$nms (${nm_mb} Mo)"
  if [[ "$rc" -ne 0 ]]; then
    status=error
    summary="arrêt en erreur (code $rc)${FAILURE:+ : $FAILURE} — $summary"
  elif [[ "$fails" -gt 0 || "$fetch_warn" -gt 0 || "$pr_cap" -gt 0 ]]; then
    status=warn
    summary="$fails suppression(s) refusée(s), fetch en échec=$fetch_warn, plafond PR atteint=$pr_cap — $summary — voir ${LOG:-le journal}"
  fi
  metrics="$(printf '{"worktrees_removed":%d,"branches_deleted":%d,"caches_removed":%d,"cache_mb":%d,"node_modules_removed":%d,"node_modules_mb":%d,"fails":%d,"fetch_failed":%d,"pr_limit_reached":%d}' \
    "$removed" "$branches" "$caches" "$cache_mb" "$nms" "$nm_mb" "$fails" "$fetch_warn" "$pr_cap")"
  if command -v cron_report >/dev/null 2>&1; then
    cron_report "$LOG_TAG" "$status" "$(( $(date +%s) - START ))" "$metrics" "$summary"
  else
    echo "WARN    cron_report indisponible (lib-supabase-report.sh non chargée) — issue du run NON enregistrée" >&2
  fi
}
trap report_outcome EXIT

REPO="${REPO:-ak125/nestjs-remix-monorepo}"
LOG_DIR="${LOG_DIR:-/tmp}"
RECENT_MIN="${RECENT_MIN:-180}"
CACHE_IDLE_MIN="${CACHE_IDLE_MIN:-1440}"
IDLE_NM_DAYS="${IDLE_NM_DAYS:-7}"
# untracked jetables : ne bloquent pas la suppression d'un worktree par ailleurs propre
ALLOW='^(\.playwright-mcp|node_modules|\.turbo|dist|build|coverage)(/|$)'
# ignorés régénérables : `git worktree remove` supprime les fichiers ignorés sans --force et
# sans les signaler ; tout autre ignoré (.env, scripts locaux, rapports, réglages locaux)
# conserve le worktree. Liste = sorties de build, caches d'outils, `.husky/_/` (hooks
# générés), `audit/cache/` (« regenerated via npm run audit:inventory », .gitignore) et
# `.claude/.session-log-state/` (marqueurs des hooks Stop, propres au worktree).
# Un dossier propre à un outil est jetable à toute profondeur (`.pytest_cache/` s'ignore
# lui-même par un `.gitignore` interne, donc git liste ses entrées une à une). Un nom
# générique (`dist`, `build`, `coverage`) n'est accepté que pour l'entrée elle-même
# (`pkg/dist/`) : `tools/build/.env`, ignoré dans un dossier source suivi, reste non régénérable.
ALLOW_IGNORED='(^|/)(node_modules|\.turbo|\.nyc_output|__pycache__|\.pytest_cache|\.ruff_cache|\.hypothesis|\.react-router)(/|$)|(^|/)(dist|build|coverage)/?$|(^|/)\.eslintcache$|\.tsbuildinfo$|^\.husky/_/|^audit/cache/|^\.claude/\.session-log-state/'
MAIN_REF=refs/remotes/origin/main

for bin in git gh jq; do
  command -v "$bin" >/dev/null 2>&1 || { FAILURE="'$bin' requis mais absent"; echo "FATAL: $FAILURE" >&2; exit 2; }
done
# Réglage lu avant toute action : 0 ou une valeur non numérique retirerait tout node_modules.
if ! [[ "$IDLE_NM_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  FAILURE="IDLE_NM_DAYS invalide (entier ≥ 1 attendu) — rien n'est fait"; echo "FATAL: $FAILURE" >&2; exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
IFS=: read -r -a ROOTS <<<"${PRUNE_ROOTS:-$REPO_ROOT/.claude/worktrees/:$HOME/worktrees/claude-:${TMPDIR:-/tmp}/claude-$(id -u)/}"
# Une entrée vide couvrirait tous les chemins : elle est ignorée.
managed() { local r; for r in "${ROOTS[@]}"; do [[ -n "$r" && "$1" == "$r"* ]] && return 0; done; return 1; }

TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/worktree-cleanup-$TS.log"
PRSTATE="$(mktemp)"

mode_label="DRY-RUN (aucune suppression — utiliser --apply pour agir)"
[[ $APPLY -eq 1 ]] && mode_label="APPLY"
echo "=== prune-merged-worktrees — $mode_label — $TS ===" | tee "$LOG"
echo "INFO    périmètre : ${ROOTS[*]}" | tee -a "$LOG"

# --- Manifeste de récupération (SHAs) AVANT toute action ---
{
  echo "# Recovery manifest $TS — repo=$REPO mode=$mode_label"
  echo "## git worktree list"; git worktree list
  echo "## git branch -vv"; git branch -vv
} >> "$LOG"

# --- Registrations de worktrees dont le dossier a disparu ---
# Listées, jamais élaguées (voir fin de passe 1). Le dry-run ne touche pas non plus aux refs distantes.
git worktree prune --dry-run --verbose 2>&1 | sed 's/^/KEEP-REG (conservée ; sortie de prune --dry-run) /' | tee -a "$LOG"
if [[ $APPLY -eq 1 ]]; then
  git fetch --prune origin --quiet \
    || echo "WARN    fetch échoué — origin/main local potentiellement périmé (décisions plus conservatrices)" | tee -a "$LOG"
else
  echo "INFO    dry-run : pas de fetch — origin/main local = $(git rev-parse --short "$MAIN_REF" 2>/dev/null || echo '?')" | tee -a "$LOG"
fi

# --- État PR batché : 1 seul appel ; sans état PR lisible, rien n'est supprimé ---
# Plafond au-dessus du nombre total de PR du dépôt (1969 le 2026-11-17) : avec 1000, les PR
# les plus anciennes sortaient de la fenêtre et leurs branches passaient « sans PR ».
PR_LIMIT="${PR_LIMIT:-5000}"
if ! gh pr list --repo "$REPO" --state all --json number,state,headRefName,headRefOid --limit "$PR_LIMIT" > "$PRSTATE" \
   || ! jq -e 'type == "array"' "$PRSTATE" >/dev/null 2>&1; then
  FAILURE="état des PR illisible (gh pr list) — aucune suppression"
  echo "FATAL   $FAILURE" | tee -a "$LOG" >&2
  exit 1
fi
if [[ "$(jq 'length' "$PRSTATE")" -ge "$PR_LIMIT" ]]; then
  echo "WARN    gh pr list : plafond de $PR_LIMIT PR atteint — les PR plus anciennes sont lues comme « sans PR » (conservées)" | tee -a "$LOG"
fi

pr_info() { # $1=branch -> "STATE<TAB>headRefOid" (la PR la plus récente gagne ; NO-PR sinon)
  jq -r --arg b "$1" '[.[]|select(.headRefName==$b)]|sort_by(.number)|last
    | if . == null then "NO-PR\t" else "\(.state)\t\(.headRefOid // "")" end' "$PRSTATE"
}

# Le travail au bout de la branche est-il conservé ailleurs ?
#   MERGED : la pointe est la tête de la PR (squash compris), un ancêtre de cette tête, ou déjà
#            dans origin/main. Ancêtre : la PR a reçu ensuite des commits poussés d'ailleurs (fusion
#            de main et projections par resync-pr.sh) ; GitHub garde la tête fusionnée (refs/pull/N/head).
#   CLOSED : seulement si déjà dans origin/main (une PR fermée non fusionnée n'a rien conservé).
# Un commit ajouté APRÈS la tête de la PR (ex. entrée log auto) n'est conservé nulle part.
tip_published() { # $1=state $2=sha $3=headRefOid
  git merge-base --is-ancestor "$2" "$MAIN_REF" 2>/dev/null && return 0
  [[ "$1" == "MERGED" && -n "$3" ]] || return 1
  # Tête absente localement : ascendance invérifiable, donc non publiée.
  [[ "$2" == "$3" ]] || git merge-base --is-ancestor "$2" "$3" 2>/dev/null
}

extra_commits() { # $1=sha $2=headRefOid -> nombre de commits au-delà de la tête de PR, ou '?'
  if [[ -n "$2" ]] && git cat-file -e "$2^{commit}" 2>/dev/null; then
    git rev-list --count "$2..$1" 2>/dev/null || echo '?'
  else
    echo '?'
  fi
}

# Un processus (lisible par cet utilisateur) dont le répertoire courant est dans le worktree
# = session active. Les processus d'autres utilisateurs ne sont pas visibles : limite connue.
in_use_pid() { # $1=path -> PID sur stdout si occupé
  local cwd pid real
  real="$(realpath -e "$1" 2>/dev/null || echo "$1")"
  for pid in /proc/[0-9]*; do
    cwd="$(readlink "$pid/cwd" 2>/dev/null)" || continue
    if [[ "$cwd" == "$real" || "$cwd" == "$real"/* ]]; then echo "${pid#/proc/}"; return 0; fi
  done
  return 1
}

# Passe 4 : répertoire courant, fichier ouvert, exécutable ou bibliothèque chargée dans le worktree
# (même contrôle que dedup-worktree-node-modules.sh). On lit la SORTIE, jamais le code retour : sous
# pipefail, le awk qui s'arrête au premier résultat coupe find/cat (SIGPIPE) et find sort en 1 sur
# les processus illisibles d'autres utilisateurs. Chemin illisible = occupé.
busy() { # $1=path
  local rp hit
  rp="$(realpath -e -- "$1" 2>/dev/null)" || return 0
  hit="$( { find /proc/[0-9]*/exe /proc/[0-9]*/cwd /proc/[0-9]*/fd/ -maxdepth 1 -printf '%l\n' 2>/dev/null
            cat /proc/[0-9]*/maps 2>/dev/null | awk 'NF>=6{print $6}'; } \
          | awk -v p="$rp" '$0==p || index($0, p"/")==1 {print "x"; exit}' || true)"
  [[ -n "$hit" ]]
}

# Dossiers node_modules réels : racine, workspaces de premier niveau, packages/* ; jamais un lien.
nm_dirs() { # $1=path
  local p
  for p in "$1/node_modules" "$1"/*/node_modules "$1"/packages/*/node_modules; do
    [[ -d "$p" && ! -L "$p" ]] && printf '%s\n' "$p"
  done
  return 0
}

# Activité récente : dossier racine, index et reflog HEAD du worktree (un commit ou un
# `git add` récents ne modifient pas la date du dossier racine).
last_activity() { # $1=path -> epoch
  local gd t max=0
  gd="$(git -C "$1" rev-parse --absolute-git-dir 2>/dev/null || true)"
  for t in "$1" ${gd:+"$gd/index" "$gd/logs/HEAD" "$gd/HEAD"}; do
    [[ -e "$t" ]] || continue
    t="$(stat -c %Y "$t")"; (( t > max )) && max=$t
  done
  echo "$max"
}

# Enregistrements `chemin NUL ref NUL détachée NUL verrouillée NUL` : le format -z garde
# intacts les chemins contenant espaces ou tabulations.
list_worktrees() {
  local line p="" b="" d=0 l=0
  while IFS= read -r -d '' line; do
    case "$line" in
      "worktree "*)       p="${line#worktree }"; b=""; d=0; l=0;;
      "branch "*)         b="${line#branch }";;
      detached)           d=1;;
      locked|"locked "*)  l=1;;
      "") [[ -n "$p" ]] && printf '%s\0%s\0%s\0%s\0' "$p" "$b" "$d" "$l"; p="";;
    esac
  done < <(git worktree list --porcelain -z)
}

CUR="$(git symbolic-ref --short HEAD 2>/dev/null || echo '')"
NOW="$(date +%s)"
# Worktrees que la passe 1 retirerait (essai à blanc) : la passe 4 ne les compte pas une 2e fois.
declare -A P1_WOULD=()

# ============================================================
# PASSE 1 — worktrees
# ============================================================
echo "--- Passe 1 : worktrees ---" | tee -a "$LOG"
while IFS= read -r -d '' path && IFS= read -r -d '' ref && IFS= read -r -d '' det && IFS= read -r -d '' locked; do
  [[ "$path" == "$REPO_ROOT" ]] && continue
  managed "$path/" || { echo "KEEP    other-manager    $path" | tee -a "$LOG"; continue; }
  [[ "$det" == "1" || -z "$ref" ]] && { echo "KEEP    detached         $path" | tee -a "$LOG"; continue; }
  br="${ref#refs/heads/}"
  IFS=$'\t' read -r st oid < <(pr_info "$br")
  case "$st" in
    MERGED|CLOSED) ;;
    OPEN)    echo "KEEP    PR-OPEN          $br" | tee -a "$LOG"; continue;;
    NO-PR)   echo "KEEP    no-PR            $br" | tee -a "$LOG"; continue;;
    *)       echo "KEEP    state=$st        $br" | tee -a "$LOG"; continue;;
  esac
  [[ -d "$path" ]] || { echo "KEEP    missing-dir      $br (registration prunable)" | tee -a "$LOG"; continue; }
  # MERGED ou CLOSED — un verrou (attribution de mission, verrou manuel) prime sur tout.
  if [[ "$locked" == "1" ]]; then echo "SKIP    $st+LOCKED        $br" | tee -a "$LOG"; continue; fi
  gd="$(git -C "$path" rev-parse --absolute-git-dir 2>/dev/null || true)"
  # Attribution de mission (scripts/agents/worktree-claim.sh), même si son verrou a manqué.
  if [[ -z "$gd" || -e "$gd/agent-claim.json" ]]; then echo "SKIP    $st+claimed-or-unreadable $br" | tee -a "$LOG"; continue; fi
  if pid="$(in_use_pid "$path")"; then echo "SKIP    $st+in-use(pid=$pid) $br" | tee -a "$LOG"; continue; fi
  # Sous-module peuplé : ses commits locaux et ses ignorés vivent sous ce worktree, et
  # git status ne voit pas un commit hors de la révision enregistrée. Décision humaine.
  if [[ -d "$gd/modules" ]]; then echo "PRESERVE $st+submodules $br" | tee -a "$LOG"; continue; fi
  # Inspecter l'arbre de travail — un statut illisible n'est JAMAIS lu comme « propre ».
  # stderr n'est pas journalisé : il peut nommer des fichiers.
  if ! porc="$(git --no-optional-locks -C "$path" status --porcelain=v1 --untracked-files=normal --ignored=matching --ignore-submodules=none 2>/dev/null)" \
     || ! lsv="$(git --no-optional-locks -C "$path" ls-files -v 2>/dev/null)"; then
    echo "PRESERVE $st+status-error $br" | tee -a "$LOG"; continue
  fi
  # skip-worktree (S) ou assume-unchanged (minuscule) : une modification locale de ces
  # fichiers suivis est invisible à git status et serait supprimée avec le worktree.
  flagged="$(printf '%s\n' "$lsv" | grep -cE '^([a-z]|S) ' || true)"
  if [[ "$flagged" -gt 0 ]]; then echo "PRESERVE $st+index-flags($flagged) $br" | tee -a "$LOG"; continue; fi
  # Toute ligne hors « ?? » / « !! » est un changement suivi (M, T, A, D, R, C, U, dans les deux colonnes).
  tracked="$(printf '%s\n' "$porc" | grep -cvE '^(\?\? |!! |$)' || true)"
  untrk="$(printf '%s\n' "$porc" | grep -c '^?? ' || true)"
  bad_untrk="$(printf '%s\n' "$porc" | grep '^?? ' | sed 's/^?? //' | grep -vcE "$ALLOW" || true)"
  bad_ign="$(printf '%s\n' "$porc" | grep '^!! ' | sed 's/^!! //' | grep -vcE "$ALLOW_IGNORED" || true)"
  if [[ "$tracked" -gt 0 ]]; then echo "PRESERVE $st+tracked($tracked) $br" | tee -a "$LOG"; continue; fi
  mmin=$(( (NOW - $(last_activity "$path")) / 60 ))
  if [[ "$mmin" -lt "$RECENT_MIN" ]]; then echo "SKIP    $st+recent(${mmin}m) $br" | tee -a "$LOG"; continue; fi
  if [[ "$untrk" -gt 0 && "$bad_untrk" -gt 0 ]]; then echo "PRESERVE $st+untrk-nonephem $br" | tee -a "$LOG"; continue; fi
  # Compte seulement : ni nom ni contenu d'un fichier ignoré dans le journal.
  if [[ "$bad_ign" -gt 0 ]]; then echo "PRESERVE $st+ignored-nonregen($bad_ign) $br" | tee -a "$LOG"; continue; fi

  sha="$(git -C "$path" rev-parse HEAD 2>/dev/null || echo '?')"
  # Retirer le worktree ne perd rien de commité (la branche reste), mais on garde worktree
  # et branche ensemble tant que la pointe n'est pas conservée ailleurs (passe 2 idem).
  if ! tip_published "$st" "$sha" "$oid"; then
    why="not-in-main"; [[ "$st" == "MERGED" ]] && why="tip≠PR-head(+$(extra_commits "$sha" "$oid"))"
    echo "PRESERVE $st+$why $br @ $sha" | tee -a "$LOG"; continue
  fi
  # Jamais --force : les untracked jetables (tous dans ALLOW à ce stade) sont retirés un par
  # un, puis git refait lui-même le contrôle de propreté. Une écriture arrivée après le
  # contrôle ci-dessus, ou un sous-module peuplé, fait donc refuser la suppression.
  jet="$(printf '%s\n' "$porc" | sed -n 's/^?? //p' | grep -E "$ALLOW" || true)"
  if [[ $APPLY -eq 1 ]]; then
    while IFS= read -r e; do
      [[ -n "$e" ]] && rm -rf -- "${path:?}/${e%/}"
    done <<<"$jet"
    if git worktree remove "$path" 2>>"$LOG"; then
      echo "REMOVED $st $br @ $sha" | tee -a "$LOG"
    else
      echo "FAIL    $st $br (git a refusé — laissé en place)" | tee -a "$LOG"
    fi
  else
    echo "WOULD-REMOVE $st ${jet:+(+untracked jetables)} $br @ $sha  $path" | tee -a "$LOG"
    P1_WOULD["$path"]=1
  fi
done < <(list_worktrees)

# Pas de `git worktree prune` : il est global au dépôt. `git worktree remove` a déjà retiré
# la registration de chaque worktree supprimé ci-dessus ; une registration « prunable »
# (dossier disparu) peut appartenir à un autre gestionnaire et être la seule référence d'un
# commit détaché. Elle reste signalée (KEEP) et son retrait est une décision humaine.

# ============================================================
# PASSE 2 — branches locales (worktree-less)
# ============================================================
echo "--- Passe 2 : branches locales ---" | tee -a "$LOG"
INWT="$(git worktree list --porcelain | awk '/^branch /{sub("refs/heads/","",$2);print $2}')"
del=0
while read -r br; do
  [[ "$br" == "$CUR" || "$br" == "main" ]] && continue
  printf '%s\n' "$INWT" | grep -qxF "$br" && continue
  IFS=$'\t' read -r st oid < <(pr_info "$br")
  sha="$(git rev-parse "$br")"
  ahead="$(git rev-list --count "$MAIN_REF..refs/heads/$br" 2>/dev/null || echo '?')"
  if [[ "$st" == "MERGED" || "$st" == "CLOSED" ]] && tip_published "$st" "$sha" "$oid"; then
    if [[ $APPLY -eq 1 ]]; then
      git branch -D "$br" >>"$LOG" 2>&1 && { echo "BRANCH-DEL $br ($st) @ $sha" >> "$LOG"; del=$((del+1)); }
    else
      echo "WOULD-DEL-BRANCH $br ($st, ahead=$ahead) @ $sha" | tee -a "$LOG"; del=$((del+1))
    fi
  elif [[ "$st" == "MERGED" ]]; then
    echo "PRESERVE-BRANCH $br (MERGED mais pointe≠tête PR : +$(extra_commits "$sha" "$oid") commit(s) non conservés) @ $sha" | tee -a "$LOG"
  else
    echo "REPORT-KEEP $br (state=$st ahead=$ahead)" >> "$LOG"
  fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads/)

# ============================================================
# PASSE 3 — caches marqués CACHEDIR.TAG dans les worktrees restants
# ============================================================
# Un cache d'outil marqué selon la Cache Directory Tagging Specification (Cargo `target/`,
# `.pytest_cache`, `.ruff_cache`) se régénère à la prochaine exécution de l'outil. Un worktree
# gardé par la passe 1 (PR ouverte, sans PR, récent) peut en porter plusieurs Go. Seul le
# dossier du cache part, si toutes ces conditions tiennent : signature en tête de CACHEDIR.TAG ;
# worktree géré, non verrouillé, sans attribution de mission, sans sous-module peuplé, sans
# processus dont le répertoire courant y est ; aucun fichier du dossier suivi ni non suivi hors
# ignorés ; aucune écriture depuis CACHE_IDLE_MIN minutes ; tout appartient à cet utilisateur.
# node_modules et .git ne sont pas parcourus. Une compilation lancée entre le contrôle et le
# retrait échoue et se relance : c'est la seule perte possible, et elle est régénérable.
echo "--- Passe 3 : caches marqués CACHEDIR.TAG ---" | tee -a "$LOG"
CACHE_SIG='Signature: 8a477f597d28d172789f06886806bc55'
cache_n=0; cache_mb=0
while IFS= read -r -d '' path && IFS= read -r -d '' ref && IFS= read -r -d '' det && IFS= read -r -d '' locked; do
  [[ "$path" == "$REPO_ROOT" || ! -d "$path" ]] && continue
  managed "$path/" || continue
  label="${ref#refs/heads/}"; [[ -n "$label" ]] || label="(HEAD détachée)"
  # Dossiers triés : un parent précède ses descendants, qui partent avec lui.
  caches=()
  while IFS= read -r -d '' d; do
    [[ "$d" != "$path" && -d "$d" && ! -L "$d" ]] || continue
    [[ "$(head -c 43 -- "$d/CACHEDIR.TAG" 2>/dev/null)" == "$CACHE_SIG" ]] || continue
    nested=0; for c in "${caches[@]}"; do [[ "$d" == "$c"/* ]] && nested=1; done
    [[ $nested -eq 0 ]] && caches+=("$d")
  done < <(find "$path" \( -name node_modules -o -name .git \) -prune -o -name CACHEDIR.TAG -type f -print0 2>/dev/null \
             | sed -z 's|/CACHEDIR\.TAG$||' | LC_ALL=C sort -z)
  [[ ${#caches[@]} -gt 0 ]] || continue
  if [[ "$locked" == "1" ]]; then echo "CACHE-KEEP locked(${#caches[@]}) $label  $path" | tee -a "$LOG"; continue; fi
  gd="$(git -C "$path" rev-parse --absolute-git-dir 2>/dev/null || true)"
  if [[ -z "$gd" || -e "$gd/agent-claim.json" ]]; then echo "CACHE-KEEP claimed-or-unreadable(${#caches[@]}) $label  $path" | tee -a "$LOG"; continue; fi
  if [[ -d "$gd/modules" ]]; then echo "CACHE-KEEP submodules(${#caches[@]}) $label  $path" | tee -a "$LOG"; continue; fi
  if pid="$(in_use_pid "$path")"; then echo "CACHE-KEEP in-use(pid=$pid) $label  $path" | tee -a "$LOG"; continue; fi
  for d in "${caches[@]}"; do
    rel="${d#"$path"/}"
    # Un `.git` entre le worktree et le cache : dépôt ou worktree imbriqué, avec ses propres
    # verrou et sessions ; son ignore ne se lit pas depuis ce worktree.
    p="$d"; inner=0
    while [[ "$p" != "$path" ]]; do [[ -e "$p/.git" ]] && inner=1; p="${p%/*}"; done
    if [[ $inner -eq 1 ]]; then echo "CACHE-KEEP nested-repo $d" | tee -a "$LOG"; continue; fi
    # Statut illisible = conservé. stderr n'est pas journalisé : il peut nommer des fichiers.
    if ! cache_st="$(git --no-optional-locks -C "$path" status --porcelain=v1 --untracked-files=all --ignore-submodules=none -- ":(literal)$rel" 2>/dev/null)" \
       || ! cache_ls="$(git --no-optional-locks -C "$path" ls-files -- ":(literal)$rel" 2>/dev/null)"; then
      echo "CACHE-KEEP status-error $d" | tee -a "$LOG"; continue
    fi
    if [[ -n "$cache_st$cache_ls" ]]; then echo "CACHE-KEEP not-ignored $d" | tee -a "$LOG"; continue; fi
    # Un parcours en erreur (droits) n'est jamais lu comme « inactif ».
    if ! recent="$(find "$d" -mmin "-$CACHE_IDLE_MIN" -print -quit 2>/dev/null)" || [[ -n "$recent" ]]; then
      echo "CACHE-KEEP recent-or-unreadable $d" | tee -a "$LOG"; continue
    fi
    if ! foreign="$(find "$d" ! -user "$(id -u)" -print -quit 2>/dev/null)" || [[ -n "$foreign" ]]; then
      echo "CACHE-KEEP foreign-owner $d" | tee -a "$LOG"; continue
    fi
    mb="$(du -sm -- "$d" 2>/dev/null | cut -f1)"; mb="${mb:-0}"
    if [[ $APPLY -eq 1 ]]; then
      rm -rf --one-file-system -- "$d" 2>/dev/null || true
      if [[ -e "$d" ]]; then echo "CACHE-FAIL $d (retrait incomplet, cache régénérable)" | tee -a "$LOG"; continue; fi
      echo "CACHE-REMOVED ${mb} Mo $d ($label)" | tee -a "$LOG"
    else
      echo "WOULD-REMOVE-CACHE ${mb} Mo $d ($label)" | tee -a "$LOG"
    fi
    cache_n=$((cache_n+1)); cache_mb=$((cache_mb+mb))
  done
done < <(list_worktrees)

# ============================================================
# PASSE 4 — node_modules autonomes des worktrees inactifs
# ============================================================
# Un `npm ci` laisse dans le worktree des node_modules (racine et workspaces). La passe 1
# ne les retire qu'avec le worktree, une fois la PR fusionnée ou fermée ; ceux d'une PR ouverte,
# sans PR ou conservés s'accumulent (43 inactifs depuis 3 jours sur DEV le 2026-11-17, disque à
# 90 %). Seuls ces dossiers partent ; `npm ci` les réinstalle. Conditions, toutes
# requises : worktree géré (jamais le checkout principal, Codex, pont Hermes), non verrouillé,
# sans attribution de mission, qu'aucune exécution de la passe 1 ne retire déjà ; aucun processus
# n'y a son répertoire courant, un fichier ouvert ou une bibliothèque chargée ; l'index git du
# worktree et le node_modules/.package-lock.json de chaque dossier (à défaut, la date du dossier)
# n'ont pas été écrits depuis IDLE_NM_DAYS jours ; chaque dossier est réel (ni lien, ni sous un
# parent lien), ignoré par git, sans fichier suivi, hors dépôt imbriqué, tout à cet utilisateur.
# Taille journalisée : `du` du dossier seul ; un fichier lié physiquement à un autre worktree
# (dedup-worktree-node-modules.sh) y compte, mais n'est libéré qu'avec sa dernière copie.
echo "--- Passe 4 : node_modules des worktrees inactifs depuis ${IDLE_NM_DAYS} j ---" | tee -a "$LOG"
nm_n=0; nm_mb=0
while IFS= read -r -d '' path && IFS= read -r -d '' ref && IFS= read -r -d '' det && IFS= read -r -d '' locked; do
  [[ "$path" == "$REPO_ROOT" || ! -d "$path" ]] && continue
  mapfile -t nms < <(nm_dirs "$path")
  [[ ${#nms[@]} -gt 0 ]] || continue
  label="${ref#refs/heads/}"; [[ -n "$label" ]] || label="(HEAD détachée)"
  if ! managed "$path/"; then echo "NM-KEEP other-manager(${#nms[@]}) $label  $path" | tee -a "$LOG"; continue; fi
  if [[ -n "${P1_WOULD[$path]:-}" ]]; then echo "NM-KEEP worktree-would-remove $label  $path" | tee -a "$LOG"; continue; fi
  if [[ "$locked" == "1" ]]; then echo "NM-KEEP locked(${#nms[@]}) $label  $path" | tee -a "$LOG"; continue; fi
  gd="$(git -C "$path" rev-parse --absolute-git-dir 2>/dev/null || true)"
  if [[ -z "$gd" || -e "$gd/agent-claim.json" ]]; then echo "NM-KEEP claimed-or-unreadable(${#nms[@]}) $label  $path" | tee -a "$LOG"; continue; fi
  if busy "$path"; then echo "NM-KEEP in-use(${#nms[@]}) $label  $path" | tee -a "$LOG"; continue; fi
  # Dernier usage = la plus récente des dates ; une date illisible n'est jamais lue comme ancienne.
  last=""
  if t="$(stat -c %Y -- "$gd/index" 2>/dev/null)"; then
    last=$t
    for d in "${nms[@]}"; do
      f="$d/.package-lock.json"; [[ -f "$f" && ! -L "$f" ]] || f="$d"
      if ! t="$(stat -c %Y -- "$f" 2>/dev/null)"; then last=""; break; fi
      (( t > last )) && last=$t
    done
  fi
  if [[ -z "$last" ]]; then echo "NM-KEEP date-unreadable $label  $path" | tee -a "$LOG"; continue; fi
  now="$(date +%s)"; idle_d=$(( (now - last) / 86400 ))
  if (( now - last < IDLE_NM_DAYS * 86400 )); then echo "NM-KEEP recent(${idle_d}j) $label  $path" | tee -a "$LOG"; continue; fi
  rp_wt="$(realpath -e -- "$path" 2>/dev/null || true)"
  for d in "${nms[@]}"; do
    rel="${d#"$path"/}"
    # Un parent lien (ex. backend -> checkout principal) ferait retirer le node_modules d'ailleurs.
    if [[ -z "$rp_wt" || "$(realpath -e -- "$d" 2>/dev/null)" != "$rp_wt/$rel" ]]; then
      echo "NM-KEEP symlinked-path $d" | tee -a "$LOG"; continue
    fi
    p="${d%/*}"; inner=0
    while [[ "$p" != "$path" ]]; do [[ -e "$p/.git" ]] && inner=1; p="${p%/*}"; done
    if [[ $inner -eq 1 ]]; then echo "NM-KEEP nested-repo $d" | tee -a "$LOG"; continue; fi
    # Suivi ou non ignoré = conservé ; erreur de lecture = conservé. stderr non journalisé.
    if ! nm_ls="$(git --no-optional-locks -C "$path" ls-files -- ":(literal)$rel" 2>/dev/null)" || [[ -n "$nm_ls" ]]; then
      echo "NM-KEEP tracked-or-unreadable $d" | tee -a "$LOG"; continue
    fi
    if ! git --no-optional-locks -C "$path" check-ignore -q -- "$rel/" 2>/dev/null; then
      echo "NM-KEEP not-ignored $d" | tee -a "$LOG"; continue
    fi
    if ! foreign="$(find "$d" ! -user "$(id -u)" -print -quit 2>/dev/null)" || [[ -n "$foreign" ]]; then
      echo "NM-KEEP foreign-owner $d" | tee -a "$LOG"; continue
    fi
    mb="$(du -sm -- "$d" 2>/dev/null | cut -f1)"; mb="${mb:-0}"
    if [[ $APPLY -eq 1 ]]; then
      # Revérifié juste avant le retrait : les passes précédentes ont pu durer.
      if busy "$path"; then echo "NM-KEEP in-use(au retrait) $d" | tee -a "$LOG"; continue; fi
      rm -rf --one-file-system -- "$d" 2>/dev/null || true
      if [[ -e "$d" ]]; then echo "NM-FAIL $d (retrait incomplet — npm ci le réinstalle)" | tee -a "$LOG"; continue; fi
      echo "NM-REMOVED ${mb} Mo $d ($label, inactif ${idle_d} j)" | tee -a "$LOG"
    else
      echo "WOULD-REMOVE-NM ${mb} Mo $d ($label, inactif ${idle_d} j)" | tee -a "$LOG"
    fi
    nm_n=$((nm_n+1)); nm_mb=$((nm_mb+mb))
  done
done < <(list_worktrees)

# --- Bilan ---
wt_removed="$(grep -cE '^(REMOVED|WOULD-REMOVE) ' "$LOG" || true)"
echo "=== Bilan : worktrees ciblés=$wt_removed  branches ciblées=$del  caches ciblés=$cache_n (${cache_mb} Mo)  node_modules ciblés=$nm_n (${nm_mb} Mo)  manifeste=$LOG ==="| tee -a "$LOG"
[[ $APPLY -eq 0 ]] && echo "(dry-run — relancer avec --apply pour exécuter)"
exit 0
