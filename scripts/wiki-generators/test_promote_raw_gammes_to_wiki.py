"""pytest suite for promote-raw-gammes-to-wiki.py — single-file convention canon.

Imports via importlib.util.spec_from_file_location to load script-file without package.
Pas de subpackage, pas de PYTHONPATH, pas de sys.path mutation.
"""
import importlib.util
import subprocess
from pathlib import Path

SCRIPT_PATH = Path(__file__).parent / "promote-raw-gammes-to-wiki.py"
_spec = importlib.util.spec_from_file_location("promote_raw_gammes_to_wiki", SCRIPT_PATH)
promote = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(promote)

VANNE_EGR_PATH = promote.GAMMES_DIR / "vanne-egr.md"


# === Task 2 skeleton smoke tests ===

def test_skeleton_loads_module():
    assert hasattr(promote, "read_raw_gamme")
    assert hasattr(promote, "main")
    assert hasattr(promote, "is_rag_recycled_candidate")
    assert hasattr(promote, "extract_dimensions")
    assert hasattr(promote, "evaluate_variant_readiness")
    assert hasattr(promote, "build_proposal_v2")
    assert hasattr(promote, "GAMMES_DIR")
    assert hasattr(promote, "WEB_DIR")
    assert hasattr(promote, "PROPOSALS_DIR")
    assert hasattr(promote, "SCHEMA_PATH")


def test_cli_smoke_runs():
    result = subprocess.run(
        ["python3", str(SCRIPT_PATH), "--gamme", "vanne-egr", "--dry-run"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, f"stderr: {result.stderr}"
    assert "vanne-egr" in result.stdout


# === Task 3 tests : RAW reader + RAG candidate guard + web aggregator ===

def test_is_rag_recycled_candidate_detection():
    """vanne-egr.md has lifecycle.last_enriched_by: script:rag-enrich-from-web-corpus."""
    raw = promote.read_raw_gamme(VANNE_EGR_PATH)
    assert promote.is_rag_recycled_candidate(raw["frontmatter_full"]) is True


def test_is_rag_recycled_candidate_negative():
    """Pure SSOT file (no rag-enrich signature) → not candidate."""
    pure_fm = {"lifecycle": {"stage": "manually_curated", "last_enriched_by": "human:owner"}}
    assert promote.is_rag_recycled_candidate(pure_fm) is False
    # Edge: empty lifecycle
    assert promote.is_rag_recycled_candidate({}) is False


def test_read_raw_gamme_marks_candidate_keeps_body():
    """Canon doctrine 2026-05-27 : RAG data = candidate, pas excluded."""
    result = promote.read_raw_gamme(VANNE_EGR_PATH)
    assert result["is_rag_candidate"] is True
    assert result["candidate_status"] == "rag_recycled_candidate"
    assert result["requires_review"] is True
    # Frontmatter full available (with candidate marker)
    assert result["frontmatter_full"]["slug"] == "vanne-egr"
    assert result["frontmatter_full"]["pg_id"] == 1145
    # Body conservé (pas suppressed) car candidate, pas exclu
    assert result["body"]
    # RAG-generated fields lisibles MAIS via frontmatter_full (candidate flag)
    assert "role" in result["frontmatter_full"].get("domain", {})
    # Safe taxonomic fields toujours accessibles
    assert result["safe_taxonomic_fields"]["pg_id"] == 1145
    assert result["safe_taxonomic_fields"]["slug"] == "vanne-egr"
    assert "related_parts" in result["safe_taxonomic_fields"]


def test_read_raw_gamme_file_not_found():
    import pytest
    with pytest.raises(FileNotFoundError):
        promote.read_raw_gamme(promote.GAMMES_DIR / "does-not-exist.md")


def test_aggregate_web_corpus_vanne_egr():
    files = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "vanne-egr")
    assert isinstance(files, list)
    # vanne-egr should have at least 1 OEM web file given it's top R2 FR
    for f in files:
        assert f["slug_gamme"] == "vanne-egr"
        assert f["source_uri"]  # URL traceable required
        assert "source_domain" in f
        assert "body" in f


def test_aggregate_web_corpus_unknown_slug():
    files = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "this-slug-doesnt-exist-12345")
    assert files == []


# === Task 4 tests : source tier classifier + dimensions extraction candidate/confirmed ===

