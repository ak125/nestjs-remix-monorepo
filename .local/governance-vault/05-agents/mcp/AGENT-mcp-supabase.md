---
agent_id: mcp-supabase
agent_name: Supabase MCP Server
status: active
owner: Supabase
governance_verdict: APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: mcp-supabase

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `mcp-supabase` |
| agent_name | Supabase MCP Server |
| status | active |
| owner | Supabase |
| description | Official Supabase MCP server for database operations |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | local |
| config_file | `.mcp.json` |
| command | `npx -y @supabase/mcp-server-supabase@latest` |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | trusted |
| risk_class | low |
| risk_factors | Uses access token for authentication |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| database | read/write (via Supabase API) |
| secrets | SUPABASE_ACCESS_TOKEN |

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
| related_ADR | ADR-002, ADR-003 |
| audit_trail_required | yes (via Supabase logs) |

## 8. Placement Decision

**MUST run on local machine** - Development tool for Supabase operations.

---

## Governance Verdict

**APPROVED** - Official Supabase integration with proper authentication.

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
