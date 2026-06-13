#!/usr/bin/env bash
#
# clean-stale-watchers.sh — reap stale/orphaned `npm run dev` watcher processes
# for THIS repo before a fresh `npm run dev` starts.
#
# Wire it as the backend `predev` hook so every `npm run dev` begins from a clean
# slate (npm runs `predev` to completion before `dev`):
#
#     "predev": "bash ../scripts/ops/clean-stale-watchers.sh",
#
# WHY THIS EXISTS
# ---------------
# A previous `npm run dev` whose top-level npm / terminal was killed (closed tab,
# SIGHUP, crash) can leave its children orphaned — reparented to init (PPID=1):
# `run-p`, `tsc --build --watch`, `tsc-alias -p tsconfig.json --watch`, `nodemon`,
# `wait-and-start.js`. The dangerous one is a *second* `tsc-alias --watch`: two
# `tsc-alias` processes rewrite the SAME `dist/*.js` in place, and when one reads a
# file the other (or `tsc`) is mid-emit, the file is truncated to 0 bytes. NestJS
# then boots into a misleading
#
#     A circular dependency has been detected inside <Module>
#
# because a provider/controller in the module's providers[]/controllers[] array
# resolves to `undefined` (require() of the 0-byte .js returns `{}`). This 0-byte
# truncation crash was observed 4 times in 16 days (2026-05-22, 2026-06-05,
# 2026-06-07, 2026-06-13), each traced to duplicate watcher processes racing the
# same dist.
#
# This script enforces the single-watcher invariant on the DEV box: kill any
# pre-existing repo watcher so the incoming `npm run dev` is the only writer.
#
# SAFETY
# ------
#   * Repo-scoped: only matches watchers launched from THIS repo's node_modules/.bin
#     (and `wait-and-start.js` whose cwd is under this repo). It never touches the
#     VS Code tsserver, other projects' watchers, or unrelated node processes.
#   * DEV-only by construction: CI and Docker run `build` / `start:prod`, never `dev`,
#     so this hook is inert there.
#   * Idempotent: a clean machine (no prior watchers) is a no-op clean exit.
#   * `--dry-run` lists what would be killed without sending any signal.
#
# Usage: clean-stale-watchers.sh [--dry-run]

set -uo pipefail

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

# Repo root = two levels up from this script (scripts/ops/ -> repo root).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BIN="${REPO_ROOT}/node_modules/.bin"
SELF=$$

log() { echo "[clean-stale-watchers] $*"; }

candidates=()

# (1) run-p / tsc / tsc-alias / nodemon launched from THIS repo's node_modules/.bin
while IFS= read -r pid; do
  [ -n "$pid" ] || continue
  [ "$pid" = "$SELF" ] && continue
  candidates+=("$pid")
done < <(pgrep -f "${BIN}/(run-p|tsc|tsc-alias|nodemon)" 2>/dev/null || true)

# (2) wait-and-start.js whose working directory is under this repo
while IFS= read -r pid; do
  [ -n "$pid" ] || continue
  [ "$pid" = "$SELF" ] && continue
  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  case "$cwd" in
    "$REPO_ROOT" | "$REPO_ROOT"/*) candidates+=("$pid") ;;
  esac
done < <(pgrep -f 'wait-and-start\.js' 2>/dev/null || true)

# Dedup. Guard against empty array under `set -u`.
pids=()
if [ "${#candidates[@]}" -gt 0 ]; then
  mapfile -t pids < <(printf '%s\n' "${candidates[@]}" | sort -un)
fi

if [ "${#pids[@]}" -eq 0 ]; then
  log "no stale repo watchers found — clean start."
  exit 0
fi

log "found ${#pids[@]} stale repo watcher process(es):"
for pid in "${pids[@]}"; do
  printf '  pid=%-8s ppid=%-8s start=%s :: %s\n' \
    "$pid" \
    "$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')" \
    "$(ps -o lstart= -p "$pid" 2>/dev/null)" \
    "$(ps -o args= -p "$pid" 2>/dev/null | cut -c1-90)"
done

if [ "$DRY_RUN" -eq 1 ]; then
  log "(--dry-run) no processes killed."
  exit 0
fi

# Graceful SIGTERM, then SIGKILL any straggler.
for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
sleep 2
for pid in "${pids[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    log "SIGKILL straggler $pid"
    kill -9 "$pid" 2>/dev/null || true
  fi
done

log "cleaned ${#pids[@]} stale watcher(s) — proceeding to a single-watcher start."
exit 0
