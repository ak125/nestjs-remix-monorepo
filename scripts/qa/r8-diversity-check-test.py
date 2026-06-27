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
normalize_balise = r8_diversity_check.normalize_balise
_field_diversity = r8_diversity_check._field_diversity
compute_balise_diversity = r8_diversity_check.compute_balise_diversity


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


class NormalizeBaliseTest(unittest.TestCase):
    """normalize_balise = accent-fold (NFKD) + lower + whitespace-collapse."""

    def test_case_and_accents_folded(self) -> None:
        self.assertEqual(normalize_balise("Clio 1.5 dCi 85"), "clio 1.5 dci 85")
        self.assertEqual(
            normalize_balise("Pédale  d'Embrayage"), "pedale d'embrayage"
        )

    def test_whitespace_collapsed_and_trimmed(self) -> None:
        self.assertEqual(normalize_balise("  A   B \t C "), "a b c")

    def test_none_and_empty(self) -> None:
        self.assertEqual(normalize_balise(None), "")
        self.assertEqual(normalize_balise(""), "")

    def test_matches_d0_definition(self) -> None:
        # Doit rester identique à seo-snapshot-baseline-rates.py:normalize().
        snap = _here / "seo-snapshot-baseline-rates.py"
        if snap.exists():
            spec = importlib.util.spec_from_file_location("ratesmod_t", snap)
            mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
            sys.modules["ratesmod_t"] = mod
            spec.loader.exec_module(mod)  # type: ignore[union-attr]
            for s in ["Clio 1.5 dCi 85", "Pédale  d'Embrayage", "  X Y ", "É", None]:
                self.assertEqual(normalize_balise(s), mod.normalize(s))


class FieldDiversityTest(unittest.TestCase):
    """_field_diversity = exact + near distinctness + collisions (report-only)."""

    def test_exact_collision_detected(self) -> None:
        fd = _field_diversity([(1, "X"), (2, "X"), (3, "y")])
        self.assertEqual(fd["distinct_exact"], 2)  # {X, y}
        self.assertEqual(fd["distinct_near"], 2)  # {x, y}
        self.assertEqual(len(fd["exact_collisions"]), 1)
        self.assertEqual(fd["exact_collisions"][0]["type_ids"], [1, 2])
        self.assertEqual(fd["near_only_collisions"], [])  # X shared exactly, not near-only

    def test_near_only_collision_is_case_difference(self) -> None:
        fd = _field_diversity([(1, "Alpha"), (2, "alpha")])
        self.assertEqual(fd["distinct_exact"], 2)  # raw differs
        self.assertEqual(fd["distinct_near"], 1)  # same normalized
        self.assertEqual(fd["exact_collisions"], [])  # no raw shared by ≥2
        self.assertEqual(len(fd["near_only_collisions"]), 1)
        self.assertEqual(fd["near_only_collisions"][0]["type_ids"], [1, 2])

    def test_all_distinct_no_collisions(self) -> None:
        fd = _field_diversity([(1, "a"), (2, "b"), (3, "c")])
        self.assertEqual(fd["distinct_exact"], 3)
        self.assertEqual(fd["exact_collisions"], [])
        self.assertEqual(fd["near_only_collisions"], [])


