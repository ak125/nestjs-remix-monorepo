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
# Usage:
#   prune-merged-worktrees.sh            # dry-run (par défaut) : affiche les décisions
#   prune-merged-worktrees.sh --apply    # exécute les suppressions
#
# Env (optionnel):
#   REPO        slug GitHub (défaut: ak125/nestjs-remix-monorepo)
#   LOG_DIR     dossier des manifestes (défaut: /tmp)
#   RECENT_MIN  minutes sous lesquelles un worktree récent est épargné (défaut: 180)
#
# Dépendances: git, gh (authentifié), jq.
set -euo pipefail

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

REPO="${REPO:-ak125/nestjs-remix-monorepo}"
LOG_DIR="${LOG_DIR:-/tmp}"
RECENT_MIN="${RECENT_MIN:-180}"
# untracked jetables : ne bloquent pas la suppression d'un worktree par ailleurs propre
ALLOW='^(\.playwright-mcp|node_modules|\.turbo|dist|build|coverage)(/|$)'

for bin in git gh jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "FATAL: '$bin' requis mais absent" >&2; exit 2; }
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

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

# --- Purge des registrations de worktrees dont le dossier a disparu ---
git worktree prune

# --- État PR batché : 1 seul appel ---
git fetch --prune origin --quiet || true
gh pr list --repo "$REPO" --state all --json number,state,headRefName --limit 1000 > "$PRSTATE"

pr_state() { # $1=branch -> MERGED|CLOSED|OPEN|NO-PR (la PR la plus récente gagne)
  jq -r --arg b "$1" '[.[]|select(.headRefName==$b)]|sort_by(.number)|last|.state // "NO-PR"' "$PRSTATE"
}

CUR="$(git symbolic-ref --short HEAD 2>/dev/null || echo '')"
removed_branches="$(mktemp)"; trap 'rm -f "$PRSTATE" "$removed_branches"' EXIT
NOW="$(date +%s)"

# ============================================================
# PASSE 1 — worktrees
# ============================================================
echo "--- Passe 1 : worktrees ---" | tee -a "$LOG"
while IFS=$'\t' read -r path ref det; do
  [[ "$path" == "$REPO_ROOT" ]] && continue
  [[ "$det" == "1" || -z "$ref" ]] && { echo "KEEP    detached         $path" | tee -a "$LOG"; continue; }
  br="${ref#refs/heads/}"
  st="$(pr_state "$br")"
  case "$st" in
    OPEN)    echo "KEEP    PR-OPEN          $br" | tee -a "$LOG"; continue;;
    NO-PR)   echo "KEEP    no-PR            $br" | tee -a "$LOG"; continue;;
  esac
  # MERGED ou CLOSED — inspecter l'arbre de travail
  porc="$(git -C "$path" status --porcelain 2>/dev/null || true)"
  tracked="$(printf '%s\n' "$porc" | grep -cE '^( M| A| D|M |A |D |R |MM|AM)' || true)"
  untrk="$(printf '%s\n' "$porc" | grep -c '^?? ' || true)"
  bad_untrk="$(printf '%s\n' "$porc" | grep '^?? ' | sed 's/^?? //' | grep -vcE "$ALLOW" || true)"
  if [[ "$tracked" -gt 0 ]]; then echo "PRESERVE $st+tracked($tracked) $br" | tee -a "$LOG"; continue; fi
  if git worktree list --porcelain | awk -v p="$path" '/^worktree /{w=$2} /^locked/{if(w==p)print}' | grep -q .; then
    echo "SKIP    $st+LOCKED        $br" | tee -a "$LOG"; continue
  fi
  mmin=$(( (NOW - $(stat -c %Y "$path")) / 60 ))
  if [[ "$mmin" -lt "$RECENT_MIN" ]]; then echo "SKIP    $st+recent(${mmin}m) $br" | tee -a "$LOG"; continue; fi
  if [[ "$untrk" -gt 0 && "$bad_untrk" -gt 0 ]]; then echo "PRESERVE $st+untrk-nonephem $br" | tee -a "$LOG"; continue; fi

  sha="$(git -C "$path" rev-parse HEAD 2>/dev/null || echo '?')"
  forceflag=(); [[ "$untrk" -gt 0 ]] && forceflag=(--force)
  if [[ $APPLY -eq 1 ]]; then
    if git worktree remove "${forceflag[@]}" "$path" 2>>"$LOG"; then
      echo "REMOVED $st $br @ $sha" | tee -a "$LOG"; echo "$br" >> "$removed_branches"
    else
      echo "FAIL    $st $br (git a refusé — laissé intact)" | tee -a "$LOG"
    fi
  else
    echo "WOULD-REMOVE $st ${forceflag[*]:+(force)} $br @ $sha  $path" | tee -a "$LOG"
    echo "$br" >> "$removed_branches"
  fi
done < <(git worktree list --porcelain | awk '
  /^worktree /{p=$2;b="";d=0} /^branch /{b=$2} /^detached/{d=1}
  /^$/{if(p)print p"\t"b"\t"d; p=""}')

[[ $APPLY -eq 1 ]] && git worktree prune

# ============================================================
# PASSE 2 — branches locales (worktree-less)
# ============================================================
echo "--- Passe 2 : branches locales ---" | tee -a "$LOG"
INWT="$(git worktree list --porcelain | awk '/^branch /{sub("refs/heads/","",$2);print $2}')"
del=0
while read -r br; do
  [[ "$br" == "$CUR" || "$br" == "main" ]] && continue
  printf '%s\n' "$INWT" | grep -qxF "$br" && continue
  st="$(pr_state "$br")"
  ahead="$(git rev-list --count origin/main.."$br" 2>/dev/null || echo '?')"
  if [[ "$st" == "MERGED" ]] || { [[ "$st" == "CLOSED" && "$ahead" == "0" ]]; }; then
    sha="$(git rev-parse "$br")"
    if [[ $APPLY -eq 1 ]]; then
      git branch -D "$br" >>"$LOG" 2>&1 && { echo "BRANCH-DEL $br ($st) @ $sha" >> "$LOG"; del=$((del+1)); }
    else
      echo "WOULD-DEL-BRANCH $br ($st, ahead=$ahead) @ $sha" | tee -a "$LOG"; del=$((del+1))
    fi
  else
    echo "REPORT-KEEP $br (state=$st ahead=$ahead)" >> "$LOG"
  fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads/)

# --- Bilan ---
wt_removed="$(grep -cE '^(REMOVED|WOULD-REMOVE) ' "$LOG" || true)"
echo "=== Bilan : worktrees ciblés=$wt_removed  branches ciblées=$del  manifeste=$LOG ==="| tee -a "$LOG"
[[ $APPLY -eq 0 ]] && echo "(dry-run — relancer avec --apply pour exécuter)"
exit 0
