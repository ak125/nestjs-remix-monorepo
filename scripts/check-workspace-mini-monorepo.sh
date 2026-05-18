#!/usr/bin/env bash
# check-workspace-mini-monorepo.sh — ADR-061 §6 : anti-mini-monorepo workspace invariant
#
# Contexte : ADR-061 « Workspace Governance » (accepted 2026-05-13) codifie 7 invariants
# dont l'invariant §6 : un workspace root (`workspaces/<domain>/`) ne doit JAMAIS contenir
# de fichier ou répertoire qui en ferait un mini-monorepo (duplication code monorepo,
# package.json local, build config, etc.).
#
# Patterns interdits au workspace root :
#   - Fichiers : package.json, tsconfig.json, Dockerfile, Makefile, CHANGELOG.md,
#                pnpm-workspace.yaml, turbo.json, lerna.json, nx.json
#   - Répertoires : backend/, frontend/, packages/, node_modules/, dist/, build/
#
# Structure autorisée d'un workspace (§2 ADR-061) :
#   workspaces/<domain>/
#     ├── README.md      (obligatoire)
#     ├── CLAUDE.md      (obligatoire)
#     ├── AGENTS.md      (obligatoire)
#     └── .claude/
#         ├── settings.json
#         ├── canon-mirrors/      (read-only, sync par cron VPS DEV)
#         └── rules/
#
# Usage :
#   ./scripts/check-workspace-mini-monorepo.sh [repo_root]
#
# Exit 0 : aucune violation
# Exit 1 : mini-monorepo détecté (rapport stdout)
# Exit 2 : erreur (repo root missing)

set -euo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"

if [[ ! -d "$REPO_ROOT" ]]; then
  echo "Error: repo root not found: $REPO_ROOT" >&2
  exit 2
fi

cd "$REPO_ROOT"

WORKSPACES_DIR="workspaces"

if [[ ! -d "$WORKSPACES_DIR" ]]; then
  echo "PASS: no $WORKSPACES_DIR/ directory, nothing to check (ADR-061 §6 N/A)"
  exit 0
fi

FORBIDDEN_FILES=(
  "package.json"
  "tsconfig.json"
  "Dockerfile"
  "Makefile"
  "CHANGELOG.md"
  "pnpm-workspace.yaml"
  "turbo.json"
  "lerna.json"
  "nx.json"
)

FORBIDDEN_DIRS=(
  "backend"
  "frontend"
  "packages"
  "node_modules"
  "dist"
  "build"
)

VIOLATIONS=()

for workspace in "$WORKSPACES_DIR"/*/; do
  [[ -d "$workspace" ]] || continue
  ws_name="$(basename "$workspace")"

  # Fichiers interdits au root du workspace
  for forbidden in "${FORBIDDEN_FILES[@]}"; do
    if [[ -f "$workspace$forbidden" ]]; then
      VIOLATIONS+=("$workspace$forbidden — forbidden file (ADR-061 §6)")
    fi
  done

  # Répertoires interdits au root du workspace (duplication code monorepo)
  for forbidden_dir in "${FORBIDDEN_DIRS[@]}"; do
    if [[ -d "$workspace$forbidden_dir" ]]; then
      VIOLATIONS+=("$workspace$forbidden_dir/ — forbidden directory, mini-monorepo duplication (ADR-061 §6)")
    fi
  done
done

if [[ ${#VIOLATIONS[@]} -eq 0 ]]; then
  WS_COUNT="$(find "$WORKSPACES_DIR" -maxdepth 1 -mindepth 1 -type d | wc -l)"
  echo "PASS: 0 mini-monorepo violation in $WS_COUNT workspace(s) (ADR-061 §6 respected)"
  exit 0
fi

echo "FAIL: ${#VIOLATIONS[@]} mini-monorepo violation(s) detected"
echo ""
for v in "${VIOLATIONS[@]}"; do
  echo "  - $v"
done
echo ""
echo "Voir ADR-061 §6 (Anti-Mini-Monorepo) pour la liste exhaustive des patterns interdits."
echo "Un workspace doit rester pur métadonnées (README + CLAUDE + AGENTS + .claude/) — pas de duplication code, pas de build config."

exit 1
