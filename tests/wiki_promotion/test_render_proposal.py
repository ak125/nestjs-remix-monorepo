"""Tests render_proposal — schema v1.0.0 + garde-fou wiki canon refusal."""
from __future__ import annotations

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[2] / 'scripts'))

import re
from datetime import datetime, timezone
from pathlib import Path

import click
import pytest
import yaml

from wiki_promotion.models import (
    EntityType,
    ExtractionMethod,
    ProposalSpec,
    SourceMap,
    SourceMapEntry,
)
from wiki_promotion.render_proposal import (
    _format_md,
    _refuse_wiki_canon_write,
    render_proposal_markdown,
)


def _sample_spec(slug: str = "filtre-a-huile") -> ProposalSpec:
    sm = SourceMap(
        entity_type=EntityType.GAMME,
        slug=slug,
        title="Filtre à huile",
        entries=[
            SourceMapEntry(
                claim_id="claim-" + "1" * 16,
                url="https://example.com/p",
                selector="readability:summary",
                quote_verbatim="Le filtre à huile retient les particules.",
                extracted_at=datetime.now(timezone.utc),
                extractor_name=ExtractionMethod.READABILITY,
            )
        ],
        built_at=datetime.now(timezone.utc),
    )
    return ProposalSpec(
        entity_type=EntityType.GAMME,
        slug=slug,
        title="Filtre à huile",
        aliases=["filtre à huile moteur"],
        source_map=sm,
        body_md="Description manuelle.",
    )


def test_frontmatter_v1_required_fields() -> None:
    spec = _sample_spec()
    fm, _ = render_proposal_markdown(spec)
    required = {
        "schema_version", "id", "entity_type", "slug", "title", "lang",
        "created_at", "updated_at", "truth_level", "review_status", "exportable",
    }
    missing = required - fm.keys()
    assert not missing, f"missing required v1.0.0 fields: {missing}"
    assert fm["schema_version"] == "1.0.0"
    assert fm["id"] == "gamme:filtre-a-huile"
    assert fm["review_status"] == "proposed"
    assert fm["exportable"] is False


def test_id_pattern_v1() -> None:
    spec = _sample_spec()
    fm, _ = render_proposal_markdown(spec)
    assert re.match(
        r"^(gamme|vehicle|constructeur|support|diagnostic):[a-z0-9][a-z0-9-]*[a-z0-9]$",
        fm["id"],
    )


def test_body_includes_sources_section() -> None:
    spec = _sample_spec()
    _, body = render_proposal_markdown(spec)
    assert "## Sources" in body
    assert "claim-" + "1" * 16 in body


def test_full_markdown_starts_with_frontmatter() -> None:
    spec = _sample_spec()
    fm, body = render_proposal_markdown(spec)
    md = _format_md(fm, body)
    assert md.startswith("---\n")
    assert "\n---\n" in md[4:]


def test_refuse_write_into_wiki_canon(tmp_path: Path) -> None:
    """Le garde-fou refuse `wiki/<entity_type>/<file>.md` sous wiki_root."""
    wiki_root = tmp_path / "automecanik-wiki"
    target = wiki_root / "wiki" / "gamme" / "filtre-a-huile.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    with pytest.raises(click.ClickException, match="writing into wiki canon is forbidden"):
        _refuse_wiki_canon_write(target, wiki_root)


def test_allow_write_into_proposals(tmp_path: Path) -> None:
    """proposals/ est autorisé."""
    wiki_root = tmp_path / "automecanik-wiki"
    target = wiki_root / "proposals" / "filtre-a-huile.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    _refuse_wiki_canon_write(target, wiki_root)


def test_allow_write_outside_wiki_root(tmp_path: Path) -> None:
    """Chemins hors wiki_root (e.g. /tmp pour tests) autorisés."""
    wiki_root = tmp_path / "automecanik-wiki"
    wiki_root.mkdir()
    target = tmp_path / "elsewhere" / "x.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    _refuse_wiki_canon_write(target, wiki_root)


def test_no_llm_inference_imports_render() -> None:
    """Garde-fou statique : aucun import LLM dans render_proposal.py."""
    src = Path(__file__).resolve().parents[2] / "scripts" / "wiki_promotion" / "render_proposal.py"
    text = src.read_text(encoding="utf-8")
    forbidden = ["anthropic", "openai", "groq", "cohere", "mistralai", "google.generativeai"]
    for needle in forbidden:
        assert needle not in text, f"LLM SDK '{needle}' must not appear in render_proposal.py"


def test_no_db_imports_anywhere() -> None:
    """Garde-fou statique : aucun import DB (psycopg, supabase, asyncpg) dans pipeline."""
    pipeline_dir = Path(__file__).resolve().parents[2] / "scripts" / "wiki_promotion"
    forbidden_db = ["psycopg", "asyncpg", "supabase", "sqlalchemy", "django"]
    for script in pipeline_dir.glob("*.py"):
        text = script.read_text(encoding="utf-8")
        for needle in forbidden_db:
            assert needle not in text, (
                f"DB SDK '{needle}' must not appear in {script.name} "
                "(PR-3a strict scope: raw → proposal, no DB)"
            )
