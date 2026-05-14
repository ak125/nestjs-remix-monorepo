#!/usr/bin/env bash
# scripts/audit/check-generator-determinism.sh
#
# W4 cross-Node generator determinism audit. One-shot, no CI gate.
#
# For each supported generator × supported Node major, runs the generator
# twice and reports the SHA-256 of the output artifact. Also reports the
# cross-Node-major byte-equality status where multiple majors are supported.
#
# Prints a markdown report on stdout suitable for paste into
# audit-reports/generator-determinism-*.md.
#
# Exit status:
#   0 always — W4 is informational. A divergence is reported in the table
#              but does NOT fail the script. Decisions are deferred to a
#              separate PR after human review.
#
# Reproduce:  bash scripts/audit/check-generator-determinism.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# Configuration. To extend with a new generator, append a tuple:
#   name|workspace_script|artifact_path|supported_node_majors_csv
GENERATORS=(
  "architecture|build:architecture|.spec/00-canon/_schema/architecture.schema.json|22"
  "db-contract|build:db-contract|.spec/00-canon/_schema/db.schema.json|20,22"
)

# Run a single generator inside a node:<major>-slim container and emit the
# sha256 of the produced artifact to stdout.
#
# Side effects:
#   - regenerates `_schema/*.schema.json` mirrors (gitignored — safe to leave).
#   - regenerates `.dependency-cruiser.generated.cjs` (COMMITTED). The audit
#     restores it to its committed state at the end (see RESTORE_PATHS).
#
# The generators are pure JS (zod, zod-to-json-schema, js-yaml, tsx — no
# native bindings), so a host-built node_modules works inside the
# container regardless of Node major.
run_in_node() {
  local node_major="$1"
  local workspace_script="$2"
  local artifact_path="$3"

  docker run --rm \
    -v "$REPO_ROOT:/app" \
    -w /app \
    --entrypoint /bin/sh \
    "node:${node_major}-slim" \
    -c "npm --workspace=@repo/registry run --silent ${workspace_script} >/dev/null 2>&1 \
        && sha256sum ${artifact_path} | awk '{print \$1}'" \
    2>/dev/null
}

emit_table_header() {
  cat <<'EOF'
| Generator | Node major | Run 1 SHA-256 (12) | Run 2 SHA-256 (12) | Same-Node determinism |
|---|---|---|---|---|
EOF
}

emit_cross_node_header() {
  cat <<'EOF'

| Generator | Node A | Node B | SHA-256 A (12) | SHA-256 B (12) | Cross-Node byte-equality |
|---|---|---|---|---|---|
EOF
}

emit_row() {
  local gen="$1"
  local major="$2"
  local sha1="$3"
  local sha2="$4"
  local same="$5"
  printf '| %s | %s | %s… | %s… | %s |\n' \
    "$gen" "$major" "${sha1:0:12}" "${sha2:0:12}" "$same"
}

emit_cross_row() {
  local gen="$1"
  local major_a="$2"
  local major_b="$3"
  local sha_a="$4"
  local sha_b="$5"
  local equal="$6"
  printf '| %s | %s | %s | %s… | %s… | %s |\n' \
    "$gen" "$major_a" "$major_b" "${sha_a:0:12}" "${sha_b:0:12}" "$equal"
}

# Map of "<generator>@<major>" → single-run sha (filled during pass 1, used
# by the cross-Node section).
declare -A SAMPLE_SHA

echo "## Same-Node determinism (double-run SHA compare)"
echo
emit_table_header

for entry in "${GENERATORS[@]}"; do
  IFS='|' read -r name script artifact majors_csv <<<"$entry"
  IFS=',' read -ra majors <<<"$majors_csv"
  for major in "${majors[@]}"; do
    sha1="$(run_in_node "$major" "$script" "$artifact")"
    sha2="$(run_in_node "$major" "$script" "$artifact")"
    if [[ "$sha1" == "$sha2" ]]; then
      verdict="✓ deterministic"
    else
      verdict="✘ DIVERGENCE"
    fi
    SAMPLE_SHA["${name}@${major}"]="$sha1"
    emit_row "$name" "$major" "$sha1" "$sha2" "$verdict"
  done
done

echo
echo "## Cross-Node-major byte-equality (per generator)"

emit_cross_node_header

for entry in "${GENERATORS[@]}"; do
  IFS='|' read -r name script artifact majors_csv <<<"$entry"
  IFS=',' read -ra majors <<<"$majors_csv"
  if [[ "${#majors[@]}" -lt 2 ]]; then
    continue
  fi
  # Compare all unordered pairs.
  for ((i=0; i<${#majors[@]}-1; i++)); do
    for ((j=i+1; j<${#majors[@]}; j++)); do
      a="${majors[$i]}"
      b="${majors[$j]}"
      sha_a="${SAMPLE_SHA["${name}@${a}"]}"
      sha_b="${SAMPLE_SHA["${name}@${b}"]}"
      if [[ "$sha_a" == "$sha_b" ]]; then
        verdict="✓ byte-equal"
      else
        verdict="✘ DIVERGENCE"
      fi
      emit_cross_row "$name" "$a" "$b" "$sha_a" "$sha_b" "$verdict"
    done
  done
done

# Restore committed generator outputs to their original state. The audit
# is informational; the generator runs above are evidence collection, not
# canonical regeneration. Restoring keeps `git status` clean after the
# script and lets contributors run W4 without dirtying the working tree.
RESTORE_PATHS=(
  ".dependency-cruiser.generated.cjs"
)
for p in "${RESTORE_PATHS[@]}"; do
  if [[ -e "$p" ]]; then
    git checkout -- "$p" 2>/dev/null || true
  fi
done

echo
echo "## Reproduce"
echo
echo '```bash'
echo "bash scripts/audit/check-generator-determinism.sh"
echo '```'
