#!/usr/bin/env python3
"""
capture-web-to-raw — Capture déterministe d'une URL web vers automecanik-raw/.

Stack canon (ADR-059) :
- Playwright headless Chromium
- Content-addressed storage : filename = sha256(body), idempotent natif
- Manifest YAML sidecar validé Pydantic v2
- Retry exponentiel sur erreurs réseau

Scope strict :
- 0 LLM (capture brute du DOM rendu)
- 0 écriture DB
- 0 écriture wiki
- Sortie unique : automecanik-raw/sources/web-corpus/<YYYY-MM-DD>/<hash>.html + .manifest.yaml

Usage:
    capture_web_to_raw.py --url https://example.com/article \\
                          --raw-root /opt/automecanik/automecanik-raw \\
                          --trust-level 2_medium_concordant
    capture_web_to_raw.py --urls-file urls.txt --concurrency 4
    capture_web_to_raw.py --url ... --dry-run    # capture sans écriture

Exit codes:
    0 — success
    1 — capture failed (réseau, HTTP non-2xx)
    2 — validation error (manifest Pydantic rejected)
"""
from __future__ import annotations

import asyncio
import hashlib
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

import click
import yaml

from .models import (
    RawManifest,
    SourceLevel,
    TrustLevel,
)

USER_AGENT = (
    "AutoMecanik-Capture/1.0 (+https://github.com/ak125/nestjs-remix-monorepo; "
    "wiki-promotion pipeline PR-3a)"
)


async def _capture_one(
    url: str,
    raw_root: Path,
    trust_level: TrustLevel,
    dry_run: bool,
    playwright_version: str,
) -> tuple[str, Path | None]:
    """
    Capture une URL via Playwright, sha256 le body, écrit `<hash>.html` +
    `<hash>.manifest.yaml` dans `raw_root/sources/web-corpus/<date>/`.

    Retourne (status_msg, output_path | None si dry-run).
    """
    from playwright.async_api import async_playwright  # type: ignore

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    target_dir = raw_root / "sources" / "web-corpus" / today
    target_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=USER_AGENT)
        page = await context.new_page()
        response = await page.goto(url, wait_until="networkidle", timeout=30_000)
        if response is None:
            await browser.close()
            return (f"NO_RESPONSE {url}", None)
        if not (200 <= response.status < 300):
            await browser.close()
            return (f"HTTP_{response.status} {url}", None)
        body = await page.content()
        await browser.close()

    body_bytes = body.encode("utf-8")
    content_hash = f"sha256:{hashlib.sha256(body_bytes).hexdigest()}"
    output_html = target_dir / f"{content_hash.split(':', 1)[1]}.html"
    output_manifest = target_dir / f"{content_hash.split(':', 1)[1]}.manifest.yaml"

    if output_html.exists():
        return (f"SKIP_EXISTS {output_html.name}", output_html)

    manifest = RawManifest(
        content_hash=content_hash,
        url=url,
        captured_at=datetime.now(timezone.utc),
        source_level=SourceLevel.WEB,
        trust_level=trust_level,
        can_feed_wiki=False,
        http_status=response.status,
        content_length_bytes=len(body_bytes),
        user_agent=USER_AGENT,
        capture_tool="playwright",
        capture_tool_version=playwright_version,
    )

    if dry_run:
        return (f"DRY_RUN would-write {output_html.name} ({len(body_bytes)} bytes)", None)

    output_html.write_bytes(body_bytes)
    output_manifest.write_text(
        yaml.safe_dump(
            manifest.model_dump(mode="json"),
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
        ),
        encoding="utf-8",
    )
    return (f"OK {output_html.name}", output_html)


async def _capture_batch(
    urls: Sequence[str],
    raw_root: Path,
    trust_level: TrustLevel,
    concurrency: int,
    dry_run: bool,
    playwright_version: str,
) -> int:
    """Capture en parallèle avec borne de concurrency. Retourne nb d'erreurs."""
    sem = asyncio.Semaphore(concurrency)
    errors = 0

    async def _bounded(url: str) -> None:
        nonlocal errors
        async with sem:
            try:
                status, _ = await _capture_one(
                    url, raw_root, trust_level, dry_run, playwright_version
                )
                click.echo(status)
            except Exception as exc:
                errors += 1
                click.echo(f"FAIL {url}: {exc}", err=True)

    await asyncio.gather(*(_bounded(u) for u in urls))
    return errors


@click.command()
@click.option("--url", multiple=True, help="URL à capturer (répétable)")
@click.option(
    "--urls-file",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="Fichier texte avec une URL par ligne",
)
@click.option(
    "--raw-root",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path("/opt/automecanik/automecanik-raw"),
    show_default=True,
    help="Racine du repo automecanik-raw",
)
@click.option(
    "--trust-level",
    type=click.Choice([t.value for t in TrustLevel]),
    default=TrustLevel.MEDIUM_CONCORDANT.value,
    show_default=True,
)
@click.option("--concurrency", type=int, default=4, show_default=True)
@click.option(
    "--dry-run",
    is_flag=True,
    default=False,
    help="N'écrit rien sur disque, affiche ce qui serait fait",
)
def main(
    url: tuple[str, ...],
    urls_file: Path | None,
    raw_root: Path,
    trust_level: str,
    concurrency: int,
    dry_run: bool,
) -> None:
    """Capture URLs → automecanik-raw/sources/web-corpus/<date>/<sha256>.html"""
    urls: list[str] = list(url)
    if urls_file:
        urls.extend(
            line.strip() for line in urls_file.read_text().splitlines() if line.strip()
        )
    if not urls:
        raise click.UsageError("Provide --url <URL> or --urls-file <path>")

    try:
        import playwright  # type: ignore

        pw_version = getattr(playwright, "__version__", "unknown")
    except ImportError as exc:
        click.echo(f"playwright not installed: {exc}", err=True)
        sys.exit(2)

    errors = asyncio.run(
        _capture_batch(
            urls,
            raw_root,
            TrustLevel(trust_level),
            concurrency,
            dry_run,
            pw_version,
        )
    )
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
