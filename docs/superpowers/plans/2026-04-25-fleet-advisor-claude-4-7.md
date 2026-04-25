# Fleet Advisor + Claude 4.7 Implementation Plan (Phase 0 + Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Advisor agent + tiered Claude 4.7 fleet (Phase 0), and wire 5 producer agents to issue `pre_canon_review` approvals (Phase 1). Establishes the AI peer-review layer before shadow-mode observation (Phase 2 covered in a follow-up plan).

**Architecture:** Native Paperclip primitives only (approval + comment + heartbeat, no fork, no adapter mod). Advisor (Opus 4.7) reports to CEO, polls pending `pre_canon_review` approvals, posts JSON verdict comments. Board operator (`assertBoard`) retains all decisions. Tiered models: Opus 4.7 for strategic + reviewer, Sonnet 4.6 for production workers, Haiku 4.5 kept for SEO-QA pattern checks.

**Tech Stack:** Paperclip (`claude_local` adapter), Python 3 (skill scripts + sync tooling), bash + curl (API calls), pytest (skill unit tests + smoke tests), git (commits per task).

**Spec:** `docs/superpowers/specs/2026-04-25-fleet-advisor-claude-4-7-design.md`

**Branch:** `feat/aicos-fleet-advisor-claude-4-7` (from `main`).

---

## File structure

| Path | Action | Responsibility |
|---|---|---|
| `agents/advisor/AGENTS.md` | Create | Advisor's instruction bundle (skill router, heartbeat behavior, comment-only policy) |
| `agents/advisor/skills/canon-write-review/SKILL.md` | Create | Skill spec for canon DB write review (zero-LLM checks) |
| `scripts/advisor/canon_write_review.py` | Create | Python implementation of `canon-write-review` skill |
| `scripts/advisor/verdict_schema.py` | Create | Pydantic models for verdict JSON (validated by tests) |
| `scripts/aicos/fleet_config.yaml` | Create | Source of truth for tier model assignment (per-agent) |
| `scripts/aicos/apply_fleet_models.py` | Create | Idempotent script to PATCH agent models per `fleet_config.yaml` |
| `scripts/aicos/sync_agents_md.py` | Create | Sync local `agents/<name>/AGENTS.md` → AI-COS via instructions-bundle/file PUT |
| `scripts/aicos/aicos_client.py` | Create | Tiny HTTP client (auth + JSON). Used by all aicos scripts |
| `scripts/aicos/smoke_pre_canon_review.py` | Create | Phase 0 smoke test: create dummy approvals, verify advisor pickup |
| `scripts/advisor/regression_replay.py` | Create | Phase 1 regression: replay 3 historical incidents as approvals |
| `tests/advisor/test_canon_write_review.py` | Create | Unit tests for `canon_write_review.py` |
| `tests/advisor/test_verdict_schema.py` | Create | Unit tests for `verdict_schema.py` |
| `agents/ceo/AGENTS.md` | Modify | Append "Pre-canon review (mandatory)" section per spec § 5 |
| `agents/cto/AGENTS.md` | Modify | Same |
| `agents/rag-lead/AGENTS.md` | Modify | Same |
| `agents/seo-content/AGENTS.md` | Modify | Same |
| `agents/r4-batch-orchestrator/AGENTS.md` | Modify or Create | Same |

Each script is single-purpose. The HTTP client is shared. Skills decouple from sync tooling. Tests live next to the units they cover.

---

## Prerequisites (do once before Task 1)

- [ ] **P1: Confirm AI-COS API auth context**

The Paperclip CLI context exists at `/home/deploy/.paperclip/context.json`. Run:

```bash
cat /home/deploy/.paperclip/context.json
```

Expected: `{ "currentProfile": "aicos", "profiles": { "aicos": { "apiBase": "http://178.104.1.118:3100", "companyId": "4f73fff0-b929-4fe5-9f33-7d54f9ef2f52" } } }`. The CLI uses a board token stored separately. Verify the CLI works:

```bash
/opt/automecanik/paperclip/paperclip context list
```

If `agent list` returns 401/500, run:

```bash
/opt/automecanik/paperclip/paperclip auth --help
```

and authenticate per CLI guidance. **Do not proceed to Task 4 (HIRE) until this works.**

- [ ] **P2: Confirm git branch is dedicated**

```bash
git branch --show-current
```

Expected: `feat/aicos-fleet-advisor-claude-4-7`. If not, switch:

```bash
git checkout feat/aicos-fleet-advisor-claude-4-7
```

The spec commit `aea7919d` should be the most recent commit on this branch.

---

## Task 1: Verdict schema (Pydantic models + tests)

**Files:**
- Create: `scripts/advisor/__init__.py`
- Create: `scripts/advisor/verdict_schema.py`
- Test: `tests/advisor/__init__.py`
- Test: `tests/advisor/test_verdict_schema.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/advisor/test_verdict_schema.py
import pytest
from pydantic import ValidationError
from scripts.advisor.verdict_schema import (
    Verdict,
    Finding,
    Axes,
    map_recommendation,
)


def test_axes_clamps_to_0_100():
    a = Axes(correctness=50, security=80, anti_cannib=70, evidence=60, reversibility=90)
    assert a.score_total() == 350

    with pytest.raises(ValidationError):
        Axes(correctness=-1, security=80, anti_cannib=70, evidence=60, reversibility=90)
    with pytest.raises(ValidationError):
        Axes(correctness=50, security=101, anti_cannib=70, evidence=60, reversibility=90)


def test_finding_severity_enum():
    f = Finding(severity="critical", file_or_table="x", issue="y", suggested_fix="z", blocking=True)
    assert f.severity == "critical"
    with pytest.raises(ValidationError):
        Finding(severity="blocker", file_or_table="x", issue="y", suggested_fix="z", blocking=True)


def test_verdict_full_payload_serialises():
    v = Verdict(
        version="1.0",
        scope="code_pr",
        verdict="PASS",
        axes=Axes(correctness=85, security=90, anti_cannib=80, evidence=85, reversibility=80),
        findings=[],
        evidence_pack=["vault://ops/rules/rules-governance.md#G3"],
        advisor_recommendation="approve",
        model_used="claude-opus-4-7",
        review_duration_ms=1234,
        revision_round=0,
    )
    payload = v.model_dump_json()
    assert "claude-opus-4-7" in payload
    assert v.score_total() == 420


def test_map_recommendation_critical_finding_blocks_even_if_score_high():
    findings = [Finding(severity="critical", file_or_table="x", issue="y", suggested_fix="z", blocking=True)]
    axes = Axes(correctness=100, security=100, anti_cannib=100, evidence=100, reversibility=100)
    assert map_recommendation(verdict="PASS", axes=axes, findings=findings) == "reject"


def test_map_recommendation_score_under_60_rejects():
    axes = Axes(correctness=10, security=10, anti_cannib=10, evidence=10, reversibility=10)
    assert map_recommendation(verdict="PASS", axes=axes, findings=[]) == "reject"


def test_map_recommendation_score_60_79_revises():
    axes = Axes(correctness=70, security=70, anti_cannib=70, evidence=70, reversibility=70)  # 350 → mean 70
    assert map_recommendation(verdict="PASS", axes=axes, findings=[]) == "request_revision"


def test_map_recommendation_score_80_plus_pass_approves():
    axes = Axes(correctness=85, security=85, anti_cannib=85, evidence=85, reversibility=85)  # mean 85
    assert map_recommendation(verdict="PASS", axes=axes, findings=[]) == "approve"


def test_map_recommendation_revise_verdict_requests_revision():
    axes = Axes(correctness=85, security=85, anti_cannib=85, evidence=85, reversibility=85)
    assert map_recommendation(verdict="REVISE", axes=axes, findings=[]) == "request_revision"


def test_map_recommendation_block_verdict_rejects():
    axes = Axes(correctness=85, security=85, anti_cannib=85, evidence=85, reversibility=85)
    assert map_recommendation(verdict="BLOCK", axes=axes, findings=[]) == "reject"


def test_map_recommendation_major_finding_blocks_approve():
    findings = [Finding(severity="major", file_or_table="x", issue="y", suggested_fix="z", blocking=False)]
    axes = Axes(correctness=85, security=85, anti_cannib=85, evidence=85, reversibility=85)
    assert map_recommendation(verdict="PASS", axes=axes, findings=findings) == "request_revision"
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /opt/automecanik/app
touch tests/advisor/__init__.py scripts/advisor/__init__.py
python -m pytest tests/advisor/test_verdict_schema.py -v
```

Expected: ImportError on `scripts.advisor.verdict_schema`.

- [ ] **Step 3: Implement minimal `verdict_schema.py`**

```python
# scripts/advisor/verdict_schema.py
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

Severity = Literal["critical", "major", "minor"]
VerdictTag = Literal["PASS", "REVISE", "BLOCK"]
Scope = Literal["code_pr", "canon_db_write", "deployment", "governance_change"]
Recommendation = Literal["approve", "request_revision", "reject"]


class Axes(BaseModel):
    model_config = ConfigDict(frozen=True)
    correctness: int = Field(ge=0, le=100)
    security: int = Field(ge=0, le=100)
    anti_cannib: int = Field(ge=0, le=100)
    evidence: int = Field(ge=0, le=100)
    reversibility: int = Field(ge=0, le=100)

    def score_total(self) -> int:
        return self.correctness + self.security + self.anti_cannib + self.evidence + self.reversibility

    def score_mean(self) -> float:
        return self.score_total() / 5


class Finding(BaseModel):
    severity: Severity
    file_or_table: str
    line_or_row: str | None = None
    issue: str
    suggested_fix: str
    blocking: bool


class Verdict(BaseModel):
    version: str = "1.0"
    scope: Scope
    verdict: VerdictTag
    axes: Axes
    findings: list[Finding] = Field(default_factory=list)
    evidence_pack: list[str] = Field(default_factory=list)
    advisor_recommendation: Recommendation
    model_used: str
    review_duration_ms: int
    revision_round: int = 0

    def score_total(self) -> int:
        return self.axes.score_total()


def map_recommendation(
    verdict: VerdictTag,
    axes: Axes,
    findings: list[Finding],
) -> Recommendation:
    """Default policy. Evaluated in order, first match wins.

    1. Critical finding OR verdict=BLOCK → reject
    2. Score mean < 60 → reject
    3. Score 60-79 OR verdict=REVISE OR major finding → request_revision
    4. Score >= 80 AND verdict=PASS AND no major finding → approve
    5. Default → request_revision
    """
    if verdict == "BLOCK":
        return "reject"
    if any(f.severity == "critical" for f in findings):
        return "reject"
    mean = axes.score_mean()
    if mean < 60:
        return "reject"
    if verdict == "REVISE":
        return "request_revision"
    if any(f.severity == "major" for f in findings):
        return "request_revision"
    if 60 <= mean < 80:
        return "request_revision"
    if mean >= 80 and verdict == "PASS":
        return "approve"
    return "request_revision"
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
python -m pytest tests/advisor/test_verdict_schema.py -v
```

