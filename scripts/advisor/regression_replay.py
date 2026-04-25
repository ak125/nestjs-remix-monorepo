"""Replay 3 historical incidents as fake pre_canon_review approvals.
Verifies the advisor BLOCKs each, per design spec § 8.3.
"""
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
        print("  FAIL: no advisor comment in 120s")
        return False

    try:
        v = Verdict.model_validate_json(advisor_comment["body"])
    except Exception as e:
        print(f"  FAIL: invalid verdict JSON: {e}")
        return False

    if v.advisor_recommendation == expected_rec:
        print(
            f"  PASS: recommendation={v.advisor_recommendation}, "
            f"score_total={v.score_total()}"
        )
        return True

    print(f"  FAIL: expected {expected_rec}, got {v.advisor_recommendation}")
    print(f"  findings: {[f.model_dump() for f in v.findings]}")
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
