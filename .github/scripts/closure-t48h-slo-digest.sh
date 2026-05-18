#!/usr/bin/env bash
# T+48h SLO digest — measure 9 signals 48h after the closure sequence
# (2026-05-17), classify each as ✅/⛔/❓, write a digest body file, emit
# GitHub Actions outputs.
#
# Called by .github/workflows/closure-t48h-slo-digest.yml. Requires gh CLI
# with GH_TOKEN env var and REPO env var (owner/name).
set -euo pipefail

: "${GH_TOKEN:?missing}"
: "${REPO:?missing}"

NOW_UTC=$(date -u +%FT%TZ)
OUT=$(mktemp)
HOLD_COUNT=0
UNKNOWN_COUNT=0

push_status() {
  local name="$1" status="$2" detail="$3"
  echo "| $name | $status | $detail |" >> "$OUT"
  case "$status" in
    "⛔") HOLD_COUNT=$((HOLD_COUNT + 1)) ;;
    "❓") UNKNOWN_COUNT=$((UNKNOWN_COUNT + 1)) ;;
  esac
}

cat > "$OUT" <<EOF
**Measurement time:** $NOW_UTC
**Closure baseline:** issue #582 (T+0 digest from 2026-05-17)

## 9-SLO matrix

| Signal | Status | Evidence |
|--------|--------|----------|
EOF

# ---- 1. Preprod (proxy via CI deploys on main) ----
CI=$(gh run list --repo "$REPO" --branch main --workflow=ci.yml --limit 3 \
  --json conclusion --jq '[.[] | .conclusion // "running"]')
CI_FAILS=$(echo "$CI" | jq '[.[] | select(. == "failure")] | length')
if [ "$CI_FAILS" -eq 0 ]; then
  push_status "1. Preprod (proxy CI deploys)" "✅" "Last 3 main deploys: $CI"
else
  push_status "1. Preprod (proxy CI deploys)" "⛔" "Last 3 main deploys: $CI"
fi

# ---- 2. Sitemap freshness ----
LM=$(curl -fsS -m 10 -I https://www.automecanik.com/sitemap.xml 2>/dev/null \
  | grep -i '^last-modified:' \
  | sed 's/[Ll]ast-[Mm]odified:[[:space:]]*//I; s/\r$//' \
  || echo "")
if [ -n "$LM" ]; then
  AGE_HRS=$(( ( $(date -u +%s) - $(date -u -d "$LM" +%s) ) / 3600 ))
  if [ "$AGE_HRS" -lt 26 ]; then
    push_status "2. Sitemap freshness" "✅" "age=${AGE_HRS}h <26h"
  else
    push_status "2. Sitemap freshness" "⛔" "age=${AGE_HRS}h ≥26h"
  fi
else
  push_status "2. Sitemap freshness" "❓" "Cannot fetch last-modified"
fi

# ---- 3. OIDC sitemap cron ----
OIDC=$(gh run list --workflow=sitemap-daily-regen.yml --limit 2 --repo "$REPO" \
  --json conclusion --jq '[.[] | .conclusion // "running"]')
OIDC_OK=$(echo "$OIDC" | jq '[.[] | select(. == "success")] | length')
OIDC_LEN=$(echo "$OIDC" | jq 'length')
if [ "$OIDC_OK" -eq 2 ] && [ "$OIDC_LEN" -eq 2 ]; then
  push_status "3. OIDC sitemap cron" "✅" "2/2 success: $OIDC"
elif [ "$OIDC_LEN" -eq 0 ]; then
  push_status "3. OIDC sitemap cron" "❓" "No runs found"
else
  push_status "3. OIDC sitemap cron" "⛔" "Got: $OIDC"
fi

# ---- 4. Heartbeat scheduler (code presence + CI green) ----
HEARTBEAT_CODE=$(grep -rE 'worker:seo-monitor:heartbeat' backend/src/modules/seo/services/ 2>/dev/null | head -1 || echo "")
if [ -n "$HEARTBEAT_CODE" ] && [ "$CI_FAILS" -eq 0 ]; then
  push_status "4. Heartbeat scheduler" "✅" "Code present + CI deploys green"
elif [ -z "$HEARTBEAT_CODE" ]; then
  push_status "4. Heartbeat scheduler" "⛔" "Heartbeat code missing from main"
else
  push_status "4. Heartbeat scheduler" "❓" "Code present but CI not all green"
fi

# ---- 5. Audit baseline ----
AUD=$(gh run list --workflow=audit.yml --limit 3 --repo "$REPO" --branch main \
  --json conclusion --jq '[.[] | .conclusion // "running"]')
AUD_FAILS=$(echo "$AUD" | jq '[.[] | select(. == "failure")] | length')
if [ "$AUD_FAILS" -eq 0 ]; then
  push_status "5. Audit baseline (main)" "✅" "Last 3: $AUD"
else
  push_status "5. Audit baseline (main)" "⛔" "Last 3: $AUD"
fi

