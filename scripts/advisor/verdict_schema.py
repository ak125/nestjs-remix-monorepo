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
        return (
            self.correctness
            + self.security
            + self.anti_cannib
            + self.evidence
            + self.reversibility
        )

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

    1. verdict=BLOCK or critical finding -> reject
    2. Score mean < 60 -> reject
    3. verdict=REVISE or major finding or 60-79 -> request_revision
    4. Score >= 80 and verdict=PASS and no major finding -> approve
    5. Default -> request_revision
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
