---
agent_id: agent.seo.vlevel
agent_name: V-Level Generator Agent
status: planned
owner: SEO Team
created: 2026-02-03
last_audit: 2026-02-03
governance_verdict: APPROVED_WITH_CONDITIONS
---

# Agent Fiche: agent.seo.vlevel

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `agent.seo.vlevel` |
| agent_name | V-Level Generator Agent |
| status | planned |
| owner | SEO Team |
| description | Calculates V-Level scores (V1-V5) for SEO pages. |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps |
| justification | Database intensive, needs Supabase access. |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | restricted |
| risk_class | low |

**Risk Factors:**
- Read-heavy operations
- Could affect SEO visibility if miscalculated
- No code modifications

## 4. Access Rights

### Read Targets
| Target | Access | Scope |
|--------|--------|-------|
| __seo_* tables | yes | full |
| __sitemap_* tables | yes | full |
| monorepo | no | - |

### Write Targets
| Target | Access |
|--------|--------|
| __seo_vlevel_scores | yes (via RPC) |
| monorepo | no |

### Secret Access
- **Level**: none (uses RPC via RpcGateService)

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
| related_ADR | ADR-003 |
| related_rules | R7 (SEO) |
| audit_trail_required | yes |

**Activation Conditions:**
- RpcGateService active
- SEO tables populated
- agent.seo.lead available (optional)

## 8. Placement Decision

**MUST run on principal VPS** - Database operations require internal network.

---

## Governance Verdict

**APPROVED WITH CONDITIONS**

Conditions:
1. Data operations via RPC only (no direct SQL)
2. RpcGateService must be active
3. Results logged for audit

---

_Audited: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
