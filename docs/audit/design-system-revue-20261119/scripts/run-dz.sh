#!/usr/bin/env bash
# Mandat DZ — lance les mesures, une à la fois (pas de parallélisme : machine partagée), chacune avec un délai maximal.
# Usage (depuis docs/audit/design-system-revue-20261119) :
#   NODE_PATH=/opt/automecanik/app/node_modules bash scripts/run-dz.sh [mesure|reflow|selecteur|feuilles|focus-marque|verif|synthese|tout] [motif-id]
# motif-id (facultatif) : ne traite que les pages dont l'identifiant correspond (ex. "r0|r1").
# Outils : Playwright 1.61.1 et axe-core 4.12.1 de /opt/automecanik/app/node_modules (aucune installation).
set -u
cd "$(dirname "$0")/.."
: "${NODE_PATH:=/opt/automecanik/app/node_modules}"; export NODE_PATH
what="${1:-tout}"; filtre="${2:-.}"
pages() { grep -E "^($filtre)" scripts/pages-dz.tsv; }
if [[ "$what" == mesure || "$what" == tout ]]; then
  pages | while IFS=$'\t' read -r id route; do
    for vp in "390 844" "1440 900"; do timeout 140 node scripts/mesure-dz.cjs "$id" "$route" $vp . 2>&1 | tail -1; done
  done
fi
if [[ "$what" == reflow || "$what" == tout ]]; then
  pages | while IFS=$'\t' read -r id route; do timeout 120 node scripts/reflow-dz.cjs "$id" "$route" . 2>&1 | tail -1; done
fi
if [[ "$what" == selecteur || "$what" == tout ]]; then
  for id_route in "r0-accueil /" "r1-gamme /pieces/filtre-a-huile-7.html"; do
    set -- $id_route
    for vp in "390 844" "1440 900"; do timeout 280 node scripts/selecteur-dz.cjs "$1" "$2" $vp . 2>&1 | tail -1; done
  done
fi
if [[ "$what" == focus-marque || "$what" == tout ]]; then
  for id_route in "r0-accueil /" "r1-gamme /pieces/filtre-a-huile-7.html"; do
    set -- $id_route
    for vp in "390 844" "1440 900"; do timeout 150 node scripts/sonde-focus-marque-dz.cjs "$1" "$2" $vp . 2>&1 | tail -1; done
  done
fi
if [[ "$what" == feuilles || "$what" == tout ]]; then
  for vp in "390 844" "1440 900"; do timeout 200 node scripts/sonde-feuilles-dz.cjs r0-accueil / $vp . 2>&1 | tail -1; done
fi
if [[ "$what" == verif || "$what" == tout ]]; then
  timeout 300 node scripts/verif-manuelle-dz.cjs . 2>&1 | tail -1
  timeout 120 python3 -I scripts/verif-manuelle-dz.py .
fi
if [[ "$what" == synthese || "$what" == tout ]]; then
  node scripts/synthese-dz.cjs .
fi
