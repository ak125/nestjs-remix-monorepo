---
agent_id: mcp-supabase-local
agent_name: Local Supabase MCP Server
status: active
owner: AutoMecanik Team
governance_verdict: APPROVED
last_audit: 2026-02-03
---

# Agent Fiche: mcp-supabase-local

## 1. Agent Identity

| Field | Value |
|-------|-------|
| agent_id | `mcp-supabase-local` |
| agent_name | Local Supabase MCP Server |
| status | active |
| owner | AutoMecanik Team |
| location_file | `scripts/mcp-server/` |
| description | Custom local MCP server for Supabase database queries |

## 2. Execution Environment

| Field | Value |
|-------|-------|
| location | local |
| server_file | `scripts/mcp-server/server.js` |
| package | `scripts/mcp-server/package.json` |

## 3. Trust & Risk

| Field | Value |
|-------|-------|
| trust_level | trusted |
| risk_class | low |
| risk_factors | Internal custom implementation, limited to SELECT queries |

## 4. Access Rights

| Target | Access |
|--------|--------|
| monorepo | read |
| database | read (SELECT only) |
| secrets | SUPABASE_SERVICE_ROLE_KEY |

## 5. Output Contract

| Field | Value |
|-------|-------|
| output_mode | report_only |
| bundle_required | no |

## 6. Tools Provided

| Tool | Description |
|------|-------------|
| `list_tables` | List all available Supabase tables |
| `describe_table` | Show table structure and columns |
| `query_table` | Execute SELECT queries with filters |
| `count_rows` | Count rows in tables |

## 7. Airlock Interaction

| Field | Value |
|-------|-------|
| airlock_required | no |

## 8. Compliance & Governance

| Field | Value |
|-------|-------|
| related_ADR | ADR-002, ADR-003 |
| audit_trail_required | no |

## 9. Placement Decision

**MUST run on local machine** - Development tool for database exploration.

---

## Governance Verdict

**APPROVED** - Read-only database queries with controlled access.

---

_Last audit: 2026-02-03_
_Auditor: Claude (Governance Analyst)_
