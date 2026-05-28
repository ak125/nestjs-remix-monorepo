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


# === B1.1 tests : tolerant frontmatter parser (indented 8 spaces + non-indented) ===

def test_parse_frontmatter_non_indented():
    """Standard YAML frontmatter (Convention B : Hella/NGK)."""
    content = "---\ntitle: foo\nslug_gamme: vanne-egr\n---\n\n# Body"
    result = promote.parse_frontmatter(content)
    assert result is not None
    assert result["frontmatter"]["title"] == "foo"
    assert result["frontmatter"]["slug_gamme"] == "vanne-egr"
    assert result["body"] == "# Body"


def test_parse_frontmatter_indented_8_spaces():
    """Convention A : frontmatter indented 8 spaces (418 web files)."""
    content = "        ---\n        title: foo\n        slug_gamme: vanne-egr\n        ---\n\n        # Body"
    result = promote.parse_frontmatter(content)
    assert result is not None
    assert result["frontmatter"]["title"] == "foo"
    assert result["frontmatter"]["slug_gamme"] == "vanne-egr"


def test_parse_frontmatter_indented_real_file():
    """Parse a real indented Convention A file from web corpus."""
    real_path = promote.WEB_DIR / "00f80f83f08f-s001.md"
    if real_path.exists():
        content = real_path.read_text(encoding="utf-8")
        result = promote.parse_frontmatter(content)
        assert result is not None, "Tolerant parser must handle indented frontmatter"
        assert result["frontmatter"].get("slug_gamme") == "capteur-d-arbre-a-cames"


def test_parse_frontmatter_missing_returns_none():
    """No frontmatter delimiters → return None (no silent fallback)."""
    assert promote.parse_frontmatter("# Just a body, no frontmatter") is None


def test_parse_frontmatter_mapped_gammes_array():
    """Convention B with mapped_gammes (array, not scalar)."""
    content = "---\ntitle: foo\nmapped_gammes:\n- vanne-egr\n- electrovanne\n---\n\n# Body"
    result = promote.parse_frontmatter(content)
    assert result is not None
    assert result["frontmatter"]["mapped_gammes"] == ["vanne-egr", "electrovanne"]


# === B1.2 tests : web relation extractor (gammes + vehicles + NO_VEHICLE_EVIDENCE) ===

def test_extract_web_relations_vanne_egr_real():
    """Real vanne-egr web files (Hella + NGK) — gammes present, no vehicles → NO_VEHICLE_EVIDENCE."""
    web = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "vanne-egr")
    assert len(web) >= 2  # Hella + NGK
    for w in web:
        relations = promote.extract_web_relations(w)
        assert "gammes" in relations
        assert "vehicles" in relations
        assert "relation_status" in relations
        assert "vanne-egr" in relations["gammes"]
        # No vehicle data in Hella/NGK frontmatter → explicit NO_VEHICLE_EVIDENCE
        assert relations["vehicles"] == []
        assert relations["relation_status"] == "NO_VEHICLE_EVIDENCE"


def test_extract_web_relations_with_vehicles():
    """If frontmatter has vehicles array, extract them."""
    fake_web = {
        "slug_gamme": "vanne-egr",
        "source_uri": "https://example.com",
        "source_domain": "example.com",
        "body": "body",
        "title": "test",
        "path": "/tmp/fake.md",
        "frontmatter_extra": {
            "vehicles": [
                {"marque": "Renault", "modele": "Clio 4", "motorisation": "1.5 dCi"},
                {"marque": "Peugeot", "modele": "308", "motorisation": "2.0 HDi"},
            ],
        },
    }
    relations = promote.extract_web_relations(fake_web)
    assert len(relations["vehicles"]) == 2
    assert relations["vehicles"][0]["marque"].lower() == "renault"
    assert relations["relation_status"] == "VEHICLE_EVIDENCE_PRESENT"


