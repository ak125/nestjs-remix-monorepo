"""Tests Pydantic models — invariants typés (round-trip, validation)."""
from __future__ import annotations

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[2] / 'scripts'))

from datetime import datetime, timezone

import pytest
from hypothesis import given, strategies as st
from pydantic import ValidationError

from wiki_promotion.models import (
    Claim,
    ClaimSet,
    EntityType,
    ExtractionMethod,
    ProposalSpec,
    RawManifest,
    SourceLevel,
    SourceMap,
    SourceMapEntry,
    TrustLevel,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sample_content_hash() -> str:
    return "sha256:" + "a" * 64


def test_raw_manifest_roundtrip() -> None:
    m = RawManifest(
        content_hash=_sample_content_hash(),
        url="https://example.com/article",
        captured_at=_now(),
        source_level=SourceLevel.WEB,
        trust_level=TrustLevel.MEDIUM_CONCORDANT,
        http_status=200,
        content_length_bytes=42,
        user_agent="AutoMecanik-Capture/1.0",
        capture_tool_version="1.40.0",
    )
    dumped = m.model_dump(mode="json")
    reloaded = RawManifest.model_validate(dumped)
    assert reloaded == m


def test_raw_manifest_rejects_bad_hash() -> None:
    with pytest.raises(ValidationError):
        RawManifest(
            content_hash="md5:deadbeef",
            url="https://example.com",
            captured_at=_now(),
            trust_level=TrustLevel.LOW,
            http_status=200,
            content_length_bytes=0,
            user_agent="x",
            capture_tool_version="1.0",
        )


def test_claim_id_pattern_enforced() -> None:
    with pytest.raises(ValidationError):
        Claim(
            claim_id="not-a-claim-id",
            text="text",
            source_url="https://example.com",
            source_content_hash=_sample_content_hash(),
            extraction_method=ExtractionMethod.JSONLD_DIRECT_LIFT,
            extracted_at=_now(),
        )


@given(slug=st.from_regex(r"^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$", fullmatch=True))
def test_source_map_slug_pattern(slug: str) -> None:
    sm = SourceMap(
        entity_type=EntityType.GAMME,
        slug=slug,
        title="X",
        entries=[],
        built_at=_now(),
    )
    assert sm.slug == slug


def test_source_map_rejects_bad_slug() -> None:
    with pytest.raises(ValidationError):
        SourceMap(
            entity_type=EntityType.GAMME,
            slug="BAD UPPER SPACE",
            title="X",
            entries=[],
            built_at=_now(),
        )


def test_proposal_spec_minimal() -> None:
    sm = SourceMap(
        entity_type=EntityType.GAMME,
        slug="filtre-a-huile",
        title="Filtre à huile",
        entries=[],
        built_at=_now(),
    )
    spec = ProposalSpec(
        entity_type=EntityType.GAMME,
        slug="filtre-a-huile",
        title="Filtre à huile",
        source_map=sm,
        body_md="content",
    )
    assert spec.lang == "fr"
    assert spec.truth_level == "L1"
