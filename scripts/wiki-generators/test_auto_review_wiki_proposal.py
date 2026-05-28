"""pytest suite for auto_review_wiki_proposal.py — read-only WIKI review module.

Tests cover the 4-verdict matrix :
  REVIEWABLE              — STRONG + clear
  REVIEWABLE_WITH_FIXES   — DATA_WEAK + clear, or STRONG + vague
  NOT_REVIEWABLE          — schema invalid, filler, marketing contamination
  NOT_APPLICABLE          — no decision_brief

Imports via importlib (single-file convention canon, no package).
"""
import importlib.util
from pathlib import Path

import pytest
import yaml

SCRIPT_PATH = Path(__file__).parent / "auto_review_wiki_proposal.py"
_spec = importlib.util.spec_from_file_location("auto_review_wiki_proposal", SCRIPT_PATH)
review = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(review)


# === Helpers : build fake proposals for tests ===

def _make_proposal(decision_brief=None, slug="test-gamme"):
    """Construct a minimal frontmatter dict + body str for tests."""
    fm = {
        "schema_version": "2.0.0",
        "id": f"gamme:{slug}",
        "entity_type": "gamme",
        "slug": slug,
        "title": slug.replace("-", " ").title(),
        "lang": "fr",
        "created_at": "2026-05-28",
        "updated_at": "2026-05-28",
        "truth_level": "L2",
        "source_refs": [],
        "review_status": "proposed",
        "exportable": {"rag": False, "seo": False, "support": False},
        "entity_data": {
            "pg_id": 1,
            "family": "test",
        },
    }
    if decision_brief is not None:
        fm["entity_data"]["decision_brief"] = decision_brief
    body = "## Rôle technique\n\nTest body content."
    return fm, body


def _strong_clear_brief():
    return {
        "function_oneliner": "Filtre l'air d'admission pour protéger le moteur des poussières et particules avant la combustion",
        "selection_criteria_top": [
            "Référence OEM ou équivalence constructeur",
            "Dimensions exactes du filtre (longueur, largeur, hauteur)",
            "Motorisation du véhicule (essence, diesel, hybride)",
        ],
        "compatibility_summary": "Vérifier la compatibilité selon le carburant (essence et diesel), 12 motorisations référencées, marques principales Bosch et Mann-Filter.",
        "source_kind": "deterministic_transform",
        "cross_check_status": "WEB_CONFIRMS_RAG",
    }


def _data_weak_clear_brief():
    return {
        "function_oneliner": "Régule le flux de liquide de refroidissement selon la température moteur",
        "selection_criteria_top": [
            "Référence OEM du thermostat",
            "Motorisation",
            "Année véhicule",
        ],
        "compatibility_summary": "Vérifier la compatibilité selon le carburant, la motorisation et la référence OEM.",
        "source_kind": "rag_candidate",
        "cross_check_status": "RAG_ONLY",
    }


# === Verdict tests (the 4-state matrix) ===

def test_strong_clear_yields_reviewable():
    fm, body = _make_proposal(decision_brief=_strong_clear_brief())
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "REVIEWABLE"
    assert r["decision_brief_quality"] == "STRONG"
    assert r["exportable_seo_allowed"] is False  # always false (ADR-033)


def test_data_weak_clear_yields_reviewable_with_fixes():
    fm, body = _make_proposal(decision_brief=_data_weak_clear_brief())
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "REVIEWABLE_WITH_FIXES"
    assert r["decision_brief_quality"] == "DATA_WEAK"


def test_marketing_contamination_yields_not_reviewable():
    db = _strong_clear_brief()
    db["function_oneliner"] = "Découvrez notre catalogue 2025-2026 — la meilleure sélection pour votre véhicule"
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "NOT_REVIEWABLE"


def test_placeholder_filler_yields_not_reviewable():
    db = _strong_clear_brief()
    db["function_oneliner"] = "Filtre l'air pour le moteur — TODO compléter la description précise"
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "NOT_REVIEWABLE"
    assert any("placeholder" in v for v in r["checks"]["anti_filler"]["violations"])


