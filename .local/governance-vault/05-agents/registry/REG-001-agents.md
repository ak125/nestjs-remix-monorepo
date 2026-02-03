---
id: REG-001
title: Agent Registry
status: active
version: 1.3.0
last_audit: 2026-02-03
total_agents: 140
---

# Agent Registry

Official source of truth for all agents in the AutoMecanik system.

## Quick Stats

| Verdict | Count |
|---------|-------|
| APPROVED | 54 |
| APPROVED_WITH_CONDITIONS | 15 |
| NOT_APPROVED | 46 |
| PENDING_FICHE | 25 |

---

## Registry Table

| agent_id | status | location | trust | output | write_target | verdict |
|----------|--------|----------|-------|--------|--------------|---------|
| bmad-master | active | local | trusted | report | none | APPROVED |
| analyst | active | local | trusted | report | none | APPROVED |
| architect | active | local | trusted | report | none | APPROVED |
| dev | active | local | restricted | bundle | agent-submissions | APPROVED_WITH_CONDITIONS |
| pm | active | local | trusted | report | none | APPROVED |
| quick-flow-solo-dev | active | local | trusted | report | none | APPROVED |
| sm | active | local | trusted | report | none | APPROVED |
| tea | active | local | trusted | report | none | APPROVED |
| tech-writer | active | local | trusted | report | none | APPROVED |
| ux-designer | active | local | trusted | report | none | APPROVED |
| agent.ceo.ia | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| agent.cto.ia | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| agent.cpo.ia | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| agent.cmo.ia | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| agent.cfo.ia | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| agent.qto | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| agent.seo.lead | planned | principal_vps | restricted | bundle | none | NOT_APPROVED |
| agent.data.lead | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| agent.rag.lead | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| agent.seo.vlevel | planned | principal_vps | restricted | report | rpc_only | APPROVED_WITH_CONDITIONS |
| agent.seo.sitemap | planned | principal_vps | restricted | report | rpc_only | APPROVED_WITH_CONDITIONS |
| agent.data.backup | planned | principal_vps | restricted | report | rpc_only | APPROVED_WITH_CONDITIONS |
| agent.rag.indexer | planned | principal_vps | restricted | report | rpc_only | APPROVED_WITH_CONDITIONS |
| agent.infra.monitor | planned | principal_vps | restricted | report | none | APPROVED_WITH_CONDITIONS |
| agent.seo.canonical | planned | principal_vps | restricted | report | rpc_only | APPROVED_WITH_CONDITIONS |
| agent.seo.content | planned | principal_vps | restricted | bundle | rpc_only | APPROVED_WITH_CONDITIONS |
| agent.data.cleanup | planned | principal_vps | restricted | report | rpc_only | APPROVED_WITH_CONDITIONS |
| agent.data.validator | planned | principal_vps | restricted | report | rpc_only | APPROVED_WITH_CONDITIONS |
| agent.rag.validator | planned | principal_vps | restricted | report | rpc_only | APPROVED_WITH_CONDITIONS |
| agent.rag.retriever | planned | principal_vps | restricted | report | rpc_only | APPROVED_WITH_CONDITIONS |
| agent.aicos.architect | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| agent.aicos.governance | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| agent.infra.logs | planned | principal_vps | restricted | report | none | APPROVED_WITH_CONDITIONS |
| front-agent | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| a1_security | active | external_vps | untrusted | report | none | APPROVED |
| a2_massive_files | active | external_vps | untrusted | report | none | APPROVED |
| a3_duplications | active | external_vps | untrusted | report | none | APPROVED |
| a4_dead_code | active | external_vps | untrusted | report | none | APPROVED |
| a5_complexity | active | external_vps | untrusted | report | none | APPROVED |
| a6_dependencies | active | external_vps | untrusted | report | none | APPROVED |
| a7_performance | active | external_vps | untrusted | report | none | APPROVED |
| a8_accessibility | active | external_vps | untrusted | report | none | APPROVED |
| a9_seo | active | external_vps | untrusted | report | none | APPROVED |
| a10_i18n | active | external_vps | untrusted | report | none | APPROVED |
| a11_tests | active | external_vps | untrusted | report | none | APPROVED |
| a12_documentation | active | external_vps | untrusted | report | none | APPROVED |
| f0_autoimport | active | external_vps | untrusted | bundle | airlock | APPROVED_WITH_CONDITIONS |
| f1_dead_code_surgeon | active | external_vps | untrusted | bundle | airlock | APPROVED_WITH_CONDITIONS |
| f15_risk_scorer | active | external_vps | untrusted | report | none | APPROVED |
| seo-monitor-scheduler | active | principal_vps | trusted | report | db_internal | APPROVED |
| seo-monitor-processor | active | principal_vps | trusted | report | db_internal | APPROVED |
| seo-audit-scheduler | active | principal_vps | trusted | report | db_internal | APPROVED |
| seo-interpolation-monitor | active | principal_vps | trusted | report | db_internal | APPROVED |
| mcp-alerting-service | active | principal_vps | trusted | report | none | APPROVED |
| database-monitor | active | principal_vps | trusted | report | none | APPROVED |
| metrics-processor | active | principal_vps | trusted | report | db_internal | APPROVED |
| cache-warming-service | active | principal_vps | trusted | report | redis | APPROVED |
| email-processor | disabled | principal_vps | trusted | report | none | APPROVED |
| cache-processor | disabled | principal_vps | trusted | report | redis | APPROVED |
| notification-demo | optional | principal_vps | trusted | report | none | APPROVED |
| ui-os | active | local | trusted | report | none | APPROVED |
| ui-ux-pro-max | active | local | trusted | report | none | APPROVED |
| seo-content-architect | active | local | trusted | report | none | APPROVED |
| governance-vault-ops | active | local | trusted | report | none | APPROVED |
| frontend-design | active | local | trusted | report | none | APPROVED |
| seo-keyword-expert | active | principal_vps | trusted | report | none | APPROVED |
| serp-analyzer | active | principal_vps | trusted | report | none | APPROVED |
| mcp-shadcn | active | local | trusted | report | none | APPROVED |
| mcp-supabase | active | local | trusted | report | none | APPROVED |
| mcp-supabase-local | active | local | trusted | report | none | APPROVED |
| seo-monitoring-service | active | principal_vps | trusted | report | db_internal | APPROVED |
| sitemap-delta-service | active | principal_vps | trusted | report | redis | APPROVED |
| search-monitoring-service | active | principal_vps | trusted | report | redis | APPROVED |
| support-analytics-service | active | principal_vps | trusted | report | none | APPROVED |
| gh-ci-deploy | active | github | trusted | report | none | APPROVED |
| gh-worker-deploy | active | github | trusted | report | none | APPROVED |
| gh-perf-gates | active | github | trusted | report | none | APPROVED |
| gh-spec-validation | active | github | trusted | report | none | APPROVED |
| gh-safety-observer | active | github | trusted | report | none | APPROVED |
| ui-audit-suite | active | local | trusted | report | none | APPROVED |
| ui-governance-suite | active | local | trusted | report | none | APPROVED |
| G1 | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| G2 | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| G3 | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| G4 | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| G5 | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| G7 | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| G10 | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| G11 | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| G13 | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| G14 | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| G17 | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| G18 | planned | principal_vps | restricted | report | none | NOT_APPROVED |
| F1 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| F2 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| F3 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| F4 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| F5 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| F6 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| M2 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| M4 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| A-CARTO | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| A2 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| A3 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| A4 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| A5 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| A6 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| A7 | planned | external_vps | untrusted | report | none | NOT_APPROVED |
| B7 | planned | external_vps | untrusted | report | none | NOT_APPROVED |

