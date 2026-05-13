# Phase 3.5 — Post-merge playbook (PR #487)

> Use this immediately after `fix(seo): restore automatic sitemap regeneration via BullMQ` is merged on `main`. The goal is to minimize the Google re-crawl latency: trigger a controlled manual regeneration right after PROD deploy instead of waiting for the 03:00 UTC cron tick.

---

## 0. Prerequisites

- PR #487 merged on `main` (CI green, reviewer approved).
- You have `ssh` access to DEV (`46.224.118.55`) and PROD (`49.12.233.2`).
- You have `CF_API_TOKEN` and the Cloudflare `ZONE_ID` for `automecanik.com`.
- You have an admin session on `https://search.google.com/search-console` for `sc-domain:automecanik.com` (or the `https://www.automecanik.com/` property — pick the one configured in this codebase, cf. `GSC_SITE_URL`).

---

## 1. DEV deploy verification (~5 min after merge)

```bash
# Wait for the auto-deploy from `main` push to land on DEV.
ssh root@46.224.118.55 'docker compose -p automecanik logs --since=10m backend' \
  | grep -iE "sitemap.*nightly regeneration|seo-monitor.*scheduler" \
  | head -10
```

**Expected log line** (proves the scheduler registered the repeatable job):

```
✅ Sitemap V10 nightly regeneration scheduled (cron="0 3 * * *" UTC)
```

If the line is absent:

- Confirm the deploy actually landed: `ssh ... docker compose ps backend` shows recent `Up`.
- Re-check `SEO_SITEMAP_CRON_ENABLED` is not set to `false` in the DEV env.
- Look for boot errors: `ssh ... docker compose logs backend | grep -iE 'error|exception' | head`.

---

## 2. PROD tag deploy

```bash
git checkout main && git pull
TAG="v2026.05.14-sitemap-cron"
git tag "$TAG"
git push origin "$TAG"

# GitHub Actions runs deploy-prod.yml automatically. Watch:
gh run watch --repo ak125/nestjs-remix-monorepo \
  $(gh run list --workflow deploy-prod.yml --branch "$TAG" \
     --json databaseId --jq '.[0].databaseId') --exit-status
```

Once green, verify on PROD:

```bash
ssh root@49.12.233.2 'docker compose -p automecanik logs --since=10m backend' \
  | grep -iE "sitemap.*nightly regeneration|seo-monitor.*scheduler" \
  | head -10
```

Same expected log line as DEV.

---

## 3. Immediate manual trigger (skip 03:00 UTC wait)

```bash
# PROD only — DEV is READ_ONLY so the processor short-circuits there.
# RateLimitSitemap is 3 req/min, but we only need one call.
curl -sS -X POST https://www.automecanik.com/api/sitemap/v10/generate-all \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .
```

**Expected JSON** (truncated):

```json
{
  "success": true,
  "message": "All V10 sitemaps generated successfully",
  "data": {
    "totalUrls": 102395,
    "totalFiles": 12,
    "durationMs": 45000,
    "buckets": [ ... ]
  }
}
```

If `success: false`, inspect bucket-level errors in `data.buckets[].error` and `data.hubResult.error`.

---

## 4. Sitemap freshness check

```bash
# Wait 60s for Cloudflare cache to potentially serve a stale copy, then bypass:
curl -sL -H 'Cache-Control: no-cache' \
  https://www.automecanik.com/sitemap.xml | head -20

# Check ALL sub-sitemaps' lastmod are today's date:
TODAY=$(date -u +%F)
curl -sL https://www.automecanik.com/sitemap.xml \
  | grep -oE '<loc>[^<]+</loc>' \
  | sed 's|<loc>\(.*\)</loc>|\1|' \
  | while read child; do
      lm=$(curl -sL "$child" | head -3 | grep -oE 'lastmod>[0-9-]+' | head -1 | sed 's|lastmod>||')
      printf "%-60s lastmod=%s\n" "$(basename $child)" "$lm"
    done

# Spot-check pieces-1.xml URL count is unchanged:
curl -sL https://www.automecanik.com/sitemap-pieces-1.xml | grep -c '<loc>'
# Expected: ~50000 (same as before; this PR doesn't modify URL inclusion)
```

If any `lastmod` ≠ today: rerun step 3 once. If still mismatched, investigate `sitemap-v10-xml.service.ts:75-77` and `__sitemap_p_link` row count.

---

## 5. Cloudflare cache purge — sitemap files only

> **CRITICAL**: purge ONLY `/sitemap*.xml`. Do NOT purge `/pieces/*` — the HTML is healthy (cf. Phase −1 smoke-test), purging would needlessly hit our origin.

```bash
# Set these once:
export CF_API_TOKEN="..."  # CloudflareAPI token with Zone.Cache.Purge perm
export ZONE_ID="..."

# Purge just the sitemap URLs we care about:
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      "https://www.automecanik.com/sitemap.xml",
      "https://www.automecanik.com/sitemap-racine.xml",
      "https://www.automecanik.com/sitemap-categories.xml",
      "https://www.automecanik.com/sitemap-vehicules.xml",
      "https://www.automecanik.com/sitemap-blog.xml",
      "https://www.automecanik.com/sitemap-pages.xml",
      "https://www.automecanik.com/sitemap-diagnostic.xml",
      "https://www.automecanik.com/sitemap-reference.xml",
      "https://www.automecanik.com/sitemap-brands.xml",
      "https://www.automecanik.com/sitemap-pieces-1.xml",
      "https://www.automecanik.com/sitemap-pieces-2.xml",
      "https://www.automecanik.com/sitemap-pieces-3.xml"
    ]
  }' | jq .

# Confirm the cache miss on next fetch:
curl -sI https://www.automecanik.com/sitemap.xml | grep -i cf-cache-status
# Expected: cf-cache-status: MISS (then HIT on second fetch — fresh content cached)
```

