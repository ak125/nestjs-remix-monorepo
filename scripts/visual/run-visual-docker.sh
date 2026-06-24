#!/usr/bin/env bash
# Régression visuelle DÉTERMINISTE.
#
# Exécute les tests Playwright `frontend/tests/visual` DANS l'image Docker Playwright pinnée
# (= runner CI ubuntu-24.04 / noble), pour que la génération des baselines ET les comparaisons
# ultérieures (migration Vite 8 / Rolldown, V8-1) partagent un rendu identique (polices,
# anti-aliasing). Générer ou comparer sur un poste hôte différent (ex. DEV Ubuntu 22.04 jammy)
# produirait des diffs de rendu de police → faux positifs.
#
# Usage :
#   scripts/visual/run-visual-docker.sh                    # comparer aux baselines committées
#   scripts/visual/run-visual-docker.sh --update-snapshots # (re)générer les baselines
#
# Prérequis : un runtime sert l'application sur http://localhost:3000
#   (surchargeable via PLAYWRIGHT_BASE_URL). Les régions data-driven (prix/stock) sont masquées
#   dans le spec ; le test fige la mise en page, pas le contenu.
set -euo pipefail

IMAGE="mcr.microsoft.com/playwright:v1.61.0-noble"   # doit matcher @playwright/test (1.61.0)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"

exec docker run --rm --network host \
  -v "${REPO_ROOT}:/work" -w /work/frontend \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  -e PLAYWRIGHT_BASE_URL="${BASE_URL}" \
  -e CI=1 \
  "${IMAGE}" \
  npx playwright test --config=tests/visual/playwright.visual.config.ts "$@"
