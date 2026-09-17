#!/usr/bin/env bash
# Test de clean-orphan-claude.sh — prouve les deux sens :
#   un vrai orphelin est tué, une session vivante est préservée.
# Né de l'incident 2026-09-17 09:30:01 : les critères « temps CPU » et « --resume »
# avaient tué 4 sessions Claude actives.
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/clean-orphan-claude.sh"
MARKER="orphan-cleaner-test-$$"
LOG=$(mktemp)
FAIL=0

cleanup() { pkill -f "$MARKER" 2>/dev/null || true; rm -f "$LOG"; }
trap cleanup EXIT

check() { # check <description> <attendu: vivant|mort> <pid>
  local desc="$1" expect="$2" pid="$3" actual
  if kill -0 "$pid" 2>/dev/null; then actual="vivant"; else actual="mort"; fi
  if [[ "$actual" == "$expect" ]]; then
    echo "  ok   — $desc ($actual)"
  else
    echo "  ÉCHEC — $desc : attendu $expect, obtenu $actual"; FAIL=1
  fi
}

# A. Vrai orphelin : réattaché à init et entrée standard fermée.
# `--fork` est OBLIGATOIRE : dans un script non interactif, les tâches de fond ne sont
# pas chefs de groupe, donc `setsid` seul n'appelle pas fork() et le parent reste vivant.
setsid --fork bash -c "exec -a $MARKER-orphelin sleep 300" 0<&- >/dev/null 2>&1 &
sleep 0.5
PID_ORPHELIN=$(pgrep -f "$MARKER-orphelin" | head -1)

# B. Session vivante : parent vivant, et cmdline contenant --resume
#    (l'ancien script la tuait sur ce seul motif).
bash -c "exec -a '$MARKER-vivant --resume' sleep 300" >/dev/null 2>&1 &
PID_VIVANT=$!
sleep 0.3

# C. Réattaché à init MAIS entrée encore reliée à un tube détenu : à préserver.
setsid --fork bash -c "exec -a $MARKER-relie sleep 300" < <(sleep 30) >/dev/null 2>&1 &
sleep 0.5
PID_RELIE=$(pgrep -f "$MARKER-relie" | head -1)

echo "PID orphelin=$PID_ORPHELIN vivant=$PID_VIVANT relié=$PID_RELIE"
CLAUDE_ORPHAN_PATTERN="$MARKER" CLAUDE_ORPHAN_LOG="$LOG" bash "$SCRIPT"
sleep 0.5

check "un vrai orphelin (entrée fermée, PPID 1) est supprimé" mort "$PID_ORPHELIN"
check "une session vivante avec --resume est préservée"      vivant "$PID_VIVANT"
check "un processus PPID 1 encore relié est préservé"         vivant "$PID_RELIE"

if [[ "$FAIL" == "0" ]]; then echo "TOUS LES TESTS PASSENT"; else echo "TESTS EN ÉCHEC"; fi
exit "$FAIL"
