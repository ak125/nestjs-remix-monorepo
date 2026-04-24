"""
Tests unitaires pour r8-diversity-check.py (verdict + formatage).

Run:
    python3 scripts/qa/r8-diversity-check-test.py
    # ou : python3 -m unittest scripts.qa.r8-diversity-check-test

Scope:
    - ModelReport.compute_verdict edge cases
    - Global verdict aggregation logic
    - Markdown output structure sanity

Not covered (par design):
    - DB connection (tested via e2e run on DEV)
    - SQL correctness (tested via live query in PR #147 smoke test)
"""
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

# Import the script by file path (contains dash → not module-friendly otherwise)
_here = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    "r8_diversity_check", _here / "r8-diversity-check.py"
)
r8_diversity_check = importlib.util.module_from_spec(_spec)  # type: ignore[arg-type]
sys.modules["r8_diversity_check"] = r8_diversity_check
_spec.loader.exec_module(r8_diversity_check)  # type: ignore[union-attr]

ModelReport = r8_diversity_check.ModelReport
RunSummary = r8_diversity_check.RunSummary
format_markdown = r8_diversity_check.format_markdown
format_json = r8_diversity_check.format_json


def _make_report(
    *,
    sib: int,
    content: int,
    normalized: int,
    block_seq: int = 1,
    semantic: int,
    faq: int,
    category: int,
    faq_absent: bool = False,
    category_absent: bool = False,
) -> ModelReport:
    return ModelReport(
        modele_id=999,
        modele_name="Test Model",
        marque_name="Test Brand",
        sibling_count=sib,
        distinct_content=content,
        distinct_normalized=normalized,
        distinct_block_seq=block_seq,
        distinct_semantic=semantic,
        distinct_faq=faq,
        distinct_category=category,
        faq_block_absent=faq_absent,
        category_block_absent=category_absent,
        avg_diversity_score=75.0,
        index_count=sib,
        review_count=0,
        regenerate_count=0,
        reject_count=0,
    )


class VerdictTest(unittest.TestCase):
    """ModelReport.compute_verdict thresholding logic."""

    def test_all_perfect_distinct_yields_pass(self) -> None:
        m = _make_report(
            sib=10, content=10, normalized=10, semantic=10, faq=10, category=10
        )
        m.compute_verdict(80)
        self.assertEqual(m.verdict, "PASS")
        self.assertEqual(m.slots_failing, [])

    def test_one_slot_below_threshold_yields_review(self) -> None:
        # faq only 7/10 = 70%, sous seuil 80 → 1 slot failing → REVIEW
        m = _make_report(
            sib=10, content=10, normalized=10, semantic=10, faq=7, category=10
        )
        m.compute_verdict(80)
        self.assertEqual(m.verdict, "REVIEW")
        self.assertEqual(m.slots_failing, ["faq_signature"])

    def test_two_slots_below_threshold_yields_review(self) -> None:
        m = _make_report(
            sib=10, content=7, normalized=10, semantic=10, faq=7, category=10
        )
        m.compute_verdict(80)
        self.assertEqual(m.verdict, "REVIEW")
        self.assertEqual(len(m.slots_failing), 2)

    def test_three_slots_below_threshold_yields_fail(self) -> None:
        m = _make_report(
            sib=10, content=5, normalized=5, semantic=5, faq=10, category=10
        )
        m.compute_verdict(80)
        self.assertEqual(m.verdict, "FAIL")
        self.assertEqual(len(m.slots_failing), 3)

    def test_block_sequence_stable_is_ignored(self) -> None:
        # block_seq=1/10 (10% distinct) MAIS c'est attendu stable → should NOT count
        m = _make_report(
            sib=10,
            content=10,
            normalized=10,
            block_seq=1,  # stable, expected
            semantic=10,
            faq=10,
            category=10,
        )
        m.compute_verdict(80)
        self.assertEqual(m.verdict, "PASS")
        self.assertNotIn("block_sequence", m.slots_failing)

    def test_faq_absent_block_excluded_from_verdict(self) -> None:
        # FAQ block not rendered for any sibling (e.g. SMART case : no FAQ in
        # gamme RAG). All siblings share SHA-256(NO_FAQ) → faq=1/10 (10%).
        # With faq_absent=True, the slot should be skipped : no failure.
        m = _make_report(
            sib=10,
            content=10,
            normalized=10,
            semantic=10,
            faq=1,  # all siblings hash same NO_FAQ constant
            category=10,
            faq_absent=True,
        )
        m.compute_verdict(80)
        self.assertEqual(m.verdict, "PASS")
        self.assertNotIn("faq_signature", m.slots_failing)
        self.assertIn("faq_signature", m.slots_absent)

    def test_category_absent_block_excluded_from_verdict(self) -> None:
        # Similar for S_CATALOG_ACCESS absent (< 3 compatible families).
        m = _make_report(
            sib=8,
            content=8,
            normalized=8,
            semantic=8,
            faq=8,
            category=1,  # all share NO_CATEGORY hash
            category_absent=True,
        )
        m.compute_verdict(80)
        self.assertEqual(m.verdict, "PASS")
        self.assertNotIn("category_signature", m.slots_failing)
        self.assertIn("category_signature", m.slots_absent)

    def test_faq_present_but_colliding_still_fails(self) -> None:
        # FAQ IS rendered (faq_absent=False) but all siblings collide on same
        # opener variant → real collision, should fail verdict.
        m = _make_report(
            sib=10,
            content=10,
            normalized=10,
            semantic=10,
            faq=2,  # only 2 distinct hashes on 10 siblings (20%)
            category=10,
            faq_absent=False,
        )
        m.compute_verdict(80)
        self.assertEqual(m.verdict, "REVIEW")
        self.assertIn("faq_signature", m.slots_failing)
        self.assertNotIn("faq_signature", m.slots_absent)

    def test_single_sibling_yields_pass_regardless(self) -> None:
        # 1 sibling = pas de duplicate possible par construction
        m = _make_report(sib=1, content=1, normalized=1, semantic=1, faq=1, category=1)
        m.compute_verdict(80)
        self.assertEqual(m.verdict, "PASS")

    def test_custom_threshold_70_loosens_check(self) -> None:
        # faq 7/10 = 70% : PASS avec threshold=70, REVIEW avec 80
        m = _make_report(
            sib=10, content=10, normalized=10, semantic=10, faq=7, category=10
        )
        m.compute_verdict(70)
        self.assertEqual(m.verdict, "PASS")

        m2 = _make_report(
            sib=10, content=10, normalized=10, semantic=10, faq=7, category=10
        )
        m2.compute_verdict(80)
        self.assertEqual(m2.verdict, "REVIEW")


