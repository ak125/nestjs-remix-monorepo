"""check_crossref.py — Couche 3 du skill seo-vault-verify.

Parse les liens internes Obsidian (wikilinks + markdown links)
et agrège combien de fichiers référencent une cible donnée.
"""
from __future__ import annotations

import re
from pathlib import Path


_WIKILINK = re.compile(r"\[\[([^\]|#]+?)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]")
_MDLINK = re.compile(r"\]\(([^)\s]+?\.md)\)")


def extract_links(path) -> set:
    """Retourne le set des target stems (sans .md, sans heading anchor)."""
    p = Path(path)
    raw = p.read_text(encoding="utf-8", errors="replace")
    links = set()

    for m in _WIKILINK.finditer(raw):
        target = m.group(1).strip()
        stem = target.split("/")[-1]
        if stem.endswith(".md"):
            stem = stem[:-3]
        links.add(stem)

    for m in _MDLINK.finditer(raw):
        target = m.group(1).strip()
        stem = target.split("/")[-1]
        if stem.endswith(".md"):
            stem = stem[:-3]
        links.add(stem)

    return links


def count_files_referencing(vault_root, target_stem: str) -> int:
    """Combien de fichiers .md du vault référencent `target_stem` ?"""
    root = Path(vault_root)
    count = 0
    for md in root.rglob("*.md"):
        try:
            if target_stem in extract_links(md):
                count += 1
        except Exception:
            continue
    return count


def scan_vault(vault_root) -> dict:
    """Retourne {source_rel_path: [target_stem, ...]}."""
    root = Path(vault_root)
    result = {}
    for md in root.rglob("*.md"):
        rel = str(md.relative_to(root))
        result[rel] = sorted(extract_links(md))
    return result