def test_extract_web_relations_never_invents_vehicle():
    """Body mentioning Renault/Peugeot must NOT auto-create vehicle relations.

    Canon doctrine 2026-05-27 : ne jamais inventer compatibilité véhicule.
    Vehicle relations come from EXPLICIT frontmatter (vehicles array) only.
    """
    fake_web = {
        "slug_gamme": "vanne-egr",
        "source_uri": "https://example.com",
        "source_domain": "example.com",
        "body": "Cette vanne EGR équipe les Renault Clio 4 1.5 dCi et Peugeot 308 2.0 HDi diesel.",
        "title": "test",
        "path": "/tmp/fake.md",
    }
    relations = promote.extract_web_relations(fake_web)
    # Body mentions vehicles but NO explicit frontmatter → no invention
    assert relations["vehicles"] == []
    assert relations["relation_status"] == "NO_VEHICLE_EVIDENCE"


def test_extract_web_relations_gamme_from_mapped_gammes_array():
    """Convention B (Hella/NGK) : mapped_gammes is an array."""
    fake_web = {
        "slug_gamme": "vanne-egr",  # set by aggregate after matching
        "matched_kind": "mapped_gammes",
        "all_mapped_gammes": ["vanne-egr", "electrovanne"],
        "source_uri": "https://hella.com/...",
        "source_domain": "hella.com",
        "body": "body",
        "title": "test",
        "path": "/tmp/fake.md",
    }
    relations = promote.extract_web_relations(fake_web)
    assert "vanne-egr" in relations["gammes"]
    assert "electrovanne" in relations["gammes"]  # other gamme in mapped array
    assert relations["matched_kind"] == "mapped_gammes"


# === B3 tests : compatibility-url-json ingest (PROD runtime proof) ===

import json as _json
from pathlib import Path as _Path

B2_COMPAT_JSON = _Path("/opt/automecanik/app/audit/compatibility-vanne-egr-prod-url-2026-05-27.json")


def test_read_compatibility_url_json():
    """Load B2 JSON output (25 entries vanne-egr, status 200, brands, motorisations)."""
    if not B2_COMPAT_JSON.exists():
        import pytest
        pytest.skip("B2 JSON not present (Phase B2 not run)")
    data = promote.read_compatibility_url_json(B2_COMPAT_JSON)
    assert data["gamme_focus"] == "vanne-egr"
    assert data["pg_id"] == 1145
    assert len(data["compatibility_proven_by_url"]) >= 10
    for entry in data["compatibility_proven_by_url"]:
        # All entries must be status 200 (filtered)
        assert entry["status"] == 200
        assert entry["proof"] == "runtime_url_status_200"


def test_reject_non_200_url_compatibility():
    """Non-200 entries must be filtered out (compatibility not proven)."""
    fake_data = {
        "gamme_focus": "vanne-egr",
        "pg_id": 1145,
        "compatibility_proven_by_url": [
            {"status": 200, "brand": "peugeot", "motorisation": "1-6-hdi", "proof": "runtime_url_status_200"},
            {"status": 404, "brand": "renault", "motorisation": "1-5-dci", "proof": "non_200_excluded"},
            {"status": 200, "brand": "citroen", "motorisation": "1-6-hdi", "proof": "runtime_url_status_200"},
        ],
    }
    filtered = promote.filter_compatibility_status_200(fake_data)
    assert len(filtered) == 2
    assert all(e["status"] == 200 for e in filtered)


def test_extract_motorisations_from_runtime_url_json():
    """Extract unique motorisations + brands from B2 JSON."""
    if not B2_COMPAT_JSON.exists():
        import pytest
        pytest.skip("B2 JSON not present")
    data = promote.read_compatibility_url_json(B2_COMPAT_JSON)
    summary = promote.summarize_compatibility_proof(data)
    # Per B2 audit : 6 brands × 9 motorisations
    assert len(summary["brands"]) >= 6
    assert len(summary["motorisations"]) >= 9
    assert "peugeot" in summary["brands"]
    assert "renault" in summary["brands"]
    assert "1-6-hdi" in summary["motorisations"]
    assert "1-5-dci" in summary["motorisations"]