class OutputFormatTest(unittest.TestCase):
    """Formatters produce expected structure and don't crash."""

    def setUp(self) -> None:
        # sib=5, faq=3 → ratio 60% < 80% threshold → REVIEW
        self.m = _make_report(
            sib=5, content=5, normalized=5, semantic=5, faq=3, category=5
        )
        self.m.compute_verdict(80)
        self.summary = RunSummary(
            run_at="2026-04-24T12:00:00+00:00",
            threshold_pct=80,
            scope="brand:smart",
            total_models=1,
            pass_count=0,
            review_count=1,
            fail_count=0,
            global_verdict="REVIEW",
        )

    def test_markdown_contains_core_sections(self) -> None:
        md = format_markdown(self.summary, [self.m])
        self.assertIn("# R8 Diversity Check", md)
        self.assertIn("Verdict global", md)
        self.assertIn("Détail par modèle", md)
        self.assertIn("Test Brand", md)
        self.assertIn("Test Model", md)
        self.assertIn("Actions recommandées", md)

    def test_markdown_verdict_badges_present(self) -> None:
        # REVIEW model → warning emoji in detail row
        md = format_markdown(self.summary, [self.m])
        self.assertIn("REVIEW", md)

    def test_markdown_collisions_section_appears_when_failing(self) -> None:
        # Add fake collision data
        self.m.collisions = {
            "faq_signature": [
                {"hash": "abc12345...", "collision_count": 2, "type_ids": [34201, 34205]}
            ]
        }
        md = format_markdown(self.summary, [self.m])
        self.assertIn("Collisions détectées", md)
        self.assertIn("34201", md)
        self.assertIn("34205", md)

    def test_json_is_parseable_and_complete(self) -> None:
        import json

        out = format_json(self.summary, [self.m])
        parsed = json.loads(out)
        self.assertIn("summary", parsed)
        self.assertIn("models", parsed)
        self.assertEqual(parsed["summary"]["threshold_pct"], 80)
        self.assertEqual(parsed["summary"]["global_verdict"], "REVIEW")
        self.assertEqual(len(parsed["models"]), 1)
        self.assertEqual(parsed["models"][0]["verdict"], "REVIEW")


if __name__ == "__main__":
    unittest.main(verbosity=2)