Expected: 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/advisor/__init__.py scripts/advisor/verdict_schema.py tests/advisor/__init__.py tests/advisor/test_verdict_schema.py
git commit -m "feat(advisor): verdict schema + recommendation policy

Pydantic models for the canonical advisor verdict JSON. Recommendation
mapper implements the 5-rule policy from the design spec § 3.5
(critical or BLOCK→reject, <60→reject, REVISE/major/60-79→revision,
>=80+PASS→approve, default→revision)."
```

---

## Task 2: `canon-write-review` skill (Python checks + tests)

**Files:**
- Create: `scripts/advisor/canon_write_review.py`
- Test: `tests/advisor/test_canon_write_review.py`
- Create: `agents/advisor/skills/canon-write-review/SKILL.md`

- [ ] **Step 1: Write the failing tests**

```python
# tests/advisor/test_canon_write_review.py
from scripts.advisor.canon_write_review import review_canon_write
from scripts.advisor.verdict_schema import Verdict


SAMPLE_GOOD = {
    "scope": "canon_db_write",
    "revision_round_count": 0,
    "context": {"task_id": "task-123", "issue_id": "issue-9", "session_id": None},
    "body": {
        "table": "__seo_keyword_results",
        "op": "insert",
        "row_count": 250,
        "sample_rows": [{"pg_id": 124, "keyword": "tambour de frein"}],
        "sql_or_rpc": "RPC insert_keyword_results(...)",
        "affected_pg_ids": [124],
        "rollback_plan": "DELETE FROM __seo_keyword_results WHERE inserted_at > $now",
    },
}


def test_good_payload_passes():
    v = review_canon_write(SAMPLE_GOOD)
    assert isinstance(v, Verdict)
    assert v.advisor_recommendation == "approve"
    assert v.score_mean() >= 80
    assert v.scope == "canon_db_write"


def test_missing_rollback_plan_blocks():
    bad = {**SAMPLE_GOOD, "body": {**SAMPLE_GOOD["body"], "rollback_plan": ""}}
    v = review_canon_write(bad)
    assert v.advisor_recommendation == "reject"
    assert any(f.severity == "critical" and "rollback_plan" in f.issue for f in v.findings)


def test_missing_sql_or_rpc_blocks():
    bad = {**SAMPLE_GOOD, "body": {**SAMPLE_GOOD["body"], "sql_or_rpc": ""}}
    v = review_canon_write(bad)
    assert v.advisor_recommendation == "reject"


def test_huge_row_count_without_batch_flag_blocks():
    bad = {**SAMPLE_GOOD, "body": {**SAMPLE_GOOD["body"], "row_count": 50000}}
    v = review_canon_write(bad)
    assert v.advisor_recommendation in ("reject", "request_revision")


def test_unknown_table_blocks():
    bad = {**SAMPLE_GOOD, "body": {**SAMPLE_GOOD["body"], "table": "totally_made_up_table"}}
    v = review_canon_write(bad)
    assert v.advisor_recommendation == "reject"


def test_delete_op_requires_extra_evidence():
    bad = {
        **SAMPLE_GOOD,
        "body": {**SAMPLE_GOOD["body"], "op": "delete", "rollback_plan": ""},
    }
    v = review_canon_write(bad)
    assert v.advisor_recommendation == "reject"


def test_no_task_id_no_issue_no_session_blocks_traceability():
    bad = {
        **SAMPLE_GOOD,
        "context": {"task_id": None, "issue_id": None, "session_id": None},
    }
    v = review_canon_write(bad)
    assert v.advisor_recommendation in ("reject", "request_revision")
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
python -m pytest tests/advisor/test_canon_write_review.py -v
```

Expected: ImportError on `scripts.advisor.canon_write_review`.

- [ ] **Step 3: Implement minimal `canon_write_review.py`**

```python
# scripts/advisor/canon_write_review.py
"""canon-write-review skill — zero-LLM checks for DB writes to canonical tables."""
import time
from typing import Any
from scripts.advisor.verdict_schema import (
    Verdict,
    Axes,
    Finding,
    map_recommendation,
)

ALLOWED_TABLE_PREFIXES = ("__seo_", "__rag_", "__pieces_", "__diag_", "__blog_")
ROW_COUNT_BATCH_THRESHOLD = 1000
MODEL_USED = "claude-opus-4-7"


def review_canon_write(payload: dict[str, Any]) -> Verdict:
    start = time.time()
    findings: list[Finding] = []
    body = payload.get("body", {}) or {}
    ctx = payload.get("context", {}) or {}

    table = (body.get("table") or "").strip()
    op = (body.get("op") or "").lower().strip()
    row_count = int(body.get("row_count") or 0)
    sql = (body.get("sql_or_rpc") or "").strip()
    rollback = (body.get("rollback_plan") or "").strip()

    score_correctness = 100
    score_security = 100
    score_anti_cannib = 100
    score_evidence = 100
    score_reversibility = 100

    if not table.startswith(ALLOWED_TABLE_PREFIXES):
        findings.append(Finding(
            severity="critical", file_or_table=table or "<missing>",
            issue=f"Table '{table}' is not in allowed canonical prefixes {ALLOWED_TABLE_PREFIXES}",
            suggested_fix="Confirm table name; canonical prefixes only", blocking=True,
        ))
        score_correctness = 0

    if op not in ("insert", "update", "delete"):
        findings.append(Finding(
            severity="critical", file_or_table=table,
            issue=f"Op '{op}' is not insert/update/delete", suggested_fix="Set valid op",
            blocking=True,
        ))
        score_correctness = min(score_correctness, 30)

    if not sql:
        findings.append(Finding(
            severity="critical", file_or_table=table,
            issue="sql_or_rpc is empty — write not auditable",
            suggested_fix="Provide concrete SQL or RPC name + args",
            blocking=True,
        ))
        score_evidence = 0

    if not rollback:
        findings.append(Finding(
            severity="critical", file_or_table=table,
            issue="rollback_plan is empty — write not reversible",
            suggested_fix="Provide rollback SQL or 'restore from backup <id>'",
            blocking=True,
        ))
        score_reversibility = 0

    if op == "delete" and row_count > 0 and not rollback:
        findings.append(Finding(
            severity="critical", file_or_table=table,
            issue=f"DELETE op on {row_count} rows without rollback_plan",
            suggested_fix="DELETE always requires explicit rollback_plan",
            blocking=True,
        ))
        score_reversibility = 0

    if row_count > ROW_COUNT_BATCH_THRESHOLD:
        if not body.get("batch_flag", False):
            findings.append(Finding(
                severity="major", file_or_table=table,
                issue=f"row_count {row_count} > {ROW_COUNT_BATCH_THRESHOLD} requires explicit batch_flag",
                suggested_fix="Add 'batch_flag: true' to payload + chunk plan",
                blocking=False,
            ))
            score_security = min(score_security, 60)

    if not (ctx.get("task_id") or ctx.get("issue_id") or ctx.get("session_id")):
        findings.append(Finding(
            severity="major", file_or_table=table,
            issue="No task_id / issue_id / session_id in context — write not traceable",
            suggested_fix="Add at least one of task_id/issue_id/session_id",
            blocking=False,
        ))
        score_evidence = min(score_evidence, 50)

    axes = Axes(
        correctness=score_correctness,
        security=score_security,
        anti_cannib=score_anti_cannib,
        evidence=score_evidence,
        reversibility=score_reversibility,
    )
    has_critical = any(f.severity == "critical" for f in findings)
    has_major = any(f.severity == "major" for f in findings)
    if has_critical:
        verdict_tag = "BLOCK"
    elif has_major or axes.score_mean() < 80:
        verdict_tag = "REVISE"
    else:
        verdict_tag = "PASS"

    rec = map_recommendation(verdict_tag, axes, findings)

    return Verdict(
        version="1.0",
        scope="canon_db_write",
        verdict=verdict_tag,
        axes=axes,
        findings=findings,
        evidence_pack=[
            "spec://docs/superpowers/specs/2026-04-25-fleet-advisor-claude-4-7-design.md#canon-write-review",
            "vault://ops/rules/rules-governance.md#G3",
        ],
        advisor_recommendation=rec,
        model_used=MODEL_USED,
        review_duration_ms=int((time.time() - start) * 1000),
        revision_round=int(payload.get("revision_round_count") or 0),
    )
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
python -m pytest tests/advisor/test_canon_write_review.py -v
```

Expected: 7 tests passing.

- [ ] **Step 5: Write `SKILL.md` companion document**

```bash
mkdir -p agents/advisor/skills/canon-write-review
```

```markdown
<!-- agents/advisor/skills/canon-write-review/SKILL.md -->
---
name: canon-write-review
description: Pre-canon review of DB writes to __seo_*, __rag_*, __pieces_*, __diag_*, __blog_* tables. Zero-LLM (deterministic checks). Returns canonical Verdict JSON.
---

