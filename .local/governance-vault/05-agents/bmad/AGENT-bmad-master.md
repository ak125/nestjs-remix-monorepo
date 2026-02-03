---
agent_id: bmad-master
agent_name: BMad Master
status: active
owner: BMAD Core Team
created: 2026-02-03
last_audit: 2026-02-03
governance_verdict: APPROVED
---

# Agent Fiche: bmad-master

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `bmad-master` |
| agent_name | BMad Master |
| status | active |
| owner | BMAD Core Team |
| description | Master Task Executor, Knowledge Custodian, and Workflow Orchestrator for BMAD methodology. |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | local_machine |
| justification | Orchestrates development workflows locally, no production access needed. |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | trusted |
| risk_class | low |

**Risk Factors:**
- No direct production access
- Read-only on monorepo
- Human validation required for outputs

## 4. Access Rights

### Read Targets
| Target | Access | Scope |
|--------|--------|-------|
| monorepo | yes | full |
| governance-vault | yes | read-only |
| logs/metrics | no | - |

### Write Targets
| Target | Access |
|--------|--------|
| monorepo | no |
| agent-submissions | no |
| governance-vault | no |

### Secret Access
- **Level**: none

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
| airlock_required | no |
| airlock_mode | N/A |
| failure_behavior | N/A |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-002 |
| related_rules | R1 (monorepo), R7 (SEO) |
| audit_trail_required | no |

**Activation Conditions:**
- BMAD methodology context active

## 8. Placement Decision

**MUST run on local_machine**

Development workflow orchestrator, no server-side execution required.

---

## Governance Verdict

**APPROVED**

Low risk, human-facing orchestrator with no production access.

---

_Audited: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
