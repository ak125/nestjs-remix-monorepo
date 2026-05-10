# Fleet Advisor + Claude 4.7 — Design

**Date** : 2026-04-25
**Author** : Claude Opus 4.7 (1M context) on behalf of @ak125
**Status** : Approved by user, ready for implementation plan
**Scope** : AI-COS Paperclip fleet (7 agents synced + 19 platform-only) + new `Advisor` agent

---

## 1. Goal

Add an **AI peer-review layer** (Anthropic-style code-reviewer / advisor sub-agent pattern) to the AI-COS Paperclip fleet, gating high-stakes canonical writes (code PRs to `main`, DB writes to `__seo_*`/`__rag_*`/`__pieces_*`, deployments, governance-vault PRs).

In the same operation, **upgrade the fleet to the Claude 4.X family** with a tiered model assignment (Opus 4.7 for strategic + reviewer, Sonnet 4.6 for production workers, Haiku 4.5 for fast pattern checks).

The reviewer **never decides** — it scores and recommends. The human board operator retains all governance decisions (G3 signed-commits, R12 exit-contract preserved).

---

## 2. Non-goals

- No fork of Paperclip — uses native primitives only
- No Claude Code adapter modification (no PreCommit hook, no `claude_local` patch)
- No bypass of the human board operator on `assertBoard`-guarded routes
- No automatic correction by the Advisor (R12 exit-contract: propose only, never `AUTO_FIXED`)
- No review of low-stakes outputs (CMO drafts, internal CPO planning, SEO-QA quick checks) — out of scope
- No change to the 19 AI-COS-only agents beyond the model field

---

## 3. Architecture

### 3.1 New agent: Advisor

| Field | Value |
|---|---|
| Name | `Advisor` |
| Role | `advisor` |
| Reports to | CEO (`993a4a02`) |
| Adapter | `claude_local` |
| Model | `claude-opus-4-7` |
| Capabilities | "Pre-canon review for code PRs, DB writes, deployments, governance changes. Read-only. Never decides — proposes verdict + scored axes for board operator." |
| Heartbeat | 60s (idle), 30s (queue non-empty) |
| Budget | 5000 USD/month (initial — to be tuned post phase 2) |
| Skills bundle | `code-review`, `canon-write-review` (new), `content-audit`, `seo-gamme-audit` (existing in monorepo) |
| Instructions bundle | `managed`, source `agents/advisor/AGENTS.md` |

### 3.2 Wiring (4 native Paperclip primitives, no fork)

```
┌──────────────┐                                                ┌──────────────┐
│  Producer    │ 1. POST /api/companies/:id/approvals           │   Advisor    │
│  Agent       ├─────► { type: "pre_canon_review",              │   Agent      │
│ (CTO, RAG,   │         payload: {scope, body, ctx},           │              │
│  R4, Content,│         requestedByAgentId }                   │              │
│  SEO-QA*)    │                                                │              │
└──────────────┘                                                └──────┬───────┘
                                                                       │ 2. heartbeat
                                                                       │    GET /approvals?status=pending
                                                                       │       &type=pre_canon_review
                                                                       ▼
                                                              ┌─────────────────┐
                                                              │ Skill router    │
                                                              │ - code_pr →     │
                                                              │   code-review   │
                                                              │ - canon_db_*    │
                                                              │   → canon-write │
                                                              │ - deployment →  │
                                                              │   code-review + │
                                                              │   ops-checklist │
                                                              │ - governance →  │
                                                              │   adr-review    │
                                                              └────────┬────────┘
                                                                       │
                                                                       │ 3. POST /approvals/:id/comments
                                                                       │    { body: verdict_json }
                                                                       │    (no decision, just recommendation)
                                                                       ▼
                                                              ┌─────────────────┐
                                                              │   Board op      │
                                                              │   (human)       │
                                                              │   sees approval │
                                                              │   + advisor cmt │
                                                              │   /approve      │
                                                              │   /reject       │
                                                              │   /revision     │
                                                              └────────┬────────┘
                                                                       │
                                                                       │ 4. Producer next heartbeat
                                                                       ▼
                                                              ┌─────────────────┐
                                                              │   Producer      │
                                                              │   reads status: │
                                                              │   approved →    │
                                                              │     merge/write │
                                                              │   revision_req →│
                                                              │     fix & re-   │
                                                              │     submit      │
                                                              │   rejected →    │
                                                              │     abort + log │
                                                              └─────────────────┘
```

### 3.3 Approval payload schema (canonical)

