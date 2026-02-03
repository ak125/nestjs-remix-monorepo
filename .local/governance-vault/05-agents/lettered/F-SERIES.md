---
series_id: F-SERIES
series_name: Testing Framework Agents
status: planned
total_agents: 6
governance_verdict: NOT_APPROVED
---

# F-Series: Testing Framework Agents

All F-Series agents are Phase 0 planned. NOT APPROVED for activation.

## Summary

| Field | Value |
|-------|-------|
| Series | F (Testing) |
| Count | 6 agents |
| Status | planned |
| Location | external_vps |
| Trust | untrusted |
| Verdict | NOT_APPROVED |

## Agent List

| Agent ID | Name | Role |
|----------|------|------|
| F1 | BAT Runner | Basic acceptance tests |
| F2 | UX Copilot | UX testing automation |
| F3 | A11y Scanner | Accessibility compliance |
| F4 | E2E + Perceptual | End-to-end visual testing |
| F5 | Observabilite UX | UX metrics collection |
| F6 | (Referenced) | TBD |

## Activation Requirements

1. ADR-006 approval required
2. External VPS configured
3. Test isolation verified
4. No production data access

## Restrictions

- MUST run on external_vps
- Read-only access to monorepo
- No database access

---

_Series frozen until ADR-006 approval._
_Last audit: 2026-02-03_