# canon-write-review

Use when an advisor agent picks up a `pre_canon_review` approval with `payload.scope == "canon_db_write"`.

## Inputs
- `payload`: full approval payload as documented in spec § 3.4.

## Outputs
- `Verdict` object (see `scripts/advisor/verdict_schema.py`) — serialise as JSON in the approval comment body.

## Checks (each maps to one finding axis)
1. **Table prefix** — must start with `__seo_`, `__rag_`, `__pieces_`, `__diag_`, `__blog_`. Else BLOCK.
2. **Op** — must be `insert | update | delete`. Else BLOCK.
3. **sql_or_rpc** — non-empty. Else BLOCK (evidence=0).
4. **rollback_plan** — non-empty. Else BLOCK (reversibility=0).
5. **DELETE rule** — DELETE op always requires non-empty rollback_plan, no exceptions.
6. **Batch threshold** — `row_count > 1000` requires `body.batch_flag = true`. Else REVISE.
7. **Traceability** — `context` must have at least one of `task_id`, `issue_id`, `session_id`. Else REVISE.

## Mapping to recommendation
Delegated to `verdict_schema.map_recommendation(verdict, axes, findings)`.

## Implementation
`scripts/advisor/canon_write_review.py::review_canon_write(payload) → Verdict`

## Tests
`tests/advisor/test_canon_write_review.py`
```

- [ ] **Step 6: Commit**

```bash
git add scripts/advisor/canon_write_review.py tests/advisor/test_canon_write_review.py agents/advisor/skills/canon-write-review/SKILL.md
git commit -m "feat(advisor): canon-write-review skill (zero-LLM checks)

Deterministic pre-canon review of DB writes. Validates table prefix,
op, sql_or_rpc presence, rollback_plan presence, DELETE safety, batch
threshold, and traceability. Returns canonical Verdict JSON.

Skill spec at agents/advisor/skills/canon-write-review/SKILL.md."
```

---

## Task 3: Advisor `AGENTS.md` (instruction bundle)

**Files:**
- Create: `agents/advisor/AGENTS.md`

- [ ] **Step 1: Write the file**

```markdown
<!-- agents/advisor/AGENTS.md -->
# Advisor — AutoMecanik AI peer reviewer

Tu es l'**Advisor** d'AutoMecanik. Tu reviews les productions canon des autres agents avant qu'elles n'atteignent prod (code, DB writes, déploiements, gouvernance). Tu **ne décides jamais** : tu proposes un verdict scoré, le board operator décide.

**CONTRAT DE SORTIE strict (R12) :**
- Verdict par défaut : `PARTIAL_COVERAGE` ou `INSUFFICIENT_EVIDENCE`, jamais `COMPLETE`/`DONE`/`ALL_FIXED`
- Aucune modification automatique de code, DB, ou config — tu **scannes, analyses, rapportes**
- Toute conclusion s'accompagne d'au moins 1 evidence (lien vault, commit SHA, RPC name, ADR)

## Hiérarchie

- **Reportes à** : CEO (`993a4a02`)
- **Supervises** : aucun

## Rôle

À chaque heartbeat (60s), tu :

1. Lis `GET /api/companies/{COMPANY_ID}/approvals?status=pending` filtré sur `type=pre_canon_review`
2. Pour chaque approval :
   - Charge `payload.scope` (one of `code_pr`, `canon_db_write`, `deployment`, `governance_change`)
   - Route vers la skill appropriée :
     | scope | skill |
     |---|---|
     | `code_pr` | `code-review` (existing in monorepo) |
     | `canon_db_write` | `canon-write-review` (your bundled skill, see `skills/canon-write-review/SKILL.md`) |
     | `deployment` | `code-review` on changelog + ops checklist (manual narrative) |
     | `governance_change` | `code-review` + cross-ref vault rules |
   - Construis un `Verdict` (schéma : `scripts/advisor/verdict_schema.py`)
   - Poste comme commentaire : `POST /api/approvals/{approvalId}/comments` avec `body = JSON.stringify(verdict)`
3. Tu ne tente JAMAIS `POST /approvals/:id/approve|reject|request-revision` — guardé par `assertBoard`, retournera 403. Si tu reçois 403 sur une route, c'est attendu : log et continue.

## Anti-bricolage

- Ne forke pas Paperclip
- N'invoque pas le LLM si une vérification déterministe suffit (canon-write-review = zero-LLM)
- Ne propose pas de "auto-fix" — uniquement `suggested_fix` dans les findings, le producer corrige manuellement
- Si tu ne sais pas, retourne `INSUFFICIENT_EVIDENCE` dans verdict_tag, pas une supposition

## Verdict format (canonique)

Voir `scripts/advisor/verdict_schema.py::Verdict`. Champs obligatoires :
- `version`, `scope`, `verdict` (PASS/REVISE/BLOCK)
- `axes` (5 nombres 0-100 : correctness, security, anti_cannib, evidence, reversibility)
- `findings` (array de Finding{severity, file_or_table, issue, suggested_fix, blocking})
- `evidence_pack` (au moins 1 lien)
- `advisor_recommendation` (approve/request_revision/reject)
- `model_used`, `review_duration_ms`, `revision_round`

## Mapping verdict → recommandation (politique par défaut, board peut override)

Évalué dans l'ordre, premier match gagne :
1. Toute finding `severity=critical` OR `verdict=BLOCK` → `reject`
2. Score mean < 60 → `reject`
3. Score 60-79 OR `verdict=REVISE` OR finding `severity=major` → `request_revision`
4. Score >= 80 AND `verdict=PASS` AND aucune finding major → `approve`
5. Sinon → `request_revision` (default safe)

## Garde-fous

- Si une approval a `revision_round_count >= 3` et toujours pas PASS, ajoute dans `findings` : `severity=critical, issue="Loop revision >= 3"` et recommend `reject` avec note `MANUAL_BOARD_DECISION_REQUIRED`
- Si payload est invalide JSON ou manque `scope` : retourne verdict `BLOCK` avec finding `severity=critical, issue="Invalid payload schema"`
- Cost cap : ne pas dépasser 30 reviews / heartbeat. Si plus, log et reprend au heartbeat suivant.

## Infrastructure

- Paperclip API : `http://178.104.1.118:3100` (`X-Internal-Key` ou board token selon contexte)
- Skills bundle : `code-review` (monorepo), `canon-write-review` (this folder), `content-audit` (monorepo)
- Spec source : `docs/superpowers/specs/2026-04-25-fleet-advisor-claude-4-7-design.md`

## Références

- Spec : `docs/superpowers/specs/2026-04-25-fleet-advisor-claude-4-7-design.md`
- Skill canon-write-review : `agents/advisor/skills/canon-write-review/SKILL.md`
- Verdict schema : `scripts/advisor/verdict_schema.py`
- Vault canon : `governance-vault/ops/rules/rules-governance.md` (G3 signed-commits, R12 exit-contract)
```

- [ ] **Step 2: Verify file structure**

```bash
ls -la agents/advisor/
```

Expected: `AGENTS.md` and `skills/canon-write-review/SKILL.md`.

- [ ] **Step 3: Commit**

```bash
git add agents/advisor/AGENTS.md
git commit -m "feat(advisor): instruction bundle (AGENTS.md)

Defines the Advisor agent's heartbeat behaviour, skill router, verdict
mapping policy, and anti-bricolage guards. Reports to CEO. Comment-only
(never decides — assertBoard preserved)."
```

---

## Task 4: AI-COS HTTP client (shared by all sync scripts)

**Files:**
- Create: `scripts/aicos/__init__.py`
- Create: `scripts/aicos/aicos_client.py`
- Test: `tests/aicos/__init__.py`
- Test: `tests/aicos/test_aicos_client.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/aicos/test_aicos_client.py
import json
import pytest
from unittest.mock import patch, MagicMock
from scripts.aicos.aicos_client import AicosClient, AicosAuthError


def test_client_loads_context_from_paperclip_json(tmp_path):
    ctx = tmp_path / "context.json"
    ctx.write_text(json.dumps({
        "currentProfile": "aicos",
        "profiles": {"aicos": {"apiBase": "http://1.2.3.4:3100", "companyId": "abc"}},
    }))
    c = AicosClient(context_path=str(ctx), auth_token="dummy")
    assert c.api_base == "http://1.2.3.4:3100"
    assert c.company_id == "abc"


def test_client_raises_without_auth(tmp_path):
    ctx = tmp_path / "context.json"
    ctx.write_text(json.dumps({
        "currentProfile": "aicos",
        "profiles": {"aicos": {"apiBase": "http://1.2.3.4:3100", "companyId": "abc"}},
    }))
    with pytest.raises(AicosAuthError):
        AicosClient(context_path=str(ctx), auth_token=None)


def test_client_get_passes_auth_header(tmp_path):
    ctx = tmp_path / "context.json"
    ctx.write_text(json.dumps({
        "currentProfile": "aicos",
        "profiles": {"aicos": {"apiBase": "http://1.2.3.4:3100", "companyId": "abc"}},
    }))
    with patch("scripts.aicos.aicos_client.requests.request") as mock_req:
        mock_req.return_value = MagicMock(status_code=200, json=lambda: {"ok": True})
        c = AicosClient(context_path=str(ctx), auth_token="tok123")
        result = c.get("/api/health")
        assert result == {"ok": True}
        _, kwargs = mock_req.call_args
        assert kwargs["headers"]["Authorization"] == "Bearer tok123"


