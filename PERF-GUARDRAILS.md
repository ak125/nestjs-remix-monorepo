# Performance Guardrails - DCO V2

> Anti-regression gates for Core Web Vitals

## Airlock Test Section
This line was added by test-airlock-001 bundle.

## Core Web Vitals Targets

| Metric | Good | Needs Improvement | Poor | Blocking |
|--------|------|-------------------|------|----------|
| **LCP** (Largest Contentful Paint) | ≤ 2500ms | ≤ 4000ms | > 4000ms | **Yes** |
| **CLS** (Cumulative Layout Shift) | ≤ 0.05 | ≤ 0.10 | > 0.25 | **Yes** |
| **INP** (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms | No |
| **TTFB** (Time to First Byte) | ≤ 800ms | ≤ 1800ms | > 3000ms | No |
| **FCP** (First Contentful Paint) | ≤ 1800ms | ≤ 3000ms | > 4500ms | No |
| **TBT** (Total Blocking Time) | ≤ 200ms | ≤ 600ms | > 1000ms | No |
| **JS Unused** | ≤ 30% | ≤ 40% | > 50% | No |

## CI/CD Integration

### GitHub Actions Gate

**File:** `.github/workflows/perf-gates.yml`

**Trigger:** PRs to `main` affecting:
- `frontend/**`
- `backend/src/modules/catalog/**`
- `backend/src/modules/seo/**`

**Behavior:**
- Runs Lighthouse CI on 3 test URLs
- Comments PR with results
- **Blocks merge** if LCP or CLS exceed thresholds

### Lighthouse Budget

**File:** `lighthouse-budget.json`

**Path-Specific Budgets:**

| Path | LCP | CLS | Notes |
|------|-----|-----|-------|
| `/` (Homepage) | 2000ms | 0.05 | Stricter - critical page |
| `/pieces/*` (PLP/PDP) | 2500ms | 0.05 | Product pages |
| `/*` (Default) | 2500ms | 0.10 | Fallback |

**Resource Budgets:**

| Resource Type | Budget |
|--------------|--------|
| Total | 500KB |
| Scripts | 200KB |
| Stylesheets | 50KB |
| Images | 300KB |

## Database Configuration

**Table:** `__ux_perf_gates`

```sql
SELECT metric, threshold_pass, threshold_warn, threshold_fail, is_blocking
FROM __ux_perf_gates
WHERE is_active = TRUE;
```

**Default Gates:**

| Metric | Pass | Warn | Fail | Blocking |
|--------|------|------|------|----------|
| lcp | 2500 | 4000 | 6000 | false |
| cls | 0.05 | 0.10 | 0.25 | false |
| inp | 200 | 300 | 500 | false |
| ttfb | 800 | 1800 | 3000 | false |
| fcp | 1800 | 3000 | 4500 | false |
| tbt | 200 | 600 | 1000 | false |
| js_unused | 30 | 40 | 50 | false |

## RPC Functions

### Validate Capture Against Gates

```sql
SELECT * FROM validate_capture_against_gates('capture-uuid');
```

Returns:
- `metric` - Gate name
- `current_value` - Measured value
- `status` - 'pass', 'warn', 'fail'
- `is_blocking` - Whether this blocks deployment

### Get CWV Summary by Role

```sql
SELECT * FROM get_cwv_summary_by_role('R2');
```

Returns aggregate CWV stats for a page role.

## Enforcement Workflow

### Pre-Merge (Automatic)

1. PR opened affecting frontend/catalog
2. GitHub Actions runs Lighthouse
3. Results compared to `lighthouse-budget.json`
4. **Block** if violations on blocking metrics
5. Comment PR with results

### Post-Deploy (Monitoring)

1. UX Capture Agent captures production pages
2. Captures stored in `__ux_captures`
3. `validate_capture_against_gates()` runs
4. Violations create `__ux_debt` items
5. Dashboard shows regression alerts

## MCP Integration

Use Chrome DevTools MCP for captures:

```
mcp__chrome-devtools__navigate_page → URL
mcp__chrome-devtools__performance_start_trace → reload=true
mcp__chrome-devtools__performance_stop_trace → filePath
mcp__chrome-devtools__take_screenshot → mobile
```

## Rollback Protocol

If a deployment causes CWV regression:

1. Identify commit via `git log`
2. Revert: `git revert <commit>`
3. Push to main
4. Verify CWV restored

## Files

- `.github/workflows/perf-gates.yml` - CI gate
- `lighthouse-budget.json` - Path-specific budgets
- `backend/supabase/migrations/20260128_dco_v2_tables.sql` - DB schema
- `backend/src/modules/ai-cos/skills/cwv-analyzer.skill.ts` - Analysis logic

## Version

- **Version:** 2.0.0
- **Last Updated:** 2026-01-28
