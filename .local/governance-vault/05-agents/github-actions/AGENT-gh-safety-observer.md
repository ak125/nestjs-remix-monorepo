---
agent_id: gh-safety-observer
agent_name: Safety Observer Workflow
status: active
owner: DevOps Team
governance_verdict: APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: gh-safety-observer

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `gh-safety-observer` |
| agent_name | Safety Observer Workflow |
| status | active |
| owner | DevOps Team |
| file | `.github/workflows/validator-dev-safety-observe.yml` |
| description | Non-blocking security observation for development safety |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | github |
| runner | ubuntu-latest |
| mode | Non-blocking observation |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | trusted |
| risk_class | low |
| risk_factors | Read-only security checks |

## 4. Safety Gates

- **GATE-1**: No PROD Supabase in DEV
- **GATE-2**: MCP Permissions Audit
- **GATE-3**: Runner Blast-Radius Control
- **GATE-4**: Secrets Hygiene Check

## 5. Governance Verdict

**APPROVED** - Critical security observation.

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
