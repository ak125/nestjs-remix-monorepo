---
agent_id: sitemap-delta-service
agent_name: Sitemap Delta Service
status: active
owner: Backend Team
governance_verdict: APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: sitemap-delta-service

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `sitemap-delta-service` |
| agent_name | Sitemap Delta Service |
| status | active |
| owner | Backend Team |
| file | `backend/src/modules/seo/services/sitemap-delta.service.ts` |
| description | Tracks URL content changes via SHA1 hashing for sitemap-latest.xml |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps |
| process | NestJS main process |
| schedule | Nightly (3:00 AM) |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | trusted |
| risk_class | low |
| risk_factors | Redis writes for delta tracking |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| database | read |
| redis | read/write |
| secrets | none |

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | report_only |
| bundle_required | no |

## 6. Features

- Tracks URL content changes via SHA1 hashing
- Maintains daily delta (changed URLs) in Redis
- Generates sitemap-latest.xml from daily changes
- Detects change types (price, stock, metadata, content)
- Auto-clears deltas after sitemap generation
- 30-day retention management

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

**MUST run on principal VPS** - Requires database and Redis access.

---

## Governance Verdict

**APPROVED** - Internal SEO tracking service.

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
