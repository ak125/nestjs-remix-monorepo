#!/usr/bin/env bash
# sync-marketing-voice-from-vault.sh — fetch canon from governance-vault,
# apply the canonical strip-frontmatter transform, and write both mirrors.
#
# Idempotent: safe to re-run. Verifies output sha256 against the vault's
# distribution_sha256 BEFORE touching mirrors (fail-closed).
#
# Source of truth for the transform: governance-vault/_scripts/compute-canon-hashes.py
# (FRONTMATTER_RE = r"^---\n.*?\n---\n*", DOTALL — strips frontmatter and all
# trailing newlines after the closing fence).
#
# Pair this with scripts/ci/check-marketing-voice-hash.sh which validates the
# result in CI (.github/workflows/marketing-voice-hash.yml).

set -euo pipefail

CANON_URL="https://raw.githubusercontent.com/ak125/governance-vault/main/ledger/rules/rules-marketing-voice.md"
HASHES_URL="https://raw.githubusercontent.com/ak125/governance-vault/main/99-meta/canon-hashes.json"

MIRRORS=(
  ".claude/canon-mirrors/marketing-voice.md"
  "workspaces/marketing/.claude/canon-mirrors/marketing-voice.md"
)

tmpdist=$(mktemp)
trap 'rm -f "$tmpdist"' EXIT

expected_sha=$(curl -fsSL "$HASHES_URL" | jq -r '.canons.marketing_voice.distribution_sha256')

curl -fsSL "$CANON_URL" | python3 -c "
import re, sys
text = sys.stdin.read()
sys.stdout.write(re.sub(r'^---\n.*?\n---\n*', '', text, count=1, flags=re.DOTALL))
" > "$tmpdist"

actual_sha=$(sha256sum "$tmpdist" | awk '{print $1}')

if [[ "$actual_sha" != "$expected_sha" ]]; then
  echo "ERROR: produced sha $actual_sha != vault distribution_sha256 $expected_sha" >&2
  echo "       Possible vault state changed mid-fetch — re-run." >&2
  exit 1
fi

for mirror in "${MIRRORS[@]}"; do
  if [[ ! -d "$(dirname "$mirror")" ]]; then
    echo "ERROR: mirror parent dir missing: $(dirname "$mirror")" >&2
    exit 1
  fi
  cp "$tmpdist" "$mirror"
  echo "OK $mirror updated (sha ${expected_sha:0:12}…)"
done
