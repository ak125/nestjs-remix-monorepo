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


# === ASCII-fold near-duplicate detection (improvement c) ===

def test_ascii_fold_strips_diacritics():
    assert review._ascii_fold("référence OE") == "reference oe"
    assert review._ascii_fold("Référence OE") == "reference oe"
    assert review._ascii_fold("RÉFÉRENCE  OE") == "reference oe"  # collapses whitespace
    assert review._ascii_fold("réference OE") == review._ascii_fold("reference OE")


def test_ascii_fold_empty_safe():
    assert review._ascii_fold("") == ""
    assert review._ascii_fold(None) == ""


def test_near_duplicate_detected_in_selection_criteria():
    """The real bug : 'Utiliser la référence OE' vs 'Utiliser la reference OE'."""
    db = _strong_clear_brief()
    db["selection_criteria_top"] = [
        "Utiliser la référence OE ou l'équivalence constructeur",
        "Respecter les dimensions exactes",
        "Utiliser la reference OE ou l'equivalence constructeur",  # ASCII-fold dup of [0]
    ]
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "REVIEWABLE_WITH_FIXES"
    assert len(r["checks"]["selection_actionability"]["near_duplicates"]) == 1
    dup_sugg = [s for s in r["fix_suggestions"] if "Doublons" in s["message"]]
    assert len(dup_sugg) == 1


def test_no_near_duplicate_when_distinct():
    db = _strong_clear_brief()
    db["selection_criteria_top"] = [
        "Référence OEM constructeur",
        "Dimensions du filtre",
        "Motorisation du véhicule",
    ]
    fm, body = _make_proposal(decision_brief=db)
    r = review.review_proposal_data(fm, body)
    assert r["checks"]["selection_actionability"]["near_duplicates"] == []


# === FR check formatter (improvement a) ===

def test_format_check_structural_pass():
    line = review._format_check_line("structural", {"pass": True, "reason": "ok", "details": ""})
    assert "✅" in line
    assert "Validité structurelle" in line
    assert "{" not in line and "}" not in line  # no Python dict dump
    assert "requis" in line


def test_format_check_anti_filler_violation():
    line = review._format_check_line(
        "anti_filler",
        {"pass": False, "reason": "filler_detected", "violations": ["placeholder_token"]},
    )
    assert "⚠️" in line
    assert "Anti-filler" in line
    assert "placeholder_token" in line
    assert "{" not in line


def test_format_check_function_clarity_marketing():
    line = review._format_check_line(
        "function_clarity",
        {"pass": False, "marketing_detected": True, "has_technical_verb": False, "reason": "marketing_contamination"},
    )
    assert "Clarté de la fonction" in line
    assert "marketing détecté" in line.lower()
    assert "pas de verbe technique" in line.lower()


def test_format_check_selection_with_near_duplicates():
    line = review._format_check_line(
        "selection_actionability",
        {"pass": False, "actionable_count": 2, "total": 3, "non_actionable_items": [],
         "near_duplicates": ["foo"]},
    )
    assert "2/3 critères actionnables" in line
    assert "doublons" in line.lower()


def test_format_check_compatibility_debug_separator():
    line = review._format_check_line(
        "compatibility_readability",
        {"pass": False, "reason": "debug_separator", "has_debug_separator": True, "has_context": False},
    )
    assert "séparateurs debug" in line.lower()


def test_format_check_source_quality_data_weak():
    line = review._format_check_line(
        "source_quality",
        {"pass": True, "verdict": "DATA_WEAK"},
    )
    assert "DATA_WEAK" in line
    assert "Qualité de la source" in line


# === "Brief actuel" inline section (improvement b) ===

def test_render_markdown_includes_brief_actuel_when_frontmatter_passed():
    fm, body = _make_proposal(decision_brief=_strong_clear_brief())
    r = review.review_proposal_data(fm, body)
    md = review.render_review_markdown(r, frontmatter=fm)
    assert "## Brief actuel" in md
    assert "Filtre l'air d'admission" in md  # function_oneliner content visible inline


