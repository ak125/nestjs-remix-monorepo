#!/usr/bin/env bash
#
# stop-log-session-suggest.sh — Stop hook for Claude Code.
#
# Detects whether the current Claude Code session has produced commits or
# PRs that would warrant an entry in log.md. If so, returns JSON instructing
# Claude to invoke the `session-log` skill (silently if no work found).
#
# Wire-up: .claude/settings.json
#   "hooks": {
#     "Stop": [
#       { "hooks": [ { "type": "command", "command": "bash scripts/claude-hooks/stop-log-session-suggest.sh" } ] }
#     ]
#   }
#
# Read-only operation. Never writes to log.md directly. Only signals Claude.

set -u

# Resolve repo root regardless of where the hook runs from.
REPO_ROOT="$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null || echo /opt/automecanik/app)"
cd "$REPO_ROOT" 2>/dev/null || exit 0

# Marker so we don't re-suggest within the same logical session unless new work appears.
MARKER_DIR="${REPO_ROOT}/.claude/.session-log-state"
mkdir -p "$MARKER_DIR" 2>/dev/null
LAST_SHA_FILE="${MARKER_DIR}/last-suggested-head"
LAST_BRANCH_FILE="${MARKER_DIR}/last-suggested-branch"

current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
current_head="$(git rev-parse HEAD 2>/dev/null || echo '')"

# Skip if not on a feature branch (main, master, detached HEAD)
case "$current_branch" in
  main|master|HEAD|"")
    exit 0
    ;;
esac

# Look for commits ahead of origin/main on the current branch
# (= work done in this branch, not yet merged).
commits_ahead="$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')"

# Skip if no commits at all on this branch yet.
if [ "${commits_ahead:-0}" -lt 1 ]; then
  exit 0
fi

# Has anything changed since the last suggestion ? (avoid re-prompt loop)
last_sha="$(cat "$LAST_SHA_FILE" 2>/dev/null || echo '')"
last_branch="$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo '')"

if [ "$current_head" = "$last_sha" ] && [ "$current_branch" = "$last_branch" ]; then
  # Same SHA + same branch as last time we suggested -> already prompted, skip.
  exit 0
fi

# Detect open PR for this branch (informational only).
pr_number=""
if command -v gh >/dev/null 2>&1; then
  pr_number="$(gh pr list --head "$current_branch" --state open --json number --jq '.[0].number' 2>/dev/null || true)"
fi

pr_hint=""
if [ -n "$pr_number" ]; then
  pr_hint=" PR #${pr_number} is open."
fi

# Persist state so we don't re-prompt for the same SHA.
printf '%s\n' "$current_head" > "$LAST_SHA_FILE"
printf '%s\n' "$current_branch" > "$LAST_BRANCH_FILE"

# Emit JSON for Claude Code Stop hook protocol — signals additional context
# for the model. The model will see this as part of the next assistant turn.
cat <<EOF
{
  "decision": "block",
  "reason": "Session has produced ${commits_ahead} commit(s) on branch '${current_branch}'.${pr_hint} Before stopping, invoke the 'session-log' skill to append a 3-4 line entry to log.md. After logging, you may stop."
}
EOF

exit 0
