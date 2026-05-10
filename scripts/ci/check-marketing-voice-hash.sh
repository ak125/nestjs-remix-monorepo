#!/usr/bin/env bash
# check-marketing-voice-hash.sh — verify a Marketing Voice copy matches the canon
# distribution_sha256 published by ak125/governance-vault in 99-meta/canon-hashes.json
# (key `marketing_voice`).
#
# Usage:
#   scripts/ci/check-marketing-voice-hash.sh <path-to-marketing-voice-copy>
#
# Source: rules-marketing-voice.md §"Distribution canonique" in the vault.
# Pattern: miroir de scripts/ci/check-aec-hash.sh.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <path-to-marketing-voice-copy>" >&2
  exit 2
fi

local_copy="$1"
canon_url="https://raw.githubusercontent.com/ak125/governance-vault/main/99-meta/canon-hashes.json"

if [[ ! -f "${local_copy}" ]]; then
  echo "ERROR: ${local_copy} missing" >&2
  exit 1
fi

local_sha=$(sha256sum "${local_copy}" | awk '{print $1}')

canon_json=$(curl -fsSL "${canon_url}")
vault_sha=$(printf '%s' "${canon_json}" | jq -r '.canons.marketing_voice.distribution_sha256')

if [[ "${local_sha}" != "${vault_sha}" ]]; then
  echo "::error::Marketing Voice distribution drift on ${local_copy}" >&2
  echo "  local: ${local_sha}" >&2
  echo "  vault: ${vault_sha}" >&2
  echo "Resync: copy ledger/rules/rules-marketing-voice.md from the vault, strip the YAML frontmatter, write to ${local_copy}." >&2
  exit 1
fi

echo "OK ${local_copy} matches vault distribution_sha256 (${vault_sha:0:12}…)"
