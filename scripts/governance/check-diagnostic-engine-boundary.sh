#!/usr/bin/env bash
# Diagnostic engine boundary check — PR-D (Diagnostic Control Plane V1).
#
# Blocks NEW cross-module imports from
# `backend/src/modules/diagnostic-engine/engines/` to other backend modules.
# The engines must stay self-contained for D7 (Diagnostic) — any cross-domain
# call has to go through the ports declared in PR-A.1
# (`backend/src/modules/diagnostic-engine/ports/`).
#
# Why pure bash + grep instead of ast-grep / dep-cruiser :
#   - ast-grep TS templates struggle with import-path regex matching across
#     module siblings.
#   - dep-cruiser config (`.dependency-cruiser.generated.cjs`) is auto-gen
#     from `.spec/00-canon/repository-registry/architecture.yaml` whose
#     BoundarySchema V1 has no `pathNot` / `via` support (would need a
#     schema bump + L4 ADR per the file's doctrine).
#   - A 30-line bash script gets us the gate today without governance churn ;
#     V1.5 can promote this to the BoundarySchema once it gains `via:` syntax.
#
# Canon refs : feedback_verify_existing_first (reuse existing audit.yml step),
# guard-hierarchy-stop-at-v1-funnel-truth (enforcement at L2).

set -euo pipefail

ENGINE_DIR="backend/src/modules/diagnostic-engine/engines"

# Grandfathered V1 exception : extract to D6 in V1.5 evidence-gated.
# Each entry = literal import path that grep -F matches. Adding entries
# requires an inline TODO with the V1.5 plan reference.
ALLOWLIST=(
  "../../rag-proxy/rag-proxy.service"  # rag-enrichment.engine.ts → EditorialPort impl V1.5
)

# Build a single grep -F pattern from the allowlist.
allow_grep_args=()
for entry in "${ALLOWLIST[@]}"; do
  allow_grep_args+=("-e" "${entry}")
done

# Search for any `from '../../...` imports in the engines.
raw=$(grep -rnE "from\s+['\"]\.\./\.\./" "${ENGINE_DIR}" 2>/dev/null || true)

if [ -z "${raw}" ]; then
  echo "✓ Diagnostic engine boundary clean — no cross-module imports."
  exit 0
fi

# Drop allowlisted entries (only when the allowlist isn't empty).
if [ ${#allow_grep_args[@]} -gt 0 ]; then
  violations=$(printf '%s\n' "${raw}" | grep -vF "${allow_grep_args[@]}" || true)
else
  violations="${raw}"
fi

if [ -z "${violations}" ]; then
  echo "✓ Diagnostic engine boundary clean — only allowlisted cross-imports."
  exit 0
fi

echo "❌ Diagnostic engine boundary violation(s):"
echo
echo "${violations}"
echo
echo "Engines under ${ENGINE_DIR} MUST NOT import sibling modules directly."
echo "Use the ports declared in backend/src/modules/diagnostic-engine/ports/"
echo "(canon PR-A.1 — ddd-bounded-contexts-anti-god-engine)."
echo
echo "If the import is truly unavoidable, add it to the ALLOWLIST in this"
echo "script with a TODO referencing the V1.5 extraction plan."
exit 1