```json
{
  "scope": "code_pr | canon_db_write | deployment | governance_change",
  "revision_round_count": 0,
  "context": {
    "issue_id": "string|null",
    "task_id": "string|null",
    "session_id": "string|null"
  },
  "body": {
    // shape varies per scope — see 3.4
  }
}
```

### 3.4 Per-scope `body` shape

**`code_pr`**
```json
{
  "repo": "ak125/nestjs-remix-monorepo | ak125/governance-vault",
  "branch": "feat/...",
  "base_sha": "abc...",
  "head_sha": "def...",
  "files_changed": ["path/a.ts", "path/b.sql"],
  "diff_summary": "string ≤2000 chars",
  "diff_url": "https://github.com/...",
  "related_pr_number": 123
}
```

**`canon_db_write`**
```json
{
  "table": "__seo_keyword_results | __rag_documents | __pieces_media_img | ...",
  "op": "insert | update | delete",
  "row_count": 1234,
  "sample_rows": [{"...": "..."}, "max 5"],
  "sql_or_rpc": "INSERT INTO ... | RPC name + args",
  "affected_pg_ids": [123, 456],
  "rollback_plan": "string"
}
```

**`deployment`**
```json
{
  "from_image": "massdoc/nestjs-remix-monorepo:preprod",
  "to_image": "massdoc/nestjs-remix-monorepo:production",
  "tag": "v2.1.0",
  "changelog_since_last_tag": "string",
  "smoke_test_results": "PASS | FAIL | SKIPPED",
  "rollback_image": "massdoc/...:v2.0.9"
}
```

**`governance_change`**
```json
{
  "vault_pr_number": 42,
  "adr_id": "ADR-022 | null",
  "files_changed": ["ledger/decisions/adr/...", "ops/rules/..."],
  "diff_summary": "string ≤2000 chars",
  "category": "rule_T | rule_G | rule_AI | rule_V | adr | policy | runbook"
}
```

### 3.5 Verdict format (advisor comment body, JSON canonical)

```json
{
  "version": "1.0",
  "scope": "code_pr | canon_db_write | deployment | governance_change",
  "verdict": "PASS | REVISE | BLOCK",
  "axes": {
    "correctness": 0,
    "security": 0,
    "anti_cannib": 0,
    "evidence": 0,
    "reversibility": 0
  },
  "score_total": 0,
  "findings": [
    {
      "severity": "critical | major | minor",
      "file_or_table": "string",
      "line_or_row": "string|null",
      "issue": "string",
      "suggested_fix": "string",
      "blocking": true
    }
  ],
  "evidence_pack": [
    "vault://ops/rules/rules-governance.md#G3",
    "monorepo://CLAUDE.md",
    "incident://INC-2026-005"
  ],
  "advisor_recommendation": "approve | request_revision | reject",
  "model_used": "claude-opus-4-7",
  "review_duration_ms": 12345,
  "revision_round": 0
}
```

Verdict mapping (default policy, board can override). Evaluated in order, first match wins:
1. Any finding with `severity=critical` OR explicit `verdict=BLOCK` → recommend `reject`
2. Score total < 60 → recommend `reject`
3. Score 60–79 OR `verdict=REVISE` → recommend `request_revision`
4. Score ≥ 80 AND `verdict=PASS` AND no `severity=major` → recommend `approve`
5. Otherwise → recommend `request_revision` (safe default)

---

## 4. Skills

### 4.1 Existing (reused as-is)
- `code-review` (monorepo) — security, architecture, performance, business compliance
- `content-audit` (monorepo) — Intent-First / Evidence-First / Decision-First, R1-R6
- `seo-gamme-audit` (monorepo) — full SEO gamme audit
- `responsive-audit` (monorepo) — mobile-first, shadcn/ui compliance

### 4.2 New: `canon-write-review`

Trigger : payload `scope = canon_db_write`. Validates a DB write to canonical tables before commit.

**Checks**
1. **Schema compliance** : columns match table schema, no NULL violations, no type coercion
2. **RLS policies** : write respects RLS (cf. ADR-021 hardening)
3. **Anti-cannibalisation** : keyword writes pass Jaccard threshold vs. existing rows (rules R-SEO-KW-01..07)
4. **V-Level integrity** : if writes touch V-Level surfaces, sibling-set consistency check
5. **Evidence requirement** : payload has `rollback_plan` non-empty + `sql_or_rpc` non-empty
6. **Volume sanity** : `row_count > 1000` requires explicit batch flag, else BLOCK
7. **Audit-trail** : write traceable to a vault rule, ADR, or task ID