def test_render_markdown_omits_brief_actuel_when_frontmatter_none():
    """Backward-compat : calling render_review_markdown(report) without frontmatter still works."""
    fm, body = _make_proposal(decision_brief=_strong_clear_brief())
    r = review.review_proposal_data(fm, body)
    md = review.render_review_markdown(r)  # no frontmatter arg
    assert "## Brief actuel" not in md
    assert "REVIEWABLE" in md  # still renders verdict


def test_render_markdown_brief_actuel_handles_missing_decision_brief():
    fm, body = _make_proposal(decision_brief=None)
    r = review.review_proposal_data(fm, body)
    md = review.render_review_markdown(r, frontmatter=fm)
    assert "## Brief actuel" in md
    assert "aucun decision_brief" in md.lower()


def test_render_markdown_no_python_dict_dump():
    """The Checks section must not contain Python dict repr like {'pass': True, ...}."""
    fm, body = _make_proposal(decision_brief=_strong_clear_brief())
    r = review.review_proposal_data(fm, body)
    md = review.render_review_markdown(r, frontmatter=fm)
    assert "{'pass'" not in md
    assert "{'reason'" not in md
    assert "'violations'" not in md


# === review_proposal_file returns tuple (CLI integration) ===

def test_review_proposal_file_returns_tuple(tmp_path):
    """review_proposal_file now returns (report, frontmatter) for --write-audit usage."""
    proposal_text = """---
slug: test-x
entity_type: gamme
entity_data:
  pg_id: 1
  family: test
  decision_brief:
    function_oneliner: Filtre l'air d'admission pour protéger le moteur des particules
    selection_criteria_top:
    - Référence OEM
    - Dimensions
    - Motorisation
    compatibility_summary: Vérifier la compatibilité selon le carburant et la motorisation.
    source_kind: deterministic_transform
    cross_check_status: WEB_CONFIRMS_RAG
---

## Body content"""
    p = tmp_path / "test-x.md"
    p.write_text(proposal_text, encoding="utf-8")
    result = review.review_proposal_file(p)
    assert isinstance(result, tuple)
    assert len(result) == 2
    report, fm = result
    assert report["slug"] == "test-x"
    assert fm["entity_data"]["decision_brief"]["source_kind"] == "deterministic_transform"


# === Task 8f (2026-05-29) : auto_promotion eligibility + safety detection ===

def test_detect_safety_category_brakes():
    assert review.detect_safety_category("plaquette-de-frein") == "freinage"
    assert review.detect_safety_category("disque-de-frein") == "freinage"
    assert review.detect_safety_category("etrier-de-frein") == "freinage"
    assert review.detect_safety_category("liquide-de-frein") == "freinage"
    assert review.detect_safety_category("flexible-de-frein") == "freinage"


def test_detect_safety_category_steering():
    assert review.detect_safety_category("rotule-de-direction") == "direction"
    assert review.detect_safety_category("cremaillere-de-direction") == "direction"


def test_detect_safety_category_airbag():
    assert review.detect_safety_category("module-airbag") == "airbag"


def test_detect_safety_category_suspension():
    assert review.detect_safety_category("amortisseur-arriere") == "suspension"
    assert review.detect_safety_category("ressort-de-suspension") == "suspension"


def test_detect_safety_category_non_safety():
    assert review.detect_safety_category("filtre-a-air") is None
    assert review.detect_safety_category("thermostat") is None
    assert review.detect_safety_category("courroie-d-accessoire") is None
    assert review.detect_safety_category("vanne-egr") is None


def test_detect_safety_category_via_family():
    assert review.detect_safety_category("unknown-slug", family="freinage") == "freinage"


def test_auto_promotion_strong_non_safety_eligible():
    """STRONG source + all checks pass + not safety → auto-acceptable."""
    fm, body = _make_proposal(decision_brief=_strong_clear_brief(), slug="filtre-a-air")
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "REVIEWABLE"
    assert r["auto_promotion_eligible"] is True
    assert r["next_action"] == "AUTO_ACCEPT_WIKI_ALLOWED"
    assert r["safety_critical"] is False
    assert r["auto_promotion_reason"] == "STRONG_SOURCE_AND_ALL_CHECKS_PASS"