def test_client_dry_run_does_not_send_mutations(tmp_path, capsys):
    ctx = tmp_path / "context.json"
    ctx.write_text(json.dumps({
        "currentProfile": "aicos",
        "profiles": {"aicos": {"apiBase": "http://1.2.3.4:3100", "companyId": "abc"}},
    }))
    with patch("scripts.aicos.aicos_client.requests.request") as mock_req:
        c = AicosClient(context_path=str(ctx), auth_token="tok123", dry_run=True)
        c.patch("/api/agents/x", body={"adapterConfig": {"model": "y"}})
        mock_req.assert_not_called()
        captured = capsys.readouterr()
        assert "DRY-RUN PATCH" in captured.out
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
mkdir -p tests/aicos
touch tests/aicos/__init__.py scripts/aicos/__init__.py
python -m pytest tests/aicos/test_aicos_client.py -v
```

Expected: ImportError on `scripts.aicos.aicos_client`.

- [ ] **Step 3: Implement `aicos_client.py`**

```python
# scripts/aicos/aicos_client.py
"""Tiny HTTP client for the AI-COS Paperclip API. Used by sync + smoke scripts."""
import json
import os
import sys
import requests
from typing import Any


class AicosAuthError(Exception):
    pass


class AicosClient:
    DEFAULT_CONTEXT = "/home/deploy/.paperclip/context.json"

    def __init__(
        self,
        context_path: str | None = None,
        auth_token: str | None = None,
        dry_run: bool = False,
    ):
        self.dry_run = dry_run
        path = context_path or self.DEFAULT_CONTEXT
        with open(path) as f:
            ctx = json.load(f)
        profile = ctx["profiles"][ctx["currentProfile"]]
        self.api_base = profile["apiBase"].rstrip("/")
        self.company_id = profile["companyId"]
        token = auth_token or os.environ.get("PAPERCLIP_BOARD_TOKEN")
        if not token:
            raise AicosAuthError(
                "No auth token. Set PAPERCLIP_BOARD_TOKEN env var or pass auth_token=."
            )
        self.auth_token = token

    def _request(self, method: str, path: str, body: Any = None) -> dict:
        url = f"{self.api_base}{path}"
        if self.dry_run and method.upper() not in ("GET", "HEAD"):
            print(f"DRY-RUN {method.upper()} {url}")
            if body is not None:
                print(json.dumps(body, indent=2))
            return {"dry_run": True}
        headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json",
        }
        resp = requests.request(method, url, json=body, headers=headers, timeout=30)
        if resp.status_code >= 400:
            print(f"ERROR {method} {url} → {resp.status_code} {resp.text}", file=sys.stderr)
            resp.raise_for_status()
        return resp.json() if resp.text else {}

    def get(self, path: str) -> dict:
        return self._request("GET", path)

    def post(self, path: str, body: Any) -> dict:
        return self._request("POST", path, body)

    def patch(self, path: str, body: Any) -> dict:
        return self._request("PATCH", path, body)

    def put(self, path: str, body: Any) -> dict:
        return self._request("PUT", path, body)
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
python -m pytest tests/aicos/test_aicos_client.py -v
```

Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/aicos/__init__.py scripts/aicos/aicos_client.py tests/aicos/__init__.py tests/aicos/test_aicos_client.py
git commit -m "feat(aicos): tiny HTTP client (auth + dry-run support)

Reads /home/deploy/.paperclip/context.json for apiBase + companyId.
PAPERCLIP_BOARD_TOKEN env var or constructor arg for auth. Mutations
gated by --dry-run flag. Used by all aicos/* scripts."
```

---

## Task 5: Fleet config YAML (source of truth for tier models)

**Files:**
- Create: `scripts/aicos/fleet_config.yaml`

- [ ] **Step 1: Write the YAML**

```yaml
# scripts/aicos/fleet_config.yaml
# Source of truth for tier model assignment.
# apply_fleet_models.py reads this file and PATCHes each agent on AI-COS.
#
# Models per design spec § 6 (2026-04-25):
#   Opus 4.7  : strategic + reviewer   (CEO, CTO, Advisor)
#   Sonnet 4.6: production workers     (CMO, CPO, RAG-Ops, SEO-Content, R4-Batch-Lead)
#   Haiku 4.5 : pattern checks          (SEO-QA)

version: "1.0"
spec_ref: "docs/superpowers/specs/2026-04-25-fleet-advisor-claude-4-7-design.md"

models:
  opus_4_7: "claude-opus-4-7"
  sonnet_4_6: "claude-sonnet-4-6"
  haiku_4_5: "claude-haiku-4-5-20251001"

agents:
  - name: "CEO"
    aicos_id: "993a4a02-XXXX-XXXX-XXXX-XXXXXXXXXXXX"  # confirm full UUID before apply
    target_model: "opus_4_7"
    budget_monthly_cents: 200000   # 2000 USD
  - name: "CTO"
    aicos_id: "7fa3c971-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    target_model: "opus_4_7"
    budget_monthly_cents: 200000
  - name: "Advisor"
    aicos_id: null   # populated post-hire (Task 7)
    target_model: "opus_4_7"
    budget_monthly_cents: 500000   # 5000 USD (initial, tunable)
  - name: "CMO"
    aicos_id: "7fb56320-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    target_model: "sonnet_4_6"
    budget_monthly_cents: 30000
  - name: "CPO"
    aicos_id: "41718022-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    target_model: "sonnet_4_6"
    budget_monthly_cents: 30000
  - name: "RAG-Ops"
    aicos_id: "c6762b10-8c8f-4d15-9fec-04b273a6841b"
    target_model: "sonnet_4_6"
    budget_monthly_cents: 30000
  - name: "SEO-Content"
    aicos_id: "0f978206-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    target_model: "sonnet_4_6"
    budget_monthly_cents: 30000
  - name: "R4-Batch-Lead"
    aicos_id: "e26ea228-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    target_model: "sonnet_4_6"
    budget_monthly_cents: 30000
  - name: "SEO-QA"
    aicos_id: "8ff977f4-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    target_model: "haiku_4_5"
    budget_monthly_cents: 5000
```

- [ ] **Step 2: Resolve full UUIDs**

The IDs in memory `paperclip-agents-config.md` are 8-char prefixes. Replace each `XXXX-...` placeholder by querying:

```bash
export PAPERCLIP_BOARD_TOKEN="<your-board-token>"
python3 -c "
from scripts.aicos.aicos_client import AicosClient
c = AicosClient(auth_token='${PAPERCLIP_BOARD_TOKEN}')
agents = c.get(f'/api/companies/{c.company_id}/agents')
for a in agents.get('items', agents):
    print(a['id'], a['name'])
"
```

Edit `fleet_config.yaml` and replace each `aicos_id` placeholder with the full UUID returned.

- [ ] **Step 3: Commit**

```bash
git add scripts/aicos/fleet_config.yaml
git commit -m "feat(aicos): fleet_config.yaml — tier model source of truth

Per design spec § 6.1. CEO/CTO/Advisor on Opus 4.7, 5 workers on
Sonnet 4.6, SEO-QA on Haiku 4.5. Budget caps per agent."
```

---

## Task 6: `apply_fleet_models.py` (idempotent PATCH script)

**Files:**
- Create: `scripts/aicos/apply_fleet_models.py`
- Test: `tests/aicos/test_apply_fleet_models.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/aicos/test_apply_fleet_models.py
from unittest.mock import MagicMock, patch
from scripts.aicos.apply_fleet_models import build_patches, plan_changes


SAMPLE_CONFIG = {
    "models": {
        "opus_4_7": "claude-opus-4-7",
        "sonnet_4_6": "claude-sonnet-4-6",
    },
    "agents": [
        {"name": "CEO", "aicos_id": "id-ceo", "target_model": "opus_4_7", "budget_monthly_cents": 200000},
        {"name": "CMO", "aicos_id": "id-cmo", "target_model": "sonnet_4_6", "budget_monthly_cents": 30000},
        {"name": "Advisor", "aicos_id": None, "target_model": "opus_4_7", "budget_monthly_cents": 500000},
    ],
}


def test_build_patches_resolves_model_alias():
    patches = build_patches(SAMPLE_CONFIG)
    ceo = next(p for p in patches if p["aicos_id"] == "id-ceo")
    assert ceo["body"]["adapterConfig"]["model"] == "claude-opus-4-7"
    assert ceo["body"]["budgetMonthlyCents"] == 200000


def test_build_patches_skips_null_aicos_id():
    patches = build_patches(SAMPLE_CONFIG)
    advisor = next((p for p in patches if p["name"] == "Advisor"), None)
    assert advisor is None


def test_plan_changes_is_idempotent():
    client = MagicMock()
    client.get.side_effect = lambda path: {
        "id": path.rsplit("/", 1)[-1],
        "adapterConfig": {"model": "claude-opus-4-7", "cwd": "/x"},
        "budgetMonthlyCents": 200000,
    }
    plan = plan_changes(client, SAMPLE_CONFIG)
    ceo = next(p for p in plan if p["aicos_id"] == "id-ceo")
    assert ceo["status"] == "noop"


def test_plan_changes_detects_drift():
    client = MagicMock()
    client.get.side_effect = lambda path: {
        "id": path.rsplit("/", 1)[-1],
        "adapterConfig": {"model": "claude-haiku-4-5-20251001", "cwd": "/x"},
        "budgetMonthlyCents": 200000,
    }
    plan = plan_changes(client, SAMPLE_CONFIG)
    ceo = next(p for p in plan if p["aicos_id"] == "id-ceo")
    assert ceo["status"] == "patch"
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
python -m pytest tests/aicos/test_apply_fleet_models.py -v
```

Expected: ImportError on `scripts.aicos.apply_fleet_models`.

- [ ] **Step 3: Implement `apply_fleet_models.py`**