Implementation : Python skill in `agents/advisor/skills/canon-write-review/SKILL.md` + `scripts/advisor/canon-write-review.py` (zero-LLM where possible, just runs RPCs + grep against vault rules).

### 4.3 Skill router (in Advisor's AGENTS.md)

Pseudo-logic the Advisor follows on each pending approval:

```
payload.scope == "code_pr"           → run code-review skill
payload.scope == "canon_db_write"    → run canon-write-review skill
payload.scope == "deployment"        → run code-review on changelog + ops checklist (manual)
payload.scope == "governance_change" → run code-review + cross-ref vault rules
```

---

## 5. Producer-side instructions (AGENTS.md updates)

The 5 producer agents get a new section in their `AGENTS.md`:

```markdown
## Pre-canon review (mandatory)

Before any of the following actions, you MUST create a `pre_canon_review` approval and wait for board decision before proceeding:

- [code_pr] git push of a PR to `main` on `ak125/nestjs-remix-monorepo` or `ak125/governance-vault`
- [canon_db_write] write to any `__seo_*`, `__rag_*`, `__pieces_*` table with row_count >= 10 (or any DELETE)
- [deployment] tag push `v*` triggering DEV→PROD promotion
- [governance_change] PR to `ak125/governance-vault` (any file under `ledger/`, `ops/rules/`, `ops/moc/`)

### How to create the approval

1. Build payload per `docs/superpowers/specs/2026-04-25-fleet-advisor-claude-4-7-design.md` § 3.4
2. POST `/api/companies/:companyId/approvals` with `type=pre_canon_review`
3. Note the `approvalId` in your task / commit-message-prefix as `[approval:<id>]`
4. Wait next heartbeat. Check status:
   - `approved` → proceed with the action
   - `revision_requested` → read advisor comment + board note, fix, then resubmit (`POST /approvals/:id/resubmit` with updated payload, increment `revision_round_count`)
   - `rejected` → abort, log reason in your activity, escalate to manager
5. Max 3 revision rounds. After round 3 + revise → escalate to CEO with full context.

If your action is NOT in this list, no approval is needed.
```

Producers affected:
- **CEO** : `governance_change` (when proposing ADRs)
- **CTO** : `code_pr`, `deployment`, `governance_change`
- **RAG-Ops** : `canon_db_write` (for `__rag_*` writes), `code_pr`
- **R4-Batch-Lead** : `canon_db_write` (for batch writes to `__seo_*`)
- **SEO-Content** : `canon_db_write` (for content writes)

CMO, CPO, SEO-QA, the 19 platform-only agents : no producer-side change (out of review scope).

---

## 6. Tier model assignment (Claude 4.X)

### 6.1 Local-synced fleet (8 agents post-hire)

| Agent | Current | Target | Reason |
|---|---|---|---|
| CEO (`993a4a02`) | haiku-4-5 | `claude-opus-4-7` | Strategy, multi-step delegation |
| CTO (`7fa3c971`) | haiku-4-5 | `claude-opus-4-7` | Architecture, complex code |
| **Advisor** (NEW) | — | `claude-opus-4-7` | Must reason better than producers |
| CMO (`7fb56320`) | haiku-4-5 | `claude-sonnet-4-6` | Marketing worker |
| CPO (`41718022`) | haiku-4-5 | `claude-sonnet-4-6` | Product worker |
| RAG-Ops (`c6762b10`) | haiku-4-5 | `claude-sonnet-4-6` | Pipeline ops |
| SEO-Content (`0f978206`) | haiku-4-5 | `claude-sonnet-4-6` | Content gen |
| R4-Batch-Lead (`e26ea228`) | haiku-4-5 | `claude-sonnet-4-6` | Batch orchestration |
| SEO-QA (`8ff977f4`) | haiku-4-5 | `claude-haiku-4-5-20251001` | Pattern checks (kept) |

### 6.2 Platform-only (19 agents on AI-COS without local sync)

Default upgrade to `claude-sonnet-4-6`, EXCEPT agents whose role is `ceo`, `cto`, or `advisor`/`reviewer` (if any) → `claude-opus-4-7`. Discovered via `GET /api/companies/:id/agents` and bulk PATCH.

### 6.3 Cost ceiling

Assumes platform-only fleet split per § 6.2: of the 19 platform-only agents, 0–2 hold strategic roles (`ceo`/`cto`/`advisor`) and would be Opus, the rest Sonnet, and a small minority kept on Haiku for fast pattern checks. Worst-case (2 Opus) used below.

