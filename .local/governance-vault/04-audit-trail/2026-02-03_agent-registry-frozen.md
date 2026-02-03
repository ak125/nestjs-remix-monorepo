---
date: 2026-02-03
type: governance
status: completed
author: Claude (Governance Analyst)
trigger: Phase 5 Formalization
---

# Agent Registry Frozen

## Summary

The agent registry (REG-001) is now the **official source of truth** for the AutoMecanik system.

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Total Agents | 116 |
| APPROVED | 40 |
| APPROVED_WITH_CONDITIONS | 8 |
| NOT_APPROVED | 43 |
| Pending Fiches | 25 |

---

## Structure Created

```
05-agents/
├── registry/
│   └── REG-001-agents.md      # Source de verite
├── bmad/
│   ├── AGENT-bmad-master.md
│   └── AGENT-dev.md
├── ai-cos/
│   ├── AGENT-agent.ceo.ia.md
│   └── AGENT-agent.seo.vlevel.md
├── python/
│   └── AGENT-a1_security.md
├── backend/
│   └── AGENT-seo-monitor-scheduler.md
├── skills/
│   └── (pending)
└── lettered/
    ├── G-SERIES.md
    ├── F-SERIES.md
    ├── M-SERIES.md
    ├── A-SERIES.md
    └── B-SERIES.md
```

---

## Key Decisions

1. **REG-001 is the source of truth** - parsable by CI/Airlock
2. **40 agents APPROVED** for immediate operation
3. **8 agents APPROVED WITH CONDITIONS** - require Airlock/RPC
4. **43 agents NOT APPROVED** - Phase 0 only
5. **Registry is FROZEN** until ADR-006 approval

---

## Restrictions Enforced

- No agent activation without fiche
- No Phase 0 agent activation
- Airlock enforce mode remains OFF
- Direct write access remains FORBIDDEN
- No REG-001 modification without ADR

---

## Validation Checklist

- [x] REG-001-agents.md created
- [x] Fiches renamed to AGENT-* format
- [x] Lettered series condensed (G/F/M/A/B)
- [x] MOC-Agents.md updated with REG-001 reference
- [x] Audit-trail entry created

---

## Next Steps

1. Complete remaining 25 fiches
2. Create ADR-006 for AI-COS Phase 1
3. Configure CI to validate REG-001
4. Set up Airlock integration

---

## References

- REG-001-agents.md
- MOC-Agents.md
- ADR-002, ADR-003, ADR-005
- Plan file: abstract-exploring-wind.md

---

_Signed: Claude (Opus 4.5)_
_Date: 2026-02-03_
_Status: Registry FROZEN_
