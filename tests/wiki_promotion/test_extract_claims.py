"""Tests extract_claims — chaîne déterministe, 0 LLM."""
from __future__ import annotations

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[2] / 'scripts'))

from pathlib import Path

import pytest

from wiki_promotion.extract_claims import extract_all
from wiki_promotion.models import ExtractionMethod

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_HASH = "sha256:" + "b" * 64


def test_jsonld_direct_lift_extracts_product() -> None:
    html = (FIXTURES / "sample-with-jsonld.html").read_text(encoding="utf-8")
    claims, rejected = extract_all(
        html,
        source_url="https://example.com/p9201",
        source_content_hash=SAMPLE_HASH,
        methods={ExtractionMethod.JSONLD_DIRECT_LIFT},
    )
    assert claims, "JSON-LD Product node should produce at least one claim"
    assert all(c.extraction_method == ExtractionMethod.JSONLD_DIRECT_LIFT for c in claims)
    assert any("Bosch P9201" in c.text for c in claims)


def test_zero_content_returns_empty_with_reasons() -> None:
    html = (FIXTURES / "sample-no-content.html").read_text(encoding="utf-8")
    claims, rejected = extract_all(
        html,
        source_url="https://example.com/empty",
        source_content_hash=SAMPLE_HASH,
    )
    assert claims == [], "Empty HTML must produce zero claims (no LLM hallucination)"
    assert rejected, "Rejection reasons must be documented"


def test_no_llm_inference_imports() -> None:
    """
    Garde-fou : aucun import de SDK LLM dans le module extract_claims.
    """
    src = Path(__file__).resolve().parents[2] / "scripts" / "wiki_promotion" / "extract_claims.py"
    text = src.read_text(encoding="utf-8")
    forbidden = ["anthropic", "openai", "groq", "cohere", "mistralai", "google.generativeai"]
    for needle in forbidden:
        assert needle not in text, f"LLM SDK '{needle}' must not appear in extract_claims.py"


def test_dom_selectors_fallback_meta_description() -> None:
    html = """<!doctype html><html><head>
    <meta name="description" content="Description fallback OK"></head>
    <body><h1>Titre H1</h1></body></html>"""
    claims, _ = extract_all(
        html,
        source_url="https://example.com",
        source_content_hash=SAMPLE_HASH,
        methods={ExtractionMethod.DOM_SELECTOR},
    )
    assert any("Description fallback OK" in c.text for c in claims)
    assert any(c.selector == 'meta[name="description"]' for c in claims)


def test_extraction_methods_isolation() -> None:
    """Restreindre les méthodes ne contamine pas d'autres extractors."""
    html = (FIXTURES / "sample-with-jsonld.html").read_text(encoding="utf-8")
    only_dom, _ = extract_all(
        html,
        source_url="https://example.com",
        source_content_hash=SAMPLE_HASH,
        methods={ExtractionMethod.DOM_SELECTOR},
    )
    assert all(c.extraction_method == ExtractionMethod.DOM_SELECTOR for c in only_dom)