def test_generic_phrase_filler_yields_not_reviewable():
    db = _strong_clear_brief()
    db["compatibility_summary"] = "Cette pièce est importante pour votre véhicule. Compatible avec plusieurs modèles."
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "NOT_REVIEWABLE"


def test_template_tag_filler_yields_not_reviewable():
    db = _strong_clear_brief()
    db["function_oneliner"] = "Filtre l'air {{ part_name }} pour le moteur — protège contre les particules"
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "NOT_REVIEWABLE"


def test_missing_decision_brief_yields_not_applicable():
    fm, body = _make_proposal(decision_brief=None)
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "NOT_APPLICABLE"
    assert r["human_review_required"] is False


def test_strong_with_vague_selection_yields_reviewable_with_fixes():
    db = _strong_clear_brief()
    db["selection_criteria_top"] = ["Qualité", "Prix", "Performance"]
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "REVIEWABLE_WITH_FIXES"
    # non-actionable items should be flagged
    assert len(r["checks"]["selection_actionability"]["non_actionable_items"]) > 0


def test_debug_separator_in_compatibility_yields_reviewable_with_fixes():
    db = _strong_clear_brief()
    db["compatibility_summary"] = "diesel | Peugeot, Renault | 42 motorisations"
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "REVIEWABLE_WITH_FIXES"
    assert r["checks"]["compatibility_readability"]["has_debug_separator"] is True


def test_missing_required_field_yields_not_reviewable():
    db = _strong_clear_brief()
    db["function_oneliner"] = ""  # required but empty
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "NOT_REVIEWABLE"


def test_no_technical_verb_in_function_yields_reviewable_with_fixes():
    db = _strong_clear_brief()
    db["function_oneliner"] = "Une pièce essentielle dans le système de freinage du véhicule moderne"
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    # no marketing, no filler, no technical verb → REVIEWABLE_WITH_FIXES
    assert r["review_verdict"] == "REVIEWABLE_WITH_FIXES"
    assert r["checks"]["function_clarity"]["has_technical_verb"] is False


# === Field-level check tests ===

def test_check_structural_decision_brief_missing():
    fm, body = _make_proposal(decision_brief=None)
    r = review.check_structural(fm, body)
    assert r["pass"] is False
    assert r["reason"] == "decision_brief_missing"


def test_check_structural_missing_required_field():
    db = _strong_clear_brief()
    db.pop("compatibility_summary")
    fm, body = _make_proposal(decision_brief=db)
    r = review.check_structural(fm, body)
    assert r["pass"] is False
    assert "compatibility_summary" in r["details"]


def test_check_anti_filler_clean():
    fm, body = _make_proposal(decision_brief=_strong_clear_brief())
    r = review.check_anti_filler(fm, body)
    assert r["pass"] is True
    assert r["violations"] == []


def test_check_anti_filler_xxx():
    db = _strong_clear_brief()
    db["function_oneliner"] = "Filtre l'air XXX pour protéger le moteur des particules"
    fm, body = _make_proposal(decision_brief=db)
    r = review.check_anti_filler(fm, body)
    assert r["pass"] is False
    assert "placeholder_token" in r["violations"]


def test_check_function_marketing_detected():
    db = _strong_clear_brief()
    db["function_oneliner"] = "Notre boutique en ligne propose les meilleures pièces pour votre véhicule moderne"
    fm, body = _make_proposal(decision_brief=db)
    r = review.check_function_clarity(fm, body)
    assert r["marketing_detected"] is True


def test_check_compatibility_natural_phrase_pass():
    db = _strong_clear_brief()
    db["compatibility_summary"] = "Vérifier la compatibilité selon le carburant et la motorisation, marques principales Bosch."
    fm, body = _make_proposal(decision_brief=db)
    r = review.check_compatibility_readability(fm, body)
    assert r["pass"] is True
    assert r["has_debug_separator"] is False
    assert r["has_context"] is True


