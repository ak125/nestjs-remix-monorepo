#!/usr/bin/env bash
#
# stop-log-session-suggest.sh — Stop hook for Claude Code (suggestion only).
#
# Detects whether the current Claude Code session has produced commits ahead
# of origin/main on the current branch that are not pushed yet. If so, it
# prints on stderr a suggestion to record the session with `/log-session`
# (skill session-log), with a draft of the 3-line entry.
#
# Writes nothing: no log.md entry, no rotation, no index change, no commit,
# no marker. A hook cannot tell whether the current task is allowed to
# commit; writing and committing log.md stays with the session, inside its
# own mandate. The companion stop-claude-md-suggest.sh, called last, is the
# one shipped next to this hook (not the session worktree's, maybe older),
# run with CLAUDE_MD_SUGGEST_NO_MARKER=1: it reads its marker, never writes it.
#
# Wire-up: .claude/settings.json
#   "Stop": [ { "hooks": [ { "type": "command", "command": "bash ..." } ] } ]
#
# No suggestion:
#   - on main / master / detached HEAD / no commits ahead of origin/main;
#   - during rebase / merge / cherry-pick / bisect / revert;
#   - when HEAD is already in origin/<branch>: an entry committed now would
#     sit alone after the pushed head and stay behind once the PR is merged;
#   - when log.md is already modified or staged (an entry is in progress);
#   - when the branch's PR is merged or closed, or its state is unknown
#     (gh missing or failing: reason on stderr).
# Never falls back to another checkout.

set -u

# Resolved before the cd below: the hook may be called by a relative path.
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"

# No fallback: outside a git worktree there is nothing to log here, and a
# hardcoded checkout would receive another session's entry.
REPO_ROOT="$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$REPO_ROOT" 2>/dev/null || exit 0

LOG_FILE="${REPO_ROOT}/log.md"
MAIN_REF=refs/remotes/origin/main

# Bail if log.md does not exist (feature not yet shipped on this branch).
[ -f "$LOG_FILE" ] || exit 0

# Bail if a multi-step git operation is in progress.
GIT_DIR="$(git rev-parse --git-dir 2>/dev/null || echo .git)"
for marker in rebase-apply rebase-merge MERGE_HEAD CHERRY_PICK_HEAD BISECT_LOG REVERT_HEAD; do
  [ -e "${GIT_DIR}/${marker}" ] && exit 0
done

current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

# Skip on protected branches / detached HEAD.
case "$current_branch" in
  main|master|HEAD|"") exit 0 ;;
esac

# Look for commits ahead of origin/main on the current branch.
commits_ahead="$(git log "$MAIN_REF"..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')"
[ "${commits_ahead:-0}" -lt 1 ] && exit 0

# Nothing left to push: an entry committed now would reach main only if
# another push followed. When none does, the PR is merged without it.
REMOTE_BRANCH_REF="refs/remotes/origin/${current_branch}"
if git rev-parse -q --verify "${REMOTE_BRANCH_REF}^{commit}" >/dev/null \
   && git merge-base --is-ancestor HEAD "$REMOTE_BRANCH_REF" 2>/dev/null; then
  echo "stop-log: HEAD déjà dans origin/${current_branch} — aucune entrée suggérée après la tête poussée" >&2
  exit 0
fi

# The last commit is an entry left by the former auto-commit mode: the
# work before it is already recorded.
last_subject="$(git log -1 --pretty=%s 2>/dev/null || true)"
case "$last_subject" in
  "chore(log): auto session entry"*) exit 0 ;;
esac

# log.md already modified or staged: an entry is in progress.
if ! git diff --quiet -- "$LOG_FILE" || ! git diff --cached --quiet -- "$LOG_FILE"; then
  exit 0
fi

# A merged or closed PR means the branch is done: an entry committed now
# would land after the PR head (squash merges leave the branch "ahead").
pr_number=""
pr_part="aucune"
if command -v gh >/dev/null 2>&1 \
   && pr_state="$(gh pr list --head "$current_branch" --state all --json number,state \
        --jq '([.[] | select(.state == "OPEN")][0].number // "") as $o | "\($o)|\(length)"' 2>/dev/null)"; then
  IFS='|' read -r pr_number pr_total <<< "$pr_state"
  if [ -z "$pr_number" ] && [ "${pr_total:-0}" -gt 0 ]; then
    echo "stop-log: PR de ${current_branch} fusionnée ou fermée — aucune entrée suggérée après sa tête" >&2
    exit 0
  fi
  [ -n "$pr_number" ] && pr_part="#${pr_number}"
else
  # Unknown state is not "no PR": the branch may already be merged.
  echo "stop-log: état de PR inconnu (gh indisponible ou en échec) — aucune entrée suggérée" >&2
  exit 0
fi

# Gather facts for the draft entry.
today="$(date +%F)"
last_commit_subject="$(git log -1 --pretty=%s 2>/dev/null | tr -d '\r' | cut -c1-120)"
short_shas="$(git log "$MAIN_REF"..HEAD --pretty=%h 2>/dev/null | tr '\n' ' ' | sed 's/ *$//')"
plus_n=""
if [ "$commits_ahead" -gt 1 ]; then
  plus_n=" (+$((commits_ahead - 1)) other commit$([ "$((commits_ahead - 1))" -gt 1 ] && echo s))"
fi

# Suggestion only (stderr). Nothing is written or committed.
cat >&2 <<EOF

[stop-log-session-suggest] La branche '${current_branch}' a ${commits_ahead} commit(s) en avance
sur origin/main, tête non poussée (PR ${pr_part}). Si le lot autorise un commit du journal,
consigner la session avec /log-session (skill session-log). Brouillon d'entrée :

## ${today} — ${current_branch}

- **Branche** : \`${current_branch}\`
- **Décision** : ${last_commit_subject}${plus_n}
- **Sortie** : PR ${pr_part} | commits ${short_shas}

Aucun fichier modifié, aucun commit créé par ce hook.
EOF

# Stop hook companion : suggérer (stderr-only) une mise à jour CLAUDE.md /
# MEMORY si la branche a accumulé des commits de correction. Émet uniquement
# un message advisory, sans marqueur : rien n'est écrit. Opt-out du compagnon
# via CLAUDE_HOOKS_DISABLE=1 (la suggestion /log-session ci-dessus reste émise).
if [ -n "$HOOK_DIR" ] && [ -x "${HOOK_DIR}/stop-claude-md-suggest.sh" ]; then
  CLAUDE_MD_SUGGEST_NO_MARKER=1 bash "${HOOK_DIR}/stop-claude-md-suggest.sh" >&2 || true
fi

exit 0