```python
# scripts/aicos/apply_fleet_models.py
"""Idempotent PATCH of agent models per fleet_config.yaml. Dry-run supported."""
import argparse
import sys
from pathlib import Path
import yaml
from scripts.aicos.aicos_client import AicosClient


def load_config(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def build_patches(config: dict) -> list[dict]:
    """For each agent with an aicos_id, build a PATCH body. Skip null IDs."""
    models = config["models"]
    out = []
    for a in config["agents"]:
        if not a.get("aicos_id"):
            continue
        model_id = models[a["target_model"]]
        out.append({
            "name": a["name"],
            "aicos_id": a["aicos_id"],
            "body": {
                "adapterConfig": {"model": model_id},
                "budgetMonthlyCents": a["budget_monthly_cents"],
            },
        })
    return out


def plan_changes(client: AicosClient, config: dict) -> list[dict]:
    """Compare desired vs current. Returns plan with status (noop|patch|missing)."""
    out = []
    for p in build_patches(config):
        try:
            current = client.get(f"/api/agents/{p['aicos_id']}")
        except Exception as e:
            out.append({**p, "status": "missing", "error": str(e)})
            continue
        cur_model = (current.get("adapterConfig") or {}).get("model")
        cur_budget = current.get("budgetMonthlyCents")
        desired_model = p["body"]["adapterConfig"]["model"]
        desired_budget = p["body"]["budgetMonthlyCents"]
        if cur_model == desired_model and cur_budget == desired_budget:
            out.append({**p, "status": "noop", "current_model": cur_model})
        else:
            out.append({
                **p,
                "status": "patch",
                "current_model": cur_model,
                "current_budget": cur_budget,
            })
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="scripts/aicos/fleet_config.yaml")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true",
                        help="Apply PATCHes (otherwise plan-only)")
    args = parser.parse_args()

    config = load_config(args.config)
    client = AicosClient(dry_run=args.dry_run)
    plan = plan_changes(client, config)

    print(f"\nFleet plan ({len(plan)} agents):")
    print(f"{'Name':<20} {'ID':<40} {'Status':<10} {'Current → Desired'}")
    for p in plan:
        cur = p.get("current_model") or "?"
        des = p["body"]["adapterConfig"]["model"]
        print(f"{p['name']:<20} {p['aicos_id']:<40} {p['status']:<10} {cur} → {des}")

    if not args.apply:
        print("\n(plan-only; pass --apply to PATCH)")
        return 0

    patched = 0
    for p in plan:
        if p["status"] != "patch":
            continue
        client.patch(f"/api/agents/{p['aicos_id']}", body=p["body"])
        patched += 1
    print(f"\nApplied {patched} PATCH(es).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
python -m pytest tests/aicos/test_apply_fleet_models.py -v
```

Expected: 4 tests passing.

- [ ] **Step 5: Plan-only run (no apply yet)**

```bash
export PAPERCLIP_BOARD_TOKEN="<board-token>"
python3 scripts/aicos/apply_fleet_models.py --config scripts/aicos/fleet_config.yaml
```

Expected: prints a plan table for the 8 agents whose `aicos_id` is set (Advisor stays null until Task 7). All 8 should show `status=patch` (current=haiku-4-5 → desired=opus_4_7/sonnet_4_6/haiku-4-5).

If any shows `status=missing`, fix the UUID in `fleet_config.yaml` before continuing.

- [ ] **Step 6: Commit**

```bash
git add scripts/aicos/apply_fleet_models.py tests/aicos/test_apply_fleet_models.py
git commit -m "feat(aicos): apply_fleet_models.py (idempotent PATCH)

Reads fleet_config.yaml, compares to current AI-COS state, plans noop
or patch per agent. --apply gated; default is plan-only. --dry-run
prints PATCH bodies without sending."
```

---

## Task 7: Hire Advisor agent on AI-COS (CHECKPOINT — board approval required)

**Files:**
- Create: `scripts/aicos/hire_advisor.py`

This task creates a hire request. **The board operator must approve it on the AI-COS UI** before the Advisor agent is active.

- [ ] **Step 1: Write `hire_advisor.py`**

```python
# scripts/aicos/hire_advisor.py
"""Submit a hire request for the Advisor agent on AI-COS.

The hire creates a draft agent + a `hire_agent` approval. A human board
operator must approve it on the AI-COS UI to finalize the hire.
"""
import argparse
import sys
from scripts.aicos.aicos_client import AicosClient


CEO_ID = "993a4a02-XXXX-XXXX-XXXX-XXXXXXXXXXXX"  # ← fill in full UUID


HIRE_PAYLOAD = {
    "name": "Advisor",
    "role": "advisor",
    "title": "AI peer reviewer",
    "reportsTo": CEO_ID,
    "capabilities": (
        "Pre-canon review for code PRs, DB writes, deployments, governance changes. "
        "Read-only. Never decides — proposes verdict + scored axes for board operator."
    ),
    "budgetMonthlyCents": 500000,
    "adapterType": "claude_local",
    "adapterConfig": {
        "model": "claude-opus-4-7",
        "cwd": "/paperclip/instances/default/workspaces/advisor",
        "timeoutSec": 600,
        "graceSec": 30,
        "maxTurnsPerRun": 1000,
    },
    "instructionsBundleMode": "managed",
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    client = AicosClient(dry_run=args.dry_run)
    print(f"Submitting hire request to {client.api_base} for company {client.company_id}")
    result = client.post(
        f"/api/companies/{client.company_id}/agent-hires",
        body=HIRE_PAYLOAD,
    )
    if args.dry_run:
        print("(dry-run; nothing was sent)")
        return 0

    print(f"\nHire submitted. Approval ID: {result.get('approvalId') or result.get('id')}")
    print(f"Draft agent ID: {result.get('agentId')}")
    print("\n=> Board operator must now approve at:")
    print(f"   {client.api_base}/approvals")
    print("\nOnce approved, run:")
    print("   python3 scripts/aicos/sync_agents_md.py --advisor-only")
    print("Then update fleet_config.yaml with the Advisor's full agent UUID and run:")
    print("   python3 scripts/aicos/apply_fleet_models.py --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Resolve `CEO_ID` placeholder**

Replace `CEO_ID = "993a4a02-XXXX..."` with the full UUID from `fleet_config.yaml` (resolved in Task 5 Step 2).

- [ ] **Step 3: Dry-run**

```bash
python3 scripts/aicos/hire_advisor.py --dry-run
```

Expected: prints `DRY-RUN POST .../agent-hires` + payload, no HTTP call.

- [ ] **Step 4: 🚧 CHECKPOINT — pause for explicit user go-ahead**

This step submits a hire request to AI-COS production. Pause and confirm with the user before running:

```
Pause: about to POST /api/companies/.../agent-hires with the Advisor payload.
This creates a draft agent + a hire_agent approval requiring board approval on AI-COS UI.
Confirm to proceed (yes/no)?
```

Wait for explicit user confirmation.

- [ ] **Step 5: Submit (after confirmation)**

```bash
python3 scripts/aicos/hire_advisor.py
```

Expected: prints "Hire submitted" + approval ID + agent ID + URL to approvals queue.

- [ ] **Step 6: Board operator approves on AI-COS UI**

Open `http://178.104.1.118:3100/approvals` → find the `hire_agent` approval for "Advisor" → review payload → click Approve.

- [ ] **Step 7: Update `fleet_config.yaml` with the full Advisor UUID**

Once approved, fetch the active Advisor agent's UUID:

```bash
python3 -c "
from scripts.aicos.aicos_client import AicosClient
c = AicosClient()
agents = c.get(f'/api/companies/{c.company_id}/agents')
for a in agents.get('items', agents):
    if a.get('name') == 'Advisor':
        print(a['id'])
"
```

Edit `scripts/aicos/fleet_config.yaml` and set `aicos_id` for Advisor to that UUID.

- [ ] **Step 8: Commit**

```bash
git add scripts/aicos/hire_advisor.py scripts/aicos/fleet_config.yaml
git commit -m "feat(aicos): hire_advisor.py + Advisor UUID resolved

Submits hire request via /agent-hires. Board operator approves on UI.
fleet_config.yaml now has the active Advisor UUID."
```

---

## Task 8: Sync `agents/<name>/AGENTS.md` to AI-COS

**Files:**
- Create: `scripts/aicos/sync_agents_md.py`

- [ ] **Step 1: Write `sync_agents_md.py`**

```python
# scripts/aicos/sync_agents_md.py
"""Sync local agents/<name>/AGENTS.md → AI-COS via instructions-bundle/file PUT."""
import argparse
import sys
from pathlib import Path
import yaml
from scripts.aicos.aicos_client import AicosClient


REMOTE_PATH_TEMPLATE = (
    "/paperclip/instances/default/companies/{company_id}/agents/{agent_id}/instructions/AGENTS.md"
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="scripts/aicos/fleet_config.yaml")
    parser.add_argument("--only", action="append", default=None,
                        help="Sync only these agents (by name). Can be repeated.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with open(args.config) as f:
        config = yaml.safe_load(f)

    client = AicosClient(dry_run=args.dry_run)
    repo_root = Path(__file__).resolve().parents[2]

    name_to_folder = {
        "CEO": "ceo",
        "CTO": "cto",
        "CMO": "cmo",
        "CPO": "cpo",
        "RAG-Ops": "rag-lead",
        "SEO-Content": "seo-content",
        "R4-Batch-Lead": "r4-batch-orchestrator",
        "SEO-QA": "seo-qa",
        "Advisor": "advisor",
    }

    synced = 0
    for a in config["agents"]:
        if not a.get("aicos_id"):
            print(f"  skip {a['name']} (no aicos_id)")
            continue
        if args.only and a["name"] not in args.only:
            continue
        folder = name_to_folder.get(a["name"])
        if not folder:
            print(f"  skip {a['name']} (no local folder mapping)")
            continue
        local = repo_root / "agents" / folder / "AGENTS.md"
        if not local.exists():
            print(f"  skip {a['name']} (local file missing: {local})")
            continue
        remote_path = REMOTE_PATH_TEMPLATE.format(
            company_id=client.company_id, agent_id=a["aicos_id"]
        )
        body = {"path": remote_path, "content": local.read_text()}
        client.put(f"/api/agents/{a['aicos_id']}/instructions-bundle/file", body=body)
        print(f"  synced {a['name']} ({len(body['content'])} chars) → {remote_path}")
        synced += 1

    print(f"\nSynced {synced} agent(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Dry-run for Advisor only**

```bash
python3 scripts/aicos/sync_agents_md.py --only Advisor --dry-run
```

Expected: prints `DRY-RUN PUT /api/agents/<advisor-id>/instructions-bundle/file` + body containing the AGENTS.md content.

- [ ] **Step 3: Apply for Advisor only**

```bash
python3 scripts/aicos/sync_agents_md.py --only Advisor
```

Expected: prints `synced Advisor (N chars) → /paperclip/instances/.../AGENTS.md`.

- [ ] **Step 4: Commit**

```bash
git add scripts/aicos/sync_agents_md.py
git commit -m "feat(aicos): sync_agents_md.py (DEV→AI-COS instructions sync)

