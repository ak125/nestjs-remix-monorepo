#!/usr/bin/env bash
#
# prune-merged-worktrees.sh — nettoyage sûr des worktrees & branches locales obsolètes
#
# Retire les git worktrees dont la PR est MERGED/CLOSED et dont l'arbre de travail
# est propre, puis supprime les branches locales correspondantes. L'état est
# re-dérivé EN DIRECT à chaque exécution (GitHub PR state + git status) — jamais
# de liste figée. Ne détruit JAMAIS de travail non-mergé, non-commité, OPEN ou
# sans PR. Écrit un manifeste de récupération (SHAs) avant toute suppression.
#
# Périmètre : seuls les worktrees du gestionnaire Claude ($MANAGED_PREFIX) sont
# candidats. Les autres gestionnaires (pont Hermes, worktrees Codex directs) gardent
# leur propre cycle de vie — ce script ne les retire jamais.
#
# Usage:
#   prune-merged-worktrees.sh            # dry-run (par défaut) : n'écrit RIEN dans le dépôt
#   prune-merged-worktrees.sh --apply    # exécute les suppressions
#
# Env (optionnel):
#   REPO            slug GitHub (défaut: ak125/nestjs-remix-monorepo)
#   LOG_DIR         dossier des manifestes (défaut: /tmp)
#   RECENT_MIN      minutes sous lesquelles un worktree récent est épargné (défaut: 180)
#   MANAGED_PREFIX  emplacement des worktrees gérés, relatif au dépôt (défaut: .claude/worktrees/)
#
# Dépendances: git, gh (authentifié), jq.
set -euo pipefail
# Un GIT_DIR / GIT_WORK_TREE hérité ferait agir chaque commande sur un autre dépôt.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

REPO="${REPO:-ak125/nestjs-remix-monorepo}"
LOG_DIR="${LOG_DIR:-/tmp}"
RECENT_MIN="${RECENT_MIN:-180}"
MANAGED_PREFIX="${MANAGED_PREFIX:-.claude/worktrees/}"
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
  command -v "$bin" >/dev/null 2>&1 || { echo "FATAL: '$bin' requis mais absent" >&2; exit 2; }
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
MANAGED_DIR="$REPO_ROOT/${MANAGED_PREFIX%/}/"

TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/worktree-cleanup-$TS.log"
PRSTATE="$(mktemp)"
trap 'rm -f "$PRSTATE"' EXIT

mode_label="DRY-RUN (aucune suppression — utiliser --apply pour agir)"
[[ $APPLY -eq 1 ]] && mode_label="APPLY"
echo "=== prune-merged-worktrees — $mode_label — $TS ===" | tee "$LOG"

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
if ! gh pr list --repo "$REPO" --state all --json number,state,headRefName,headRefOid --limit 1000 > "$PRSTATE" \
   || ! jq -e 'type == "array"' "$PRSTATE" >/dev/null 2>&1; then
  echo "FATAL   état des PR illisible (gh pr list) — aucune suppression" | tee -a "$LOG" >&2
  exit 1
fi

pr_info() { # $1=branch -> "STATE<TAB>headRefOid" (la PR la plus récente gagne ; NO-PR sinon)
  jq -r --arg b "$1" '[.[]|select(.headRefName==$b)]|sort_by(.number)|last
    | if . == null then "NO-PR\t" else "\(.state)\t\(.headRefOid // "")" end' "$PRSTATE"
}

# Le travail au bout de la branche est-il conservé ailleurs ?
#   MERGED : la pointe est exactement la tête de la PR (squash compris) ou déjà dans origin/main.
#   CLOSED : seulement si déjà dans origin/main (une PR fermée non fusionnée n'a rien conservé).
# Un commit ajouté APRÈS la tête de la PR (ex. entrée log auto) n'est conservé nulle part.
tip_published() { # $1=state $2=sha $3=headRefOid
  git merge-base --is-ancestor "$2" "$MAIN_REF" 2>/dev/null && return 0
  [[ "$1" == "MERGED" && -n "$3" && "$2" == "$3" ]]
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

# ============================================================
# PASSE 1 — worktrees
# ============================================================
echo "--- Passe 1 : worktrees ---" | tee -a "$LOG"
while IFS= read -r -d '' path && IFS= read -r -d '' ref && IFS= read -r -d '' det && IFS= read -r -d '' locked; do
  [[ "$path" == "$REPO_ROOT" ]] && continue
  [[ "$path/" == "$MANAGED_DIR"* ]] || { echo "KEEP    other-manager    $path" | tee -a "$LOG"; continue; }
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

# --- Bilan ---
wt_removed="$(grep -cE '^(REMOVED|WOULD-REMOVE) ' "$LOG" || true)"
echo "=== Bilan : worktrees ciblés=$wt_removed  branches ciblées=$del  manifeste=$LOG ==="| tee -a "$LOG"
[[ $APPLY -eq 0 ]] && echo "(dry-run — relancer avec --apply pour exécuter)"
exit 0
