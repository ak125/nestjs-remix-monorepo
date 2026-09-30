#!/usr/bin/env bash
#
# stop-log-session-suggest.sh — Stop hook for Claude Code (auto-commit mode).
#
# Detects whether the current Claude Code session has produced commits or
# PRs ahead of origin/main on the current branch. If so, the script:
#   1. Appends a deterministic 3-line entry to log.md (suffix " (auto)" so
#      it is visually distinguishable from human-curated entries).
#   2. Stages and commits ONLY log.md with `chore(log): auto session entry`.
#   3. Updates the marker file so a re-fire on the same SHA stays silent.
#
# No JSON output, no Claude involvement, no LLM tokens consumed. Idempotent
# (marker file gates re-trigger). Skill `/log-session` remains available for
# curated manual entries.
#
# Wire-up: .claude/settings.json
#   "Stop": [ { "hooks": [ { "type": "command", "command": "bash ..." } ] } ]
#
# Safe by design:
#   - Only stages log.md ; never touches other files.
#   - Skips on main / master / detached HEAD / no commits.
#   - Skips during rebase / merge / cherry-pick / bisect to avoid colliding
#     with operations the user is steering by hand.
#   - Honours pre-commit hooks (no --no-verify).
#   - Never falls back to another checkout, never sweeps an index or an
#     archive it did not prepare (the commit names its paths: `--only`),
#     never commits after the branch's PR is merged or closed, and never
#     commits when that state is unknown (gh missing or failing: stderr).

set -u

# No fallback: outside a git worktree there is nothing to log here, and a
# hardcoded checkout would receive another session's entry.
REPO_ROOT="$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$REPO_ROOT" 2>/dev/null || exit 0

LOG_FILE="${REPO_ROOT}/log.md"
MARKER_DIR="${REPO_ROOT}/.claude/.session-log-state"
LAST_SHA_FILE="${MARKER_DIR}/last-suggested-head"
LAST_BRANCH_FILE="${MARKER_DIR}/last-suggested-branch"
MAIN_REF=refs/remotes/origin/main

# Bail if log.md does not exist (feature not yet shipped on this branch).
[ -f "$LOG_FILE" ] || exit 0
mkdir -p "$MARKER_DIR" 2>/dev/null

# Bail if a multi-step git operation is in progress.
GIT_DIR="$(git rev-parse --git-dir 2>/dev/null || echo .git)"
for marker in rebase-apply rebase-merge MERGE_HEAD CHERRY_PICK_HEAD BISECT_LOG REVERT_HEAD; do
  [ -e "${GIT_DIR}/${marker}" ] && exit 0
done

current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
current_head="$(git rev-parse HEAD 2>/dev/null || echo '')"

# Skip on protected branches / detached HEAD.
case "$current_branch" in
  main|master|HEAD|"") exit 0 ;;
esac

# Look for commits ahead of origin/main on the current branch.
commits_ahead="$(git log "$MAIN_REF"..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')"
[ "${commits_ahead:-0}" -lt 1 ] && exit 0

# Defence-in-depth against runaway auto-commit chains:
# if the most recent commit is itself an auto-log entry, bail. The marker
# file should already prevent re-fire on the same SHA, but if the hook is
# invoked twice (parallel terminal, harness retry, marker race), this guard
# guarantees we never produce two consecutive `chore(log): auto session
# entry` commits.
last_subject="$(git log -1 --pretty=%s 2>/dev/null || true)"
case "$last_subject" in
  "chore(log): auto session entry"*) exit 0 ;;
esac

# Idempotence: same SHA + same branch → already logged, skip.
last_sha="$(cat "$LAST_SHA_FILE" 2>/dev/null || echo '')"
last_branch="$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo '')"
if [ "$current_head" = "$last_sha" ] && [ "$current_branch" = "$last_branch" ]; then
  exit 0
fi

# Skip if log.md is currently staged or modified by something else — we
# only auto-commit when log.md is the sole change we will introduce.
if ! git diff --quiet -- "$LOG_FILE" || ! git diff --cached --quiet -- "$LOG_FILE"; then
  exit 0
fi

# Only commit what this hook prepares: another staged path or a pre-existing
# change to the archive belongs to someone else (the failure path below
# resets, restores or removes the archive). The commit itself also names its
# paths, so a path staged by someone else while this hook runs stays out.
ARCHIVE_FILE="${REPO_ROOT}/log-archive-$(date +%Y).md"
if ! git diff --cached --quiet; then
  echo "stop-log: index non vide — entrée auto non créée" >&2
  exit 0
fi
if [ -e "$ARCHIVE_FILE" ] && { ! git ls-files --error-unmatch -- "$ARCHIVE_FILE" >/dev/null 2>&1 || ! git diff --quiet -- "$ARCHIVE_FILE"; }; then
  echo "stop-log: $(basename "$ARCHIVE_FILE") modifié ou non suivi — entrée auto non créée" >&2
  exit 0
fi