| Tier | Local | Platform-only | Total agents | Per-agent monthly USD | Subtotal |
|---|---|---|---|---|---|
| Opus 4.7 | 3 (CEO, CTO, Advisor) | up to 2 | 5 | ~$2000 | $10,000 |
| Sonnet 4.6 | 5 (CMO, CPO, RAG, R4, SEO-Content) | ~16 | 21 | ~$300 | $6,300 |
| Haiku 4.5 | 1 (SEO-QA) | ~1 | 2 | ~$50 | $100 |
| **Total** | **9** | **19** | **28** | | **~$16,400/month worst-case** |

Realistic case (0 platform Opus) : ~$12,400/month. Baseline pre-upgrade : ~$1,400/month (all Haiku). Per-agent budget caps in `budgetMonthlyCents` enforce per-tier ceilings; alert threshold 80%.

Budget caps enforced per agent via `budgetMonthlyCents` in Paperclip. Hard cap on Advisor budget triggers fallback to Sonnet 4.6 model in `adapterConfig.fallback_model` (TBD if Paperclip supports it; otherwise alert + manual swap).

---

## 7. Failure modes & guardrails

| Failure mode | Detection | Mitigation |
|---|---|---|
| Advisor heartbeat down > 10 min | Paperclip dashboard heartbeat status | Board operator notified, can decide approval without IA recommendation (zero blocking on humans) |
| Advisor returns malformed JSON | JSON schema validation on comment body | Advisor retries 1× with stricter prompt, else flags `INSUFFICIENT_EVIDENCE`, board decides blind |
| Producer skips approval (forgets / bug) | Asynchronous CI check (post-merge) on commit messages — if `[approval:...]` missing for canon-touching commit, raise an issue auto | Detection only in phase 3; phase 2 logs warning, no enforcement |
| Revision loop infinite | `revision_round_count` in payload, advisor escalates to BLOCK + tags `MANUAL_BOARD_DECISION_REQUIRED` after round 3 | Board reviews escalated approvals daily |
| Advisor cost runaway | Per-agent budget cap, alert at 80% | Auto-pause via Paperclip `POST /agents/:id/pause` |
| Advisor false positive (BLOCKs valid work) | Phase 2 shadow mode catches before phase 3 enforcement | Tune `canon-write-review` thresholds based on phase 2 data |
| Wrong model assigned | Config revision history (`GET /api/agents/:id/config-revisions`) | Rollback via `POST /config-revisions/:id/rollback` |

---

## 8. Validation / tests

### 8.1 Smoke tests (phase 0)
1. Create faux `pre_canon_review` payload (one per scope) via curl
2. Verify Advisor heartbeat picks it up within 90s
3. Verify advisor comment posted with valid JSON verdict
4. Verify `assertBoard` blocks Advisor from `/approve` and `/reject`

### 8.2 End-to-end (phase 1)
1. CTO creates a test PR (toy change) on a sandbox branch
2. CTO creates `pre_canon_review` approval
3. Advisor reviews → posts comment
4. Board operator approves
5. CTO next heartbeat → merges
6. Verify audit trail full in approval + commit message + activity log

### 8.3 Regression — historical incident replay
Replay 3 incidents as `pre_canon_review` payloads. Advisor must `BLOCK` all 3:

| Incident | Scope | Expected verdict | Reason advisor should catch |
|---|---|---|---|
| INC-2026-005 (GSC 5xx) | code_pr | BLOCK | Missing matview cache, anti-pattern flagged in code-review |
| RAG vault rollback 2026-04-18 | canon_db_write | BLOCK | Source = LLM, not RAG/vault — caught by `canon-write-review` evidence check |
| INC-2026-009 admin password leak | code_pr | BLOCK | RLS policy missing, caught by `code-review` security axis |

If any of the 3 returns PASS, design is invalid → halt rollout.

### 8.4 Cost canary (phase 2 = 1 week shadow)
- Advisor commenting only, board ignores comments
- Daily report : N approvals reviewed, avg cost per review, false-positive rate (board approves anyway), false-negative rate (board rejects despite advisor PASS)
- Target : <10% FP, <5% FN before phase 3

---

## 9. Rollout plan

