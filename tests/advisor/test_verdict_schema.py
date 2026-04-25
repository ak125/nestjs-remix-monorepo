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