class ComputeBaliseDiversityTest(unittest.TestCase):
    """compute_balise_diversity over a sibling group (report-only)."""

    def setUp(self) -> None:
        # 3 sœurs enrichies, 5 affichables → coverage 0.6.
        # title : t1==t2 exact, t3 = near-only (casse) → exact=2, near=1.
        # h1    : t1==t2 exact, t3 distinct → exact=2, near=2.
        # desc  : t1==t2 exact, t3 distinct → exact=2, near=2.
        self.rows = [
            {"type_id": 1, "meta_title": "Clio 1.5 dCi 85", "h1": "Clio 1.5 dCi 85", "meta_description": "Desc A"},
            {"type_id": 2, "meta_title": "Clio 1.5 dCi 85", "h1": "Clio 1.5 dCi 85", "meta_description": "Desc A"},
            {"type_id": 3, "meta_title": "clio 1.5 dci 85", "h1": "Clio 1.6 16V 110", "meta_description": "Desc C"},
        ]
        self.b = compute_balise_diversity(140004, "Clio III", "Renault", self.rows, 5)

    def test_coverage_and_counts(self) -> None:
        self.assertEqual(self.b["enriched_siblings"], 3)
        self.assertEqual(self.b["indexable_siblings"], 5)
        self.assertEqual(self.b["emission_coverage"], 0.6)

    def test_title_exact_and_near(self) -> None:
        t = self.b["fields"]["meta_title"]
        self.assertEqual(t["distinct_exact"], 2)
        self.assertEqual(t["distinct_near"], 1)
        self.assertEqual(t["exact_collisions"][0]["type_ids"], [1, 2])
        # t3 « clio… » collides near-only with t1/t2 « Clio… »
        self.assertEqual(len(t["near_only_collisions"]), 1)
        self.assertEqual(t["near_only_collisions"][0]["type_ids"], [1, 2, 3])

    def test_h1_exact_only(self) -> None:
        h = self.b["fields"]["h1"]
        self.assertEqual(h["distinct_exact"], 2)
        self.assertEqual(h["distinct_near"], 2)
        self.assertEqual(h["near_only_collisions"], [])

    def test_zero_indexable_yields_none_coverage(self) -> None:
        b = compute_balise_diversity(1, "M", "B", self.rows, 0)
        self.assertIsNone(b["emission_coverage"])


class BaliseOutputTest(unittest.TestCase):
    """Formatters surface balises and never affect the content verdict path."""

    def setUp(self) -> None:
        self.summary = RunSummary(
            run_at="2026-06-27T12:00:00+00:00",
            threshold_pct=80,
            scope="modele:140004",
            total_models=1,
            pass_count=1,
            review_count=0,
            fail_count=0,
            global_verdict="PASS",
        )
        rows = [
            {"type_id": 1, "meta_title": "T", "h1": "H", "meta_description": "D"},
            {"type_id": 2, "meta_title": "T", "h1": "H", "meta_description": "D"},
        ]
        self.balises = [compute_balise_diversity(140004, "Clio III", "Renault", rows, 4)]

    def test_markdown_balise_section_appears(self) -> None:
        md = format_markdown(self.summary, [], self.balises)
        self.assertIn("Balises émises", md)
        self.assertIn("report-only", md)
        self.assertIn("Collisions EXACTES", md)  # T/H/D all collide → exact hits
        self.assertIn("140004", md)

    def test_markdown_backward_compatible_without_balises(self) -> None:
        # Existing 2-arg call must still work (no balise section).
        md = format_markdown(self.summary, [])
        self.assertNotIn("Balises émises", md)

    def test_json_balises_and_meta_present(self) -> None:
        import json

        parsed = json.loads(format_json(self.summary, [], self.balises))
        self.assertIn("balises", parsed)
        self.assertEqual(len(parsed["balises"]), 1)
        self.assertTrue(parsed["balise_meta"]["report_only"])
        self.assertEqual(parsed["balise_meta"]["near_dup_status"], "CALIBRATION_PENDING")
        self.assertEqual(
            parsed["balise_meta"]["trgm_thresholds_schema_version"], "v0"
        )
        self.assertIsNone(parsed["balise_meta"]["measurement_error"])

    def test_json_surfaces_measurement_error_observably(self) -> None:
        import json

        parsed = json.loads(
            format_json(self.summary, [], [], balise_error="OperationalError: boom")
        )
        # Verdict contenu intact, erreur balise observable (pas silencieuse).
        self.assertEqual(parsed["summary"]["global_verdict"], "PASS")
        self.assertEqual(parsed["balise_meta"]["measurement_error"], "OperationalError: boom")

    def test_markdown_shows_error_note_when_balise_fails(self) -> None:
        md = format_markdown(self.summary, [], [], balise_error="OperationalError: boom")
        self.assertIn("Mesure balises indisponible", md)
        self.assertIn("OperationalError: boom", md)
        self.assertIn("contenu", md)  # verdict contenu préservé


if __name__ == "__main__":
    unittest.main(verbosity=2)