def test_classify_source_tier_tier1():
    assert promote.classify_source_tier("bremboparts.com") == "tier1"
    assert promote.classify_source_tier("www.gates.com") == "tier1"
    assert promote.classify_source_tier("boschaftermarket.com") == "tier1"
    assert promote.classify_source_tier("aftermarket.zf.com") == "tier1"


def test_classify_source_tier_tier2():
    assert promote.classify_source_tier("fr.wikipedia.org") == "tier2"
    assert promote.classify_source_tier("en.wikipedia.org") == "tier2"


def test_classify_source_tier_unknown_and_empty():
    assert promote.classify_source_tier("random-blog.com") == "unknown"
    assert promote.classify_source_tier("") == "unknown"


def test_classify_source_tier_rag_candidate():
    """RAG-recycled frontmatter → tier rag_recycled_candidate (acceptable mais requires_review)."""
    rag_fm = {"lifecycle": {"last_enriched_by": "script:rag-enrich-from-web-corpus"}}
    assert promote.classify_source_tier("internal", frontmatter=rag_fm) == "rag_recycled_candidate"


def test_extract_dimensions_vanne_egr_candidate_confirmed():
    """Per canon doctrine 2026-05-27 : candidate (RAG) + confirmed (OEM web) parallel."""
    raw = promote.read_raw_gamme(VANNE_EGR_PATH)
    web = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "vanne-egr")
    dims = promote.extract_dimensions(raw, web)
    # 9 dimensions keys must exist
    for key in ["function", "source_refs", "related_parts", "selection_criteria", "symptoms",
                "compatibility_factors", "maintenance_context", "oem_references", "fuel_engine_differences"]:
        assert key in dims, f"Missing dimension {key}"

    # function : candidate/confirmed/cross_check_status structure
    func = dims["function"]
    assert isinstance(func, dict)
    assert "candidate_value" in func
    assert "candidate_source_kind" in func
    assert "confirmed_value" in func
    assert "cross_check_status" in func
    assert func["cross_check_status"] in (
        "WEB_CONFIRMS_RAG", "WEB_DIFFERS_FROM_RAG", "RAG_ONLY", "WEB_ONLY", "NEITHER"
    )

    # If RAG candidate, marked requires_review
    if raw["is_rag_candidate"] and func["candidate_value"]:
        assert func["candidate_requires_review"] is True

    # source_refs : RAG candidate flagged
    rag_refs = [r for r in dims["source_refs"] if r.get("tier") == "rag_recycled_candidate"]
    if raw["is_rag_candidate"]:
        assert len(rag_refs) >= 1
        assert rag_refs[0]["trust"] == "candidate"
        assert rag_refs[0]["requires_review"] is True
        assert "wiki_accepted_auto" in rag_refs[0]["forbidden_for"]

    # related_parts taxonomic safe (slug list)
    assert isinstance(dims["related_parts"], list)


def test_extract_dimensions_empty_corpus():
    """No web corpus → confirmed_value empty, candidate from RAG only."""
    raw = promote.read_raw_gamme(VANNE_EGR_PATH)
    dims = promote.extract_dimensions(raw, [])
    func = dims["function"]
    assert func["cross_check_status"] in ("RAG_ONLY", "NEITHER")
    assert not func["confirmed_value"]


# === Task 5 tests : variant-readiness + anti-filler + content_hash ===

def test_variant_readiness_pass_variant_ready():
    """Web-confirmed dimensions + compatibility_factors → PASS_VARIANT_READY."""
    dims = {
        "function": {"candidate_value": "x", "confirmed_value": "x web", "cross_check_status": "WEB_CONFIRMS_RAG"},
        "source_refs": [{"tier": "rag_recycled_candidate"}, {"tier": "tier1", "trust": "confirmed"}],
        "compatibility_factors": {"motorisation": ["1.5 dCi"]},
        "symptoms": {"candidate_value": ["a"], "confirmed_value": ["a web"], "cross_check_status": "WEB_CONFIRMS_RAG"},
        "selection_criteria": {"candidate_value": ["b"], "confirmed_value": ["b web"], "cross_check_status": "WEB_CONFIRMS_RAG"},
        "related_parts": ["c"], "maintenance_context": {"periodicite_km": 80000},
        "oem_references": [], "fuel_engine_differences": {},
    }
    r = promote.evaluate_variant_readiness(dims, is_r2_sensitive=True)
    assert r["status"] == "PASS_VARIANT_READY"
    assert r["has_oem_web_source"] is True


