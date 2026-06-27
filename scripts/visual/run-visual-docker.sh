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

# NB : ce tag est DUPLIQUÉ dans .github/workflows/visual-gate.yml (step purge) — bumper les deux.
IMAGE="mcr.microsoft.com/playwright:v1.61.0-noble"   # doit matcher @playwright/test (1.61.0)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"

# Garde-fou capture (B4) : `--update-snapshots` ne doit JAMAIS écrire des baselines contre un
# runtime ≠ env du gate (PREPROD:3200). Capturer contre DEV:3000 (build Vite dev) produit des
# hauteurs de contenu différentes du build prod → baselines flaky (cf. README « env de capture »).
for arg in "$@"; do
  if [ "$arg" = "--update-snapshots" ] && [ "$BASE_URL" != "http://localhost:3200" ]; then
    echo "ERREUR: --update-snapshots exige PLAYWRIGHT_BASE_URL=http://localhost:3200 (l'env du gate)." >&2
    echo "  Les baselines de gate se capturent via le workflow (capture_baselines=true), pas en local." >&2
    echo "  Voir frontend/tests/visual/README.md (« l'env de capture DOIT == l'env de gate »)." >&2
    exit 1
  fi
done

# `--user`+`HOME=/tmp` : Playwright tourne en tant qu'utilisateur HÔTE (pas root) → les artefacts
# écrits dans le workspace monté (test-results/, et snapshots/ en --update-snapshots) appartiennent
# au runner, donc le `clean: true` du checkout CI suivant ne casse PAS en EACCES, et la copie locale
# des baselines ne bute pas sur des fichiers root. Chromium tourne sans sandbox (chromiumSandbox défaut
# = false) → non-root OK (vérifié empiriquement dans l'image noble pinnée).
exec docker run --rm --network host \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -v "${REPO_ROOT}:/work" -w /work/frontend \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  -e PLAYWRIGHT_BASE_URL="${BASE_URL}" \
  -e CI=1 \
  "${IMAGE}" \
  npx playwright test --config=tests/visual/playwright.visual.config.ts "$@"
