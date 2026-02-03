---
agent_id: agent.ceo.ia
agent_name: IA-CEO
status: planned
owner: AI-COS Architecture Team
created: 2026-02-03
last_audit: 2026-02-03
governance_verdict: NOT_APPROVED
---

# Agent Fiche: agent.ceo.ia (IA-CEO)

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `agent.ceo.ia` |
| agent_name | IA-CEO |
| status | planned |
| owner | AI-COS Architecture Team |
| description | Coordinates all IA agents, proposes strategic decisions to Human CEO. |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps |
| justification | Central orchestrator needs access to all subsystems. |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | restricted |
| risk_class | high |

**Risk Factors:**
- Can invoke other agents
- Cross-domain coordination
- Strategic decision influence
- High blast radius if compromised

## 4. Access Rights

### Read Targets
| Target | Access | Scope |
|--------|--------|-------|
| monorepo | yes | full |
| governance-vault | yes | full |
| logs/metrics | yes | observability |

### Write Targets
| Target | Access |
|--------|--------|
| monorepo | no (via Airlock only) |
| governance-vault | no (proposals only) |

### Secret Access
- **Level**: limited (observability tokens only)

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | report_only |
| bundle_required | no |
| bundle_scope | N/A |
| constraints_profile | default |

## 6. Airlock Interaction

| Field | Value |
|-------|-------|
| airlock_required | yes |
| airlock_mode | observe |
| failure_behavior | escalate (to Human CEO) |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-002, ADR-003, ADR-005 |
| related_rules | R1-R7 (all) |
| audit_trail_required | yes |

**Activation Conditions:**
- AI-COS module deployed
- All Level 2 agents available
- Human CEO approval
- ADR-006 created and approved

## 8. Placement Decision

**MUST run on principal VPS** - Central coordination requires internal network access.

---

## Governance Verdict

**NOT APPROVED**

Phase 0 planned only. Requires separate ADR for activation.

**Blocking Reasons:**
1. AI-COS module not yet deployed
2. No ADR-006 for Phase 1 activation
3. Human CEO approval pending

---

_Audited: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
