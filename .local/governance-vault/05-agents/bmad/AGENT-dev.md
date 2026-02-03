---
agent_id: dev
agent_name: Amelia (Developer Agent)
status: active
owner: BMAD BMM Team
created: 2026-02-03
last_audit: 2026-02-03
governance_verdict: APPROVED_WITH_CONDITIONS
---

# Agent Fiche: dev (Amelia)

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `dev` |
| agent_name | Amelia (Developer Agent) |
| status | active |
| owner | BMAD BMM Team |
| description | Senior Software Engineer for code implementation. |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | local_machine |
| justification | Code generation happens locally, requires Airlock for production. |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | restricted |
| risk_class | medium |

**Risk Factors:**
- Generates executable code
- Could introduce vulnerabilities
- Requires human review before merge

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
| monorepo | no (via Airlock only) |
| agent-submissions | yes (via bundle) |
| governance-vault | no |

### Secret Access
- **Level**: none

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | bundle_only |
| bundle_required | yes |
| bundle_scope | All production code changes |
| constraints_profile | lint, typecheck |

## 6. Airlock Interaction

| Field | Value |
|-------|-------|
| airlock_required | yes |
| airlock_mode | observe |
| failure_behavior | log_only |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-002, ADR-005 |
| related_rules | R1-R7 |
| audit_trail_required | yes |

**Activation Conditions:**
- BMAD methodology context active
- Airlock system available

## 8. Placement Decision

**MUST run on local_machine** with Airlock bundle submission for production changes.

---

## Governance Verdict

**APPROVED WITH CONDITIONS**

All code changes must be submitted via Airlock bundle. No direct write access to monorepo.

---

_Audited: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
