#!/usr/bin/env python3
"""
extract-claims — Extracteur déterministe local raw HTML → claims YAML.

Chaîne d'extraction (priorité décroissante) :
  1. Schema.org JSON-LD direct lift (Product, Article, FAQPage, BreadcrumbList)
  2. Readability (article body + title sémantique)
  3. Trafilatura (texte propre + metadata, stripping commentaires/boilerplate)
  4. DOM selectors typés (CSS/XPath patterns connus)

**0 LLM**. Aucun appel API distant. Tout est déterministe local.
Aucune inférence sémantique : si aucun extracteur ne donne de claim sourcé,
sortie = liste vide + `rejected_reasons` documenté.

Usage:
    extract_claims.py --raw-html sources/web-corpus/2026-05-13/<hash>.html
    extract_claims.py --raw-html ... --out claims.yaml
    extract_claims.py --raw-html ... --methods jsonld,readability  # restreindre

Exit codes:
    0 — succès (claims extraites ou rejection documentée)
    1 — fichier raw introuvable / manifest invalide
"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import click
import yaml

from .models import (
    Claim,
    ClaimSet,
    ExtractionMethod,
)


JSONLD_SUPPORTED_TYPES = {"Product", "Article", "NewsArticle", "FAQPage", "BreadcrumbList"}


def _load_manifest(html_path: Path) -> dict:
    """Charge le manifest YAML sidecar correspondant au HTML."""
    manifest_path = html_path.with_suffix(".manifest.yaml")
    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest sidecar absent: {manifest_path}")
    return yaml.safe_load(manifest_path.read_text(encoding="utf-8"))


def _make_claim_id(source_url: str, selector: str, text: str) -> str:
    """sha256(url + selector + text)[:16] préfixé 'claim-'."""
    payload = f"{source_url}|{selector}|{text}".encode("utf-8")
    return f"claim-{hashlib.sha256(payload).hexdigest()[:16]}"


def _extract_jsonld(
    html: str, source_url: str, source_content_hash: str
) -> list[Claim]:
    """
    Lift direct des nodes JSON-LD Schema.org. Aucune inférence : on lit
    `name`, `description`, `headline`, `articleBody`, etc. tels qu'ils
    apparaissent dans le document.
    """
    try:
        from lxml import html as lxml_html  # type: ignore
    except ImportError:
        return []

    tree = lxml_html.fromstring(html)
    claims: list[Claim] = []
    now = datetime.now(timezone.utc)

    for idx, script in enumerate(tree.xpath('//script[@type="application/ld+json"]')):
        try:
            data = json.loads(script.text_content() or "")
        except json.JSONDecodeError:
            continue

        nodes = data if isinstance(data, list) else [data]
        for node_idx, node in enumerate(nodes):
            if not isinstance(node, dict):
                continue
            jsonld_type = node.get("@type")
            if isinstance(jsonld_type, list):
                jsonld_type = next(iter(jsonld_type), None)
            if jsonld_type not in JSONLD_SUPPORTED_TYPES:
                continue

            for field in ("name", "headline", "description", "articleBody"):
                value = node.get(field)
                if isinstance(value, str) and value.strip():
                    text = value.strip()[:4000]
                    selector = f"$.script[{idx}].{jsonld_type}[{node_idx}].{field}"
                    claims.append(
                        Claim(
                            claim_id=_make_claim_id(source_url, selector, text),
                            text=text,
                            source_url=source_url,
                            source_content_hash=source_content_hash,
                            extraction_method=ExtractionMethod.JSONLD_DIRECT_LIFT,
                            selector=selector,
                            extracted_at=now,
                        )
                    )

    return claims


def _extract_readability(
    html: str, source_url: str, source_content_hash: str
) -> list[Claim]:
    """Readability : title + summary du content principal sémantique."""
    try:
        from readability import Document  # type: ignore
    except ImportError:
        return []

    doc = Document(html)
    title = (doc.title() or "").strip()
    # Filter readability placeholders for empty/missing content
    if title in {"[no-title]", "[no_title]", "no-title"}:
        title = ""
    summary_html = doc.summary() or ""

    try:
        from lxml import html as lxml_html  # type: ignore

        summary_text = lxml_html.fromstring(summary_html).text_content().strip()
    except Exception:
        summary_text = ""

    claims: list[Claim] = []
    now = datetime.now(timezone.utc)

    if title:
        claims.append(
            Claim(
                claim_id=_make_claim_id(source_url, "readability:title", title),
                text=title[:4000],
                source_url=source_url,
                source_content_hash=source_content_hash,
                extraction_method=ExtractionMethod.READABILITY,
                selector="readability:title",
                extracted_at=now,
            )
        )
    if len(summary_text) >= 100:
        claims.append(
            Claim(
                claim_id=_make_claim_id(source_url, "readability:summary", summary_text),
                text=summary_text[:4000],
                source_url=source_url,
                source_content_hash=source_content_hash,
                extraction_method=ExtractionMethod.READABILITY,
                selector="readability:summary",
                extracted_at=now,
            )
        )
    return claims


def _extract_trafilatura(
    html: str, source_url: str, source_content_hash: str
) -> list[Claim]:
    """Trafilatura : texte propre extrait (boilerplate stripped)."""
    try:
        import trafilatura  # type: ignore
    except ImportError:
        return []

    text = trafilatura.extract(
        html, include_comments=False, include_tables=False, favor_precision=True
    ) or ""
    text = text.strip()
    if len(text) < 200:
        return []

    now = datetime.now(timezone.utc)
    return [
        Claim(
            claim_id=_make_claim_id(source_url, "trafilatura:text", text[:200]),
            text=text[:4000],
            source_url=source_url,
            source_content_hash=source_content_hash,
            extraction_method=ExtractionMethod.TRAFILATURA,
            selector="trafilatura:text",
            extracted_at=now,
        )
    ]


def _extract_dom_selectors(
    html: str, source_url: str, source_content_hash: str
) -> list[Claim]:
    """
    Patterns DOM connus : meta[name=description], h1, og:title.
    Sélecteurs fixes, déterministes, jamais inférés.
    """
    try:
        from lxml import html as lxml_html  # type: ignore
    except ImportError:
        return []

    tree = lxml_html.fromstring(html)
    claims: list[Claim] = []
    now = datetime.now(timezone.utc)

    selectors_text: dict[str, str] = {}

    for el in tree.xpath('//meta[@name="description"]/@content'):
        if el and el.strip():
            selectors_text['meta[name="description"]'] = el.strip()
            break

    for el in tree.xpath('//meta[@property="og:title"]/@content'):
        if el and el.strip():
            selectors_text['meta[property="og:title"]'] = el.strip()
            break

    h1_nodes = tree.xpath("//h1")
    if h1_nodes:
        h1_text = (h1_nodes[0].text_content() or "").strip()
        if h1_text:
            selectors_text["h1"] = h1_text

    for selector, text in selectors_text.items():
        claims.append(
            Claim(
                claim_id=_make_claim_id(source_url, selector, text),
                text=text[:4000],
                source_url=source_url,
                source_content_hash=source_content_hash,
                extraction_method=ExtractionMethod.DOM_SELECTOR,
                selector=selector,
                extracted_at=now,
            )
        )
    return claims


def extract_all(
    html: str,
    source_url: str,
    source_content_hash: str,
    methods: Iterable[ExtractionMethod] | None = None,
) -> tuple[list[Claim], list[str]]:
    """
    Applique les extracteurs dans l'ordre canon et dédup par `claim_id`.
    Retourne (claims, rejected_reasons).
    """
    enabled = (
        set(methods)
        if methods
        else set(ExtractionMethod)
    )
    all_claims: dict[str, Claim] = {}
    rejected: list[str] = []

    extractors = [
        (ExtractionMethod.JSONLD_DIRECT_LIFT, _extract_jsonld, "no_jsonld_supported_types"),
        (ExtractionMethod.READABILITY, _extract_readability, "readability_below_threshold"),
        (ExtractionMethod.TRAFILATURA, _extract_trafilatura, "trafilatura_below_200_chars"),
        (ExtractionMethod.DOM_SELECTOR, _extract_dom_selectors, "no_dom_pattern_match"),
    ]

    for method, fn, reject_reason in extractors:
        if method not in enabled:
            continue
        claims = fn(html, source_url, source_content_hash)
        if not claims:
            rejected.append(reject_reason)
            continue
        for claim in claims:
            all_claims.setdefault(claim.claim_id, claim)

    return list(all_claims.values()), rejected


@click.command()
@click.option(
    "--raw-html",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    required=True,
    help="Chemin vers le fichier HTML brut (manifest sidecar attendu à côté)",
)
@click.option(
    "--out",
    type=click.Path(dir_okay=False, path_type=Path),
    default=None,
    help="Chemin de sortie YAML. Défaut : stdout.",
)
@click.option(
    "--methods",
    default=",".join(m.value for m in ExtractionMethod),
    show_default=True,
    help="Liste comma-séparée des extracteurs à appliquer",
)
def main(raw_html: Path, out: Path | None, methods: str) -> None:
    """Extrait claims d'un raw HTML via chaîne déterministe (0 LLM)."""
    manifest = _load_manifest(raw_html)
    source_url = str(manifest["url"])
    source_content_hash = manifest["content_hash"]

    enabled_methods = {ExtractionMethod(m.strip()) for m in methods.split(",") if m.strip()}

    html = raw_html.read_text(encoding="utf-8")
    claims, rejected_reasons = extract_all(
        html, source_url, source_content_hash, methods=enabled_methods
    )

    relative_manifest = raw_html.with_suffix(".manifest.yaml")
    claim_set = ClaimSet(
        source_manifest=str(relative_manifest),
        claims=claims,
        extracted_at=datetime.now(timezone.utc),
        rejected_reasons=rejected_reasons,
    )

    output = yaml.safe_dump(
        claim_set.model_dump(mode="json"),
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
    )
    if out:
        out.write_text(output, encoding="utf-8")
        click.echo(f"wrote {out} ({len(claims)} claims, {len(rejected_reasons)} rejected)")
    else:
        click.echo(output, nl=False)

    sys.exit(0)


if __name__ == "__main__":
    main()
