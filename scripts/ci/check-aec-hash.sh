#!/usr/bin/env bash
# check-aec-hash.sh — verify an AEC copy matches the canon distribution_sha256
# published by ak125/governance-vault in 99-meta/canon-hashes.json (key `aec`).
#
# Usage:
#   scripts/ci/check-aec-hash.sh <path-to-AEC-copy>
#
# The monorepo distributes AEC twice (.claude/rules/ + workspaces/seo-batch/.claude/rules/),
# so the workflow calls this script for each path.
#
# Source: rules-agent-exit-contract.md §"Distribution canonique" in the vault.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <path-to-AEC-copy>" >&2
  exit 2
fi

local_copy="$1"
canon_url="https://raw.githubusercontent.com/ak125/governance-vault/main/99-meta/canon-hashes.json"

if [[ ! -f "${local_copy}" ]]; then
  echo "ERROR: ${local_copy} missing" >&2
  exit 1
fi

local_sha=$(sha256sum "${local_copy}" | awk '{print $1}')

# Vault is public — the raw URL works without auth. `gh api` would also work but
# adds a token requirement to local runs; curl keeps the script standalone.
canon_json=$(curl -fsSL "${canon_url}")
vault_sha=$(printf '%s' "${canon_json}" | jq -r '.canons.aec.distribution_sha256')

if [[ "${local_sha}" != "${vault_sha}" ]]; then
  echo "::error::AEC distribution drift on ${local_copy}" >&2
  echo "  local: ${local_sha}" >&2
  echo "  vault: ${vault_sha}" >&2
  echo "Resync: copy ledger/rules/rules-agent-exit-contract.md from the vault, strip the YAML frontmatter, write to ${local_copy}." >&2
  exit 1
fi

echo "OK — ${local_copy} matches vault canon-hashes.json aec.distribution_sha256 (${vault_sha})"
