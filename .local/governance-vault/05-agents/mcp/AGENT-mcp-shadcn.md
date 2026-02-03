---
agent_id: mcp-shadcn
agent_name: shadcn MCP Server
status: active
owner: Claude Code
governance_verdict: APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: mcp-shadcn

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `mcp-shadcn` |
| agent_name | shadcn MCP Server |
| status | active |
| owner | Claude Code |
| description | External MCP server for shadcn/ui component library integration |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | local |
| config_file | `.mcp.json` |
| command | `npx shadcn@latest mcp` |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | trusted |
| risk_class | low |
| risk_factors | Read-only component queries, no database access |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| database | no |
| secrets | none |

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | report_only |
| bundle_required | no |

## 6. Airlock Interaction

| Field | Value |
|-------|-------|
| airlock_required | no |

## 7. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-002 |
| audit_trail_required | no |

## 8. Placement Decision

**MUST run on local machine** - Development tool for UI component queries.

---

## Governance Verdict

**APPROVED** - Read-only component library integration.

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
