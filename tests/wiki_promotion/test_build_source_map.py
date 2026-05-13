"""Tests build_source_map — projection 1:1 claims → entries, round-trip stable."""
from __future__ import annotations

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[2] / 'scripts'))

from datetime import datetime, timezone

import yaml
from hypothesis import given, settings, strategies as st

from wiki_promotion.build_source_map import build_source_map
from wiki_promotion.models import (
    Claim,
    ClaimSet,
    EntityType,
    ExtractionMethod,
    SourceMap,
)


SAMPLE_HASH = "sha256:" + "c" * 64


def _make_claim(idx: int) -> Claim:
    return Claim(
        claim_id=f"claim-{idx:016x}",
        text=f"sample claim {idx}",
        source_url="https://example.com/page",
        source_content_hash=SAMPLE_HASH,
        extraction_method=ExtractionMethod.READABILITY,
        selector="readability:summary",
        extracted_at=datetime.now(timezone.utc),
    )


def test_one_to_one_projection() -> None:
    claims = [_make_claim(i) for i in range(3)]
    cs = ClaimSet(
        source_manifest="ignored.manifest.yaml",
        claims=claims,
        extracted_at=datetime.now(timezone.utc),
    )
    sm = build_source_map(cs, EntityType.GAMME, "filtre-a-huile", "Filtre à huile")
    assert len(sm.entries) == 3
    assert [e.claim_id for e in sm.entries] == [c.claim_id for c in claims]


def test_empty_claims_yields_empty_entries() -> None:
    cs = ClaimSet(
        source_manifest="x.yaml",
        claims=[],
        extracted_at=datetime.now(timezone.utc),
    )
    sm = build_source_map(cs, EntityType.SUPPORT, "retours", "Retours")
    assert sm.entries == []


@settings(max_examples=20)
@given(n=st.integers(min_value=0, max_value=10))
def test_yaml_roundtrip_stable(n: int) -> None:
    """Property : (build → dump YAML → parse → SourceMap.model_validate) idempotent."""
    claims = [_make_claim(i) for i in range(n)]
    cs = ClaimSet(
        source_manifest="x.yaml",
        claims=claims,
        extracted_at=datetime.now(timezone.utc),
    )
    sm1 = build_source_map(cs, EntityType.VEHICLE, "renault-clio-3", "Renault Clio 3")
    dumped = yaml.safe_dump(sm1.model_dump(mode="json"), allow_unicode=True)
    reloaded = SourceMap.model_validate(yaml.safe_load(dumped))
    assert reloaded == sm1