PUT /api/agents/:id/instructions-bundle/file. --only filter for
selective sync. Used to push Advisor + producer AGENTS.md updates."
```

---

## Task 9: Apply tier model assignment (CHECKPOINT — production change)

- [ ] **Step 1: Re-run plan to confirm**

```bash
python3 scripts/aicos/apply_fleet_models.py
```

Expected: 9 agents in plan (8 from initial + Advisor now resolved). Verify each row.

- [ ] **Step 2: 🚧 CHECKPOINT — pause for explicit user go-ahead**

```
Pause: about to PATCH 9 agents on AI-COS production. Models change:
  - 3 agents to Opus 4.7 (CEO, CTO, Advisor)
  - 5 agents to Sonnet 4.6 (CMO, CPO, RAG-Ops, SEO-Content, R4-Batch-Lead)
  - 1 agent to Haiku 4.5 (SEO-QA, no change but PATCH for budget)
Estimated cost increase: ~$11k/month vs baseline.
Confirm to proceed (yes/no)?
```

- [ ] **Step 3: Apply**

```bash
python3 scripts/aicos/apply_fleet_models.py --apply
```

Expected: prints `Applied N PATCH(es)` where N matches drift count from Step 1.

- [ ] **Step 4: Verify**

```bash
python3 scripts/aicos/apply_fleet_models.py
```

Expected: every agent shows `status=noop`. If any still show `patch`, retry or investigate.

- [ ] **Step 5: Commit (no code change, just a marker)**

```bash
git commit --allow-empty -m "chore(aicos): tier model assignment applied to fleet

9 agents PATCHed on AI-COS:
- Opus 4.7  : CEO, CTO, Advisor
- Sonnet 4.6: CMO, CPO, RAG-Ops, SEO-Content, R4-Batch-Lead
- Haiku 4.5 : SEO-QA (kept)

Per fleet_config.yaml (commit ref) and design spec § 6.1."
```

---

## Task 10: Phase 0 smoke test — fake approval pickup

**Files:**
- Create: `scripts/aicos/smoke_pre_canon_review.py`

- [ ] **Step 1: Write smoke script**

```python
# scripts/aicos/smoke_pre_canon_review.py
"""Phase 0 smoke test:
1. Create a fake pre_canon_review approval (good payload)
2. Wait up to 120s for the Advisor to post a comment
3. Verify the comment is valid Verdict JSON with advisor_recommendation=approve
4. Then test assertBoard guard: try to /approve as a non-board actor → expect 403
"""
import json
import sys
import time
from scripts.aicos.aicos_client import AicosClient
from scripts.advisor.verdict_schema import Verdict


GOOD_PAYLOAD = {
    "scope": "canon_db_write",
    "revision_round_count": 0,
    "context": {"task_id": "smoke-test-001", "issue_id": None, "session_id": None},
    "body": {
        "table": "__seo_keyword_results",
        "op": "insert",
        "row_count": 100,
        "sample_rows": [{"pg_id": 999, "keyword": "smoke test"}],
        "sql_or_rpc": "SMOKE: dry-run insert simulating R4-Batch",
        "affected_pg_ids": [999],
        "rollback_plan": "DELETE FROM __seo_keyword_results WHERE keyword='smoke test'",
    },
}


