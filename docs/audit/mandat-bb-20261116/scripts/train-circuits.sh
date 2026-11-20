#!/usr/bin/env bash
# Mandat BB — PROPOSITION, non installée : train ordonné pour les circuits faible et moyen.
#
#   train-circuits.sh <fichier-train> | --prs <n> [<n>...]            plan seulement (défaut)
#   train-circuits.sh --run <fichier-train> | --run --prs <n> [...]   exécution, par l'owner uniquement
#
# But : payer une seule fois la règle « branche à jour ». Une PR à la fois, dans l'ordre : mise à jour
# par `resync-pr.sh` (le script existant, inchangé), puis attente de la fusion. Le push du resync
# déclenche `merge-circuits.yml` ; c'est son job « 🔐 Armement » (App, environnement `app-actions`)
# qui arme la fusion sur la nouvelle tête, et GitHub qui fusionne quand les contrôles requis sont
# verts. Ce script n'appelle JAMAIS `gh pr merge` : il n'arme rien et ne fusionne rien. Il ne
# contourne aucun contrôle : une PR de circuit élevé, rouge, en brouillon ou en conflit est laissée
# à l'owner (`merge-pr.sh`), et le train s'arrête à la première PR qui ne fusionne pas, comme
# `merge-train.sh` (l'ordre peut porter des PR empilées).
#
# Seul le mode plan a été essayé (2026-11-16). Le mode --run pousse sur des branches de PR et
# provoque des fusions par le workflow : il est refusé dans une session d'agent.
set -euo pipefail
REPO="${REPO:-ak125/nestjs-remix-monorepo}"
RESYNC="${RESYNC:-/home/deploy/resync/resync-pr.sh}"
PREFLIGHT="$(dirname "$0")/train-preflight.sh"
WAIT_MIN="${WAIT_MIN:-25}"     # attente maximale d'une fusion après un resync (passage mesuré : 8 à 9 min)
MAX_PASSES=3                   # même borne que merge-pr.sh quand main bouge pendant l'attente

run=false
[ "${1:-}" = "--run" ] && { run=true; shift; }
prs=()
if [ "${1:-}" = "--prs" ]; then shift; prs=("$@")
elif [ -n "${1:-}" ] && [ -f "$1" ]; then while read -r n _; do [[ "$n" =~ ^[0-9]+$ ]] && prs+=("$n"); done < "$1"
else sed -n '2,6p' "$0" >&2; exit 2; fi
[ "${#prs[@]}" -gt 0 ] || { echo "aucune PR" >&2; exit 2; }
if $run && [ -n "${CLAUDECODE:-}${CLAUDE_CODE_ENTRYPOINT:-}" ]; then
  echo "refus : --run est réservé à l'owner (session d'agent détectée)" >&2; exit 2
fi

verdict_of() { "$PREFLIGHT" --prs "$1" 2>/dev/null | sed -n '2,3p' || true; }   # lecture seule

for n in "${prs[@]}"; do
  out=$(verdict_of "$n"); v=$(awk 'NR==1 {print $2}' <<<"$out"); circuit=$(sed -n '1s/.*circuit=\([^ ]*\).*/\1/p' <<<"$out")
  echo "$out"
  case "$v" in
    FUSIONNEE) continue ;;
    PRETE|ATTENDRE) ;;
    *) echo "→ #$n laissée de côté : à corriger ou à traiter par l'owner. Arrêt du train."; exit 1 ;;
  esac
  case "$circuit" in
    faible|moyen) ;;
    *) echo "→ #$n : circuit « $circuit » : approbation et fusion par l'owner (merge-pr.sh). Arrêt du train."; exit 1 ;;
  esac
  if ! $run; then
    echo "→ plan : $RESYNC $n ; attente de la fusion armée par merge-circuits.yml (≤ $WAIT_MIN min) ; PR suivante."
    continue
  fi
  pass=1
  "$RESYNC" "$n" || { echo "→ #$n : resync refusé. Arrêt du train."; exit 1; }
  deadline=$(( $(date +%s) + WAIT_MIN * 60 ))
  while :; do
    sleep 30
    out=$(verdict_of "$n"); v=$(awk 'NR==1 {print $2}' <<<"$out")
    case "$v" in
      FUSIONNEE) echo "→ #$n fusionnée."; break ;;
      ECARTEE|ILLISIBLE) echo "$out"; echo "→ #$n ne fusionnera pas sur cette tête. Arrêt du train."; exit 1 ;;
    esac
    if grep -q "en retard sur main" <<<"$out"; then          # main a bougé hors du train
      pass=$((pass + 1)); [ "$pass" -le "$MAX_PASSES" ] || { echo "→ #$n : $MAX_PASSES passes sans fusion. Arrêt."; exit 1; }
      "$RESYNC" "$n" || { echo "→ #$n : resync refusé. Arrêt du train."; exit 1; }
      deadline=$(( $(date +%s) + WAIT_MIN * 60 ))
    fi
    if [ "$(date +%s)" -gt "$deadline" ]; then
      echo "$out"; echo "→ #$n : pas de fusion après $WAIT_MIN min (auto-fusion non armée ?). Arrêt du train."; exit 1
    fi
  done
done
$run && echo "Train terminé." || echo "Plan terminé : rien n'a été poussé ni fusionné."