---

## Enforcement Rules

1. **APPROVED**: Agent can operate freely within documented scope
2. **APPROVED_WITH_CONDITIONS**: Agent requires Airlock/RPC gate validation
3. **NOT_APPROVED**: Agent MUST NOT be activated without new ADR

---

## Validation Schema

For CI/Airlock integration:

```yaml
status:
  - active
  - planned
  - disabled
  - optional

location:
  - local           # Developer machine
  - principal_vps   # Production VPS
  - external_vps    # Isolated analysis VPS

trust:
  - trusted         # Internal service, human-facing
  - restricted      # Generates code or has elevated access
  - untrusted       # External agent, read-only

output:
  - report          # Analysis/audit only
  - bundle          # Produces Airlock bundles

write_target:
  - none            # No write access
  - airlock         # Via Airlock bundle only
  - rpc_only        # Via RpcGateService only
  - db_internal     # Internal database tables
  - redis           # Redis cache only
  - agent-submissions  # agent-submissions repo

verdict:
  - APPROVED
  - APPROVED_WITH_CONDITIONS
  - NOT_APPROVED
```

---

## References

- ADR-002: Airlock Zero-Trust Architecture
- ADR-003: RPC Governance
- ADR-005: Airlock Observe Mode Activation
- MOC-Agents: Central agent index

---

## Change Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-02-03 | 1.0.0 | Initial registry creation | Claude (Governance Analyst) |
| 2026-02-03 | 1.1.0 | Phase 6: +10 AI-COS agents discovered | Claude (Governance Analyst) |
| 2026-02-03 | 1.2.0 | Phase 7: +7 agents (3 MCP, 4 backend services) | Claude (Governance Analyst) |
| 2026-02-03 | 1.3.0 | Phase 8: +7 agents (5 GitHub Actions, 2 script suites) | Claude (Governance Analyst) |
| 2026-02-03 | 1.2.0 | Phase 7: +7 agents (3 MCP, 4 backend services) | Claude (Governance Analyst) |

---

_Registry frozen until ADR-006 approval._
_Last audit: 2026-02-03_
