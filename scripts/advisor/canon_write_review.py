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
        findings.append(
            Finding(
                severity="critical",
                file_or_table=table or "<missing>",
                issue=f"Table '{table}' is not in allowed canonical prefixes {ALLOWED_TABLE_PREFIXES}",
                suggested_fix="Confirm table name; canonical prefixes only",
                blocking=True,
            )
        )
        score_correctness = 0

    if op not in ("insert", "update", "delete"):
        findings.append(
            Finding(
                severity="critical",
                file_or_table=table,
                issue=f"Op '{op}' is not insert/update/delete",
                suggested_fix="Set valid op",
                blocking=True,
            )
        )
        score_correctness = min(score_correctness, 30)

    if not sql:
        findings.append(
            Finding(
                severity="critical",
                file_or_table=table,
                issue="sql_or_rpc is empty — write not auditable",
                suggested_fix="Provide concrete SQL or RPC name + args",
                blocking=True,
            )
        )
        score_evidence = 0

    if not rollback:
        findings.append(
            Finding(
                severity="critical",
                file_or_table=table,
                issue="rollback_plan is empty — write not reversible",
                suggested_fix="Provide rollback SQL or 'restore from backup <id>'",
                blocking=True,
            )
        )
        score_reversibility = 0

    if op == "delete" and row_count > 0 and not rollback:
        findings.append(
            Finding(
                severity="critical",
                file_or_table=table,
                issue=f"DELETE op on {row_count} rows without rollback_plan",
                suggested_fix="DELETE always requires explicit rollback_plan",
                blocking=True,
            )
        )
        score_reversibility = 0

    if row_count > ROW_COUNT_BATCH_THRESHOLD:
        if not body.get("batch_flag", False):
            findings.append(
                Finding(
                    severity="major",
                    file_or_table=table,
                    issue=f"row_count {row_count} > {ROW_COUNT_BATCH_THRESHOLD} requires explicit batch_flag",
                    suggested_fix="Add 'batch_flag: true' to payload + chunk plan",
                    blocking=False,
                )
            )
            score_security = min(score_security, 60)

    if not (ctx.get("task_id") or ctx.get("issue_id") or ctx.get("session_id")):
        findings.append(
            Finding(
                severity="major",
                file_or_table=table,
                issue="No task_id / issue_id / session_id in context — write not traceable",
                suggested_fix="Add at least one of task_id/issue_id/session_id",
                blocking=False,
            )
        )
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
