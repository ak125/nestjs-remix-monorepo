#!/usr/bin/env bash
#
# install-dev-service.sh — DEV:3000 supervisé par systemd (unit utilisateur).
#
#   bash /opt/automecanik/app/scripts/ops/install-dev-service.sh [status|install|switch|uninstall]
#
# POURQUOI : le stack DEV:3000 (`npm run dev` du backend) tournait dans un terminal
# VS Code. Fermer ce terminal, perdre la session SSH ou redémarrer la machine
# l'arrêtait, et rien ne le relançait : sync-dev-runtime.sh ne fait qu'alerter.
# Sous systemd, le stack vit dans un cgroup : un arrêt ou un redémarrage tue tout
# l'arbre (aucun watcher orphelin ne réécrit dist/ à côté du stack suivant),
# Restart=on-failure relance le stack, et le journal garde sa sortie :
#   journalctl --user -u automecanik-dev -f
#
#   status     (défaut) unit installée et à jour, état systemd, stacks DEV lancés
#              hors du service, /health. Ne modifie rien.
#   install    copie l'unit du dépôt et recharge systemd ; n'active ni ne démarre rien.
#   switch     install, puis arrête les stacks DEV de ce checkout lancés hors du
#              service (terminal, orphelins), active et démarre le service, attend
#              /health = 200.
#   uninstall  arrête et désactive le service, retire l'unit. Retour au terminal :
#              cd /opt/automecanik/app/backend && npm run dev
#
# `switch` coupe DEV:3000 pendant le premier build (1 à 3 min) et arrête le stack
# lancé depuis un terminal : commande du propriétaire, pas d'un agent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
UNIT_NAME="automecanik-dev.service"
UNIT_SRC="${REPO_ROOT}/scripts/ops/${UNIT_NAME}"
UNIT_DST="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/${UNIT_NAME}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/health}"
# Lancé hors session graphique (SSH sans PAM systemd, cron), systemctl --user ne
# trouve pas le bus du gestionnaire utilisateur sans ce chemin.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

log() { echo "[install-dev-service] $*"; }
die() { echo "[install-dev-service] ERREUR: $*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] || die "à lancer avec l'utilisateur du stack DEV, pas root (unit utilisateur)"
[ -f "$UNIT_SRC" ] || die "unit absente : $UNIT_SRC"

# Le backend servi est celui de l'unit, pas celui du script.
BACKEND_DIR=$(sed -n 's/^WorkingDirectory=//p' "$UNIT_SRC")
[ -n "$BACKEND_DIR" ] || die "WorkingDirectory absent de $UNIT_SRC"

# install et switch copient l'unit de CE checkout : depuis un worktree, ce serait
# installer une version non fusionnée pour servir un autre répertoire.
require_served_checkout() {
  [ "${REPO_ROOT}/backend" = "$BACKEND_DIR" ] \
    || die "lancer depuis le checkout servi ($(dirname "$BACKEND_DIR")), pas depuis $REPO_ROOT"
}

unit_cgroup() { systemctl --user show "$UNIT_NAME" -p ControlGroup --value 2>/dev/null || true; }

# Processus du stack DEV de BACKEND_DIR qui ne tournent pas dans le cgroup du
# service : stack lancé depuis un terminal, ou orphelins d'un stack mort. Tous ont
# backend/ pour cwd ; le motif écarte le shell du terminal et les autres commandes
# lancées depuis ce répertoire.
stray_stack_pids() {
  local ucg pid cmd
  ucg=$(unit_cgroup)
  while read -r pid cmd; do
    case "$cmd" in
      "npm run dev"|"npm run dev:"*|*"run-p dev:"*|*"tsc --build"*|*tsc-alias*|*dev-compile-watch.js*|*wait-and-start.js*|*nodemon*|*"dist/main"*) ;;
      *) continue ;;
    esac
    [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" = "$BACKEND_DIR" ] || continue
    if [ -n "$ucg" ] && [ "$(sed -n 's/^0:://p' "/proc/$pid/cgroup" 2>/dev/null)" = "$ucg" ]; then
      continue
    fi
    echo "$pid"
  done < <(ps -eo pid=,args=)
}

health_code() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" 2>/dev/null || true; }