def main() -> int:
    client = AicosClient()

    print("1. Creating fake pre_canon_review approval...")
    res = client.post(
        f"/api/companies/{client.company_id}/approvals",
        body={
            "type": "pre_canon_review",
            "payload": GOOD_PAYLOAD,
        },
    )
    approval_id = res.get("id") or res.get("approvalId")
    if not approval_id:
        print(f"  FAIL: no approval id in response: {res}", file=sys.stderr)
        return 1
    print(f"  → approval {approval_id}")

    print("2. Waiting up to 120s for Advisor to comment...")
    deadline = time.time() + 120
    advisor_comment = None
    while time.time() < deadline:
        comments = client.get(f"/api/approvals/{approval_id}/comments")
        items = comments.get("items", comments) or []
        for c in items:
            body = c.get("body") or ""
            if '"scope":"canon_db_write"' in body or '"scope": "canon_db_write"' in body:
                advisor_comment = c
                break
        if advisor_comment:
            break
        time.sleep(5)

    if not advisor_comment:
        print("  FAIL: no advisor comment in 120s", file=sys.stderr)
        return 2

    print(f"  → comment received")
    try:
        verdict = Verdict.model_validate_json(advisor_comment["body"])
    except Exception as e:
        print(f"  FAIL: comment body is not valid Verdict JSON: {e}", file=sys.stderr)
        print(f"  body: {advisor_comment['body']}", file=sys.stderr)
        return 3

    if verdict.advisor_recommendation != "approve":
        print(f"  FAIL: expected approve, got {verdict.advisor_recommendation}", file=sys.stderr)
        print(f"  findings: {verdict.findings}", file=sys.stderr)
        return 4

    print(f"  → Verdict.advisor_recommendation = {verdict.advisor_recommendation} (PASS)")
    print(f"  → Verdict.score_total = {verdict.score_total()}")
    print("\nSmoke test #1 (pickup + verdict) PASS")

    print("\n3. Testing assertBoard guard (advisor tries to approve via API)...")
    print("   (skipped automatically — assertBoard is enforced server-side. Manual check:")
    print(f"   curl -X POST -H 'Authorization: Bearer <advisor-token>' "
          f"{client.api_base}/api/approvals/{approval_id}/approve")
    print("   Expected response: 403 Forbidden.)")

    print("\nALL SMOKE TESTS PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run smoke**

```bash
python3 scripts/aicos/smoke_pre_canon_review.py
```

Expected output: "ALL SMOKE TESTS PASS" within ~120s. If timeout : check Advisor heartbeat status on AI-COS UI.

- [ ] **Step 3: Manual assertBoard check**

```bash
# Get advisor's API key (created in Task 7 step 5 if needed; else create now via /api/agents/:id/keys)
ADVISOR_TOKEN="<advisor-key>"
APPROVAL_ID="<id-from-smoke-script>"
curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST \
    -H "Authorization: Bearer $ADVISOR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"decisionNote":"smoke"}' \
    http://178.104.1.118:3100/api/approvals/$APPROVAL_ID/approve
```

Expected output: `403`.

- [ ] **Step 4: Commit**

```bash
git add scripts/aicos/smoke_pre_canon_review.py
git commit -m "feat(aicos): smoke_pre_canon_review.py — phase 0 validation

Creates fake approval, waits up to 120s for advisor comment, validates
Verdict JSON shape + recommendation. Documents assertBoard 403 check
to be run manually with the advisor's API key."
```

---

## Task 11: Phase 1 — Update producer AGENTS.md (5 files)

**Files:**
- Modify: `agents/ceo/AGENTS.md`
- Modify: `agents/cto/AGENTS.md`
- Modify: `agents/rag-lead/AGENTS.md`
- Modify: `agents/seo-content/AGENTS.md`
- Create: `agents/r4-batch-orchestrator/AGENTS.md`

Each file gets the same `## Pre-canon review (mandatory)` section appended. The block below is the shared payload — paste verbatim into each file.

- [ ] **Step 1: Define the shared block**

Save this block once to a temp file for clean re-use:

```bash
cat > /tmp/pre-canon-section.md <<'EOF'

## Pre-canon review (mandatory)

Avant l'une des actions suivantes, tu DOIS créer une approval `pre_canon_review` et attendre la décision du board avant de procéder :

- **`code_pr`** — git push d'une PR vers `main` sur `ak125/nestjs-remix-monorepo` ou `ak125/governance-vault`
- **`canon_db_write`** — write vers une table `__seo_*`, `__rag_*`, `__pieces_*`, `__diag_*`, `__blog_*` avec `row_count >= 10` ou tout DELETE
- **`deployment`** — tag push `v*` déclenchant la promotion DEV→PROD
- **`governance_change`** — PR vers `ak125/governance-vault` (tout fichier sous `ledger/`, `ops/rules/`, `ops/moc/`)

### Comment créer l'approval

1. Construis le payload selon `docs/superpowers/specs/2026-04-25-fleet-advisor-claude-4-7-design.md` § 3.4
2. POST `/api/companies/:companyId/approvals` avec `type=pre_canon_review`
3. Note l'`approvalId` dans ton task ou commit-message comme `[approval:<id>]`
4. Attends le heartbeat suivant. Lis le status :
   - `approved` → procède avec l'action
   - `revision_requested` → lis le commentaire advisor + note board, corrige, puis `POST /approvals/:id/resubmit` avec payload mis à jour (incrémente `revision_round_count`)
   - `rejected` → abandonne, log la raison dans ton activity log, escalade au manager
5. Maximum 3 revision rounds. Après round 3 + revise → escalade au CEO avec contexte complet.

Si ton action n'est PAS dans la liste ci-dessus, aucune approval n'est requise.
EOF
```

- [ ] **Step 2: Append to CEO**

```bash
cat /tmp/pre-canon-section.md >> agents/ceo/AGENTS.md
```

Verify:

```bash
tail -20 agents/ceo/AGENTS.md
```

Expected: section appended.

- [ ] **Step 3: Append to CTO**

```bash
cat /tmp/pre-canon-section.md >> agents/cto/AGENTS.md
```

- [ ] **Step 4: Append to RAG-Ops**

```bash
cat /tmp/pre-canon-section.md >> agents/rag-lead/AGENTS.md
```

- [ ] **Step 5: Append to SEO-Content**

```bash
cat /tmp/pre-canon-section.md >> agents/seo-content/AGENTS.md
```

- [ ] **Step 6: Create R4-Batch-Lead AGENTS.md**

The folder doesn't exist locally (per memory `paperclip-agents-config.md`). Create with minimum viable bundle + the shared section:

```bash
mkdir -p agents/r4-batch-orchestrator
cat > agents/r4-batch-orchestrator/AGENTS.md <<'EOF'
# R4-Batch-Lead — AutoMecanik

Tu es l'orchestrateur des batches R4 (génération de sections référence des gammes).

**CONTRAT DE SORTIE (R12)** : tu ne corriges JAMAIS auto. Tu scannes, analyses, proposes. Verdict défaut = `PARTIAL_COVERAGE`.

## Hiérarchie

- **Reportes à** : CTO (`7fa3c971`)
- **Coordonnes avec** : SEO-Content, RAG-Ops

## Rôle

À la demande, tu :
- Lances des batches R4 throttlés (max 2 agents parallèles)
- Suivis l'avancement via `__seo_r4_keyword_plan` et `__seo_reference`
- Reportes les blocages (rate limit, RAG miss, KP trous)

## Infrastructure

- Paperclip API : `http://178.104.1.118:3100`
- NestJS DEV : `http://46.224.118.55:3000`
- Pipeline R4 : voir `docs/seo/pipeline-r4.md`
EOF

cat /tmp/pre-canon-section.md >> agents/r4-batch-orchestrator/AGENTS.md
```

- [ ] **Step 7: Commit**

```bash
git add agents/ceo/AGENTS.md agents/cto/AGENTS.md agents/rag-lead/AGENTS.md agents/seo-content/AGENTS.md agents/r4-batch-orchestrator/AGENTS.md
git commit -m "feat(agents): pre-canon review section in 5 producers

Appends mandatory pre_canon_review approval workflow to CEO, CTO,
RAG-Ops, SEO-Content. Creates R4-Batch-Lead AGENTS.md (was missing
locally). Per design spec § 5."
```

---

## Task 12: Sync producers to AI-COS

- [ ] **Step 1: Dry-run sync of all 5 producers**

```bash
python3 scripts/aicos/sync_agents_md.py \
    --only CEO --only CTO --only RAG-Ops --only SEO-Content --only R4-Batch-Lead \
    --dry-run
```

Expected: prints DRY-RUN PUT for each, with content size.

- [ ] **Step 2: 🚧 CHECKPOINT — pause for explicit user go-ahead**

```
Pause: about to PUT updated AGENTS.md to 5 producer agents on AI-COS.
After this, those agents will see the pre_canon_review section on next heartbeat.
Confirm to proceed (yes/no)?
```

- [ ] **Step 3: Apply**

```bash
python3 scripts/aicos/sync_agents_md.py \
    --only CEO --only CTO --only RAG-Ops --only SEO-Content --only R4-Batch-Lead
```

Expected: 5 lines `synced <name> (N chars) → /paperclip/.../AGENTS.md`.

- [ ] **Step 4: Verify on AI-COS UI**

Open `http://178.104.1.118:3100` → for each of CEO/CTO/RAG-Ops/SEO-Content/R4-Batch-Lead → click into agent → verify the AGENTS.md preview shows the new "Pre-canon review (mandatory)" section.

- [ ] **Step 5: Commit (marker)**

```bash
git commit --allow-empty -m "chore(aicos): producer AGENTS.md synced to AI-COS

5 producers (CEO/CTO/RAG-Ops/SEO-Content/R4-Batch-Lead) updated with
pre_canon_review section. They will see it on next heartbeat."
```

---

## Task 13: End-to-end test (toy code_pr)

- [ ] **Step 1: Pick a toy change**

Use the spec file itself for a no-op modification: append a single space at the end of `docs/superpowers/specs/2026-04-25-fleet-advisor-claude-4-7-design.md`.

```bash
git checkout -b smoke/e2e-pre-canon-review
echo "" >> docs/superpowers/specs/2026-04-25-fleet-advisor-claude-4-7-design.md
git add docs/superpowers/specs/2026-04-25-fleet-advisor-claude-4-7-design.md
git commit -m "smoke: e2e test for pre_canon_review (toy change)"
git push origin smoke/e2e-pre-canon-review
```

- [ ] **Step 2: Open a draft PR**

```bash
gh pr create --draft --title "smoke: e2e pre_canon_review" \
    --body "Toy PR to validate the pre_canon_review approval flow end-to-end. Will be closed without merge."
```

Note the PR number returned (`PR_NUM`).

- [ ] **Step 3: Manually create the `pre_canon_review` approval as a "producer"**

```bash
PR_NUM="<from-step-2>"
HEAD_SHA=$(git rev-parse HEAD)
BASE_SHA=$(git merge-base origin/main HEAD)

cat > /tmp/e2e-payload.json <<EOF
{
  "type": "pre_canon_review",
  "payload": {
    "scope": "code_pr",
    "revision_round_count": 0,
    "context": {"task_id": "e2e-smoke", "issue_id": null, "session_id": null},
    "body": {
      "repo": "ak125/nestjs-remix-monorepo",
      "branch": "smoke/e2e-pre-canon-review",
      "base_sha": "$BASE_SHA",
      "head_sha": "$HEAD_SHA",
      "files_changed": ["docs/superpowers/specs/2026-04-25-fleet-advisor-claude-4-7-design.md"],
      "diff_summary": "Append empty line to spec file (no-op).",
      "diff_url": "https://github.com/ak125/nestjs-remix-monorepo/pull/$PR_NUM",
      "related_pr_number": $PR_NUM
    }
  }
}
EOF

curl -s -X POST \
    -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
    -H "Content-Type: application/json" \
    -d @/tmp/e2e-payload.json \
    http://178.104.1.118:3100/api/companies/4f73fff0-b929-4fe5-9f33-7d54f9ef2f52/approvals
```

Note the returned approval id (`APPROVAL_ID`).

- [ ] **Step 4: Wait for advisor comment, verify**

```bash
APPROVAL_ID="<from-step-3>"
sleep 90
curl -s -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
    http://178.104.1.118:3100/api/approvals/$APPROVAL_ID/comments | python3 -m json.tool
```

Expected: at least one comment whose body is valid Verdict JSON with `scope=code_pr`. The recommendation is likely `approve` (toy change, no findings).

- [ ] **Step 5: Approve as board**

In AI-COS UI: navigate to the approval → click Approve.

- [ ] **Step 6: Verify status flipped**

```bash
curl -s -H "Authorization: Bearer $PAPERCLIP_BOARD_TOKEN" \
    http://178.104.1.118:3100/api/approvals/$APPROVAL_ID | python3 -c "import json,sys; print(json.load(sys.stdin).get('status'))"
```

Expected: `approved`.

- [ ] **Step 7: Cleanup**

```bash
gh pr close --delete-branch $PR_NUM
```

- [ ] **Step 8: Commit (marker)**

```bash
git checkout feat/aicos-fleet-advisor-claude-4-7
git commit --allow-empty -m "chore(advisor): e2e pre_canon_review test PASS

Toy code_pr approval created, advisor commented within 90s, board
approved, status flipped to approved. Flow validated end-to-end."
```

---

## Task 14: Phase 1 — Regression replay (3 historical incidents)

**Files:**
- Create: `scripts/advisor/regression_replay.py`
- Create: `scripts/advisor/incidents/inc-2026-005.json`
- Create: `scripts/advisor/incidents/rag-vault-rollback-2026-04-18.json`
- Create: `scripts/advisor/incidents/inc-2026-009.json`

- [ ] **Step 1: Build the 3 incident payloads**

```bash
mkdir -p scripts/advisor/incidents
```

```json
// scripts/advisor/incidents/inc-2026-005.json
{
  "type": "pre_canon_review",
  "payload": {
    "scope": "code_pr",
    "revision_round_count": 0,
    "context": {"task_id": "regression-INC-2026-005", "issue_id": null, "session_id": null},
    "body": {
      "repo": "ak125/nestjs-remix-monorepo",
      "branch": "feat/vehicle-page-direct",
      "base_sha": "0000000",
      "head_sha": "1111111",
      "files_changed": ["frontend/app/routes/v.$brand.$model.$type.tsx"],
      "diff_summary": "Vehicle page uses direct DB query on every request — no matview cache, no fallback. Triggers 5xx under GSC crawler load (see ADR-016).",
      "diff_url": "fictional-replay",
      "related_pr_number": 0
    }
  },
  "expected_recommendation": "reject",
  "expected_axes_floor": {"correctness": 50, "security": 80, "reversibility": 50}
}
```

```json
// scripts/advisor/incidents/rag-vault-rollback-2026-04-18.json
{
  "type": "pre_canon_review",
  "payload": {
    "scope": "canon_db_write",
    "revision_round_count": 0,
    "context": {"task_id": "regression-RAG-rollback", "issue_id": null, "session_id": null},
    "body": {
      "table": "__seo_diag_session",
      "op": "insert",
      "row_count": 350,
      "sample_rows": [{"engine_keyword": "breezy-eagle", "source": "LLM"}],
      "sql_or_rpc": "INSERT INTO __seo_diag_session SELECT * FROM tmp_llm_seed",
      "affected_pg_ids": [],
      "rollback_plan": ""
    }
  },
  "expected_recommendation": "reject",
  "expected_axes_floor": {"reversibility": 0, "evidence": 0}
}
```

```json
// scripts/advisor/incidents/inc-2026-009.json
{
  "type": "pre_canon_review",
  "payload": {
    "scope": "code_pr",
    "revision_round_count": 0,
    "context": {"task_id": "regression-INC-2026-009", "issue_id": null, "session_id": null},
    "body": {
      "repo": "ak125/nestjs-remix-monorepo",
      "branch": "feat/admin-list",
      "base_sha": "0000000",
      "head_sha": "2222222",
      "files_changed": ["backend/supabase/policies/admin.sql"],
      "diff_summary": "New admin RPC list_admins() returns password_hash column, exposed via anon key — RLS missing on __admin_users.",
      "diff_url": "fictional-replay",
      "related_pr_number": 0
    }
  },
  "expected_recommendation": "reject",
  "expected_axes_floor": {"security": 0}
}
```

- [ ] **Step 2: Write the replay script**

```python
# scripts/advisor/regression_replay.py
"""Replay 3 historical incidents as fake pre_canon_review approvals.
Verifies the advisor BLOCKs each, per design spec § 8.3."""
import json
import sys
import time
from pathlib import Path
from scripts.aicos.aicos_client import AicosClient
from scripts.advisor.verdict_schema import Verdict


INCIDENTS = [
    "inc-2026-005.json",
    "rag-vault-rollback-2026-04-18.json",
    "inc-2026-009.json",
]


def replay_one(client: AicosClient, incident_file: Path) -> bool:
    data = json.loads(incident_file.read_text())
    expected_rec = data.pop("expected_recommendation", "reject")
    data.pop("expected_axes_floor", None)

    print(f"\n=== {incident_file.name} ===")
    res = client.post(f"/api/companies/{client.company_id}/approvals", body=data)
    aid = res.get("id") or res.get("approvalId")
    print(f"  approval {aid} created (expecting recommendation={expected_rec})")

    deadline = time.time() + 120
    advisor_comment = None
    while time.time() < deadline:
        comments = client.get(f"/api/approvals/{aid}/comments")
        items = comments.get("items", comments) or []
        for c in items:
            body = c.get("body") or ""
            if '"advisor_recommendation"' in body:
                advisor_comment = c
                break
        if advisor_comment:
            break
        time.sleep(5)

    if not advisor_comment:
        print(f"  FAIL: no advisor comment in 120s")
        return False

    try:
        v = Verdict.model_validate_json(advisor_comment["body"])
    except Exception as e:
        print(f"  FAIL: invalid verdict JSON: {e}")
        return False

    if v.advisor_recommendation == expected_rec:
        print(f"  PASS: recommendation={v.advisor_recommendation}, score_total={v.score_total()}")
        return True

    print(f"  FAIL: expected {expected_rec}, got {v.advisor_recommendation}")
    print(f"  findings: {[f.dict() for f in v.findings]}")
    return False


def main() -> int:
    client = AicosClient()
    here = Path(__file__).resolve().parent / "incidents"
    results = []
    for f in INCIDENTS:
        results.append(replay_one(client, here / f))
    passed = sum(results)
    print(f"\n=== Regression: {passed}/{len(results)} PASS ===")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Run replay**

```bash
python3 scripts/advisor/regression_replay.py
```

Expected: 3/3 PASS. Each incident's verdict must be `reject` (the advisor blocked it).

If any fail: this is a **design invalidation** — halt the rollout and review the canon-write-review thresholds vs. the failed incident, OR review the `code-review` skill checklist for the missed code_pr cases. Do not proceed to Phase 2 (shadow mode) until 3/3 pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/advisor/regression_replay.py scripts/advisor/incidents/
git commit -m "test(advisor): regression replay — 3 historical incidents BLOCK

Replays INC-2026-005 (vehicle page 5xx), RAG vault rollback
2026-04-18, and INC-2026-009 (admin RLS leak) as pre_canon_review
approvals. Advisor must reject all 3. Per design spec § 8.3."
```

---

## Task 15: Open a PR + roll forward to Phase 2 plan

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/aicos-fleet-advisor-claude-4-7
```

- [ ] **Step 2: Open a PR**

```bash
gh pr create --title "feat(aicos): fleet advisor + Claude 4.7 tiering (Phase 0+1)" --body "$(cat <<'EOF'
## Summary
- Adds **Advisor agent** (Opus 4.7) with comment-only review on `pre_canon_review` approvals — board operator keeps decision (assertBoard preserved)
- Tiers fleet to Claude 4.X family : Opus 4.7 (CEO/CTO/Advisor), Sonnet 4.6 (5 workers), Haiku 4.5 (SEO-QA kept)
- Wires 5 producer agents (CEO/CTO/RAG-Ops/SEO-Content/R4-Batch-Lead) with mandatory pre_canon_review section
- Native Paperclip primitives only — no fork, no adapter mod (no bricolage)

## Files
- spec : `docs/superpowers/specs/2026-04-25-fleet-advisor-claude-4-7-design.md`
- plan : `docs/superpowers/plans/2026-04-25-fleet-advisor-claude-4-7.md`
- skill : `agents/advisor/skills/canon-write-review/`
- agent : `agents/advisor/AGENTS.md`
- producer updates : `agents/ceo|cto|rag-lead|seo-content|r4-batch-orchestrator/AGENTS.md`
- aicos tooling : `scripts/aicos/{aicos_client,fleet_config.yaml,apply_fleet_models,sync_agents_md,hire_advisor,smoke_pre_canon_review}.py`
- advisor tooling : `scripts/advisor/{verdict_schema,canon_write_review,regression_replay}.py`

## Test plan
- [x] Unit tests : `pytest tests/advisor tests/aicos -v` (16 tests)
- [x] Phase 0 smoke test : `scripts/aicos/smoke_pre_canon_review.py` PASS
- [x] Phase 1 e2e test : toy `code_pr` approval roundtrip (Task 13) PASS
- [x] Phase 1 regression : `scripts/advisor/regression_replay.py` 3/3 PASS
- [ ] Phase 2 (post-merge, separate plan) : 7-day shadow mode + metrics dashboard

## Cost impact
~$1,400/month → up to ~$16,400/month worst-case (per spec § 6.3). Per-agent budget caps active.

## Rollback
Per spec § 10.2 : `POST /api/agents/<advisor>/pause` (instantly stops review enforcement). Producers fall back to no-review behaviour. Model PATCHes reversible via Paperclip config-revisions API.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Note the PR number for follow-up Phase 2 plan**

Open the PR URL returned. The Phase 2 (shadow mode) plan will be written separately once Phase 0+1 are merged and observed for ≥48h.

---

## Self-review (post-write, against the spec)

- **Spec § 1 Goal** — covered by Tasks 1-13 (Advisor + tiering + producers wired) and offer of Phase 2 plan separately
- **Spec § 2 Non-goals** — respected (no fork: Tasks use existing API; no adapter mod; no auto-correct in canon_write_review)
- **Spec § 3.1 Advisor agent fields** — covered by Task 7 (hire payload) + Task 5 (fleet_config budget)
- **Spec § 3.2 Wiring** — Advisor's AGENTS.md (Task 3) describes the full loop; smoke (Task 10) and e2e (Task 13) validate it
- **Spec § 3.3 Approval payload schema** — Tests in Tasks 1-2 + payload examples in Tasks 13-14
- **Spec § 3.4 Per-scope body shape** — covered for `code_pr` (Task 13), `canon_db_write` (Tasks 2 + 10 + 14). `deployment` and `governance_change` use the existing `code-review` skill — no new skill, no new test in this plan; they will be validated organically in Phase 2 shadow mode
- **Spec § 3.5 Verdict format** — Task 1 implements + tests
- **Spec § 4.1 Existing skills** — referenced in Advisor AGENTS.md, no install needed (already in monorepo)
- **Spec § 4.2 New skill canon-write-review** — Task 2
- **Spec § 4.3 Skill router** — described in Advisor AGENTS.md (Task 3)
- **Spec § 5 Producer instructions** — Task 11
- **Spec § 6 Tier model** — Task 5 (config) + Task 9 (apply)
- **Spec § 7 Failure modes** — guards in Advisor AGENTS.md (Task 3) cover invalid payload, revision_round >= 3, cost cap. Heartbeat-down alerting is operational, not codified in this plan.
- **Spec § 8.1 Smoke** — Task 10
- **Spec § 8.2 E2E** — Task 13
- **Spec § 8.3 Regression** — Task 14
- **Spec § 8.4 Cost canary (Phase 2)** — explicitly out of scope of this plan; covered in Phase 2 follow-up
- **Spec § 9 Rollout** — Phases 0+1 covered by Tasks 1-15; Phase 2+3 deferred
- **Spec § 10 Rollback** — documented in PR body (Task 15) + each task is reversible via git revert + Paperclip config-revision rollback
- **Spec § 11 Open questions** — Q1 (`fallback_model`) deferred to Phase 2; Q2 (audit-trail mirror) deferred; Q3 (managed bundle) decided as `managed` (Task 7 hire_payload); Q4 (CI post-merge check) Phase 3, separate plan; Q5 (skill cross-discovery) verified informally by sync script working

**Placeholder scan** :
- `CEO_ID = "993a4a02-XXXX..."` and other UUID placeholders in `fleet_config.yaml` / `hire_advisor.py` are **explicit prerequisites** with concrete resolution steps (Task 5 Step 2, Task 7 Step 2). Not placeholders in the failure sense — required input data.
- No "TBD", "implement later", "similar to". All code blocks complete.

**Type consistency** :
- `Verdict`, `Axes`, `Finding`, `map_recommendation` consistent across Tasks 1, 2, 10, 14
- `AicosClient` consistent across Tasks 4, 6, 7, 8, 10, 14
- `aicos_id`, `target_model`, `budget_monthly_cents` consistent in YAML + Tasks 5, 6, 8

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-25-fleet-advisor-claude-4-7.md`.

Two execution options :

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints

**Which approach?**

(Tasks 7 and 9 contain explicit `🚧 CHECKPOINT` blocks that pause for board-operator confirmation regardless of execution mode — production AI-COS state changes.)
