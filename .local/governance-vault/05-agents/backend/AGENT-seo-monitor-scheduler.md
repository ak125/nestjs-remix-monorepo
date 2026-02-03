---
agent_id: seo-monitor-scheduler
agent_name: SEO Monitor Scheduler
status: active
owner: Backend Team
created: 2026-02-03
last_audit: 2026-02-03
governance_verdict: APPROVED
---

# Agent Fiche: seo-monitor-scheduler

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `seo-monitor-scheduler` |
| agent_name | SEO Monitor Scheduler |
| status | active |
| owner | Backend Team |
| description | Schedules SEO monitoring jobs (30min critical + 6h random sample). |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | principal_vps (worker process port 3001) |
| justification | Requires database and Redis access for job queuing. |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | trusted |
| risk_class | low |

**Risk Factors:**
- Database read operations only
- Internal service, no external exposure

## 4. Access Rights

### Read Targets
| Target | Access | Scope |
|--------|--------|-------|
| __seo_* tables | yes | full |
| __products tables | yes | read-only |
| Redis queues | yes | seo-monitor |

### Write Targets
| Target | Access |
|--------|--------|
| seo_monitor_results | yes |
| alerts table | yes |
| Redis queues | yes |

### Secret Access
- **Level**: SUPABASE_SERVICE_ROLE_KEY (required for worker)

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
| failure_behavior | retry (BullMQ) |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-003 |
| related_rules | R2 (Supabase SDK) |
| audit_trail_required | yes (via logs) |

**Activation Conditions:**
- Redis available
- Supabase connection active
- Worker process running

## 8. Placement Decision

**MUST run on principal VPS** - Internal worker process with database access.

---

## Governance Verdict

**APPROVED**

Internal monitoring service with proper isolation and logging.

---

_Audited: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
