---
series_id: A-SERIES
series_name: Architecture Analysis Agents
status: planned
total_agents: 7
governance_verdict: NOT_APPROVED
---

# A-Series: Architecture Analysis Agents

All A-Series agents are Phase 0 planned. NOT APPROVED for activation.

## Summary

| Field | Value |
|-------|-------|
| Series | A (Architecture) |
| Count | 7 agents |
| Status | planned |
| Location | external_vps |
| Trust | untrusted |
| Verdict | NOT_APPROVED |

## Agent List

| Agent ID | Name | Role |
|----------|------|------|
| A-CARTO | Architecture Cartography | Codebase mapping |
| A2 | Dead Code Detection | Unused code identification |
| A3 | Duplication Detector | DRY violation detection |
| A4 | Complexity Analyzer | Cyclomatic complexity |
| A5 | Type Coverage | TypeScript coverage |
| A6 | (Referenced) | TBD |
| A7 | Performance Analyzer | Performance bottlenecks |

## Activation Requirements

1. ADR-006 approval required
2. Read-only monorepo clone
3. No production access
4. Report-only output

## Restrictions

- MUST run on external_vps
- Read-only access only
- No code modifications

---

_Series frozen until ADR-006 approval._
_Last audit: 2026-02-03_
