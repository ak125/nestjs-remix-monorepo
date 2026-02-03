---
agent_id: gh-perf-gates
agent_name: Performance Gates Workflow
status: active
owner: DevOps Team
governance_verdict: APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: gh-perf-gates

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `gh-perf-gates` |
| agent_name | Performance Gates Workflow |
| status | active |
| owner | DevOps Team |
| file | `.github/workflows/perf-gates.yml` |
| description | Validates performance thresholds on PRs |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | github |
| runner | ubuntu-latest |
| triggers | pull_request to main |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | trusted |
| risk_class | low |
| risk_factors | Read-only performance checks |

## 4. Checks Performed

- Lighthouse performance testing
- Core Web Vitals thresholds (LCP, CLS, TTFB, TBT, FCP)
- E2E testing

## 5. Governance Verdict

**APPROVED** - Read-only performance validation.

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
