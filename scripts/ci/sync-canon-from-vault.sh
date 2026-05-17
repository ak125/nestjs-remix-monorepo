#!/usr/bin/env bash
# sync-canon-from-vault.sh — generic resync of canon mirrors declared in
# ak125/governance-vault@main/99-meta/canon-hashes.json.
#
# For every canon entry whose `consumers[].repo` matches the current repo
# (auto-detected via $GITHUB_REPOSITORY or defaulting to ak125/nestjs-remix-monorepo),
# fetches the canon file, applies the canonical strip-frontmatter transform
# (same regex as governance-vault/_scripts/compute-canon-hashes.py:
# FRONTMATTER_RE = r"^---\n.*?\n---\n*", DOTALL), verifies the resulting
# sha256 matches `distribution_sha256`, and writes each declared mirror path.
#
# Fail-closed: any mismatch between produced sha and expected distribution_sha256
# aborts BEFORE touching mirror files. Idempotent: re-running on synced mirrors
# leaves git status clean.
#
# Used by .github/workflows/canon-sync.yml. Also safe to run locally.

set -euo pipefail

VAULT_RAW="${VAULT_RAW:-https://raw.githubusercontent.com/ak125/governance-vault/main}"
HASHES_URL="$VAULT_RAW/99-meta/canon-hashes.json"
TARGET_REPO="${GITHUB_REPOSITORY:-ak125/nestjs-remix-monorepo}"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

curl -fsSL "$HASHES_URL" -o "$tmpdir/canon-hashes.json"

python3 - "$tmpdir/canon-hashes.json" "$TARGET_REPO" "$VAULT_RAW" <<'PY'
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

hashes_path, target_repo, vault_raw = sys.argv[1], sys.argv[2], sys.argv[3]

FRONTMATTER_RE = re.compile(r"^---\n.*?\n---\n*", re.DOTALL)

with open(hashes_path, encoding="utf-8") as f:
    canons = json.load(f)["canons"]

print(f"Target repo: {target_repo}")
print(f"Vault: {vault_raw}")
print()

updated = 0
in_sync = 0
for key, meta in canons.items():
    targets = [c for c in meta["consumers"] if c["repo"] == target_repo]
    if not targets:
        continue
    print(f"=== {key} (v{meta['version']}) — {len(targets)} mirror(s) ===")
    canon_url = f"{vault_raw}/{meta['canon_path']}"
    with urllib.request.urlopen(canon_url) as r:
        raw = r.read().decode("utf-8")
    distribution = FRONTMATTER_RE.sub("", raw, count=1)
    actual_sha = hashlib.sha256(distribution.encode("utf-8")).hexdigest()
    expected_sha = meta["distribution_sha256"]
    if actual_sha != expected_sha:
        print(
            f"  ERROR: {key} produced sha {actual_sha[:12]}… "
            f"!= expected distribution_sha256 {expected_sha[:12]}…",
            file=sys.stderr,
        )
        print(
            "  Vault may have changed mid-fetch, or "
            "_scripts/compute-canon-hashes.py transform diverged.",
            file=sys.stderr,
        )
        sys.exit(1)
    for c in targets:
        path = Path(c["path"])
        if not path.parent.is_dir():
            print(f"  ERROR: parent dir missing for {c['path']}", file=sys.stderr)
            sys.exit(1)
        if path.exists() and path.read_text(encoding="utf-8") == distribution:
            print(f"  ok       {c['path']}")
            in_sync += 1
        else:
            path.write_text(distribution, encoding="utf-8")
            print(f"  UPDATED  {c['path']}  →  sha {expected_sha[:12]}…")
            updated += 1

print()
if updated == 0:
    print(f"All {in_sync} canon mirror(s) in sync — no changes.")
else:
    print(f"{updated} mirror(s) updated, {in_sync} already in sync.")
PY
