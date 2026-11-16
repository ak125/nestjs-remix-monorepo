#!/usr/bin/env bash
# Weekly PR hygiene digest — collect open PR inventory, classify, recommend
# this week's focus, write a digest body file, and emit GitHub Actions outputs.
#
# Called by .github/workflows/weekly-pr-hygiene.yml. Requires gh CLI with
# GH_TOKEN env var and REPO env var (owner/name).
#
#   bash .github/scripts/weekly-pr-hygiene.sh            legacy contract: emits `title` +
#        `body_path` (the unpatched workflow then creates a dated issue, as before).
#   bash .github/scripts/weekly-pr-hygiene.sh --publish  mandat AM (2026-11-16): updates ONE
#        standing issue (fixed title) through report-issue-publish.sh; a short comment
#        only when the weekly focus or a bucket colour changes.
set -euo pipefail

: "${GH_TOKEN:?missing}"
: "${REPO:?missing}"

MODE="${1:-}"
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TITLE="Hygiène hebdomadaire des PR — rapport unique (weekly-pr-hygiene)"

TODAY=$(date -u +%F)
WEEKNUM=$(date -u +%V)
SEVEN_DAYS_AGO=$(date -u -d '7 days ago' +%F)
LAST_MONDAY=$(date -u -d 'last Monday' +%F)
OUT=$(mktemp)

# ---- Measurement 1 — Stale PRs (≥ 7d inactive) ----
STALE_RAW=$(gh pr list --repo "$REPO" --state open --limit 100 \
  --json number,title,headRefName,updatedAt,isDraft \
  --jq "[.[] | select(.updatedAt < \"$SEVEN_DAYS_AGO\")]")
STALE_COUNT=$(echo "$STALE_RAW" | jq 'length')

# ---- Measurement 2 — Conflicting PRs ----
CONFLICT_RAW=$(gh pr list --repo "$REPO" --state open --limit 100 \
  --json number,title,mergeStateStatus,headRefName \
  --jq '[.[] | select(.mergeStateStatus == "DIRTY" or .mergeStateStatus == "CONFLICTING")]')
CONFLICT_COUNT=$(echo "$CONFLICT_RAW" | jq 'length')

# ---- Measurement 3 — Dependabot blockers (PR-9a freshness gate effect) ----
DEPABOT_RAW=$(gh pr list --repo "$REPO" --state open --search 'head:dependabot' --limit 30 \
  --json number,title,statusCheckRollup \
  --jq '[.[] | select((.statusCheckRollup // []) | map(select(.conclusion == "FAILURE")) | length > 0)]')
DEPABOT_COUNT=$(echo "$DEPABOT_RAW" | jq 'length')

# ---- Measurement 4 — Last week's merged PRs ----
MERGED_RAW=$(gh pr list --repo "$REPO" --state merged \
  --search "merged:>=$LAST_MONDAY" --limit 50 \
  --json number,title,mergedAt,additions,deletions)
MERGED_COUNT=$(echo "$MERGED_RAW" | jq 'length')
LOC_ADD=$(echo "$MERGED_RAW" | jq '[.[].additions] | add // 0')
LOC_DEL=$(echo "$MERGED_RAW" | jq '[.[].deletions] | add // 0')

# ---- Measurement 5 — Audit baseline state ----
AUDIT_BASELINE_PRESENT="no"
AUDIT_UNUSED_EXPORTS=""
if [ -f audit-reports/phase0-baseline.json ]; then
  AUDIT_BASELINE_PRESENT="yes"
  AUDIT_UNUSED_EXPORTS=$(jq '.knip.unused_exports' audit-reports/phase0-baseline.json)
fi
AUDIT_RUNS=$(gh run list --workflow=audit.yml --limit 5 --repo "$REPO" --branch main \
  --json conclusion --jq '[.[] | .conclusion // "running"]')
AUDIT_FAILS=$(echo "$AUDIT_RUNS" | jq '[.[] | select(. == "failure")] | length')

# ---- Decision tree ----
if [ "$STALE_COUNT" -ge 10 ] && [ "$MERGED_COUNT" -lt 5 ]; then
  FOCUS="🧹 Hygiene week — batch-close stale PRs"
  ACTION1="Mirror the 2026-05-17 closure batch (audit-trail comments, branches preserved)."
  ACTION2="Re-evaluate cascade PRs (seo-governance-control-plane / seo-projection)."
  ACTION3="Skip new feature work until WIP < 20 open PRs."
elif [ "$DEPABOT_COUNT" -ge 5 ]; then
  FOCUS="📦 PR-9b first batch upgrade (scope ≤ 3 packages)"
  ACTION1="Pick top 3 packages from audit/dependencies/dependency-modernization-inventory.json (longest gap-to-latest)."
  ACTION2="Refresh inventory + bump packages in single PR (typed, with rollback drill)."
  ACTION3="Verify Dependabot freshness gate unblocks after merge."
elif [ "$AUDIT_FAILS" -gt 0 ]; then
  FOCUS="🛠 Baseline recovery mini-PR"
  ACTION1="Identify regression source via npm run audit:knip -- --reporter=symbols."
  ACTION2="Fix at source (export visibility) or refresh baseline with audit-trail."
  ACTION3="No new front until audit gates green again."
elif [ "$CONFLICT_COUNT" -gt 0 ]; then
  FOCUS="🔀 Rebase cascade (oldest stack first)"
  ACTION1="Worktree per stack, rebase on main, push --force-with-lease."
  ACTION2="Merge in cascade order: A1 → B → C → D → E."
  ACTION3="Run audit:contract-drift-ratchet after each merge."
