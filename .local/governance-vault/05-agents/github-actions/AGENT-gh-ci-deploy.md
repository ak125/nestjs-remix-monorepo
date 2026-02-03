---
agent_id: gh-ci-deploy
agent_name: CI/CD Deploy Workflow
status: active
owner: DevOps Team
governance_verdict: APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: gh-ci-deploy

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `gh-ci-deploy` |
| agent_name | CI/CD Deploy Workflow |
| status | active |
| owner | DevOps Team |
| file | `.github/workflows/ci.yml` |
| description | Main CI/CD pipeline for linting, type checking, building and deploying |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | github |
| runner | self-hosted, Linux, X64 |
| triggers | push to main/dev |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | trusted |
| risk_class | medium |
| risk_factors | Deploys to production on main branch |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read/write |
| Docker Hub | push |
| Production server | SSH deploy |
| secrets | DOCKERHUB_TOKEN, DATABASE_URL |

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | report_only |
| bundle_required | no |

## 6. Pipeline Jobs

1. **lint** - ESLint validation
2. **typecheck** - TypeScript checking
3. **build** - Docker image build
4. **deploy** - Production deployment (main only)

## 7. Governance Verdict

**APPROVED** - Critical CI/CD automation with proper safeguards.

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
