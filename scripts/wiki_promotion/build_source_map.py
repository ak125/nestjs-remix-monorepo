#!/usr/bin/env python3
"""
build-source-map — Indexe les claims par claim_id avec provenance vérifiable.

Lit la sortie YAML de extract-claims (ClaimSet) et produit un SourceMap
typé Pydantic v2 prêt pour render-proposal.

Aucune transformation de contenu, aucun LLM. Simple projection structurée
+ enrichissement par contexte entity (entity_type, slug, title humain).

Usage:
    build_source_map.py --claims claims.yaml \\
                        --entity-type gamme \\
                        --slug filtre-a-huile \\
                        --title "Filtre à huile"
    build_source_map.py --claims claims.yaml ... --out source_map.yaml
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import click
import yaml

from .models import (
    ClaimSet,
    EntityType,
    SourceMap,
    SourceMapEntry,
)


def build_source_map(
    claim_set: ClaimSet,
    entity_type: EntityType,
    slug: str,
    title: str,
) -> SourceMap:
    """Projette claims → source map entries (1:1, ordre conservé)."""
    entries = [
        SourceMapEntry(
            claim_id=c.claim_id,
            url=c.source_url,
            selector=c.selector,
            quote_verbatim=c.text,
            extracted_at=c.extracted_at,
            extractor_name=c.extraction_method,
        )
        for c in claim_set.claims
    ]
    return SourceMap(
        entity_type=entity_type,
        slug=slug,
        title=title,
        entries=entries,
        built_at=datetime.now(timezone.utc),
    )


@click.command()
@click.option(
    "--claims",
    "claims_path",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    required=True,
    help="Chemin vers le fichier YAML produit par extract-claims",
)
@click.option(
    "--entity-type",
    type=click.Choice([e.value for e in EntityType]),
    required=True,
)
@click.option("--slug", required=True, help="kebab-case ASCII, max 80 chars")
@click.option("--title", required=True, help="Titre humain libre")
@click.option(
    "--out",
    type=click.Path(dir_okay=False, path_type=Path),
    default=None,
    help="Chemin de sortie YAML. Défaut : stdout.",
)
def main(
    claims_path: Path,
    entity_type: str,
    slug: str,
    title: str,
    out: Path | None,
) -> None:
    """Construit un SourceMap typé à partir d'un ClaimSet YAML."""
    raw = yaml.safe_load(claims_path.read_text(encoding="utf-8"))
    claim_set = ClaimSet.model_validate(raw)

    source_map = build_source_map(
        claim_set,
        EntityType(entity_type),
        slug,
        title,
    )

    output = yaml.safe_dump(
        source_map.model_dump(mode="json"),
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
    )
    if out:
        out.write_text(output, encoding="utf-8")
        click.echo(f"wrote {out} ({len(source_map.entries)} entries)")
    else:
        click.echo(output, nl=False)

    sys.exit(0)


if __name__ == "__main__":
    main()
