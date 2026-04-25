# @repo/seo-types

Shared SEO types and Zod schemas for the SEO department modules.

## Domains

| Module | Purpose | Backed by |
|--------|---------|-----------|
| `observability` | GSC, GA4, CWV, indexation, GSC links | 4 time-series tables (partitioned monthly) |
| `onpage` | Audit findings (schema, image, canonical, meta A/B, internal links) | Single `__seo_audit_findings` table with discriminated payload |
| `intelligence` | Event log, anomalies, alerts, ingestion runs, forecasts | Single `__seo_event_log` table with discriminated payload |
| `geo-aeo` | E-E-A-T, Helpful Content, answer-engine format suggestions | JSONB columns on existing `__seo_entity_health` |
| `content-ops` | Editorial calendar, freshness rotation | New `__seo_editorial_calendar` table + JSONB column |

## Usage

```typescript
// NestJS controller
import { AuditFindingSchema } from "@repo/seo-types/onpage";

const finding = AuditFindingSchema.parse(rowFromDb);
// finding.audit_type narrows finding.payload type
if (finding.audit_type === "schema_violation") {
  console.log(finding.payload.schema_type); // type-safe
}
```

```typescript
// Remix loader
import { GSCTimeseriesResponseSchema } from "@repo/seo-types/observability";

export async function loader({ request }: LoaderFunctionArgs) {
  const apiResponse = await fetch("/api/admin/seo-cockpit/gsc/timeseries").then(r => r.json());
  return json(GSCTimeseriesResponseSchema.parse(apiResponse));
}
```

## Design rationale

### Why discriminated unions instead of separate tables ?

The user explicitly asked to **merge tables where possible** to keep the DB lean. We use discriminated unions on `audit_type` and `event_type` to :

- Keep one Postgres table (with ENUM constraint + JSONB payload + GIN index)
- Preserve **type safety** at the API boundary via Zod parsing
- Allow **extensibility** : adding a new audit kind = adding a new variant, no migration

### Why JSONB columns on existing table for entity-level scores ?

`__seo_entity_health` already holds "current state per entity" (entity_score, risk_flag, risk_level). E-E-A-T, Helpful Content audit, freshness state, on-page audit summary all describe **current state per entity** — semantically same concept, no reason for a new table.

### Why time-series tables stay separate ?

GSC/GA4/CWV daily volumes are 30M+ rows/month. They **must** be partitioned by month for index performance and cleanup. Putting them behind a generic `__seo_metric_daily` would lose typed indexes (different metrics need different indexed columns) and is the actual bricolage we want to avoid.

## Build

```bash
npm run build       # tsc → dist/
npm run typecheck   # no emit, just verify
npm run dev         # tsc --watch
```

## Reference

- Architecture decision : `governance-vault/ledger/decisions/adr/ADR-XXX-seo-department-architecture.md`
- Plan : `docs/superpowers/plans/seo-department.md` (V2 plan, 8-week roadmap)
- DB design rationale : section *Migrations* of the plan above
