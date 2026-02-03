---
agent_id: front-agent
agent_name: AI-COS Front Agent (UX Interface)
status: planned
owner: AI-COS Architecture Team
governance_verdict: NOT_APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: front-agent

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `front-agent` |
| agent_name | AI-COS Front Agent (UX Interface) |
| status | planned |
| owner | AI-COS Architecture Team |
| parent_lead | agent.ceo.ia |
| squad | executive |
| description | User-facing interface agent for AI-COS system, handles user interactions |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps |
| justification | User-facing component requires production access |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | restricted |
| risk_class | high |
| risk_factors | User-facing agent, could expose internal data or allow unauthorized actions |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| user data | restricted (via API only) |
| logs/metrics | yes |
| secrets | session tokens |

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | report_only |
| bundle_required | no |
| constraints_profile | user_facing |

## 6. Airlock Interaction

| Field | Value |
|-------|-------|
| airlock_required | yes |
| airlock_mode | observe |
| failure_behavior | graceful_degradation |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-002, ADR-003 |
| related_rules | R1-R7 (all) |
| audit_trail_required | yes (mandatory) |
| activation_conditions | AI-COS Phase 2+, complete security audit, Human CEO approval |

## 8. Placement Decision

**MUST run on principal VPS** - User-facing interface requires production environment.

---

## Governance Verdict

**NOT APPROVED**

Reasons:
- Phase 0 planned only
- User-facing agent requires extensive security review
- Complete AI-COS infrastructure must be deployed first
- High-risk user interaction surface
- Human CEO oversight required

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
