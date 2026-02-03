---
agent_id: seo-monitoring-service
agent_name: SEO Monitoring Service
status: active
owner: Backend Team
governance_verdict: APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: seo-monitoring-service

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `seo-monitoring-service` |
| agent_name | SEO Monitoring Service |
| status | active |
| owner | Backend Team |
| file | `backend/src/modules/seo/services/seo-monitoring.service.ts` |
| description | Monitors SEO health, sitemap accessibility, and index coverage |

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
| risk_factors | Read-heavy, sends Slack alerts |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| database | read |
| sitemaps | read |
| secrets | SLACK_WEBHOOK_URL |

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | report_only |
| bundle_required | no |

## 6. Features

- Monitors 9 sitemaps (.xml, .xml.gz)
- Checks sitemap accessibility and status
- Tracks index coverage metrics
- Detects URL errors and generates alerts
- Sends alerts to Slack webhook

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

**MUST run on principal VPS** - Requires sitemap and database access.

---

## Governance Verdict

**APPROVED** - Internal monitoring service.

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
