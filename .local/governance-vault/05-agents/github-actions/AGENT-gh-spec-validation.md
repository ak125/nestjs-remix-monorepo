---
agent_id: gh-spec-validation
agent_name: Spec Validation Workflow
status: active
owner: DevOps Team
governance_verdict: APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: gh-spec-validation

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `gh-spec-validation` |
| agent_name | Spec Validation Workflow |
| status | active |
| owner | DevOps Team |
| file | `.github/workflows/spec-validation.yml` |
| description | Validates spec files and documentation |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | github |
| runner | ubuntu-latest |
| triggers | pull_request, push |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | trusted |
| risk_class | low |
| risk_factors | Read-only documentation validation |

## 4. Governance Verdict

**APPROVED** - Read-only spec validation.

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
