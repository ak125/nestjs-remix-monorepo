#!/usr/bin/env bash
# Applique le triage de la file (ADR-128 D1 et D6) : pose le label dept: des lignes de confiance
# « forte » marquées « garder » du tableau de docs/plans/2026-11-15-adr128-triage-file.md.
#
# À blanc par défaut : affiche les commandes, aucun appel gh. --apply : geste de l'owner, avec son
# compte. Seule écriture possible : `gh issue edit --add-label`. Le script ne ferme rien, ne retire
# aucun label, ne commente rien. Une issue fermée depuis le relevé, ou qui porte déjà un label
# dept:, est ignorée.
#
# Usage : triage-file-apply.sh [--apply] [--plan FICHIER] [--repo PROPRIETAIRE/DEPOT]
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLAN="$ICI/../../docs/plans/2026-11-15-adr128-triage-file.md"
REPO="${REPO:-ak125/nestjs-remix-monorepo}"
APPLIQUER=0

while (($#)); do
  case "$1" in
    --apply) APPLIQUER=1 ;;
    --dry-run) APPLIQUER=0 ;;
    --plan) PLAN="${2:?--plan attend un fichier}"; shift ;;
    --repo) REPO="${2:?--repo attend propriétaire/dépôt}"; shift ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "argument inconnu : $1" >&2; exit 2 ;;
  esac
  shift
done

[[ -r "$PLAN" ]] || { echo "plan illisible : $PLAN" >&2; exit 2; }
[[ "$REPO" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] || { echo "dépôt invalide : $REPO" >&2; exit 2; }

# Lignes du seul tableau « Issues ouvertes au relevé » : | #N | Créée | Titre | `dept:…` | Confiance
# | Raison | Suite | Preuve |. Toute ligne de ce tableau qui n'a pas 8 colonnes arrête le script.
LIGNES="$(awk -F'|' '
  /^## / { dans = ($0 == "## Issues ouvertes au relevé"); next }
  dans && /^\| #[0-9]+ \|/ {
    if (NF != 10) { printf "ligne mal formée (%d colonnes) : %s\n", NF - 2, $0 > "/dev/stderr"; exit 3 }
    n = $2; d = $5; c = $6; s = $8
    gsub(/[ #`]/, "", n); gsub(/[ `]/, "", d); gsub(/ /, "", c); gsub(/ /, "", s)
    if (c == "forte" && s == "garder") print n "\t" d
  }' "$PLAN")"

[[ -n "$LIGNES" ]] || { echo "aucune ligne forte + garder dans $PLAN" >&2; exit 3; }
while IFS=$'\t' read -r n d; do
  [[ "$n" =~ ^[0-9]+$ && "$d" =~ ^dept:[0-9]{2}-[a-z-]+$ ]] \
    || { echo "ligne rejetée : issue « $n », label « $d »" >&2; exit 3; }
done <<< "$LIGNES"

TOTAL="$(wc -l <<< "$LIGNES" | tr -d ' ')"
if ((APPLIQUER == 0)); then
  echo "# à blanc : $TOTAL ligne(s) forte + garder, aucun appel gh (--apply pour appliquer)"
  while IFS=$'\t' read -r n d; do
    printf 'gh issue edit %s --repo %s --add-label "%s"\n' "$n" "$REPO" "$d"
  done <<< "$LIGNES"
  exit 0
fi

POSES=0; IGNOREES=0; ECHECS=0
while IFS=$'\t' read -r n d; do
  if ! etat="$(gh issue view "$n" --repo "$REPO" --json state,labels \
                 --jq '[.state, ([.labels[].name | select(startswith("dept:"))] | join(","))] | @tsv')"; then
    echo "#$n : lecture impossible, ignorée" >&2; ECHECS=$((ECHECS + 1)); continue
  fi
  IFS=$'\t' read -r statut depts <<< "$etat"
  if [[ "$statut" != "OPEN" ]]; then
    echo "#$n : $statut depuis le relevé, ignorée"; IGNOREES=$((IGNOREES + 1)); continue
  fi
  if [[ -n "$depts" ]]; then
    echo "#$n : porte déjà $depts, ignorée"; IGNOREES=$((IGNOREES + 1)); continue
  fi
  if gh issue edit "$n" --repo "$REPO" --add-label "$d" > /dev/null; then
    echo "#$n : $d ajouté"; POSES=$((POSES + 1))
  else
    echo "#$n : échec de l'ajout de $d (le label existe-t-il ?)" >&2; ECHECS=$((ECHECS + 1))
  fi
done <<< "$LIGNES"

echo "# $POSES ajouté(s), $IGNOREES ignorée(s), $ECHECS échec(s) sur $TOTAL"
((ECHECS == 0))
