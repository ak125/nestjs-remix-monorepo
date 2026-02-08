#!/usr/bin/env bash
set -euo pipefail

VAULT="${VAULT_DIR:-/opt/automecanik/governance-vault}"
REPO="${REPO_DIR:-/opt/automecanik/app}"
BUNDLES_DIR="${BUNDLES_DIR:-/opt/automecanik/airlock/inbox}"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1" >&2; exit 1; }; }
need git; need date; need sha256sum; need awk; need find; need sort; need head; need sed; need mkdir; need wc

# ====== DEC-008: PROD READ-ONLY ENFORCEMENT ======
if [[ "${ENV:-}" == "PROD" ]]; then
  echo "🛑 PROD is READ-ONLY — no tail operations allowed (DEC-008)"
  echo "   This environment can only execute, never modify."
  exit 1
fi

# ====== SIGNING POLICY (AUTO-DETECT) ======
# Si vault exige signing → BLOQUER si pas signé
# Si vault n'exige pas signing → pas de vérification

is_signing_required() {
  local signing format signkey
  signing="$(git -C "$VAULT" config --get commit.gpgsign 2>/dev/null || true)"
  format="$(git -C "$VAULT" config --get gpg.format 2>/dev/null || true)"
  signkey="$(git -C "$VAULT" config --get user.signingkey 2>/dev/null || true)"
  [[ "$signing" == "true" && "$format" == "ssh" && -n "$signkey" ]]
}

verify_signature() {
  if ! is_signing_required; then
    echo "ℹ️  Vault does not require signing"
    return 0
  fi

  echo "ℹ️  Vault requires signed commits - verifying..."
  local log_out
  log_out="$(git -C "$VAULT" log --show-signature -1 2>&1 || true)"
  if echo "$log_out" | grep -q "Good \"git\" signature"; then
    echo "✅ Signature verified"
    return 0
  else
    echo "❌ BLOCKED: Commit not signed (vault policy requires signing)"
    echo "$log_out"
    exit 1
  fi
}

usage(){
  cat <<'USAGE'
Usage:
  tail-bundle.sh --bundle <id|latest> --decision <MERGED|REJECTED|FAILED_CHECKS|ACCEPTED> --reason "text"
                [--pr <url>] [--branch <name>]

Writes a signed commit in governance-vault:
  04-audit-trail/bundles/YYYY/YYYY-MM/YYYY-MM-DD__<bundle>__<decision>.md
USAGE
}

resolve_latest_bundle() {
  local latest_patch
  latest_patch="$(find "$BUNDLES_DIR" -maxdepth 2 -type f -name "changes.patch" -printf '%T@ %p\n' 2>/dev/null     | sort -nr | head -n 1 | awk '{print $2}')"
  [[ -n "${latest_patch:-}" ]] || return 1
  basename "$(dirname "$latest_patch")"
}

BUNDLE=""; DECISION=""; REASON=""; PR_URL=""; BRANCH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle) BUNDLE="$2"; shift 2;;
    --decision) DECISION="$2"; shift 2;;
    --reason) REASON="$2"; shift 2;;
    --pr) PR_URL="$2"; shift 2;;
    --branch) BRANCH="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "❌ Unknown arg: $1" >&2; usage; exit 2;;
  esac
done

[[ -n "$BUNDLE" && -n "$DECISION" && -n "$REASON" ]] || { usage; exit 2; }

if [[ "$BUNDLE" == "latest" ]]; then
  latest="$(resolve_latest_bundle || true)"
  [[ -n "${latest:-}" ]] || { echo "❌ No bundle found in: $BUNDLES_DIR" >&2; exit 1; }
  BUNDLE="$latest"
  echo "✅ Resolved latest bundle → $BUNDLE"
fi

PATCH="$BUNDLES_DIR/$BUNDLE/changes.patch"
[[ -f "$PATCH" ]] || { echo "❌ Patch not found: $PATCH" >&2; exit 1; }
[[ -d "$VAULT/.git" ]] || { echo "❌ Vault repo not found: $VAULT" >&2; exit 1; }
[[ -d "$REPO/.git" ]] || { echo "❌ App repo not found: $REPO" >&2; exit 1; }

patch_hash="$(sha256sum "$PATCH" | awk '{print $1}')"

# Try to get patch stats (may fail for invalid patches)
if git -C "$REPO" apply --numstat "$PATCH" >/dev/null 2>&1; then
  files_count="$(git -C "$REPO" apply --numstat "$PATCH" | wc -l | awk '{print $1}')"
  added="$(git -C "$REPO" apply --numstat "$PATCH" | awk '{a+=$1} END{print a+0}')"
  deleted="$(git -C "$REPO" apply --numstat "$PATCH" | awk '{d+=$2} END{print d+0}')"
else
  # For invalid patches (e.g., REJECTED decisions), use placeholder values
  echo "⚠️  Patch cannot be applied (using placeholder stats)"
  files_count="?"
  added="?"
  deleted="?"
fi

today="$(date -I)"
ym="$(date +%Y-%m)"
yyyy="$(date +%Y)"

safe_bundle="$(echo "$BUNDLE" | sed 's/[^a-zA-Z0-9._-]/-/g')"
safe_decision="$(echo "$DECISION" | sed 's/[^a-zA-Z0-9._-]/-/g')"

out_dir="$VAULT/04-audit-trail/bundles/$yyyy/$ym"
mkdir -p "$out_dir"

file="$out_dir/${today}__${safe_bundle}__${safe_decision}.md"

cat >"$file" <<EOF
---
date: $today
type: bundle-audit
bundle_id: "$BUNDLE"
decision: "$DECISION"
patch_hash_sha256: "$patch_hash"
scope:
  files: $files_count
  added: $added
  deleted: $deleted
repo_path: "$REPO"
branch: "${BRANCH:-}"
pr: "${PR_URL:-}"
reason: "$REASON"
---

# Airlock Bundle Tail — $BUNDLE

## Decision
- **$DECISION**
- $REASON

## Scope
- Files: **$files_count**
- Lines: **+$added / -$deleted**
- Patch SHA256: \`$patch_hash\`

## Links
- Branch: ${BRANCH:-"(none)"}
- PR: ${PR_URL:-"(none)"}
EOF

cd "$VAULT"
git add "$file"
# Handle idempotent writes (file may already exist with same content)
if git diff --cached --quiet; then
  echo "ℹ️  Vault entry already exists (idempotent)"
else
  git commit -m "tail(bundle): $DECISION $BUNDLE"
fi

# Vérifier signature si vault l'exige (zero trust)
verify_signature

# ====== DEC-003: PREPROD GATE ======
# Only PREPROD can push to GitHub (zero trust)
CURRENT_ENV="${ENV:-DEV}"
if [[ "$CURRENT_ENV" != "PREPROD" ]]; then
  echo "⚠️  PREPROD Gate: Push blocked (ENV=$CURRENT_ENV)"
  echo "   Tail written locally. To push: ENV=PREPROD gov tail ..."
  echo "✅ Tail written (local): $file"
  exit 0
fi

git push origin "$(git branch --show-current)" 2>/dev/null || git push origin main

echo "✅ Tail written and pushed: $file"
