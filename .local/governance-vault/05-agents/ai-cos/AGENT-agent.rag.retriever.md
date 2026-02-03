---
agent_id: agent.rag.retriever
agent_name: RAG Retriever Agent
status: planned
owner: RAG Team
governance_verdict: APPROVED_WITH_CONDITIONS
last_audit: 2026-02-03
---

# Agent Fiche: agent.rag.retriever

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `agent.rag.retriever` |
| agent_name | RAG Retriever Agent |
| status | planned |
| owner | RAG Team |
| parent_lead | agent.rag.lead |
| squad | rag |
| description | Retrieves relevant knowledge from RAG system for agent queries |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps |
| justification | Requires access to RAG knowledge base and vector store |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | restricted |
| risk_class | low |
| risk_factors | Read-only retrieval, could return stale data if index not updated |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| rag_knowledge tables | read |
| vector_store | read |
| logs/metrics | yes |
| secrets | embedding API keys (if applicable) |

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | report_only |
| bundle_required | no |
| constraints_profile | default |

## 6. Airlock Interaction

| Field | Value |
|-------|-------|
| airlock_required | no (read-only) |
| airlock_mode | N/A |
| failure_behavior | log_only |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-003 |
| related_rules | R1 (monorepo) |
| audit_trail_required | yes |
| activation_conditions | agent.rag.lead deployed, RAG module active |

## 8. Placement Decision

**MUST run on principal VPS** - Requires access to RAG knowledge base and vector store.

---

## Governance Verdict

**APPROVED WITH CONDITIONS**

Conditions:
- Read-only access to RAG systems
- ADR-006 approval required for activation

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
