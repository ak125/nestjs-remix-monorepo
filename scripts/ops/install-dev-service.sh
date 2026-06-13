#!/usr/bin/env bash
#
# install-dev-service.sh — make systemd the canonical supervisor of DEV:3000.
#
# Run once on the DEV box (46.224.118.55) as the deploy user. Idempotent.
#
#     bash scripts/ops/install-dev-service.sh
#
# WHY (structural fix)
# --------------------
# DEV:3000 is `npm run dev` (run-p -> tsc --build --watch + tsc-alias --watch + nodemon).
# When that command is launched from a terminal that later closes, its children are
# reparented to init (orphaned). A second `npm run dev` then runs alongside the orphans,
# and two `tsc-alias --watch` processes rewrite the SAME dist/*.js in place, truncating
# files to 0 bytes mid-emit. NestJS then crashes at boot with a misleading
# "A circular dependency has been detected inside <Module>". Seen 4x in 16 days.
#
# systemd runs the whole tree in one cgroup and `KillMode=control-group` tears the entire
# cgroup down on stop/restart — so a watcher can never be orphaned. `Restart=on-failure`
# also auto-recovers a crash. This makes the failure mode structurally impossible instead
# of merely cleaned-up after the fact.
#
# Cutover is brief (~15s :3000 downtime) and reversible:
#   systemctl --user stop automecanik-dev   # then `cd backend && npm run dev` to go manual again
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UNIT_SRC="${REPO_ROOT}/scripts/ops/automecanik-dev.service"
UNIT_DST="${HOME}/.config/systemd/user/automecanik-dev.service"

log() { echo "[install-dev-service] $*"; }

[ -f "$UNIT_SRC" ] || { echo "missing $UNIT_SRC" >&2; exit 1; }

mkdir -p "$(dirname "$UNIT_DST")"
install -m 0644 "$UNIT_SRC" "$UNIT_DST"
log "installed unit -> $UNIT_DST"

systemctl --user daemon-reload
loginctl enable-linger "$(id -un)" >/dev/null 2>&1 || true   # service survives logout

# Clean cutover, no restart-fight:
#  (1) stop any systemd-managed instance (clean stop disables Restart),
#  (2) reap any manual/orphaned watchers still on the box,
#  (3) start fresh under systemd as the single instance.
systemctl --user stop automecanik-dev.service 2>/dev/null || true
bash "${REPO_ROOT}/scripts/ops/clean-stale-watchers.sh" || true
systemctl --user enable --now automecanik-dev.service
log "service enabled + started"

for i in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/health 2>/dev/null || echo 000)"
  log "/health=${code} (try ${i})"
  if [ "$code" = "200" ]; then
    log "DEV:3000 is now supervised by systemd. Logs: journalctl --user -u automecanik-dev -f"
    exit 0
  fi
  sleep 4
done

log "WARNING: /health not 200 after ~80s — inspect: journalctl --user -u automecanik-dev -n 80 --no-pager" >&2
exit 1
