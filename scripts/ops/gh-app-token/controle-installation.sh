#!/usr/bin/env bash
# Compare les fichiers installés du jeton GitHub App des agents (machine DEV) à leur source dans
# ce dossier, puis montre l'état du minuteur et le dernier rapport du renouvellement.
# Lecture seule : n'installe, ne démarre et ne lit aucun secret (ni clé, ni app.conf, ni hosts.yml).
#
#   bash scripts/ops/gh-app-token/controle-installation.sh
#
# Code de sortie : 0 si les quatre fichiers installés sont identiques à la source et si le minuteur
# s'est déclenché il y a 25 min au plus, 1 sinon.
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
UNITES="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
ETAT="${CRON_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/automecanik/cron}/gh-app-token-refresh.json"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

# source (dans ce dossier) → emplacement installé
PAIRES=(
  "automecanik-gh-app-token:/usr/local/libexec/automecanik-gh-app-token"
  "automecanik-gh-app-token-refresh:$HOME/.local/libexec/automecanik-gh-app-token-refresh"
  "automecanik-gh-app-token-refresh.service:$UNITES/automecanik-gh-app-token-refresh.service"
  "automecanik-gh-app-token-refresh.timer:$UNITES/automecanik-gh-app-token-refresh.timer"
)

empreinte() { if [ -r "$1" ]; then sha256sum "$1" | cut -d' ' -f1; else echo "absent-ou-illisible"; fi; }

ecarts=0
for p in "${PAIRES[@]}"; do
  src="$ICI/${p%%:*}" dst="${p#*:}"
  es=$(empreinte "$src") ei=$(empreinte "$dst")
  if [ "$es" = "$ei" ]; then verdict="identique"; else verdict="DIFFÉRENT"; ecarts=$((ecarts + 1)); fi
  printf '%-10s %s\n           source    %s\n           installé  %s  (%s)\n' \
    "$verdict" "${p%%:*}" "$es" "$ei" "$dst"
done

echo "minuteur : $(systemctl --user show automecanik-gh-app-token-refresh.timer -p ActiveState -p UnitFileState -p LastTriggerUSec 2>&1 | tr '\n' ' ')"
echo "service  : $(systemctl --user show automecanik-gh-app-token-refresh.service -p Result -p ExecMainStatus -p ExecMainExitTimestamp 2>&1 | tr '\n' ' ')"
if [ -r "$ETAT" ] && command -v jq >/dev/null 2>&1; then
  echo "rapport  : $(jq -r '"\(.status) depuis \(.since | strflocaltime("%Y-%m-%d %H:%M")) (\(.streak) exécution(s)), dernier \(.ts | strflocaltime("%Y-%m-%d %H:%M")) — \(.summary)"' "$ETAT")"
else
  echo "rapport  : aucun ($ETAT) — wrapper antérieur à la source versionnée, ou jamais lancé"
fi

# Fraîcheur du minuteur : le jeton vit 1 h et le minuteur le renouvelle toutes les 20 min. Plus de
# 25 min sans déclenchement = minuteur arrêté, ou non reparti avec le gestionnaire (18/11/2026).
SEUIL_MIN=25
alerte=0
dernier=$(LC_ALL=C systemctl --user show automecanik-gh-app-token-refresh.timer -p LastTriggerUSec --value 2>/dev/null || true)
if [ -z "$dernier" ] || [ "$dernier" = n/a ]; then
  echo "ALERTE   minuteur : aucun déclenchement connu (absent, ou pas déclenché depuis le démarrage du gestionnaire)"
  alerte=1
elif ! t=$(date -d "$dernier" +%s 2>/dev/null); then
  echo "ALERTE   minuteur : dernier déclenchement illisible ($dernier)"
  alerte=1
elif age=$((($(date +%s) - t) / 60)) && [ "$age" -gt "$SEUIL_MIN" ]; then
  echo "ALERTE   minuteur : dernier déclenchement il y a $age min (> $SEUIL_MIN min), jeton expiré ou sur le point de l'être"
  alerte=1
else
  echo "fraîcheur: dernier déclenchement il y a $age min (seuil $SEUIL_MIN min)"
fi

[ "$ecarts" -eq 0 ] || { echo "$ecarts fichier(s) installé(s) différent(s) de la source : voir README.md, « Installer ou mettre à jour »"; exit 1; }
[ "$alerte" -eq 0 ] || { echo "minuteur en retard : voir README.md, « Échec du renouvellement : où le lire »"; exit 1; }
echo "installation identique à la source, minuteur déclenché il y a $age min"
