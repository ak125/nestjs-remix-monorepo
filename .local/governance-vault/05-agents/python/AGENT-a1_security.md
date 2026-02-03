---
agent_id: a1_security
agent_name: Security Scanner Agent
status: active
owner: Python Analysis Team
created: 2026-02-03
last_audit: 2026-02-03
governance_verdict: APPROVED
---

# Agent Fiche: a1_security

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `a1_security` |
| agent_name | Security Scanner Agent |
| status | active |
| owner | Python Analysis Team |
| description | Performs security vulnerability scanning on codebase. |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | external_vps |
| justification | Read-only analysis, no production access needed. Isolation for security. |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | restricted |
| risk_class | low |

**Risk Factors:**
- Read-only operations
- Could expose vulnerabilities in reports (mitigated by private storage)

## 4. Access Rights

### Read Targets
| Target | Access | Scope |
|--------|--------|-------|
| monorepo | yes | read-only clone |
| governance-vault | no | - |
| logs/metrics | no | - |

### Write Targets
| Target | Access |
|--------|--------|
| monorepo | no |
| reports/ | yes (local) |

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
| failure_behavior | log_only |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-002 |
| related_rules | R1 (monorepo) |
| audit_trail_required | yes |

**Activation Conditions:**
- Clone of monorepo available
- Python environment configured

## 8. Placement Decision

**MUST run outside principal VPS** - Isolation for security analysis.

---

## Governance Verdict

**APPROVED**

Read-only analysis agent, properly isolated.

---

_Audited: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
