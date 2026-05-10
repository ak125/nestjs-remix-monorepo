"""check_obsidian.py — Couche 4 du skill seo-vault-verify.

Vérifie l'intégrité Obsidian : frontmatter YAML parsable et
blocs Dataview non-vides.
"""
from __future__ import annotations

import re
from pathlib import Path

import yaml


_FRONTMATTER = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
_DATAVIEW_BLOCK = re.compile(r"```dataview\s*\n(.*?)```", re.DOTALL)


def check_vault_integrity(vault_root) -> dict:
    """Scanne tous les .md et retourne erreurs frontmatter + dataview."""
    root = Path(vault_root)
    frontmatter_errors = []
    dataview_errors = []
    total_blocks = 0

    for md in root.rglob("*.md"):
        rel = str(md.relative_to(root))
        raw = md.read_text(encoding="utf-8", errors="replace")

        m = _FRONTMATTER.match(raw)
        if m:
            try:
                yaml.safe_load(m.group(1))
            except yaml.YAMLError as e:
                frontmatter_errors.append({"path": rel, "error": str(e)})

        for bm in _DATAVIEW_BLOCK.finditer(raw):
            total_blocks += 1
            body = bm.group(1).strip()
            if not body:
                dataview_errors.append({"path": rel,
                                        "error": "bloc dataview vide"})

    return {
        "frontmatter_errors": frontmatter_errors,
        "dataview_errors": dataview_errors,
        "dataview_blocks_total": total_blocks,
    }
