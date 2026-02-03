# MOC: Agents

Index central de tous les agents du systeme AutoMecanik.

**Date audit**: 2026-02-03
**Total agents**: 140
**Verdicts**: 54 APPROVED | 15 APPROVED WITH CONDITIONS | 46 NOT APPROVED | 25 pending fiches

---

## Source de Verite

| Document | Description |
|----------|-------------|
| **[[REG-001-agents]]** | Registre officiel (parsable CI/Airlock) |
| **05-agents/** | Fiches individuelles par categorie |
| **05-agents/lettered/** | Series condensees (G/F/M/A/B) |

---

## Statistiques Globales

| Catégorie | Nombre | Actifs | Planifiés |
|-----------|--------|--------|-----------|
| BMAD Agents | 10 | 10 | 0 |
| AI-COS Executive (L1) | 6 | 0 | 6 |
| AI-COS Leads (L2) | 3 | 0 | 3 |
| AI-COS Executors (L3) | 15 | 0 | 15 |
| AI-COS Support | 2 | 0 | 2 |
| AI-COS Interface | 1 | 0 | 1 |
| G-Series | 18 | 0 | 18 |
| F-Series | 6 | 0 | 6 |
| M-Series | 2 | 0 | 2 |
| A-Series | 7 | 0 | 7 |
| B-Series | 1 | 0 | 1 |
| Python Analysis | 12 | 12 | 0 |
| Python Fixproof | 3 | 3 | 0 |
| Backend Services | 15 | 15 | 0 |
| MCP Servers | 3 | 3 | 0 |
| Skills | 5 | 5 | 0 |
| Backend JS | 2 | 2 | 0 |
| GitHub Actions | 5 | 5 | 0 |
| Script Suites | 2 | 2 | 0 |

---

## Par Localisation

### Principal VPS (production)
- Backend Services (11)
- AI-COS agents (planifiés)

### External VPS (isolation)
- Python Analysis Agents (12)
- Python Fixproof Agents (3)

### Local Machine (développement)
- BMAD Agents (10)
- Skills (5)
- MCP Servers (3)
- Script Suites (2)

### GitHub (CI/CD)
- GitHub Actions Workflows (5)

---

## BMAD Agents (10)

| Agent ID | Name | Status | Verdict | Fiche |
|----------|------|--------|---------|-------|
| `bmad-master` | BMad Master | active | APPROVED | [[AGENT-bmad-master]] |
| `analyst` | Mary | active | APPROVED | - |
| `architect` | Winston | active | APPROVED | - |
| `dev` | Amelia | active | APPROVED WITH CONDITIONS | [[AGENT-dev]] |
| `pm` | John | active | APPROVED | - |
| `quick-flow-solo-dev` | Barry | active | APPROVED | - |
| `sm` | Bob | active | APPROVED | - |
| `tea` | Murat | active | APPROVED | - |
| `tech-writer` | Paige | active | APPROVED | - |
| `ux-designer` | Sally | active | APPROVED | - |

---

## AI-COS Executive (Level 1 - 6)

| Agent ID | Name | Status | Verdict | Fiche |
|----------|------|--------|---------|-------|
| `agent.ceo.ia` | IA-CEO | planned | NOT APPROVED | [[AGENT-agent.ceo.ia]] |
| `agent.cto.ia` | IA-CTO | planned | NOT APPROVED | - |
| `agent.cpo.ia` | IA-CPO | planned | NOT APPROVED | - |
| `agent.cmo.ia` | IA-CMO | planned | NOT APPROVED | - |
| `agent.cfo.ia` | IA-CFO | planned | NOT APPROVED | - |
| `agent.qto` | Quality Officer | planned | NOT APPROVED | - |

---

## AI-COS Leads (Level 2 - 3)

| Agent ID | Name | Status | Verdict |
|----------|------|--------|---------|
| `agent.seo.lead` | SEO Lead | planned | NOT APPROVED |
| `agent.data.lead` | Data Lead | planned | NOT APPROVED |
| `agent.rag.lead` | RAG Lead | planned | NOT APPROVED |

---

## AI-COS Executors (Level 3 - 15)

| Agent ID | Name | Status | Verdict | Fiche |
|----------|------|--------|---------|-------|
| `agent.seo.vlevel` | V-Level Generator | planned | APPROVED WITH CONDITIONS | [[AGENT-agent.seo.vlevel]] |
| `agent.seo.sitemap` | Sitemap Generator | planned | APPROVED WITH CONDITIONS | - |
| `agent.seo.canonical` | Canonical URL Manager | planned | APPROVED WITH CONDITIONS | [[AGENT-agent.seo.canonical]] |
| `agent.seo.content` | SEO Content Generator | planned | APPROVED WITH CONDITIONS | [[AGENT-agent.seo.content]] |
| `agent.data.backup` | Backup Agent | planned | APPROVED WITH CONDITIONS | - |
| `agent.data.cleanup` | Data Cleanup Agent | planned | APPROVED WITH CONDITIONS | [[AGENT-agent.data.cleanup]] |
| `agent.data.validator` | Data Validator | planned | APPROVED WITH CONDITIONS | [[AGENT-agent.data.validator]] |
| `agent.rag.indexer` | RAG Indexer | planned | APPROVED WITH CONDITIONS | - |
| `agent.rag.validator` | RAG Validator | planned | APPROVED WITH CONDITIONS | [[AGENT-agent.rag.validator]] |
| `agent.rag.retriever` | RAG Retriever | planned | APPROVED WITH CONDITIONS | [[AGENT-agent.rag.retriever]] |
| `agent.infra.monitor` | Infra Monitor | planned | APPROVED WITH CONDITIONS | - |
| `agent.infra.logs` | Logs Aggregator | planned | APPROVED WITH CONDITIONS | [[AGENT-agent.infra.logs]] |

---

## AI-COS Support (2)

| Agent ID | Name | Status | Verdict | Fiche |
|----------|------|--------|---------|-------|
| `agent.aicos.architect` | AI-COS Architect | planned | NOT APPROVED | [[AGENT-agent.aicos.architect]] |
| `agent.aicos.governance` | AI-COS Governance | planned | NOT APPROVED | [[AGENT-agent.aicos.governance]] |

---

## AI-COS Interface (1)

| Agent ID | Name | Status | Verdict | Fiche |
|----------|------|--------|---------|-------|
| `front-agent` | UX Interface Agent | planned | NOT APPROVED | [[AGENT-front-agent]] |

---

## Lettered Series

### G-Series (Governance - 18)

| Agent ID | Name | Status | Verdict |
|----------|------|--------|---------|
| G1 | Prioritizer RICE/WSJF | planned | NOT APPROVED |
| G2 | Security Governance | planned | NOT APPROVED |
| G4 | Risk Manager | planned | NOT APPROVED |
| G5 | Meta-Score Health | planned | NOT APPROVED |
| G10 | Chaos Lite | planned | NOT APPROVED |
| G17 | Incident Coach | planned | NOT APPROVED |
| G3, G7, G11, G13, G14, G18 | (Referenced) | planned | NOT APPROVED |

### F-Series (Testing - 6)

| Agent ID | Name | Status | Verdict |
|----------|------|--------|---------|
| F1 | BAT Runner | planned | NOT APPROVED |
| F2 | UX Copilot | planned | NOT APPROVED |
| F3 | A11y Scanner | planned | NOT APPROVED |
| F4 | E2E + Perceptual | planned | NOT APPROVED |
| F5 | Observabilite UX | planned | NOT APPROVED |
| F6 | (Referenced) | planned | NOT APPROVED |

### M-Series (Mutation - 2)

| Agent ID | Name | Status | Verdict |
|----------|------|--------|---------|
| M2 | Mutation Testing | planned | NOT APPROVED |
| M4 | Shadow Traffic | planned | NOT APPROVED |

### A-Series (Architecture - 7)

| Agent ID | Name | Status | Verdict |
|----------|------|--------|---------|
| A-CARTO | Architecture Cartography | planned | NOT APPROVED |
| A2 | Dead Code Detection | planned | NOT APPROVED |
| A3 | Duplication Detector | planned | NOT APPROVED |
| A4 | Complexity Analyzer | planned | NOT APPROVED |
| A5 | Type Coverage | planned | NOT APPROVED |
| A7 | Performance Analyzer | planned | NOT APPROVED |

### B-Series (Ethics - 1)

| Agent ID | Name | Status | Verdict |
|----------|------|--------|---------|
| B7 | Ethics Guard | planned | NOT APPROVED |

---

## Python Agents (15)

### Analysis Agents (12)

| Agent ID | File | Status | Verdict | Fiche |
|----------|------|--------|---------|-------|
| a1_security | a1_security.py | active | APPROVED | [[AGENT-a1_security]] |
| a2_massive_files | a2_massive_files.py | active | APPROVED | - |
| a3_duplications | a3_duplications.py | active | APPROVED | - |
| a4_dead_code | a4_dead_code.py | active | APPROVED | - |
| a5_complexity | a5_complexity.py | active | APPROVED | - |
| a6_dependencies | a6_dependencies.py | active | APPROVED | - |
| a7_performance | a7_performance.py | active | APPROVED | - |
| a8_accessibility | a8_accessibility.py | active | APPROVED | - |
| a9_seo | a9_seo.py | active | APPROVED | - |
| a10_i18n | a10_i18n.py | active | APPROVED | - |
| a11_tests | a11_tests.py | active | APPROVED | - |
| a12_documentation | a12_documentation.py | active | APPROVED | - |

### Fixproof Agents (3)

| Agent ID | File | Status | Verdict |
|----------|------|--------|---------|
| f0_autoimport | f0_autoimport.py | active | APPROVED WITH CONDITIONS |
| f1_dead_code_surgeon | f1_dead_code_surgeon.py | active | APPROVED WITH CONDITIONS |
| f15_risk_scorer | f15_risk_scorer.py | active | APPROVED |

---

## MCP Servers (3)

| Agent ID | Name | Status | Verdict | Fiche |
|----------|------|--------|---------|-------|
| `mcp-shadcn` | shadcn MCP Server | active | APPROVED | [[AGENT-mcp-shadcn]] |
| `mcp-supabase` | Supabase MCP Server | active | APPROVED | [[AGENT-mcp-supabase]] |
| `mcp-supabase-local` | Local Supabase MCP | active | APPROVED | [[AGENT-mcp-supabase-local]] |

---

## Backend Service Agents (15)

| Agent ID | Service | Status | Verdict | Fiche |
|----------|---------|--------|---------|-------|
| seo-monitor-scheduler | SEO Monitor Scheduler | active | APPROVED | [[AGENT-seo-monitor-scheduler]] |
| seo-monitor-processor | SEO Monitor Processor | active | APPROVED | - |
| seo-audit-scheduler | SEO Audit Scheduler | active | APPROVED | - |
| seo-interpolation-monitor | Interpolation Monitor | active | APPROVED | - |
| seo-monitoring-service | SEO Monitoring | active | APPROVED | [[AGENT-seo-monitoring-service]] |
| sitemap-delta-service | Sitemap Delta | active | APPROVED | [[AGENT-sitemap-delta-service]] |
| search-monitoring-service | Search Monitoring | active | APPROVED | [[AGENT-search-monitoring-service]] |
| support-analytics-service | Support Analytics | active | APPROVED | [[AGENT-support-analytics-service]] |
| mcp-alerting-service | MCP Alerting | active | APPROVED | - |
| database-monitor | Database Monitor | active | APPROVED | - |
| metrics-processor | Metrics Processor | active | APPROVED | - |
| cache-warming-service | Cache Warming | active | APPROVED | - |
| email-processor | Email Processor | disabled | APPROVED | - |
| cache-processor | Cache Processor | disabled | APPROVED | - |
| notification-demo | Notification Demo | optional | APPROVED | - |

---

## Skills (5)

| Skill ID | Name | Status | Verdict |
|----------|------|--------|---------|
| ui-os | UI Operating System | active | APPROVED |
| ui-ux-pro-max | UI/UX Design Intelligence | active | APPROVED |
| seo-content-architect | SEO Content Architect | active | APPROVED |
| governance-vault-ops | Governance Vault Ops | active | APPROVED |
| frontend-design | Frontend Design Excellence | active | APPROVED |

---

## Backend JS Agents (2)

| Agent ID | File | Status | Verdict |
|----------|------|--------|---------|
| seo-keyword-expert | seo-keyword-expert.js | active | APPROVED |
| serp-analyzer | serp-analyzer.js | active | APPROVED |

---

## GitHub Actions (5)

| Agent ID | Workflow | Status | Verdict | Fiche |
|----------|----------|--------|---------|-------|
| `gh-ci-deploy` | ci.yml | active | APPROVED | [[AGENT-gh-ci-deploy]] |
| `gh-worker-deploy` | worker-deploy.yml | active | APPROVED | [[AGENT-gh-worker-deploy]] |
| `gh-perf-gates` | perf-gates.yml | active | APPROVED | [[AGENT-gh-perf-gates]] |
| `gh-spec-validation` | spec-validation.yml | active | APPROVED | [[AGENT-gh-spec-validation]] |
| `gh-safety-observer` | validator-dev-safety-observe.yml | active | APPROVED | [[AGENT-gh-safety-observer]] |

---

## Script Suites (2)

| Agent ID | Directory | Status | Verdict | Fiche |
|----------|-----------|--------|---------|-------|
| `ui-audit-suite` | scripts/ui-audit/ | active | APPROVED | [[AGENT-ui-audit-suite]] |
| `ui-governance-suite` | scripts/ui-governance/ | active | APPROVED | [[AGENT-ui-governance-suite]] |

---

## Restrictions Globales

- Aucun agent AI-COS Phase 0 n'est active
- Airlock enforce mode reste desactive
- Agents sans droits d'ecriture directe sur production
- Tous les agents "planned" necessitent ADR separee

---

## Lettered Series Files

| Series | File | Agents |
|--------|------|--------|
| G-Series | [[G-SERIES]] | 18 (Governance) |
| F-Series | [[F-SERIES]] | 6 (Testing) |
| M-Series | [[M-SERIES]] | 2 (Mutation) |
| A-Series | [[A-SERIES]] | 7 (Architecture) |
| B-Series | [[B-SERIES]] | 1 (Ethics) |

---

## References

- [[REG-001-agents]] - Agent Registry (Source de Verite)
- [[ADR-002-airlock-zero-trust]] - Architecture Zero-Trust
- [[ADR-003-rpc-governance]] - RPC Governance
- [[ADR-005-airlock-observe-activation]] - Airlock Observe Mode

---

_Registre gele jusqu'a ADR-006._
_Derniere mise a jour: 2026-02-03_
_Audit: Claude (Governance Analyst)_
