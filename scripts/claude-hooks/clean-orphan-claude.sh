#!/usr/bin/env bash
# clean-orphan-claude.sh — Kill orphan Claude Code processes
# Runs via cron every 5 minutes to prevent RAM accumulation
# Each orphan session = ~500 MB (claude + shadcn MCP + supabase MCP)
set -euo pipefail

LOG="/tmp/claude-orphan-cleanup.log"
KILLED=0

# Get all claude binary PIDs
mapfile -t CLAUDE_PIDS < <(pgrep -f 'native-binary/claude' 2>/dev/null || true)

if [[ ${#CLAUDE_PIDS[@]} -le 1 ]]; then
  exit 0  # 0 or 1 process = nothing to clean
fi

for PID in "${CLAUDE_PIDS[@]}"; do
  [[ -z "$PID" ]] && continue
  [[ ! -d "/proc/$PID" ]] && continue

  # Check if stdin (fd/0) is a broken pipe (orphan) or active pipe
  # An active claude process has an open pipe from extensionHost
  # An orphan has a broken/closed pipe
  if ! ls -l "/proc/$PID/fd/0" &>/dev/null; then
    # fd/0 not accessible = orphan
    echo "$(date '+%Y-%m-%d %H:%M:%S') KILL orphan PID=$PID (fd/0 gone)" >> "$LOG"
    kill -TERM "$PID" 2>/dev/null || true
    ((KILLED++)) || true
    continue
  fi

  # Check if the process has been idle (no CPU) for a while
  # Get process state: S=sleeping is normal, but check elapsed time
  ETIME=$(ps -o etimes= -p "$PID" 2>/dev/null | tr -d ' ')
  CPUTIME=$(ps -o cputimes= -p "$PID" 2>/dev/null | tr -d ' ')

  if [[ -z "$ETIME" || -z "$CPUTIME" ]]; then
    continue  # process disappeared
  fi

  # If process has been alive >10 min and used <5s CPU = likely orphan
  if [[ "$ETIME" -gt 600 && "$CPUTIME" -lt 5 ]]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') KILL idle orphan PID=$PID (alive=${ETIME}s, cpu=${CPUTIME}s)" >> "$LOG"
    kill -TERM "$PID" 2>/dev/null || true
    ((KILLED++)) || true
    continue
  fi

  # If process has --resume flag and has been alive >15 min = old conversation
  CMDLINE=$(cat "/proc/$PID/cmdline" 2>/dev/null | tr '\0' ' ')
  if [[ "$CMDLINE" == *"--resume"* && "$ETIME" -gt 900 ]]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') KILL stale --resume PID=$PID (alive=${ETIME}s)" >> "$LOG"
    kill -TERM "$PID" 2>/dev/null || true
    ((KILLED++)) || true
  fi
done

if [[ "$KILLED" -gt 0 ]]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') Cleaned $KILLED orphan claude process(es)" >> "$LOG"
fi

# --- IDE Lock Cleanup ---
# Remove stale lock files where the VS Code server PID no longer exists
IDE_LOCK_DIR="$HOME/.claude/ide"
LOCKS_CLEANED=0

if [ -d "$IDE_LOCK_DIR" ]; then
  for LOCKFILE in "$IDE_LOCK_DIR"/*.lock; do
    [ -f "$LOCKFILE" ] || continue
    LOCK_PID=$(jq -r '.pid // empty' "$LOCKFILE" 2>/dev/null || echo "")
    if [ -z "$LOCK_PID" ]; then
      rm -f "$LOCKFILE"
      ((LOCKS_CLEANED++)) || true
      continue
    fi
    if ! kill -0 "$LOCK_PID" 2>/dev/null; then
      echo "$(date '+%Y-%m-%d %H:%M:%S') REMOVE stale IDE lock $(basename "$LOCKFILE") (pid=$LOCK_PID dead)" >> "$LOG"
      rm -f "$LOCKFILE"
      ((LOCKS_CLEANED++)) || true
    fi
  done
  if [ "$LOCKS_CLEANED" -gt 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Cleaned $LOCKS_CLEANED stale IDE lock(s)" >> "$LOG"
  fi
fi

# --- Stale Subagent Counter Cleanup ---
# Remove counter files for sessions that no longer exist
COUNTERS_CLEANED=0
for CFILE in /tmp/claude-agent-count-*; do
  [ -f "$CFILE" ] || continue
  CPID="${CFILE##*count-}"
  if [ -n "$CPID" ] && ! kill -0 "$CPID" 2>/dev/null; then
    rm -f "$CFILE"
    ((COUNTERS_CLEANED++)) || true
  fi
done
if [ "$COUNTERS_CLEANED" -gt 0 ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') Cleaned $COUNTERS_CLEANED stale agent counter(s)" >> "$LOG"
fi

# Rotate log if >1MB
if [[ -f "$LOG" ]] && [[ $(stat -c%s "$LOG" 2>/dev/null || echo 0) -gt 1048576 ]]; then
  tail -100 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi
