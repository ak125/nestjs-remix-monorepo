#!/usr/bin/env bash
#
# prune-stale-worktrees.sh — remove git worktrees that are provably disposable.
#
# Worktrees accumulate (one per WIP branch) and each one inflates Claude Code's
# system prompt (every path lands in "Additional working directories") and the
# `git worktree list` surface. `git worktree prune` only removes orphaned admin
# entries, and `clean_gone` only handles branches deleted on the remote — neither
# catches the common case: a squash-merged PR whose branch was never deleted.
#
# This script encodes the SAFE deletion criteria mechanically. A worktree is a
# candidate ONLY when ALL of these hold (anti-bricolage: never cut blind):
#   #0  it is not the primary worktree, nor the one we are running from
#   #1  working tree is clean — no staged, unstaged, or untracked changes
#   #2  inactive for >= MIN_DAYS (last commit older than the threshold)
#   #3  its branch is resolved: PR MERGED/CLOSED (via gh), or branch is [gone]
#       (deleted on the remote). PR OPEN or no-PR-and-not-gone → KEPT.
#
# `git worktree remove` keeps the branch ref, so every removal is reversible
# (`git worktree add <path> <branch>` re-creates it). DIRTY and PR-OPEN
# worktrees are NEVER touched — that is live work.
#
# Usage:
#   ./scripts/cleanup/prune-stale-worktrees.sh            # DRY-RUN (default)
#   ./scripts/cleanup/prune-stale-worktrees.sh --apply    # actually remove
#
# Env overrides:
#   WT_MIN_DAYS         minimum inactivity in days (default 6)
#
# Exit codes:
#   0 — completed (dry-run, or apply succeeded with no failures)
#   1 — one or more removals failed
#   2 — setup error (not in a git repo)

set -u

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

MIN_DAYS="${WT_MIN_DAYS:-6}"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO_ROOT" ] || { echo "not in a git repository" >&2; exit 2; }

# Primary worktree (the one backing the main checkout) and the current one are
# never candidates.
PRIMARY="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
CURRENT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

have_gh=0
command -v gh >/dev/null 2>&1 && have_gh=1

now="$(date +%s)"
candidates=()
kept=0

# Branches deleted on the remote (one fetch --prune keeps this accurate).
git fetch --prune origin >/dev/null 2>&1 || true
gone_branches="$(git branch -vv 2>/dev/null | awk '/\[[^]]*: gone\]/{print $1}' | tr -d '*' || true)"

while read -r wt; do
  [ -n "$wt" ] || continue
  [ -d "$wt" ] || continue
  # #0 — skip primary and current.
  { [ "$wt" = "$PRIMARY" ] || [ "$wt" = "$CURRENT" ]; } && continue

  br="$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  [ -n "$br" ] && [ "$br" != "HEAD" ] || { kept=$((kept+1)); continue; }

  # #1 — clean working tree.
  if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then
    kept=$((kept+1)); continue
  fi

  # #2 — stale.
  last_ct="$(git -C "$wt" log -1 --format=%ct 2>/dev/null || echo "$now")"
  days=$(( (now - last_ct) / 86400 ))
  [ "$days" -ge "$MIN_DAYS" ] || { kept=$((kept+1)); continue; }

  # #3 — branch resolved (PR merged/closed, or branch gone).
  resolved=""
  if printf '%s\n' "$gone_branches" | grep -qx "$br"; then
    resolved="gone"
  elif [ "$have_gh" = 1 ]; then
    state="$(gh pr list --head "$br" --state all --json state --jq '.[0].state' 2>/dev/null || echo '')"
    case "$state" in
      MERGED|CLOSED) resolved="$state" ;;
    esac
  fi
  [ -n "$resolved" ] || { kept=$((kept+1)); continue; }

  candidates+=("${wt}|${days}|${resolved}")
done < <(git worktree list --porcelain | awk '/^worktree /{print $2}')

if [ "${#candidates[@]}" -eq 0 ]; then
  echo "No disposable worktrees (clean + stale>=${MIN_DAYS}d + PR merged/closed/gone). Kept: ${kept}."
  exit 0
fi

echo "Disposable worktrees (clean + stale>=${MIN_DAYS}d + resolved branch):"
printf '%-44s %6s  %s\n' "WORKTREE" "AGE" "REASON"
for c in "${candidates[@]}"; do
  IFS='|' read -r wt days reason <<< "$c"
  printf '%-44s %5dd  %s\n' "$(basename "$wt")" "$days" "$reason"
done
echo ""

if [ "$APPLY" != 1 ]; then
  echo "DRY-RUN — ${#candidates[@]} candidate(s), ${kept} kept. Re-run with --apply to remove."
  echo "(branch refs are preserved; 'git worktree add <path> <branch>' restores any of them.)"
  exit 0
fi

failed=0
removed=0
for c in "${candidates[@]}"; do
  IFS='|' read -r wt _ _ <<< "$c"
  if git worktree remove "$wt" 2>/tmp/.wt-prune-err; then
    echo "✓ removed $(basename "$wt")"; removed=$((removed+1))
  else
    echo "✗ FAILED $(basename "$wt"): $(cat /tmp/.wt-prune-err)" >&2; failed=$((failed+1))
  fi
done
git worktree prune >/dev/null 2>&1 || true
echo ""
echo "Removed: ${removed} | failed: ${failed} | kept: ${kept}."
[ "$failed" -eq 0 ]
