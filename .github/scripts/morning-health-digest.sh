#!/usr/bin/env bash
# Morning health digest — collect 6 signals, classify, write digest body file,
# emit GitHub Actions outputs.
#
# Called by .github/workflows/morning-health-digest.yml. Requires gh CLI with
# GH_TOKEN env var and REPO env var (owner/name).
set -euo pipefail

: "${GH_TOKEN:?missing}"
: "${REPO:?missing}"

NOW_UTC=$(date -u +%FT%TZ)
TODAY=$(date -u +%F)
YESTERDAY=$(date -u -d 'yesterday' +%F)
OUT=$(mktemp)
STATUS_OVERALL="✅"

# ---- Signal 1 — Sitemap freshness ----
echo "## Signal 1 — Sitemap freshness (PROD)" >> "$OUT"
LM=$(curl -fsS -m 10 -I https://www.automecanik.com/sitemap.xml 2>/dev/null \
  | grep -i '^last-modified:' \
  | sed 's/[Ll]ast-[Mm]odified:[[:space:]]*//I; s/\r$//' \
  || echo "")
if [ -n "$LM" ]; then
  AGE_SEC=$(( $(date -u +%s) - $(date -u -d "$LM" +%s) ))
  AGE_HRS=$(( AGE_SEC / 3600 ))
  if [ "$AGE_HRS" -lt 26 ]; then
    S="✅"
  elif [ "$AGE_HRS" -lt 30 ]; then
    S="⚠️"
    [ "$STATUS_OVERALL" = "✅" ] && STATUS_OVERALL="⚠️"
  else
    S="⛔"
    STATUS_OVERALL="⛔"
  fi
  echo "$S last-modified=\`$LM\` (age=${AGE_HRS}h, threshold <26h)" >> "$OUT"
else
  echo "❓ Could not fetch \`last-modified\`" >> "$OUT"
fi
echo "" >> "$OUT"

# ---- Signal 2 — OIDC daily sitemap cron ----
echo "## Signal 2 — OIDC daily sitemap cron" >> "$OUT"
OIDC=$(gh run list --workflow=sitemap-daily-regen.yml --limit 2 --repo "$REPO" \
  --json conclusion,createdAt \
  --jq '.[] | "\(.createdAt[:19]) \(.conclusion // "running")"' 2>/dev/null || echo "")
if [ -z "$OIDC" ]; then
  echo "⚠️ No runs yet" >> "$OUT"
  [ "$STATUS_OVERALL" = "✅" ] && STATUS_OVERALL="⚠️"
else
  echo '```' >> "$OUT"
  echo "$OIDC" >> "$OUT"
  echo '```' >> "$OUT"
  if echo "$OIDC" | grep -q failure; then STATUS_OVERALL="⛔"; fi
fi
echo "" >> "$OUT"

# ---- Signal 3 — CI deploys on main ----
echo "## Signal 3 — CI deploys on main (last 3)" >> "$OUT"
CI=$(gh run list --repo "$REPO" --branch main --workflow=ci.yml --limit 3 \
  --json conclusion,createdAt,headSha \
  --jq '.[] | "\(.createdAt[:19]) sha=\(.headSha[:7]) \(.conclusion // "running")"' 2>/dev/null || echo "")
echo '```' >> "$OUT"
echo "$CI" >> "$OUT"
echo '```' >> "$OUT"
if echo "$CI" | grep -q failure; then STATUS_OVERALL="⛔"; fi
echo "" >> "$OUT"

# ---- Signal 4 — Open PRs with failing checks ----
echo "## Signal 4 — Open PRs with failing checks" >> "$OUT"
FAILS=$(gh pr list --repo "$REPO" --state open --limit 60 \
  --json number,title,headRefName,statusCheckRollup \
  --jq '[.[] | {n: .number, t: (.title[:65]), head: .headRefName, failed: ([.statusCheckRollup[] | select(.conclusion=="FAILURE") | .name] | unique)} | select((.failed | length) > 0)]' 2>/dev/null || echo "[]")
DEPENDABOT=$(echo "$FAILS" | jq '[.[] | select(.head | startswith("dependabot/"))] | length')
OTHER=$(echo "$FAILS" | jq '[.[] | select(.head | startswith("dependabot/") | not)] | length')
echo "- Dependabot freshness-gate blocked: **$DEPENDABOT** (expected, PR-9a control plane)" >> "$OUT"
echo "- Other failing PRs (actionable): **$OTHER**" >> "$OUT"
if [ "$OTHER" -gt 0 ]; then
  [ "$STATUS_OVERALL" = "✅" ] && STATUS_OVERALL="⚠️"
  echo "" >> "$OUT"
  echo "**Actionable:**" >> "$OUT"
  echo "$FAILS" | jq -r '.[] | select(.head | startswith("dependabot/") | not) | "- #\(.n) \(.t) — failing: \(.failed | join(", "))"' >> "$OUT"
fi
echo "" >> "$OUT"

# ---- Signal 5 — Audit + drift on main ----
echo "## Signal 5 — Audit & drift workflows on main" >> "$OUT"
AUD=$(gh run list --workflow=audit.yml --limit 3 --repo "$REPO" --branch main \
  --json conclusion --jq '.[] | .conclusion // "running"' 2>/dev/null | tr '\n' ' ' || echo "")
DRF=$(gh run list --workflow=contract-drift-observatory.yml --limit 3 --repo "$REPO" --branch main \
  --json conclusion --jq '.[] | .conclusion // "running"' 2>/dev/null | tr '\n' ' ' || echo "")
echo "- audit.yml (last 3): $AUD" >> "$OUT"
echo "- contract-drift-observatory.yml (last 3): $DRF" >> "$OUT"
if echo "$AUD $DRF" | grep -q failure; then STATUS_OVERALL="⛔"; fi
echo "" >> "$OUT"

# ---- Signal 6 — Yesterday's merges ----
echo "## Signal 6 — PRs merged yesterday ($YESTERDAY)" >> "$OUT"
MERGED=$(gh pr list --repo "$REPO" --state merged \
  --search "merged:>=$YESTERDAY merged:<$TODAY" \
  --json number,title,mergedAt \
  --jq '.[] | "- #\(.number) \(.title[:70]) (\(.mergedAt[:16]))"' 2>/dev/null || echo "")
if [ -z "$MERGED" ]; then
  echo "_None._" >> "$OUT"
else
  echo "$MERGED" >> "$OUT"
fi
echo "" >> "$OUT"

echo "---" >> "$OUT"
echo "Run: ${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-$REPO}/actions/runs/${GITHUB_RUN_ID:-?}" >> "$OUT"
echo "Replaces Claude Desktop routine \`trig_017ywezN156yjiVW8BRVcYi6\` (disabled 2026-05-17)." >> "$OUT"

{
  echo "title=$STATUS_OVERALL Morning health digest — $TODAY"
  echo "body_path=$OUT"
} >> "${GITHUB_OUTPUT:-/dev/stdout}"
