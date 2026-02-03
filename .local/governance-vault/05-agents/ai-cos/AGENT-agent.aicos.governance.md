---
agent_id: agent.aicos.governance
agent_name: AI-COS Governance Agent
status: planned
owner: AI-COS Architecture Team
governance_verdict: NOT_APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: agent.aicos.governance

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `agent.aicos.governance` |
| agent_name | AI-COS Governance Agent |
| status | planned |
| owner | AI-COS Architecture Team |
| parent_lead | agent.ceo.ia |
| squad | executive |
| description | Enforces governance rules across AI-COS system, monitors compliance |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps |
| justification | Governance role requires access to all AI-COS agents |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | restricted |
| risk_class | high |
| risk_factors | Governance enforcement impacts all agent operations |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| governance-vault | read/write |
| agent_registry | read/write |
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
| airlock_required | yes |
| airlock_mode | observe |
| failure_behavior | escalate |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-002, ADR-003, ADR-005 |
| related_rules | R1-R7 (all) |
| audit_trail_required | yes (mandatory) |
| activation_conditions | AI-COS Phase 1 deployed, Human CEO approval |

## 8. Placement Decision

**MUST run on principal VPS** - Central governance role.

---

## Governance Verdict

**NOT APPROVED**

Reasons:
- Phase 0 planned only
- Requires complete AI-COS infrastructure
- High-impact governance role needs extensive ADR documentation
- Human CEO oversight required

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
