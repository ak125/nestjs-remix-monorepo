---
agent_id: agent.aicos.architect
agent_name: AI-COS Architect
status: planned
owner: AI-COS Architecture Team
governance_verdict: NOT_APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: agent.aicos.architect

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `agent.aicos.architect` |
| agent_name | AI-COS Architect |
| status | planned |
| owner | AI-COS Architecture Team |
| parent_lead | agent.cto.ia |
| squad | executive |
| description | Defines and maintains AI-COS contracts, interfaces, and architectural decisions |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps |
| justification | Central architecture role requires access to all AI-COS components |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | restricted |
| risk_class | high |
| risk_factors | Architectural decisions impact entire AI-COS system |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| governance-vault | read/write (proposals) |
| logs/metrics | yes |
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
| airlock_required | yes (for any code/config changes) |
| airlock_mode | observe |
| failure_behavior | escalate |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-002, ADR-003 |
| related_rules | R1-R7 (all) |
| audit_trail_required | yes (mandatory) |
| activation_conditions | AI-COS Phase 1 deployed, Human CTO approval |

## 8. Placement Decision

**MUST run on principal VPS** - Central architecture role.

---

## Governance Verdict

**NOT APPROVED**

Reasons:
- Phase 0 planned only
- Requires complete AI-COS infrastructure
- High-impact architectural role needs extensive ADR documentation
- Human CTO oversight required

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
