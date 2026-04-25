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