| Phase | Duration | Activities | Exit criterion |
|---|---|---|---|
| **0 — Build** | 2-3 days | Create `canon-write-review` skill, write Advisor `AGENTS.md`, hire Advisor agent on AI-COS via `/agent-hires`, set models tiering on 7 local-synced agents via PATCH, sync DEV→AI-COS | Advisor heartbeat green, smoke tests pass |
| **1 — Producers wired** | 2-3 days | Update AGENTS.md of 5 producer agents (CEO, CTO, RAG-Ops, R4-Batch-Lead, SEO-Content) with "Pre-canon review" section, sync DEV→AI-COS, run end-to-end test | E2E test pass, revision loop tested |
| **2 — Shadow mode** | 7 days | Producers create approvals, advisor comments, board ignores comments. Daily metrics dashboard | <10% FP and <5% FN observed |
| **3 — Enforcement** | ongoing | Producers must wait for board decision (approval status check is blocking); CI post-merge check active | Steady-state |

Total elapsed : ~12-13 days.

---

## 10. Migration & rollback

### 10.1 Forward
- Atomic PATCHes per agent on AI-COS (one PATCH = one model change). Failure of one PATCH does not affect others.
- Hire Advisor through `/agent-hires` (creates draft + approval) → board approves on AI-COS UI.
- AGENTS.md sync via `PUT /api/agents/:id/instructions-bundle/file` (existing flow per memory `paperclip-agents-config.md`).

### 10.2 Rollback
- **Per-agent model rollback** : `POST /api/agents/:id/config-revisions/:revisionId/rollback` (Paperclip native)
- **Advisor agent rollback** : `POST /api/agents/:id/pause` (revert all producers to no-review behavior); subsequently `POST /agents/:id/terminate` if needed
- **AGENTS.md rollback** : git revert in `agents/` folder + re-sync
- **Full rollback** : 4 commands + 1 board action ; estimated <10 min

---

## 11. Open questions (to resolve in implementation plan)

1. **Paperclip `fallback_model` support** — does `adapterConfig` allow a fallback model on budget breach? If not, design uses pause-and-alert instead. (Verify in writing-plans phase.)
2. **Approval comments retention** — verdict JSON is stored in `approval_comments.body` (text). For long-term audit, do we also mirror to `governance-vault/ledger/audit-trail/`? Decision deferred to phase 1.
3. **Advisor instruction bundle managed vs external** — `managed` recommended (consistent with CEO/CTO), but external (cwd=/repo) gives more flexibility. Decide in phase 0.
4. **CI post-merge check (phase 3)** — implement as GitHub Action workflow; design TBD in writing-plans.
5. **Skill cross-discovery** — Advisor needs `code-review`, `content-audit`, `seo-gamme-audit` skills installed in its workspace. Verify Paperclip skill injection mechanism handles multi-skill bundle.

---

## 12. Decision matrix recap

| Decision | Choice | Rationale |
|---|---|---|
| Review scope | Canon writes only (code PR, DB write, deploy, gov) | Aligns G3, R12, audit-trail; avoids advisor noise on low-stakes |
| Wiring | Native approval + comment + heartbeat | No fork, no adapter mod, no bricolage |
| Decision authority | Board operator only (`assertBoard` preserved) | G3 signed-commits, R12 exit-contract |
| Advisor model | Opus 4.7 | Must reason better than producers |
| Producer model | Sonnet 4.6 | Quality/cost balance for steady workers |
| Pattern-check model | Haiku 4.5 (kept) | Fast, cheap, sufficient for SEO-QA |
| Skills new | `canon-write-review` only | Reuse `code-review` / `content-audit` / `seo-gamme-audit` existing |
| Rollout | 4 phases incl. 7-day shadow | De-risk via observation before enforcement |
| Cost ceiling | ~$12,750/month at full enforcement | Vs ~$1,400 baseline; offset by quality + incident prevention |

---

## 13. References

- `paperclip/docs/api/approvals.md`
- `paperclip/docs/api/agents.md`
- `paperclip/docs/adapters/claude-local.md`
- `paperclip/server/src/routes/approvals.ts:121` (assertBoard guard)
- `paperclip/packages/db/src/schema/approvals.ts` (text type field — extensible)
- Memory : `paperclip-agents-config.md`, `vps-aicos.md`, `r12-exit-contract.md`, `feedback_no_hybrid_workarounds.md`
- Vault canon : `ops/rules/rules-governance.md` (G3), `ledger/decisions/adr/ADR-021-rls-hardening.md`
- Anthropic pattern : Claude Code subagent `code-reviewer` (this very environment, `superpowers:code-reviewer`)

---

_Status : design ready for writing-plans skill to produce a step-by-step implementation plan._