# ---- 6. Dependency freshness gate ----
DEP=$(gh run list --workflow=dependency-modernization-fresh.yml --limit 10 --repo "$REPO" \
  --json conclusion,event --jq '[.[] | {c: .conclusion, e: .event}]')
PUSH_OK=$(echo "$DEP" | jq '[.[] | select(.e == "push" and .c == "success")] | length')
PUSH_FAIL=$(echo "$DEP" | jq '[.[] | select(.e == "push" and .c == "failure")] | length')
if [ "$PUSH_OK" -gt 0 ] && [ "$PUSH_FAIL" -eq 0 ]; then
  push_status "6. Dependency freshness gate" "✅" "Push: $PUSH_OK success / $PUSH_FAIL fail (Dependabot blocks expected)"
elif [ "$PUSH_FAIL" -gt 0 ]; then
  push_status "6. Dependency freshness gate" "⛔" "Push fails: $PUSH_FAIL"
else
  push_status "6. Dependency freshness gate" "❓" "No push events found"
fi

# ---- 7. Drift observatory ----
DRF=$(gh run list --workflow=contract-drift-observatory.yml --limit 3 --repo "$REPO" --branch main \
  --json conclusion --jq '[.[] | .conclusion // "running"]')
DRF_FAILS=$(echo "$DRF" | jq '[.[] | select(. == "failure")] | length')
if [ "$DRF_FAILS" -eq 0 ]; then
  push_status "7. Drift observatory" "✅" "Last 3: $DRF"
else
  push_status "7. Drift observatory" "⛔" "Last 3: $DRF"
fi

# ---- 8. Synthetic crawler / sitemap freshness SLO ----
SLO=$(gh run list --workflow=sitemap-freshness-slo.yml --limit 3 --repo "$REPO" \
  --json conclusion --jq '[.[] | .conclusion // "running"]')
SLO_LEN=$(echo "$SLO" | jq 'length')
SLO_FAILS=$(echo "$SLO" | jq '[.[] | select(. == "failure")] | length')
if [ "$SLO_LEN" -eq 0 ]; then
  push_status "8. Synthetic crawler SLO" "❓" "No recent runs"
elif [ "$SLO_FAILS" -eq 0 ]; then
  push_status "8. Synthetic crawler SLO" "✅" "Last 3: $SLO"
else
  push_status "8. Synthetic crawler SLO" "⛔" "Last 3: $SLO"
fi

# ---- 9. GSC impressions (manual check required) ----
push_status "9. GSC impressions /pieces/*" "❓" "Manual GSC dashboard check required"

# ---- Verdict ----
echo "" >> "$OUT"
echo "## 🎯 Verdict" >> "$OUT"
echo "" >> "$OUT"
if [ "$HOLD_COUNT" -eq 0 ]; then
  VERDICT="GO"
  DEPS_STALE=0
  if [ -f audit/dependencies/dependency-modernization-inventory.json ]; then
    DEPS_STALE=$(jq '[.families[]? | select((.staleness_months? // 0) > 6)] | length' \
      audit/dependencies/dependency-modernization-inventory.json 2>/dev/null || echo 0)
  fi
  if [ "$DEPS_STALE" -gt 0 ]; then
    NEXT="📦 **PR-9b** — first typed batch upgrade (≤ 3 packages, scope strict). $DEPS_STALE families flagged stale >6 months."
  else
    NEXT="🧹 **PR-8b-2** — cleanup ≤ 5 files (canon \`feedback_deletion_governance_scaling_discipline\`)."
  fi
  echo "✅ **GO** — $UNKNOWN_COUNT UNKNOWN signal(s), 0 HOLD." >> "$OUT"
  echo "" >> "$OUT"
  echo "**Recommended next track:** $NEXT" >> "$OUT"
  echo "" >> "$OUT"
  echo "> Reminder: **JAMAIS PR-9b ET PR-8b-2 en parallèle** (canon \`feedback_evidence_before_perimeter_expansion\`)." >> "$OUT"
else
  VERDICT="HOLD"
  echo "⛔ **HOLD** — $HOLD_COUNT signal(s) breached threshold. Mini-PR recovery scope only. Re-window 48h after fix." >> "$OUT"
fi

cat >> "$OUT" <<EOF

---

**References:**
- T+0 baseline: #582
- Merged PRs: #579 (PR-9a) #562 (auth phase 3) #565 (OIDC) #566 (heartbeat)
- Workflow run: ${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-$REPO}/actions/runs/${GITHUB_RUN_ID:-?}

_Replaces Claude Desktop routine \`trig_01EGEoNa8u6DbEXs6KtuPoMJ\` (disabled 2026-05-17). This workflow can be deleted in a follow-up cleanup PR after this run fires._
EOF

{
  echo "title=📊 Closure 2026-05-17 — T+48h SLO digest (verdict: $VERDICT)"
  echo "body_path=$OUT"
} >> "${GITHUB_OUTPUT:-/dev/stdout}"
