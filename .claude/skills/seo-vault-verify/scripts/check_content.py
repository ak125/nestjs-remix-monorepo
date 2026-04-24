"""check_content.py — Couche 2 du skill seo-vault-verify.

Vérifie les assertions binaires du manifeste sur chaque fichier :
must_contain (avec near/window optionnels), sections_required,
tags_required, tag_context, frontmatter_keys_required,
dataview_blocks_min.

Normalisation : Unicode NFC, case-insensitive par défaut,
whitespace collapse.
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import yaml


def _normalize(text: str) -> str:
    """NFC + lowercase + whitespace collapse."""
    nfc = unicodedata.normalize("NFC", text)
    collapsed = re.sub(r"\s+", " ", nfc)
    return collapsed.lower()


def _normalize_pattern(pat: str) -> str:
    nfc = unicodedata.normalize("NFC", pat)
    return re.sub(r"\s+", " ", nfc).lower()


def _extract_frontmatter(content: str) -> dict:
    """Parse YAML frontmatter entre --- ... ---. Retourne {} si absent."""
    m = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
    if not m:
        return {}
    try:
        parsed = yaml.safe_load(m.group(1))
        return parsed if isinstance(parsed, dict) else {}
    except yaml.YAMLError:
        return {}


def _check_pattern(text_norm: str, rule: dict) -> dict:
    pattern = rule["pattern"]
    target = _normalize_pattern(pattern)

    if "near" in rule:
        near = rule["near"]
        near_norm = _normalize_pattern(near)
        window = int(rule.get("window", 200))
        for m in re.finditer(re.escape(near_norm), text_norm):
            start = max(0, m.start() - window)
            end = min(len(text_norm), m.end() + window)
            zone = text_norm[start:end]
            if target in zone:
                return {"pass": True, "pattern": pattern, "mode": "near"}
        return {"pass": False, "pattern": pattern, "mode": "near",
                "reason": f"'{pattern}' pas trouvé dans fenêtre ±{window} autour de '{near}'"}

    found = target in text_norm
    return {"pass": found, "pattern": pattern, "mode": "simple"}


def _check_section_title(text_norm: str, title: str) -> tuple[bool, int]:
    """Retourne (présent, index_début_section) — match H2 '## title'."""
    title_norm = _normalize_pattern(title)
    pat = re.compile(r"##\s+" + re.escape(title_norm), re.MULTILINE)
    m = pat.search(text_norm)
    if not m:
        return False, -1
    return True, m.start()


def _section_body(text_norm: str, start: int) -> str:
    rest = text_norm[start:]
    next_h2 = re.search(r"\n##\s+", rest[2:])
    if next_h2:
        return rest[:next_h2.start() + 2]
    return rest


def _count_terms(section_body: str, markers: list) -> int:
    """Compte les termes définis via markers.

    Ex: markers = ["**", ":"] matches `**terme** :` ; markers = ["**", "—"]
    matches `**terme** —` (em-dash). Le séparateur est normalisé pour
    accepter variations de whitespace.
    """
    if len(markers) != 2:
        return 0
    start, end = markers
    # **terme** suivi d'optional whitespace, suivi du separator
    pattern = re.escape(start) + r"[^\n*]+?" + re.escape(start) + r"\s*" + re.escape(end)
    return len(re.findall(pattern, section_body))


def _check_tag(text_norm: str, tag: str) -> bool:
    return tag.lower() in text_norm


def check_file(path, rules: dict) -> dict:
    """Applique toutes les règles d'un item manifeste à un fichier."""
    path = Path(path)
    if not path.exists():
        return {"pass": False, "path": str(path),
                "checks": [{"pass": False, "type": "file_exists",
                            "detail": "fichier absent"}]}

    raw = path.read_text(encoding="utf-8", errors="replace")
    text_norm = _normalize(raw)
    frontmatter = _extract_frontmatter(raw)
    checks = []

    for rule in rules.get("must_contain", []):
        r = _check_pattern(text_norm, rule)
        r["type"] = "must_contain"
        checks.append(r)

    for sec in rules.get("sections_required", []):
        title = sec["title"]
        present, start = _check_section_title(text_norm, title)
        if not present:
            checks.append({"pass": False, "type": "section_required",
                           "detail": f"section '{title}' absente"})
            continue
        min_terms = sec.get("min_terms")
        if min_terms is not None:
            body = _section_body(text_norm, start)
            count = _count_terms(body, sec.get("term_markers", ["**", ":"]))
            ok = count >= min_terms
            checks.append({"pass": ok, "type": "section_min_terms",
                           "detail": f"section '{title}' : {count}/{min_terms} termes"})
        else:
            checks.append({"pass": True, "type": "section_required",
                           "detail": f"section '{title}' présente"})

    for tag in rules.get("tags_required", []):
        ok = _check_tag(text_norm, tag)
        checks.append({"pass": ok, "type": "tag_required",
                       "detail": f"tag '{tag}' {'trouvé' if ok else 'absent'}"})

    for ctx in rules.get("tag_context", []):
        tag = ctx["tag"]
        qualifier = ctx["qualifier_pattern"]
        window = int(ctx.get("window", 100))
        qualifier_norm = _normalize_pattern(qualifier)
        tag_norm = tag.lower()
        found = False
        for m in re.finditer(re.escape(tag_norm), text_norm):
            start = max(0, m.start() - window)
            end = min(len(text_norm), m.end() + window)
            if qualifier_norm in text_norm[start:end]:
                found = True
                break
        checks.append({"pass": found, "type": "tag_context",
                       "detail": f"'{tag}' {'près de' if found else 'loin de'} '{qualifier}'"})

    for key in rules.get("frontmatter_keys_required", []):
        ok = key in frontmatter
        checks.append({"pass": ok, "type": "frontmatter_key",
                       "detail": f"clé '{key}' {'présente' if ok else 'absente'} dans frontmatter"})

    if "dataview_blocks_min" in rules:
        min_n = int(rules["dataview_blocks_min"])
        count = len(re.findall(r"```dataview\b", raw))
        checks.append({"pass": count >= min_n, "type": "dataview_blocks",
                       "detail": f"{count}/{min_n} blocks dataview"})

    all_pass = all(c["pass"] for c in checks) if checks else True
    return {"pass": all_pass, "path": str(path), "checks": checks}