def test_auto_promotion_strong_safety_requires_spot_check():
    """STRONG source + safety part → human spot-check, NOT auto-acceptable."""
    fm, body = _make_proposal(decision_brief=_strong_clear_brief(), slug="plaquette-de-frein")
    r = review.review_proposal_data(fm, body)
    assert r["auto_promotion_eligible"] is False  # safety blocks auto-accept
    assert r["next_action"] == "HUMAN_SPOT_CHECK"
    assert r["safety_critical"] is True
    assert r["safety_category"] == "freinage"
    assert r["auto_promotion_reason"] == "STRONG_BUT_SAFETY_CRITICAL"


def test_auto_promotion_data_weak_enrich_raw():
    """DATA_WEAK source → ENRICH_RAW_SOURCE, never auto-acceptable."""
    fm, body = _make_proposal(decision_brief=_data_weak_clear_brief(), slug="filtre-a-air")
    r = review.review_proposal_data(fm, body)
    assert r["auto_promotion_eligible"] is False
    assert r["next_action"] == "ENRICH_RAW_SOURCE"
    assert r["auto_promotion_reason"] == "DATA_WEAK_SOURCE"


def test_auto_promotion_data_weak_safety_still_enrich_raw():
    """DATA_WEAK + safety : ENRICH_RAW is still the primary action ; safety_critical flagged."""
    fm, body = _make_proposal(decision_brief=_data_weak_clear_brief(), slug="plaquette-de-frein")
    r = review.review_proposal_data(fm, body)
    assert r["auto_promotion_eligible"] is False
    assert r["next_action"] == "ENRICH_RAW_SOURCE"
    assert r["safety_critical"] is True
    assert r["safety_category"] == "freinage"


def test_auto_promotion_not_reviewable_rejected():
    """NOT_REVIEWABLE (marketing/filler/schema) → REJECTED_UPSTREAM_FIX."""
    db = _strong_clear_brief()
    db["function_oneliner"] = "Découvrez notre catalogue 2025-2026 — meilleurs prix"
    fm, body = _make_proposal(decision_brief=db, slug="filtre-a-air")
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "NOT_REVIEWABLE"
    assert r["auto_promotion_eligible"] is False
    assert r["next_action"] == "REJECTED_UPSTREAM_FIX"


def test_auto_promotion_not_applicable():
    """No decision_brief → NOT_APPLICABLE."""
    fm, body = _make_proposal(decision_brief=None, slug="filtre-a-air")
    r = review.review_proposal_data(fm, body)
    assert r["review_verdict"] == "NOT_APPLICABLE"
    assert r["auto_promotion_eligible"] is False
    assert r["next_action"] == "NOT_APPLICABLE"


def test_auto_promotion_never_eligible_with_safety_critical():
    """Safety invariant : auto_promotion_eligible is NEVER True for safety parts.

    Tested across all combinations : even with the strongest brief, safety always
    triggers HUMAN_SPOT_CHECK.
    """
    for slug in ["plaquette-de-frein", "etrier-de-frein", "rotule-de-direction",
                  "module-airbag", "amortisseur-arriere"]:
        fm, body = _make_proposal(decision_brief=_strong_clear_brief(), slug=slug)
        r = review.review_proposal_data(fm, body)
        assert r["auto_promotion_eligible"] is False, f"safety part {slug} must not be auto-eligible"
        assert r["safety_critical"] is True, f"slug {slug} should be detected as safety"


def test_render_markdown_includes_auto_promotion_section():
    fm, body = _make_proposal(decision_brief=_strong_clear_brief(), slug="filtre-a-air")
    r = review.review_proposal_data(fm, body)
    md = review.render_review_markdown(r, frontmatter=fm)
    assert "Auto-promotion eligibility" in md
    assert "auto_promotion_eligible" in md
    assert "next_action" in md
    assert "AUTO_ACCEPT_WIKI_ALLOWED" in md


def test_render_markdown_safety_flag_visible():
    fm, body = _make_proposal(decision_brief=_strong_clear_brief(), slug="plaquette-de-frein")
    r = review.review_proposal_data(fm, body)
    md = review.render_review_markdown(r, frontmatter=fm)
    assert "safety_critical** : `True`" in md
    assert "freinage" in md.lower()
    assert "HUMAN_SPOT_CHECK" in md
