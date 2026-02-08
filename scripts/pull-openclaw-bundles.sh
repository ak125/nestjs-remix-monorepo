#!/usr/bin/env bash
set -euo pipefail

# ====== CONFIG ======
AGENT_SUBMISSIONS_DIR="${AGENT_SUBMISSIONS_DIR:-/opt/automecanik/app/agent-submissions}"

# ====== MAIN ======
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PULL BUNDLES FROM GITHUB (agent-submissions)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if agent-submissions exists
if [[ ! -d "$AGENT_SUBMISSIONS_DIR/.git" ]]; then
  echo "❌ agent-submissions repo not found at $AGENT_SUBMISSIONS_DIR"
  echo "   Clone it first: git clone <repo-url> $AGENT_SUBMISSIONS_DIR"
  exit 1
fi

# Git pull
cd "$AGENT_SUBMISSIONS_DIR"
echo "ℹ️  Pulling from origin/main..."
git fetch origin main
git reset --hard origin/main

echo ""
echo "✅ Pull complete."
echo ""
echo "Bundles available:"
ls -1 "$AGENT_SUBMISSIONS_DIR/bundles" 2>/dev/null || echo "  (empty)"