# A merged or closed PR means the branch is done: a commit now would land
# after the PR head (squash merges leave the branch "ahead" of origin/main).
pr_number=""
pr_part="aucune"
if command -v gh >/dev/null 2>&1 \
   && pr_state="$(gh pr list --head "$current_branch" --state all --json number,state \
        --jq '([.[] | select(.state == "OPEN")][0].number // "") as $o | "\($o)|\(length)"' 2>/dev/null)"; then
  IFS='|' read -r pr_number pr_total <<< "$pr_state"
  if [ -z "$pr_number" ] && [ "${pr_total:-0}" -gt 0 ]; then
    echo "stop-log: PR de ${current_branch} fusionnée ou fermée — aucun commit après sa tête" >&2
    exit 0
  fi
  [ -n "$pr_number" ] && pr_part="#${pr_number}"
else
  # Unknown state is not "no PR": the branch may already be merged.
  echo "stop-log: état de PR inconnu (gh indisponible ou en échec) — aucune entrée créée" >&2
  exit 0
fi

# Gather facts for the entry.
today="$(date +%F)"
last_commit_subject="$(git log -1 --pretty=%s 2>/dev/null | tr -d '\r' | cut -c1-120)"
short_shas="$(git log "$MAIN_REF"..HEAD --pretty=%h 2>/dev/null | tr '\n' ' ' | sed 's/ *$//')"
plus_n=""
if [ "$commits_ahead" -gt 1 ]; then
  plus_n=" (+$((commits_ahead - 1)) other commit$([ "$((commits_ahead - 1))" -gt 1 ] && echo s))"
fi

# Append deterministic entry. Always one blank line before the H2 heading.
{
  printf '\n## %s — %s (auto)\n\n' "$today" "$current_branch"
  printf -- '- **Branche** : `%s`\n' "$current_branch"
  printf -- '- **Décision** : %s%s\n' "$last_commit_subject" "$plus_n"
  printf -- '- **Sortie** : PR %s | commits %s\n' "$pr_part" "$short_shas"
} >> "$LOG_FILE"

# Bound log.md size: archive old entries into log-archive-<year>.md so the
# live file never grows without limit. Deterministic, no LLM. The archive is
# committed for history but never read at session start (CLAUDE.md reads only
# the bounded `tail` of log.md).
bash "${REPO_ROOT}/scripts/claude-hooks/rotate-log.sh" "$LOG_FILE" "$ARCHIVE_FILE" 2>/dev/null || true

# Stop hook companion : suggérer (stderr-only) une mise à jour CLAUDE.md /
# MEMORY si la branche a accumulé des commits de correction. Hors du flow de
# commit log — émet uniquement un message advisory. Idempotent, opt-out via
# CLAUDE_HOOKS_DISABLE=1.
if [ -x "${REPO_ROOT}/scripts/claude-hooks/stop-claude-md-suggest.sh" ]; then
  bash "${REPO_ROOT}/scripts/claude-hooks/stop-claude-md-suggest.sh" 2>&1 >&2 || true
fi

# Stage log.md (+ the archive if rotation just touched it) and commit.
commit_paths=("$LOG_FILE")
[ -f "$ARCHIVE_FILE" ] && commit_paths+=("$ARCHIVE_FILE")
git add -- "${commit_paths[@]}" 2>/dev/null

# Use a dedicated commit message. Pre-commit hooks run normally (no bypass).
# `--only` + pathspec: the commit holds these paths and nothing else staged.
if git commit --only -m "chore(log): auto session entry for ${current_branch}" \
              -m "Generated by stop-log-session-suggest.sh after detecting ${commits_ahead} commit(s) ahead of origin/main." \
              --quiet -- "${commit_paths[@]}" 2>"${GIT_DIR}/stop-log-commit.err"; then
  # Update marker with the NEW HEAD (the auto-commit just landed).
  printf '%s\n' "$(git rev-parse HEAD)" > "$LAST_SHA_FILE"
  printf '%s\n' "$current_branch" > "$LAST_BRANCH_FILE"
else
  # Commit failed (probably a pre-commit hook). Roll back the staged changes
  # (log.md + archive, in case rotation just ran) so the user finds a clean
  # working tree, leave a marker so we don't loop.
  git reset HEAD -- "$LOG_FILE" "$ARCHIVE_FILE" >/dev/null 2>&1
  git checkout -- "$LOG_FILE" >/dev/null 2>&1
  # A fresh archive created this run is untracked → checkout won't remove it.
  git ls-files --error-unmatch -- "$ARCHIVE_FILE" >/dev/null 2>&1 \
    && git checkout -- "$ARCHIVE_FILE" >/dev/null 2>&1 \
    || rm -f "$ARCHIVE_FILE" 2>/dev/null
  # `checkout -- log.md` restored the full pre-append file → no entry lost.
  printf '%s\n' "$current_head" > "$LAST_SHA_FILE"
  printf '%s\n' "$current_branch" > "$LAST_BRANCH_FILE"
fi

exit 0
