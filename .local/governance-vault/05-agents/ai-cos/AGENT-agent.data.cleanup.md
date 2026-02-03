---
agent_id: agent.data.cleanup
agent_name: Data Cleanup Agent
status: planned
owner: Data Team
governance_verdict: APPROVED_WITH_CONDITIONS
last_audit: 2026-02-03
---

# Agent Fiche: agent.data.cleanup

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `agent.data.cleanup` |
| agent_name | Data Cleanup Agent |
| status | planned |
| owner | Data Team |
| parent_lead | agent.data.lead |
| squad | data |
| description | Identifies and cleans orphaned/stale data, maintains data hygiene |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps |
| justification | Requires database access for cleanup operations |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | restricted |
| risk_class | medium |
| risk_factors | Data deletion could cause data loss if misconfigured |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| database tables | read/delete (via RPC) |
| logs/metrics | yes (for audit) |
| secrets | none |

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | report_only |
| bundle_required | no |
| constraints_profile | safe_delete |

## 6. Airlock Interaction

| Field | Value |
|-------|-------|
| airlock_required | no (data operations only) |
| airlock_mode | N/A |
| failure_behavior | rollback |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-003 |
| related_rules | R1 (monorepo), R5 (backup) |
| audit_trail_required | yes (mandatory) |
| activation_conditions | agent.data.lead deployed, backup verification active |

## 8. Placement Decision

**MUST run on principal VPS** - Requires database access for cleanup operations.

---

## Governance Verdict

**APPROVED WITH CONDITIONS**

Conditions:
- All deletions via RPC only (soft delete preferred)
- Backup verification before any delete operation
- Full audit trail required
- ADR-006 approval required for activation

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