def test_extract_dimensions_with_compatibility_url_proof():
    """When compatibility-url JSON provided, dimensions get compatibility_factors_present=true."""
    if not B2_COMPAT_JSON.exists():
        import pytest
        pytest.skip("B2 JSON not present")
    raw = promote.read_raw_gamme(VANNE_EGR_PATH)
    web = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "vanne-egr")
    compat_data = promote.read_compatibility_url_json(B2_COMPAT_JSON)
    dims = promote.extract_dimensions(raw, web, compatibility_url_data=compat_data)

    # New dimension : compatibility_proven_by_url
    assert "compatibility_proven_by_url" in dims
    assert len(dims["compatibility_proven_by_url"]) >= 10

    # Enriched compatibility_factors from proven URLs
    cf = dims["compatibility_factors"]
    assert "marques" in cf
    assert "motorisations" in cf
    assert "peugeot" in cf["marques"]
    assert "renault" in cf["marques"]
    # Source kind marker
    assert cf.get("source_kind") == "compatibility_proven_by_runtime_url"


def test_variant_readiness_upgrades_with_runtime_url_proof():
    """Variant_readiness upgrades from PASS_PARTIAL_R2_BLOCKED → PASS_VARIANT_READY when compat URL proof present."""
    if not B2_COMPAT_JSON.exists():
        import pytest
        pytest.skip("B2 JSON not present")
    raw = promote.read_raw_gamme(VANNE_EGR_PATH)
    web = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "vanne-egr")
    compat_data = promote.read_compatibility_url_json(B2_COMPAT_JSON)
    dims = promote.extract_dimensions(raw, web, compatibility_url_data=compat_data)
    vr = promote.evaluate_variant_readiness(dims, is_r2_sensitive=True)
    # Must NOT be PASS_PARTIAL_R2_BLOCKED anymore (compatibility_factors now present)
    assert vr["status"] != "PASS_PARTIAL_R2_BLOCKED"
    assert vr["compatibility_factors_present"] is True


def test_no_body_inference_used():
    """B3 must NOT extract compatibility from body (canon strict — only from JSON proof)."""
    raw = promote.read_raw_gamme(VANNE_EGR_PATH)
    web = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "vanne-egr")
    # Empty compatibility data → no body fallback
    dims = promote.extract_dimensions(raw, web, compatibility_url_data=None)
    # Empty compat data → no proven URL list
    if dims.get("compatibility_proven_by_url"):
        assert len(dims["compatibility_proven_by_url"]) == 0
    # compatibility_factors source must NOT be body-inferred
    cf = dims.get("compatibility_factors", {})
    if cf:
        # If any compatibility_factors set, source must NOT be "body_inferred"
        assert cf.get("source_kind") != "body_inferred"


