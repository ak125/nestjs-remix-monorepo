---
agent_id: gh-worker-deploy
agent_name: Worker Deploy Workflow
status: active
owner: DevOps Team
governance_verdict: APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: gh-worker-deploy

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `gh-worker-deploy` |
| agent_name | Worker Deploy Workflow |
| status | active |
| owner | DevOps Team |
| file | `.github/workflows/worker-deploy.yml` |
| description | Deploys worker processes to production |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | github |
| runner | self-hosted |
| triggers | push to main/staging with worker changes |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | trusted |
| risk_class | medium |
| risk_factors | Deploys workers to production |

## 4. Features

- Docker build and push to GHCR
- SSH deployment to production
- Health checks
- Slack notifications (success/failure)

## 5. Governance Verdict

**APPROVED** - Worker deployment automation.

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