def test_variant_readiness_pass_partial_r2_blocked():
    """5+ dimensions confirmed but no compatibility_factors + R2-sensitive → PASS_PARTIAL_R2_BLOCKED."""
    dims = {
        "function": {"candidate_value": "x", "confirmed_value": "x web", "cross_check_status": "WEB_CONFIRMS_RAG"},
        "source_refs": [{"tier": "tier1", "trust": "confirmed"}],
        "symptoms": {"candidate_value": ["a"], "confirmed_value": ["a web"], "cross_check_status": "WEB_CONFIRMS_RAG"},
        "selection_criteria": {"candidate_value": ["b"], "confirmed_value": ["b web"], "cross_check_status": "WEB_CONFIRMS_RAG"},
        "related_parts": ["c"], "maintenance_context": {"periodicite_km": 80000},
        "oem_references": [], "fuel_engine_differences": {},
    }
    r = promote.evaluate_variant_readiness(dims, is_r2_sensitive=True)
    assert r["status"] == "PASS_PARTIAL_R2_BLOCKED"


def test_variant_readiness_rag_candidate_requires_review():
    """Dimensions majoritairement candidate sans confirmation web + no OEM → REQUIRES_REVIEW."""
    dims = {
        "function": {"candidate_value": "x", "confirmed_value": "", "cross_check_status": "RAG_ONLY"},
        "source_refs": [{"tier": "rag_recycled_candidate", "trust": "candidate", "requires_review": True}],
        "symptoms": {"candidate_value": ["a"], "confirmed_value": [], "cross_check_status": "RAG_ONLY"},
        "selection_criteria": {"candidate_value": ["b"], "confirmed_value": [], "cross_check_status": "RAG_ONLY"},
        "related_parts": ["c"], "maintenance_context": {"risques_erreur": ["x"]},
        "compatibility_factors": {}, "oem_references": [], "fuel_engine_differences": {},
    }
    r = promote.evaluate_variant_readiness(dims, is_r2_sensitive=True)
    assert r["status"] == "RAG_CANDIDATE_REQUIRES_REVIEW"
    assert r["requires_human_review"] is True


def test_variant_readiness_fail_not_ready():
    dims = {
        "function": {"candidate_value": "x", "confirmed_value": "", "cross_check_status": "RAG_ONLY"},
        "source_refs": [{"tier": "tier1"}],
    }
    r = promote.evaluate_variant_readiness(dims, is_r2_sensitive=False)
    assert r["status"] == "FAIL_NOT_VARIANT_READY"


def test_variant_readiness_no_function_fail():
    """Missing function → FAIL_NOT_VARIANT_READY."""
    dims = {
        "function": {"candidate_value": "", "confirmed_value": "", "cross_check_status": "NEITHER"},
        "source_refs": [{"tier": "tier1"}],
        "symptoms": {"candidate_value": ["a"], "confirmed_value": [], "cross_check_status": "RAG_ONLY"},
    }
    r = promote.evaluate_variant_readiness(dims, is_r2_sensitive=False)
    assert r["status"] == "FAIL_NOT_VARIANT_READY"


def test_anti_filler_passes_clean_body():
    body = "## Rôle technique\n\nLa vanne EGR recycle les gaz d'échappement."
    result = promote.validate_anti_filler(body)
    assert result["pass"] is True
    assert result["generation_mode"] == "deterministic_transform_only"
    assert result["llm_used"] is False
    assert result["paraphrase_used"] is False


def test_anti_filler_fails_on_placeholder():
    result = promote.validate_anti_filler("Some content TODO complete this section")
    assert result["pass"] is False
    assert "TODO" in result["reason"]


def test_anti_filler_fails_on_template_literal():
    result = promote.validate_anti_filler("Le nom est <%title%>.")
    assert result["pass"] is False


def test_content_hash_deterministic():
    body = "same content"
    assert promote.compute_content_hash(body) == promote.compute_content_hash(body)


def test_content_hash_different_for_different_input():
    assert promote.compute_content_hash("a") != promote.compute_content_hash("b")


# === Task 6 tests : proposal builder + schema validator + E2E ===