def test_cli_accepts_compatibility_url_json_flag():
    """--compatibility-url-json flag accepted, file content surfaced in run log."""
    if not B2_COMPAT_JSON.exists():
        import pytest
        pytest.skip("B2 JSON not present")
    result = subprocess.run(
        ["python3", str(SCRIPT_PATH), "--gamme", "vanne-egr", "--dry-run", "--verbose",
         "--compatibility-url-json", str(B2_COMPAT_JSON)],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, f"stderr: {result.stderr}"
    # Output must mention proven compatibility
    assert "compatibility_proven_by_url" in result.stdout
    assert "1-6-hdi" in result.stdout or "1-5-dci" in result.stdout


# === B5 tests : DB-rich dimensions ingest from B4 cross-check JSON ===

B4_CROSSCHECK_JSON = _Path("/opt/automecanik/app/audit/compatibility-top-r2-db-crosscheck-2026-05-27.json")


def test_read_db_crosscheck_json_detection():
    """Detect B4 JSON format (has 'results' + 'classifications', not 'compatibility_proven_by_url')."""
    if not B4_CROSSCHECK_JSON.exists():
        import pytest
        pytest.skip("B4 JSON not present")
    data = promote.read_compatibility_url_json(B4_CROSSCHECK_JSON)
    # Must auto-detect B4 format and convert to compatibility_proven_by_url[]
    assert data["url_count"] > 0
    # Each entry must keep DB fields if present
    sample = data["compatibility_proven_by_url"][0]
    assert "source_url" in sample
    assert "status" in sample


def test_reject_stale_db_missing_from_confirmed_dimensions():
    """STALE_URL_DB_MISSING entries must be EXCLUDED from confirmed compatibility_proven_by_url."""
    if not B4_CROSSCHECK_JSON.exists():
        import pytest
        pytest.skip("B4 JSON not present")
    data = promote.read_compatibility_url_json(B4_CROSSCHECK_JSON)
    # B4 JSON has 222 entries total, 219 PASS_DB_ALIGNED, 3 STALE
    # After filtering, only PASS_DB_ALIGNED entries should remain
    for entry in data["compatibility_proven_by_url"]:
        # If B4 format, classification field present and must be PASS_DB_ALIGNED
        if "classification" in entry:
            assert entry["classification"] == "PASS_DB_ALIGNED"
    # Should have 219 entries (B4 PASS_DB_ALIGNED count), not 222
    assert data["url_count"] == 219, f"Expected 219 PASS_DB_ALIGNED, got {data['url_count']}"


def test_db_aligned_tuple_enriches_motorisation_profile():
    """Each PASS_DB_ALIGNED entry should provide DB-rich fields (type_name, fuel, power_ps, years)."""
    if not B4_CROSSCHECK_JSON.exists():
        import pytest
        pytest.skip("B4 JSON not present")
    data = promote.read_compatibility_url_json(B4_CROSSCHECK_JSON)
    # Filter to vanne-egr only
    vanne_entries = [e for e in data["compatibility_proven_by_url"] if e.get("gamme") == "vanne-egr"]
    assert len(vanne_entries) > 0
    sample = vanne_entries[0]
    # DB-rich fields available
    assert "db_type_name" in sample or "db_type_fuel" in sample


def test_fuel_power_years_added_to_compatibility_factors():
    """When B4 JSON provided, compatibility_factors gets fuels, power_ps_range, year_range."""
    if not B4_CROSSCHECK_JSON.exists():
        import pytest
        pytest.skip("B4 JSON not present")
    raw = promote.read_raw_gamme(VANNE_EGR_PATH)
    web = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "vanne-egr")
    compat_data = promote.read_compatibility_url_json(B4_CROSSCHECK_JSON)
    dims = promote.extract_dimensions(raw, web, compatibility_url_data=compat_data)
    cf = dims["compatibility_factors"]
    # DB-rich enrichment
    assert "fuels" in cf
    assert isinstance(cf["fuels"], list)
    assert len(cf["fuels"]) > 0
    # source_kind upgraded to runtime_url_and_db
    assert cf["source_kind"] == "compatibility_proven_by_runtime_url_and_db"


def test_source_kind_runtime_url_and_db():
    if not B4_CROSSCHECK_JSON.exists():
        import pytest
        pytest.skip("B4 JSON not present")
    raw = promote.read_raw_gamme(VANNE_EGR_PATH)
    web = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "vanne-egr")
    compat_data = promote.read_compatibility_url_json(B4_CROSSCHECK_JSON)
    dims = promote.extract_dimensions(raw, web, compatibility_url_data=compat_data)
    assert dims["compatibility_factors"]["source_kind"] == "compatibility_proven_by_runtime_url_and_db"


def test_variant_readiness_still_passes_after_db_enrichment():
    if not B4_CROSSCHECK_JSON.exists():
        import pytest
        pytest.skip("B4 JSON not present")
    raw = promote.read_raw_gamme(VANNE_EGR_PATH)
    web = promote.aggregate_web_corpus_by_slug(promote.WEB_DIR, "vanne-egr")
    compat_data = promote.read_compatibility_url_json(B4_CROSSCHECK_JSON)
    dims = promote.extract_dimensions(raw, web, compatibility_url_data=compat_data)
    vr = promote.evaluate_variant_readiness(dims, is_r2_sensitive=True)
    assert vr["status"] == "PASS_VARIANT_READY"


def test_no_db_query_in_b5_dry_run():
    """B5 must NOT make any network calls to Supabase during read_compatibility_url_json."""
    # Set a fake SUPABASE_URL to ensure no real call is made
    import os
    original_url = os.environ.get("SUPABASE_URL")
    os.environ["SUPABASE_URL"] = "https://fake-must-not-be-called.invalid"
    try:
        if B4_CROSSCHECK_JSON.exists():
            data = promote.read_compatibility_url_json(B4_CROSSCHECK_JSON)
            assert data["url_count"] > 0  # Loaded without network
    finally:
        if original_url:
            os.environ["SUPABASE_URL"] = original_url