else
  FOCUS="🧪 PR-8b-2 cleanup (≤ 5 files)"
  ACTION1="Pick next 5 candidates from audit/cleanup/inventory.json."
  ACTION2="One PR with audit-trail, observation window 48h after merge."
  ACTION3="No PR-9b or other new front in parallel (canon feedback_evidence_before_perimeter_expansion)."
fi

# ---- Assemble digest body (heredoc — safe inside .sh, not YAML) ----
cat > "$OUT" <<EOF
## 🎯 Recommendation — Week $WEEKNUM ($TODAY)

**Focus:** $FOCUS

1. $ACTION1
2. $ACTION2
3. $ACTION3

> Canon \`feedback_evidence_before_perimeter_expansion\` — un seul front à la fois.

---

## 📊 Open PR inventory

| Bucket | Count |
|--------|-------|
| Stale (≥ 7d inactive) | $STALE_COUNT |
| Conflicting (DIRTY/CONFLICTING) | $CONFLICT_COUNT |
| Dependabot blocked by freshness-gate | $DEPABOT_COUNT (expected, PR-9a control plane) |

## 🪦 Stale PRs

EOF

if [ "$STALE_COUNT" -gt 0 ]; then
  echo "$STALE_RAW" | jq -r '.[] | "- #\(.number) \(.title[:70]) — last updated \(.updatedAt[:10])\(if .isDraft then " _(draft)_" else "" end)"' >> "$OUT"
else
  echo "_None._" >> "$OUT"
fi
echo "" >> "$OUT"

echo "## 🔀 Conflicting PRs" >> "$OUT"
if [ "$CONFLICT_COUNT" -gt 0 ]; then
  echo "$CONFLICT_RAW" | jq -r '.[] | "- #\(.number) \(.title[:70]) (\(.mergeStateStatus))"' >> "$OUT"
else
  echo "_None._" >> "$OUT"
fi
echo "" >> "$OUT"

echo "## 📦 Dependabot blockers (PR-9a control plane effect — expected)" >> "$OUT"
if [ "$DEPABOT_COUNT" -gt 0 ]; then
  echo "$DEPABOT_RAW" | jq -r '.[] | "- #\(.number) \(.title[:70])"' | head -10 >> "$OUT"
  if [ "$DEPABOT_COUNT" -gt 10 ]; then
    REMAINING=$((DEPABOT_COUNT - 10))
    echo "- _… and $REMAINING more._" >> "$OUT"
  fi
else
  echo "_None._" >> "$OUT"
fi
echo "" >> "$OUT"

cat >> "$OUT" <<EOF
## 🚢 Last week's deliverables (since $LAST_MONDAY)

- Merged: **$MERGED_COUNT PRs**
- LoC: **+$LOC_ADD / -$LOC_DEL**

## 🛡 Audit baseline

- baseline file present: **$AUDIT_BASELINE_PRESENT**
- knip.unused_exports baseline: **${AUDIT_UNUSED_EXPORTS:-?}**
- audit.yml last 5 runs on main: $AUDIT_RUNS
- failures: **$AUDIT_FAILS**

---

Run: ${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-$REPO}/actions/runs/${GITHUB_RUN_ID:-?}
Replaces Claude Desktop routine \`trig_01N7BCAuPai8ZRwX88ytNU3i\` (disabled 2026-05-17).
EOF

# ---- Publish ----
if [ "$MODE" = "--publish" ]; then
  # Colours follow the decision tree above (its own thresholds, none added here).
  c_ge() { if [ "$1" -ge "$2" ]; then echo orange; else echo vert; fi; }
  STATE=$(jq -cn \
    --arg focus "$FOCUS" \
    --arg stale "$(c_ge "$STALE_COUNT" 10)" \
    --arg conflict "$(c_ge "$CONFLICT_COUNT" 1)" \
    --arg dependabot "$(c_ge "$DEPABOT_COUNT" 5)" \
    --arg audit "$(if [ "$AUDIT_FAILS" -gt 0 ]; then echo rouge; else echo vert; fi)" \
    '{focus: {c: $focus, l: "Focus de la semaine"},
      stale: {c: $stale, l: "PR inactives depuis 7 j (seuil 10)"},
      conflict: {c: $conflict, l: "PR en conflit"},
      dependabot: {c: $dependabot, l: "PR Dependabot bloquées (seuil 5)"},
      audit: {c: $audit, l: "audit.yml sur main (5 derniers runs)"}}')
  BODY=$(mktemp)
  {
    echo "_Issue unique, corps remplacé chaque lundi par \`weekly-pr-hygiene\` ; un commentaire seulement quand le focus ou une couleur change. Lu le $(date -u +%FT%TZ)._"
    echo ""
    cat "$OUT"
  } > "$BODY"
  # shellcheck source=report-issue-publish.sh
  . "$HERE/report-issue-publish.sh"
  N=$(report_issue_publish "$TITLE" "$BODY" "$STATE" ak125)
  echo "Issue de rapport : #$N (semaine $WEEKNUM, focus : $FOCUS)"
  echo "issue=$N" >> "${GITHUB_OUTPUT:-/dev/null}"
else
  {
    echo "title=📊 Weekly PR hygiene W$WEEKNUM — $TODAY ($FOCUS)"
    echo "body_path=$OUT"
  } >> "${GITHUB_OUTPUT:-/dev/stdout}"
fi