cmd_status() {
  if [ ! -f "$UNIT_DST" ]; then
    log "unit : non installée ($UNIT_DST)"
  elif cmp -s "$UNIT_SRC" "$UNIT_DST"; then
    log "unit : installée, identique au dépôt"
  else
    log "unit : installée, DIFFÉRENTE de $UNIT_SRC (relancer install)"
  fi
  [ -e "${UNIT_DST}.disabled" ] && log "note : ${UNIT_DST}.disabled présent (ancienne unit renommée, ignorée par systemd, laissée en place)"
  log "systemd : $(systemctl --user show "$UNIT_NAME" -p LoadState -p ActiveState -p SubState -p UnitFileState -p NRestarts 2>&1 | tr '\n' ' ')"
  log "linger : $(loginctl show-user "$(id -un)" -p Linger --value 2>/dev/null || echo inconnu) (yes = le service survit à la déconnexion)"
  local pids
  pids=$(stray_stack_pids)
  if [ -n "$pids" ]; then
    log "stack DEV hors du service ($BACKEND_DIR) :"
    # shellcheck disable=SC2086
    ps -o pid=,ppid=,etime=,args= -p $(echo $pids | tr ' ' ',') | sed 's/^/    /' || true
  else
    log "stack DEV hors du service : aucun"
  fi
  log "health : $(health_code) ($HEALTH_URL)"
}

cmd_install() {
  require_served_checkout
  mkdir -p "$(dirname "$UNIT_DST")"
  install -m 0644 "$UNIT_SRC" "$UNIT_DST"
  systemctl --user daemon-reload
  log "unit installée : $UNIT_DST (ni activée ni démarrée)"
}

cmd_switch() {
  require_served_checkout
  [ "$(loginctl show-user "$(id -un)" -p Linger --value 2>/dev/null || true)" = "yes" ] \
    || log "ATTENTION : linger désactivé — le service s'arrêtera à la dernière déconnexion (loginctl enable-linger $(id -un))"
  cmd_install

  local pids i
  pids=$(stray_stack_pids)
  if [ -n "$pids" ]; then
    log "arrêt du stack DEV hors service (SIGTERM) : $(echo "$pids" | tr '\n' ' ')"
    # shellcheck disable=SC2086
    kill -TERM $pids 2>/dev/null || true
    for i in $(seq 1 20); do
      [ -z "$(stray_stack_pids)" ] && break
      sleep 1
    done
    pids=$(stray_stack_pids)
    if [ -n "$pids" ]; then
      log "toujours présents après 20 s (SIGKILL) : $(echo "$pids" | tr '\n' ' ')"
      # shellcheck disable=SC2086
      kill -KILL $pids 2>/dev/null || true
      sleep 1
    fi
  fi

  # Un autre processus sur :3000 ferait crasher l'app du service en boucle :
  # wait-and-start.js ne tue que les processus de son propre backend/.
  if [ "$(systemctl --user is-active "$UNIT_NAME" 2>/dev/null || true)" != "active" ] \
     && ss -Htln 'sport = :3000' 2>/dev/null | grep -q .; then
    die ":3000 occupé par un processus hors de $BACKEND_DIR — service non démarré. Voir : ss -tlnp 'sport = :3000'"
  fi

  systemctl --user enable "$UNIT_NAME" >/dev/null
  systemctl --user restart "$UNIT_NAME"
  log "service activé et démarré — attente de /health (premier build compris, 3 min max)"
  for i in $(seq 1 36); do
    sleep 5
    if [ "$(health_code)" = "200" ]; then
      log "DEV:3000 supervisé par systemd, /health = 200 après $((i * 5)) s. Journal : journalctl --user -u automecanik-dev -f"
      return 0
    fi
  done
  die "/health ≠ 200 après 3 min — service laissé en place. Inspecter : journalctl --user -u automecanik-dev -n 100 --no-pager"
}

cmd_uninstall() {
  systemctl --user disable --now "$UNIT_NAME" 2>/dev/null || true
  rm -f "$UNIT_DST"
  systemctl --user daemon-reload
  log "service arrêté et retiré. Relance manuelle : cd $BACKEND_DIR && npm run dev"
}

case "${1:-status}" in
  status) cmd_status ;;
  install) cmd_install ;;
  switch) cmd_switch ;;
  uninstall) cmd_uninstall ;;
  *) die "usage : $0 [status|install|switch|uninstall]" ;;
esac
