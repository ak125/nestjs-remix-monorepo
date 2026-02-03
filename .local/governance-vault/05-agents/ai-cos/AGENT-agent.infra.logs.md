---
agent_id: agent.infra.logs
agent_name: Infrastructure Logs Agent
status: planned
owner: Infrastructure Team
governance_verdict: APPROVED_WITH_CONDITIONS
last_audit: 2026-02-03
---

# Agent Fiche: agent.infra.logs

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `agent.infra.logs` |
| agent_name | Infrastructure Logs Agent |
| status | planned |
| owner | Infrastructure Team |
| parent_lead | agent.infra.monitor |
| squad | infra |
| description | Aggregates and analyzes logs from all infrastructure components |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps |
| justification | Requires access to all infrastructure logs |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | restricted |
| risk_class | low |
| risk_factors | Read-only log aggregation, minimal risk |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| logs | read (all) |
| metrics | read |
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
| airlock_required | no (read-only) |
| airlock_mode | N/A |
| failure_behavior | log_only |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-003 |
| related_rules | R1 (monorepo) |
| audit_trail_required | yes |
| activation_conditions | agent.infra.monitor deployed |

## 8. Placement Decision

**MUST run on principal VPS** - Requires access to infrastructure logs.

---

## Governance Verdict

**APPROVED WITH CONDITIONS**

Conditions:
- Read-only access to logs
- ADR-006 approval required for activation

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