---

## 6. GSC resubmit + URL Inspection (prioritized)

### 6.a Resubmit the sitemap index

In Google Search Console UI for the property: **Indexing → Sitemaps**, click `sitemap.xml`, then *"Demander une nouvelle indexation"* (request re-indexing) or remove + re-add. GSC processes within hours.

### 6.b URL Inspection on top baseline URLs

From `__seo_ga4_daily` baseline (top organic pieces, W17 reference). For each: GSC UI → **URL Inspection** → paste URL → *"Demander une indexation"*. Quota ~10/day per property.

Priority list (auto-generated from baseline):

```sql
-- Run this on Supabase to get the current top-20 baseline URLs:
SELECT 'https://www.automecanik.com' || page AS url, SUM(sessions) AS baseline_sessions
FROM __seo_ga4_daily
WHERE channel = 'organic search'
  AND page LIKE '/pieces/%'
  AND date BETWEEN '2026-04-13' AND '2026-04-26'
GROUP BY page
ORDER BY baseline_sessions DESC
LIMIT 20;
```

---

## 7. Monitor recovery (7–14 days)

Daily check on the GA4 + GSC tables (both fed by the existing daily-fetch processor at 04:00 UTC):

```sql
-- Organic pieces sessions trend, last 21 days
SELECT date,
       SUM(sessions) FILTER (WHERE channel = 'organic search'
                              AND page LIKE '/pieces/%') AS organic_pieces
FROM __seo_ga4_daily
WHERE date >= CURRENT_DATE - INTERVAL '21 days'
GROUP BY date ORDER BY date;

-- GSC pieces impressions trend, last 21 days
SELECT date,
       SUM(impressions) FILTER (WHERE page LIKE '%/pieces/%') AS pieces_impressions,
       SUM(clicks)      FILTER (WHERE page LIKE '%/pieces/%') AS pieces_clicks
FROM __seo_gsc_daily
WHERE date >= CURRENT_DATE - INTERVAL '21 days'
GROUP BY date ORDER BY date;
```

**Expected timeline**:

- D+1 to D+3: Googlebot detects sitemap freshness change, recrawl rate increases.
- D+3 to D+7: Impressions start recovering for previously deindexed `/pieces/*` URLs.
- D+7 to D+14: Sessions follow. Target: return to W17 baseline (≈ 405 organic sessions/week on pieces).

If no recovery at D+10: open Phase 4.A ticket (Freshness SLO + BullMQ healthcheck) and Phase 4.D (real `last_modified_at` per URL).

---

## 8. Tag this resolved in vault + memory

```bash
# 1. Append session log entry (skill `session-log` triggers on Stop hook, or invoke manually):
echo "$(date -u +%F) | main | sitemap auto-regeneration restored (PR #487) + Phase 3.5 playbook executed" >> log.md

# 2. Update memory if recovery is confirmed:
cat > /home/deploy/.claude/projects/-opt-automecanik-app/memory/incident-traffic-drop-2026-04-22-resolved.md <<'EOF'
---
name: incident-traffic-drop-2026-04-22-resolved
description: -40% organic /pieces/* W17→W19 caused by stale sitemap; resolved via BullMQ scheduler (PR #487)
metadata:
  type: project
---

Root cause: zero scheduler triggered sitemap regeneration → last manual run 2026-04-23 froze `<lastmod>` 21 days → Googlebot crawl budget eroded.

Why: @nestjs/schedule v6 disabled in app.module.ts (conflict @nestjs/common v10) → all @Cron inert. No BullMQ job either.

Fix: SitemapV10SchedulerService registers BullMQ repeatable on `seo-monitor` queue (PR #487), READ_ONLY gate at processor (ADR-028 Option D), 03:00 UTC daily. SitemapRegenerateProcessor delegates to SitemapV10Service.generateAll(). Manual trigger possible via existing POST /api/sitemap/v10/generate-all.

Prevention: PR #488 adds CI guard that fails the build when @Cron is present while ScheduleModule is disabled (or annotate with INERT-OK-NO-SCHEDULER).

How to apply: any incident with declining GSC impressions while HTML is clean → check sitemap freshness FIRST (curl /sitemap.xml | grep lastmod). Phase −1 playbook in `audit-reports/seo-smoke/2026-05-13/PHASE-MINUS-1-REPORT.md`.

Refs:
- PR #487 (fix), PR #488 (prevention)
- audit-reports/seo-smoke/2026-05-13/PHASE-MINUS-1-REPORT.md (Phase -1 evidence)
- audit-reports/seo-smoke/2026-05-13/PHASE-3-5-POST-MERGE-PLAYBOOK.md (this playbook)
EOF
```

---

## Rollback (if step 3 or step 4 reveals catastrophic regression)

```bash
# 1. Quick disable without revert:
ssh root@49.12.233.2 'docker compose -p automecanik exec backend env SEO_SITEMAP_CRON_ENABLED=false'
# Then redeploy to apply (or modify the docker-compose env and `docker compose up -d`).

# 2. Full revert via PR (preferred — leaves audit trail):
gh pr create --base main \
  --head revert/sitemap-cron-fix \
  --title "revert: sitemap cron auto-regeneration"
gh pr merge <revert-pr> --auto --squash
```

No DB migration to roll back. The existing manual POST `/api/sitemap/v10/generate-all` keeps working as before.
