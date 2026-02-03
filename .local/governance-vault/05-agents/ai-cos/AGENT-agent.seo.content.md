---
agent_id: agent.seo.content
agent_name: SEO Content Generator
status: planned
owner: SEO Team
governance_verdict: APPROVED_WITH_CONDITIONS
last_audit: 2026-02-03
---

# Agent Fiche: agent.seo.content

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `agent.seo.content` |
| agent_name | SEO Content Generator |
| status | planned |
| owner | SEO Team |
| parent_lead | agent.seo.lead |
| squad | seo |
| description | Generates SEO-optimized content (meta descriptions, titles, structured data) |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps |
| justification | Requires database access and potential LLM integration |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | restricted |
| risk_class | medium |
| risk_factors | Content generation could produce inaccurate or low-quality text |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| __seo_* tables | read/write (via RPC) |
| logs/metrics | no |
| secrets | LLM API keys (if applicable) |

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | bundle_only |
| bundle_required | yes (for content changes) |
| bundle_scope | `backend/src/modules/seo/`, `__seo_content` tables |
| constraints_profile | quality_check |

## 6. Airlock Interaction

| Field | Value |
|-------|-------|
| airlock_required | yes |
| airlock_mode | observe |
| failure_behavior | log_only |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-002, ADR-003 |
| related_rules | R7 (SEO uniquement) |
| audit_trail_required | yes |
| activation_conditions | agent.seo.lead deployed, content quality review process in place |

## 8. Placement Decision

**MUST run on principal VPS** - Requires database and potential LLM API access.

---

## Governance Verdict

**APPROVED WITH CONDITIONS**

Conditions:
- All content changes via Airlock bundle
- Database writes via RPC only
- Human review required for generated content
- ADR-006 approval required for activation

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
