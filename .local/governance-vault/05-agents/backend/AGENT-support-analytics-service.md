---
agent_id: support-analytics-service
agent_name: Support Analytics Service
status: active
owner: Backend Team
governance_verdict: APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: support-analytics-service

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `support-analytics-service` |
| agent_name | Support Analytics Service |
| status | active |
| owner | Backend Team |
| file | `backend/src/modules/support/services/support-analytics.service.ts` |
| description | Aggregates support metrics and generates performance KPIs |

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
| risk_factors | Read-only analytics, no external writes |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| database | read |
| redis | no |
| secrets | none |

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | report_only |
| bundle_required | no |

## 6. Features

- Aggregates support metrics (contacts, reviews, quotes, claims, FAQ)
- Generates performance reports and KPIs
- Calculates agent workload distribution
- Tracks satisfaction trends (30-day default)
- Provides insights and recommendations

## 7. Airlock Interaction

| Field | Value |
|-------|-------|
| airlock_required | no |

## 8. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-003 |
| audit_trail_required | no |

## 9. Placement Decision

**MUST run on principal VPS** - Requires database access.

---

## Governance Verdict

**APPROVED** - Internal analytics service, read-only.

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