def test_build_proposal_v2_vanne_egr_option_c():
    """Option C (default) : dimensions go into body + review_notes, not entity_data.dimensions."""
    raw = promote.read_raw_gamme(VANNE_EGR_PATH)
    web = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "vanne-egr")
    dims = promote.extract_dimensions(raw, web)
    proposal_text = promote.build_proposal_v2(raw, web, dims, schema_option="C")
    # Frontmatter v2.0.0 canon
    assert proposal_text.startswith("---\n")
    assert "schema_version: 2.0.0" in proposal_text
    assert "id: gamme:vanne-egr" in proposal_text
    assert "entity_type: gamme" in proposal_text
    assert "slug: vanne-egr" in proposal_text
    assert "truth_level: L2" in proposal_text  # AJUSTEMENT #1 owner
    assert "review_status: proposed" in proposal_text
    assert "rag: false" in proposal_text  # exportable.rag default false
    # entity_data has pg_id
    assert "pg_id: 1145" in proposal_text
    # Body has H2 sections
    assert "## Rôle technique" in proposal_text
    # Option C : NO entity_data.dimensions key (canon doctrine schema unchanged)
    assert "  dimensions:" not in proposal_text


def test_build_proposal_v2_rag_candidate_flagged_in_review_notes():
    """If raw is RAG candidate, proposal body sections + review_notes flag candidate items."""
    raw = promote.read_raw_gamme(VANNE_EGR_PATH)
    web = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "vanne-egr")
    dims = promote.extract_dimensions(raw, web)
    proposal_text = promote.build_proposal_v2(raw, web, dims, schema_option="C")
    # review_notes should mention rag_recycled_candidate
    assert "rag_recycled_candidate" in proposal_text or "candidate" in proposal_text.lower()


def test_validate_schema_vanne_egr_passes():
    raw = promote.read_raw_gamme(VANNE_EGR_PATH)
    web = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "vanne-egr")
    dims = promote.extract_dimensions(raw, web)
    proposal_text = promote.build_proposal_v2(raw, web, dims, schema_option="C")
    import yaml as _yaml
    fm_match = re.match(r'^---\n(.*?)\n---\n', proposal_text, re.DOTALL)
    fm = _yaml.safe_load(fm_match.group(1))
    result = promote.validate_schema(fm, schema_option="C")
    assert result["valid"] is True, f"Schema errors: {result.get('errors')}"


# E2E integration test — moved to bottom

import re  # local import for fm_match regex


def test_e2e_vanne_egr_dry_run_full():
    """E2E : --gamme vanne-egr --dry-run produces full proposal output without writes."""
    result = subprocess.run(
        ["python3", str(SCRIPT_PATH), "--gamme", "vanne-egr", "--dry-run", "--verbose"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, f"stderr: {result.stderr}"
    assert "schema_version: 2.0.0" in result.stdout
    assert "truth_level: L2" in result.stdout
    assert "review_status: proposed" in result.stdout
    assert any(s in result.stdout for s in [
        "PASS_VARIANT_READY", "PASS_PARTIAL", "RAG_CANDIDATE_REQUIRES_REVIEW", "FAIL_NOT_VARIANT_READY"
    ])
    assert "generation_mode" in result.stdout
    assert "deterministic_transform_only" in result.stdout


# === Task 7 tests : run log writer + idempotence ===

def test_write_run_log_creates_file(tmp_path, monkeypatch):
    monkeypatch.setattr(promote, "RUN_LOG_DIR", tmp_path)
    run_data = {"run_id": "test-uuid-task7", "scope_input": "vanne-egr", "scope": "gamme"}
    path = promote.write_run_log(run_data)
    assert path.exists()
    import json as _json
    loaded = _json.loads(path.read_text())
    assert loaded["run_id"] == "test-uuid-task7"
    assert loaded["scope_input"] == "vanne-egr"


def test_write_run_log_includes_traceable_metadata(tmp_path, monkeypatch):
    monkeypatch.setattr(promote, "RUN_LOG_DIR", tmp_path)
    run_data = {
        "run_id": "test-trace",
        "scope_input": "vanne-egr",
        "generation_mode": "deterministic_transform_only",
        "llm_used": False,
        "paraphrase_used": False,
    }
    path = promote.write_run_log(run_data)
    import json as _json
    loaded = _json.loads(path.read_text())
    assert loaded["generation_mode"] == "deterministic_transform_only"
    assert loaded["llm_used"] is False
    assert loaded["paraphrase_used"] is False