def test_check_source_quality_strong():
    fm, body = _make_proposal(decision_brief=_strong_clear_brief())
    r = review.check_source_quality(fm, body)
    assert r["verdict"] == "STRONG"


def test_check_source_quality_data_weak():
    fm, body = _make_proposal(decision_brief=_data_weak_clear_brief())
    r = review.check_source_quality(fm, body)
    assert r["verdict"] == "DATA_WEAK"


# === Scores tests ===

def test_scores_strong_clear_high():
    fm, body = _make_proposal(decision_brief=_strong_clear_brief())
    r = review.review_proposal_data(fm, body)
    scores = r["scores"]
    assert scores["source_traceability"] == 5
    assert scores["anti_filler"] == 5
    assert scores["reviewability"] >= 4


def test_scores_data_weak_medium_source():
    fm, body = _make_proposal(decision_brief=_data_weak_clear_brief())
    r = review.review_proposal_data(fm, body)
    assert r["scores"]["source_traceability"] == 3


def test_scores_marketing_low_reviewability():
    db = _strong_clear_brief()
    db["function_oneliner"] = "Découvrez notre catalogue exceptionnel — version digitale qui vous permet de tout trouver"
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    assert r["scores"]["reviewability"] == 1


# === Markdown rendering test ===

def test_render_markdown_contains_verdict():
    fm, body = _make_proposal(decision_brief=_strong_clear_brief())
    r = review.review_proposal_data(fm, body)
    md = review.render_review_markdown(r)
    assert "REVIEWABLE" in md
    assert "exportable_seo_allowed" in md
    assert "Required human action" in md


def test_render_markdown_data_weak_says_no_seo():
    fm, body = _make_proposal(decision_brief=_data_weak_clear_brief())
    r = review.review_proposal_data(fm, body)
    md = review.render_review_markdown(r)
    assert "REVIEWABLE_WITH_FIXES" in md
    assert "exportable.seo: true" in md.lower() or "exportable.seo" in md


# === Fix suggestions tests ===

def test_fix_suggestions_marketing_is_major():
    db = _strong_clear_brief()
    db["function_oneliner"] = "Découvrez notre catalogue 2025 pour votre véhicule moderne avec qualité garantie"
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    marketing_sugg = [s for s in r["fix_suggestions"] if s["field"] == "decision_brief.function_oneliner"]
    assert len(marketing_sugg) > 0
    assert marketing_sugg[0]["severity"] == "major"


def test_fix_suggestions_data_weak_info():
    fm, body = _make_proposal(decision_brief=_data_weak_clear_brief())
    r = review.review_proposal_data(fm, body)
    src_sugg = [s for s in r["fix_suggestions"] if s["field"] == "decision_brief.source_kind"]
    assert len(src_sugg) == 1
    assert src_sugg[0]["severity"] == "info"
    assert "DATA_WEAK" in src_sugg[0]["message"]


# === Parse / file I/O tests ===

def test_parse_proposal_text_simple():
    text = """---
slug: foo
entity_data:
  decision_brief:
    function_oneliner: "test"
---

## Body content"""
    fm, body = review.parse_proposal_text(text)
    assert fm["slug"] == "foo"
    assert "Body content" in body


def test_parse_proposal_text_missing_delimiters_raises():
    with pytest.raises(ValueError, match="frontmatter delimiters"):
        review.parse_proposal_text("no frontmatter here")


# === Exportable SEO safety invariant ===

def test_exportable_seo_always_false_even_for_strong():
    """Read-only invariant : the auto-review NEVER allows exportable.seo:true."""
    fm, body = _make_proposal(decision_brief=_strong_clear_brief())
    r = review.review_proposal_data(fm, body)
    assert r["exportable_seo_allowed"] is False


def test_exportable_seo_always_false_even_for_strongest_clearest():
    """Even with perfect inputs, the verdict is REVIEWABLE — never auto-approved."""
    db = _strong_clear_brief()
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] != "ACCEPTED"  # ACCEPTED is not a valid verdict
    assert r["review_verdict"] in review.ALL_VERDICTS
    assert r["exportable_seo_allowed"] is False
