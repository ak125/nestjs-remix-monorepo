#!/usr/bin/env bash
# clean-orphan-claude.sh — Kill ORPHAN Claude Code processes (RAM reclaim)
#
# Un orphelin = son client est mort : le processus a été réattaché à init (PPID 1)
# ET son entrée standard ne mène plus à personne (tube sans autre détenteur, ou fd/0
# disparu). Les deux conditions sont requises : elles décrivent un état, jamais une
# habitude d'usage.
#
# INTERDIT ICI (incident 2026-09-17 09:30:01, 4 sessions vivantes tuées) :
#   - le temps CPU ("vivant > 600 s avec < 5 s de CPU") : une session qui attend un
#     agent, un export ou une longue requête est inactive au sens CPU, pas orpheline ;
#   - le drapeau `--resume` ("vivant > 900 s") : Claude Code reprend TOUTES ses
#     sessions avec `--resume`, donc ce critère tue le travail en cours.
# Voir la mémoire reference_clean_orphan_claude_kills_live_resumed_sessions.
#
# Usage : clean-orphan-claude.sh [--dry-run] [--verbose]
set -euo pipefail

LOG="${CLAUDE_ORPHAN_LOG:-/tmp/claude-orphan-cleanup.log}"
DRY_RUN=0
VERBOSE=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --verbose) VERBOSE=1 ;;
    *) echo "usage: $0 [--dry-run] [--verbose]" >&2; exit 2 ;;
  esac
done

KILLED=0
# Motif surchargeable pour les tests (jamais en production : valeur par défaut figée).
CLAUDE_PATTERN="${CLAUDE_ORPHAN_PATTERN:-native-binary/claude}"
mapfile -t CLAUDE_PIDS < <(pgrep -f "$CLAUDE_PATTERN" 2>/dev/null || true)

# Le tube d'entrée d'un processus vivant est détenu par au moins un autre processus
# (l'hôte d'extension, le terminal…). Sans détenteur, plus personne ne lit sa sortie.
pipe_has_peer() {
  local pipe="$1" self="$2" fd
  for fd in /proc/[0-9]*/fd/*; do
    [[ "$fd" == /proc/"$self"/fd/* ]] && continue
    [[ "$(readlink "$fd" 2>/dev/null)" == "$pipe" ]] && return 0
  done
  return 1
}

for PID in "${CLAUDE_PIDS[@]}"; do
  [[ -z "$PID" || ! -d "/proc/$PID" ]] && continue

  PPID_VAL=$(ps -o ppid= -p "$PID" 2>/dev/null | tr -d ' ')
  [[ -z "$PPID_VAL" ]] && continue

  # Condition 1 — le parent vit encore : ce n'est pas un orphelin, on ne touche à rien.
  if [[ "$PPID_VAL" != "1" ]]; then
    [[ "$VERBOSE" == "1" ]] && echo "GARDE PID=$PID (parent vivant PPID=$PPID_VAL)"
    continue
  fi

  # Condition 2 — l'entrée standard ne mène plus à personne.
  STDIN_TARGET=$(readlink "/proc/$PID/fd/0" 2>/dev/null || true)
  REASON=""
  if [[ -z "$STDIN_TARGET" ]]; then
    REASON="fd/0 disparu"
  elif [[ "$STDIN_TARGET" == pipe:* ]] && ! pipe_has_peer "$STDIN_TARGET" "$PID"; then
    REASON="tube d'entrée sans détenteur ($STDIN_TARGET)"
  fi

  if [[ -z "$REASON" ]]; then
    [[ "$VERBOSE" == "1" ]] && echo "GARDE PID=$PID (PPID 1 mais entrée encore reliée : ${STDIN_TARGET:-?})"
    continue
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "SIMULATION — tuerait PID=$PID ($REASON)"
    continue
  fi

  echo "$(date '+%Y-%m-%d %H:%M:%S') KILL orphan PID=$PID ($REASON)" >> "$LOG"
  kill -TERM "$PID" 2>/dev/null || true
  KILLED=$((KILLED + 1))
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
