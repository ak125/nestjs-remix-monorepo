#!/usr/bin/env bash
# check-aec-hash.sh — contrôle d'une copie de l'AEC dans le monorepo, local et sans réseau.
#
# Usage :
#   scripts/ci/check-aec-hash.sh <chemin-de-la-copie>
#
# Deux contrôles, tous deux contre les fichiers du checkout :
#   1. scripts/canon/compute-canon-hashes.py --check : le manifeste
#      .spec/00-canon/canon-distribution/canon-hashes.json et toutes les copies du
#      monorepo sont conformes aux sources du même dossier ;
#   2. la copie nommée est déclarée au manifeste (clé `aec`, ce dépôt). Une copie non
#      déclarée ne fait pas foi (journal des principes, P30) : la déclarer dans CANONS
#      du générateur, ou la retirer du workflow.
#
# Appelé par .github/workflows/agent-exit-contract-hash.yml, une fois par copie.
# Source de la règle : AEC §« Distribution canonique ».

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <chemin-de-la-copie>" >&2
  exit 2
fi

copy="$1"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
manifest="${root}/.spec/00-canon/canon-distribution/canon-hashes.json"
canon_key="aec"

python3 "${root}/scripts/canon/compute-canon-hashes.py" --check

if ! jq -e --arg path "${copy}" --arg key "${canon_key}" \
  '.canons[$key].consumers | any(.repo == "ak125/nestjs-remix-monorepo" and .path == $path)' \
  "${manifest}" >/dev/null; then
  echo "::error::${copy} n'est pas une copie déclarée du canon '${canon_key}' dans ${manifest#"${root}/"}" >&2
  exit 1
fi

echo "OK — ${copy} : copie déclarée du canon '${canon_key}', conforme à sa source"
