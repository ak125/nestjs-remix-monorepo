---
agent_id: search-monitoring-service
agent_name: Search Monitoring Service
status: active
owner: Backend Team
governance_verdict: APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: search-monitoring-service

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `search-monitoring-service` |
| agent_name | Search Monitoring Service |
| status | active |
| owner | Backend Team |
| file | `backend/src/modules/search/services/search-monitoring.service.ts` |
| description | Records search performance metrics and tracks popular queries |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps |
| process | NestJS main process |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | trusted |
| risk_class | low |
| risk_factors | Redis writes for metrics persistence |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| database | no |
| redis | read/write |
| secrets | none |

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | report_only |
| bundle_required | no |

## 6. Features

- Records search performance metrics (response time, cache hits, errors)
- Tracks service usage comparison (basic vs. enhanced search)
- Maintains hourly statistics (last 168 hours)
- Tracks top 50 popular queries
- Provides performance reports with recommendations
- Persists metrics to Redis cache

## 7. Airlock Interaction

| Field | Value |
|-------|-------|
| airlock_required | no |

## 8. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-003 |
| audit_trail_required | yes (via logs) |

## 9. Placement Decision

**MUST run on principal VPS** - Requires Redis access.

---

## Governance Verdict

**APPROVED** - Internal search metrics service.

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
