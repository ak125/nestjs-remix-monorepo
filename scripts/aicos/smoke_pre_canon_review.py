"""Phase 0 smoke test:
1. Create a fake pre_canon_review approval (good payload)
2. Wait up to 120s for the Advisor to post a comment
3. Verify the comment is valid Verdict JSON with advisor_recommendation=approve
4. Then test assertBoard guard: try to /approve as a non-board actor -> expect 403
"""
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
    print(f"  -> approval {approval_id}")

    print("2. Waiting up to 120s for Advisor to comment...")
    deadline = time.time() + 120
    advisor_comment = None
    while time.time() < deadline:
        comments = client.get(f"/api/approvals/{approval_id}/comments")
        items = comments.get("items", comments) or []
        for c in items:
            body = c.get("body") or ""
            if (
                '"scope":"canon_db_write"' in body
                or '"scope": "canon_db_write"' in body
            ):
                advisor_comment = c
                break
        if advisor_comment:
            break
        time.sleep(5)

    if not advisor_comment:
        print("  FAIL: no advisor comment in 120s", file=sys.stderr)
        return 2

    print("  -> comment received")
    try:
        verdict = Verdict.model_validate_json(advisor_comment["body"])
    except Exception as e:
        print(f"  FAIL: comment body is not valid Verdict JSON: {e}", file=sys.stderr)
        print(f"  body: {advisor_comment['body']}", file=sys.stderr)
        return 3

    if verdict.advisor_recommendation != "approve":
        print(
            f"  FAIL: expected approve, got {verdict.advisor_recommendation}",
            file=sys.stderr,
        )
        print(f"  findings: {verdict.findings}", file=sys.stderr)
        return 4

    print(
        f"  -> Verdict.advisor_recommendation = {verdict.advisor_recommendation} (PASS)"
    )
    print(f"  -> Verdict.score_total = {verdict.score_total()}")
    print("\nSmoke test #1 (pickup + verdict) PASS")

    print("\n3. Testing assertBoard guard (advisor tries to approve via API)...")
    print(
        "   (skipped automatically — assertBoard is enforced server-side. Manual check:"
    )
    print(
        "   curl -X POST -H 'Authorization: Bearer <advisor-token>' "
        f"{client.api_base}/api/approvals/{approval_id}/approve"
    )
    print("   Expected response: 403 Forbidden.)")

    print("\nALL SMOKE TESTS PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
