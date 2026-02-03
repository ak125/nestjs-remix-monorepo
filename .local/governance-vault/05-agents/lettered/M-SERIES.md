---
series_id: M-SERIES
series_name: Mutation Testing Agents
status: planned
total_agents: 2
governance_verdict: NOT_APPROVED
---

# M-Series: Mutation Testing Agents

All M-Series agents are Phase 0 planned. NOT APPROVED for activation.

## Summary

| Field | Value |
|-------|-------|
| Series | M (Mutation) |
| Count | 2 agents |
| Status | planned |
| Location | external_vps |
| Trust | untrusted |
| Verdict | NOT_APPROVED |

## Agent List

| Agent ID | Name | Role |
|----------|------|------|
| M2 | Mutation Testing | Code mutation for test quality |
| M4 | Shadow Traffic | Production traffic replay |

## Activation Requirements

1. ADR-006 approval required
2. Isolated environment mandatory
3. No production impact allowed
4. Rollback mechanism verified

## Restrictions

- MUST run on external_vps
- No production database access
- Shadow traffic requires explicit authorization

---

_Series frozen until ADR-006 approval._
_Last audit: 2026-02-03_
