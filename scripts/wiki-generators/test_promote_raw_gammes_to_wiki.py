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
