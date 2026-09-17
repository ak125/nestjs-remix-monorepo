#!/usr/bin/env bash
# clean-orphan-claude.sh — Kill orphan Claude Code processes
# Runs via cron every 5 minutes to prevent RAM accumulation
# Each orphan session = ~500 MB (claude + shadcn MCP + supabase MCP)
#
# Un orphelin, c'est un processus dont le parent est mort : il a ete rattache a PID 1
# et plus personne ne tient l'autre bout de son entree standard. Ni la duree de vie, ni
# le temps CPU, ni le drapeau --resume ne disent quoi que ce soit la-dessus : une session
# active qui attend un export de 40 min est « inactive » au sens CPU, et Claude Code relance
# toute session reprise avec --resume. Ces deux criteres tuaient donc des sessions vivantes.
set -euo pipefail

LOG="/tmp/claude-orphan-cleanup.log"
KILLED=0
MIN_AGE_S=600  # ne juger qu'un processus deja installe, pour laisser un demarrage se rattacher

# Get all claude binary PIDs
mapfile -t CLAUDE_PIDS < <(pgrep -f 'native-binary/claude' 2>/dev/null || true)

if [[ ${#CLAUDE_PIDS[@]} -le 1 ]]; then
  exit 0  # 0 or 1 process = nothing to clean
fi

# Inventaire unique des inodes de pipe/socket ouverts par TOUS les processus.
# Si l'inode de l'entree standard d'un claude n'apparait qu'une fois, c'est le sien seul :
# le pair (extensionHost, terminal, ssh) a disparu.
declare -A FD_HOLDERS=()
while read -r target; do
  [[ -z "$target" ]] && continue
  FD_HOLDERS["$target"]=$(( ${FD_HOLDERS["$target"]:-0} + 1 ))
done < <(find /proc -maxdepth 3 -path '/proc/[0-9]*/fd/*' -type l -printf '' -exec readlink {} \; 2>/dev/null \
         | grep -E '^(pipe|socket):' || true)

for PID in "${CLAUDE_PIDS[@]}"; do
  [[ -z "$PID" ]] && continue
  [[ ! -d "/proc/$PID" ]] && continue

  # 1. stdin inaccessible = orphelin certain
  if ! ls -l "/proc/$PID/fd/0" &>/dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') KILL orphan PID=$PID (fd/0 gone)" >> "$LOG"
    kill -TERM "$PID" 2>/dev/null || true
    ((KILLED++)) || true
    continue
  fi

  # 2. rattache a PID 1 ET plus personne au bout de son entree standard
  PPID_OF=$(ps -o ppid= -p "$PID" 2>/dev/null | tr -d ' ')
  [[ "$PPID_OF" != "1" ]] && continue

  ETIME=$(ps -o etimes= -p "$PID" 2>/dev/null | tr -d ' ')
  [[ -z "$ETIME" || "$ETIME" -lt "$MIN_AGE_S" ]] && continue

  STDIN_TARGET=$(readlink "/proc/$PID/fd/0" 2>/dev/null || true)
  # entree standard hors pipe/socket (/dev/null d'un `claude -p` detache, tty) : on ne juge pas
  [[ "$STDIN_TARGET" =~ ^(pipe|socket): ]] || continue

  if [[ "${FD_HOLDERS[$STDIN_TARGET]:-0}" -eq 1 ]]; then  # exactement lui-meme ; 0 = inventaire muet -> on ne tue pas
    echo "$(date '+%Y-%m-%d %H:%M:%S') KILL orphan PID=$PID (PPID=1, ${STDIN_TARGET} sans pair, alive=${ETIME}s)" >> "$LOG"
    kill -TERM "$PID" 2>/dev/null || true
    ((KILLED++)) || true
  fi
done

if [[ "$KILLED" -gt 0 ]]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') Cleaned $KILLED orphan claude process(es)" >> "$LOG"
fi
