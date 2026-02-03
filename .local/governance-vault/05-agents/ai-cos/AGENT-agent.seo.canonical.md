---
agent_id: agent.seo.canonical
agent_name: Canonical URL Manager
status: planned
owner: SEO Team
governance_verdict: APPROVED_WITH_CONDITIONS
last_audit: 2026-02-03
---

# Agent Fiche: agent.seo.canonical

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `agent.seo.canonical` |
| agent_name | Canonical URL Manager |
| status | planned |
| owner | SEO Team |
| parent_lead | agent.seo.lead |
| squad | seo |
| description | Manages canonical URLs for SEO optimization, prevents duplicate content issues |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps |
| justification | Requires database access for URL management |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | restricted |
| risk_class | low |
| risk_factors | URL modifications could impact SEO rankings if misconfigured |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| __seo_* tables | read/write (via RPC) |
| logs/metrics | no |
| secrets | none |

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | report_only |
| bundle_required | no |
| constraints_profile | default |

## 6. Airlock Interaction

| Field | Value |
|-------|-------|
| airlock_required | no (data operations only) |
| airlock_mode | N/A |
| failure_behavior | log_only |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-003 |
| related_rules | R7 (SEO uniquement) |
| audit_trail_required | yes |
| activation_conditions | agent.seo.lead deployed, ADR-006 approved |

## 8. Placement Decision

**MUST run on principal VPS** - Requires database access for canonical URL management.

---

## Governance Verdict

**APPROVED WITH CONDITIONS**

Conditions:
- All database writes via RPC only
- Parent lead (agent.seo.lead) must be active
- ADR-006 approval required for activation

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
