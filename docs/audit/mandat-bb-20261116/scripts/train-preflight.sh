#!/usr/bin/env bash
# Mandat BB — contrôle préalable d'un train de fusion. LECTURE SEULE : uniquement des `gh` de lecture.
#
#   train-preflight.sh <fichier-train>        une PR par ligne : « <numéro> [<empreinte>] » (format de merge-train.sh)
#   train-preflight.sh --prs <n> [<n>...]     liste donnée sur la ligne de commande
#
# Dit, AVANT de lancer le train, quelles PR l'arrêteraient : `merge-train.sh` s'arrête à la première
# PR en échec « sans toucher aux suivantes », et `merge-pr.sh` refuse un brouillon, un conflit et
# tout check rouge ou annulé, requis ou non. Le 2026-11-15, deux arrêts de ce type ont coûté 44 et
# 78 minutes de train. Ce script ne pousse rien, ne fusionne rien, n'arme rien, ne relance rien.
#
# Sortie : 0 si toutes les PR listées sont prêtes (ou déjà fusionnées), 1 sinon, 2 sur erreur d'usage.
set -euo pipefail
REPO="${REPO:-ak125/nestjs-remix-monorepo}"
MIN_A_JOUR=2   # minutes mesurées pour une PR déjà à jour (#2084, #2086, train du 2026-11-15)
MIN_RETARD=9   # minutes mesurées pour une PR en retard : resync + contrôles + fusion (#2085 : 9,2 ; #2083 : 7,8)

prs=()
if [ "${1:-}" = "--prs" ]; then
  shift; prs=("$@")
elif [ -n "${1:-}" ] && [ -f "$1" ]; then
  while read -r n _; do [[ "$n" =~ ^[0-9]+$ ]] && prs+=("$n"); done < "$1"
else
  sed -n '2,12p' "$0" >&2; exit 2
fi
[ "${#prs[@]}" -gt 0 ] || { echo "aucune PR à contrôler" >&2; exit 2; }
for n in "${prs[@]}"; do [[ "$n" =~ ^[0-9]+$ ]] || { echo "numéro de PR invalide : $n" >&2; exit 2; }; done

# Contrôles requis : lus sur la branche (même lecture que merge-pr.sh), jamais recopiés ici.
required=$(gh api "repos/$REPO/branches/main" --jq '.protection.required_status_checks.contexts') ||
  { echo "lecture des contrôles requis impossible" >&2; exit 2; }

echo "# Contrôle préalable du train — $(date -u +%FT%TZ) — $REPO — $(jq length <<<"$required") contrôles requis"
ready=0; behind=0; bad=0
for n in "${prs[@]}"; do
  j=$(gh pr view "$n" --repo "$REPO" --json number,title,state,isDraft,mergeable,mergeStateStatus,headRefOid,labels,autoMergeRequest,statusCheckRollup) ||
    { echo "#$n  ILLISIBLE"; bad=$((bad + 1)); continue; }
  # Un seul passage jq : verdict, motif, tête, circuit.
  line=$(jq -r --argjson req "$required" '
    def nm: (.name // .context);
    def res: (.conclusion // .state // "");
    (.statusCheckRollup // []) as $c
    | ([$c[] | select(res | IN("FAILURE","CANCELLED","TIMED_OUT","ACTION_REQUIRED","STARTUP_FAILURE","ERROR"))
        | (if (nm | IN($req[])) then "REQUIS " else "" end) + nm] | unique) as $red
    | ([$c[] | select((.status // "COMPLETED") != "COMPLETED" or (.state // "") == "PENDING") | nm] | unique) as $run
    | ($req - [$c[] | nm]) as $missing
    | ([.labels[].name | select(startswith("circuit:")) | sub("^circuit:"; "")] | join(",")) as $circuit
    | (if .state == "MERGED" then ["FUSIONNEE", "déjà fusionnée : le train la saute"]
       elif .state != "OPEN" then ["ECARTEE", "PR fermée"]
       elif .isDraft then ["ECARTEE", "brouillon : merge-pr.sh la refuse"]
       elif .mergeable == "CONFLICTING" or .mergeStateStatus == "DIRTY" then ["ECARTEE", "conflit avec main : à résoudre dans la PR"]
       elif ($red | length) > 0 then ["ECARTEE", "check rouge ou annulé sur la tête : " + ($red | join(" ; "))]
       elif ($run | length) > 0 then ["ATTENDRE", "\($run | length) check(s) en cours"]
       elif ($missing | length) > 0 then ["ATTENDRE", "contrôle requis pas encore enregistré : " + ($missing | join(" ; "))]
       elif .mergeStateStatus == "BEHIND" then ["PRETE", "en retard sur main : resync puis contrôles"]
       elif .mergeStateStatus == "BLOCKED" then ["ECARTEE", "bloquée par la protection (revue de l owner requise ou conversation ouverte)"]
       else ["PRETE", "à jour (" + .mergeStateStatus + ")"] end) as $v
    | [$v[0], .headRefOid, (if $circuit == "" then "-" else $circuit end), (.autoMergeRequest != null | tostring), .mergeStateStatus, $v[1], (.title[0:60])] | @tsv' <<<"$j")
  IFS=$'\t' read -r verdict head circuit armed ms why title <<<"$line"
  printf '#%-5s %-9s circuit=%-6s auto-fusion=%-5s %s\n       tête %s — %s\n' "$n" "$verdict" "$circuit" "$armed" "$why" "$head" "$title"
  case "$verdict" in
    PRETE) ready=$((ready + 1)); [ "$ms" = "BEHIND" ] && behind=$((behind + 1)) ;;
    FUSIONNEE) : ;;
    *) bad=$((bad + 1)) ;;
  esac
done

# Après la première fusion du train, toutes les PR suivantes sont en retard sur main.
if [ "$ready" -gt 0 ]; then
  first=$MIN_RETARD; [ "$behind" -lt "$ready" ] && first=$MIN_A_JOUR
  echo "## $ready PR prête(s), $bad à écarter ou à attendre. Durée estimée du train : ≈ $((first + (ready - 1) * MIN_RETARD)) min" \
       "(≈ $MIN_RETARD min par PR en retard ; toute PR devient en retard dès la fusion précédente)."
else
  echo "## Aucune PR prête ; $bad à écarter ou à attendre."
fi
[ "$bad" -eq 0 ]
