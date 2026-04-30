#!/usr/bin/env python3
"""validate-gamme-diagnostic-relations.py — ADR-033 §"Phase 2" CI validator (monorepo side).

Validates wiki gamme fiches against the ADR-033 v2.0.0 frontmatter contract :
  - schema_version 2.0.0 strict
  - NO entity_data.symptoms[] block (anti-pattern §D2 → blocked_reasons:[legacy_symptoms_block])
  - NO file under wiki/systemes/ (anti-pattern §D3 → forbidden_systemes_dir)
  - NO file matching wiki/diagnostic/<symptom>-*.md regex (anti-pattern §D3 → forbidden_per_symptom_file)
  - diagnostic_relations[].symptom_slug ∈ exports/diag-canon-slugs.json (fallback hardcoded if absent)
  - diagnostic_relations[].sources[] ∈ _meta/source-catalog.yaml
  - relation_to_part required per entry (§D1 → relation_to_part_missing)

Complementary to the wiki repo's _scripts/quality-gates.py (which has 9 gates including
overclaim, source policy, maintenance advice). This monorepo-side validator is a
narrower contract enforcer focused on FK validation and the 3 anti-patterns figés §D3.
The wiki repo CI runs the full 9 gates ; this monorepo CI runs the FK-strict subset
to catch regressions when monorepo changes (skill updates, content/ embed changes)
would invalidate wiki fiches.

Usage :
  python3 scripts/wiki/validate-gamme-diagnostic-relations.py --all
  python3 scripts/wiki/validate-gamme-diagnostic-relations.py <file>...
  python3 scripts/wiki/validate-gamme-diagnostic-relations.py --wiki-path /path/to/automecanik-wiki

Exit :
  0 — all PASS
  1 — at least one fiche FAILED
  2 — script error (missing wiki path, missing canon files, etc.)

Refs :
  - ADR-033 vault PR #108 commit 77085ef
  - canon : automecanik-wiki/_meta/schema/frontmatter.schema.json v2.0.0
  - source registry : automecanik-wiki/_meta/source-catalog.yaml
  - canon DB slugs : automecanik-wiki/exports/diag-canon-slugs.json (Phase 3 PR-D ADR-033)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("FATAL: PyYAML required (pip install pyyaml)\n")
    sys.exit(2)


# ── Configuration ────────────────────────────────────────────────────────────

DEFAULT_WIKI_PATH = Path(os.environ.get("AUTOMECANIK_WIKI_PATH", "/opt/automecanik/automecanik-wiki"))

# Fallback canon slugs si exports/diag-canon-slugs.json absent (PR-D ADR-033 wires the cron).
# Snapshot de public.__diag_symptom au 2026-04-30 (cf. mémoire diag-symptom-db-convention.md).
FALLBACK_CANON_SYMPTOM_SLUGS = {
    "brake_noise_metallic",
    "brake_noise_grinding",
    "brake_pulling_side",
    "brake_soft_pedal",
    "brake_vibration_pedal",
}

# Pattern interdit ADR-033 §D3 : wiki/diagnostic/<symptom>-*.md
FORBIDDEN_PER_SYMPTOM_FILE_PATTERN = re.compile(
    r"^wiki/diagnostic/(bruit|grincement|vibration|voyant|fumee|surchauffe|fuite|usure|symptome|claquement|sifflement)-.*\.md$"
)

# blocked_reasons enum (subset des 9 quality-gates wiki, focused FK + anti-patterns §D3)
BLOCKED_REASONS = (
    "schema_version_invalid",
    "legacy_symptoms_block",
    "forbidden_systemes_dir",
    "forbidden_per_symptom_file",
    "relation_to_part_missing",
    "symptom_slug_unknown",
    "source_slug_unknown",
)


# ── Canon loaders ────────────────────────────────────────────────────────────


def load_canon_symptom_slugs(wiki_path: Path) -> tuple[set[str], str]:
    """Load __diag_symptom canon slugs. Prefers exports/diag-canon-slugs.json,
    falls back to hardcoded snapshot if absent (PR-D ADR-033 wires nightly export)."""
    export_path = wiki_path / "exports" / "diag-canon-slugs.json"
    if export_path.exists():
        try:
            data = json.loads(export_path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                slugs = {entry["symptom_slug"] for entry in data if "symptom_slug" in entry}
                return slugs, f"loaded {len(slugs)} slugs from {export_path}"
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            sys.stderr.write(f"WARN: cannot parse {export_path}: {e}. Using fallback.\n")
    return FALLBACK_CANON_SYMPTOM_SLUGS, f"using hardcoded fallback ({len(FALLBACK_CANON_SYMPTOM_SLUGS)} slugs, PR-D ADR-033 not yet wired)"


def load_source_catalog(wiki_path: Path) -> set[str]:
    """Load _meta/source-catalog.yaml registered slugs."""
    catalog_path = wiki_path / "_meta" / "source-catalog.yaml"
    if not catalog_path.exists():
        sys.stderr.write(f"FATAL: {catalog_path} missing — wiki repo not at expected path\n")
        sys.exit(2)
    data = yaml.safe_load(catalog_path.read_text(encoding="utf-8"))
    sources = data.get("sources") or []
    return {s["slug"] for s in sources if isinstance(s, dict) and "slug" in s}


# ── Frontmatter parsing ──────────────────────────────────────────────────────


def split_frontmatter(text: str) -> tuple[dict, str] | None:
    """Split frontmatter from body. Returns (frontmatter_dict, body_str) or None."""
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    fm_text = text[4:end]
    body = text[end + 5 :]
    try:
        fm = yaml.safe_load(fm_text) or {}
    except yaml.YAMLError:
        return None
    return fm, body


# ── Gates ────────────────────────────────────────────────────────────────────


def gate_path_anti_patterns(rel_path: str) -> list[str]:
    """ADR-033 §D3 — forbidden file paths."""
    reasons = []
    if rel_path.startswith("wiki/systemes/"):
        reasons.append("forbidden_systemes_dir")
    if FORBIDDEN_PER_SYMPTOM_FILE_PATTERN.match(rel_path):
        reasons.append("forbidden_per_symptom_file")
    return reasons


def gate_legacy_symptoms_block(fm: dict) -> list[str]:
    """ADR-033 §D2 — entity_data.symptoms[] or diagnostic.symptoms[] is forbidden."""
    entity_data = fm.get("entity_data") or {}
    if isinstance(entity_data, dict) and "symptoms" in entity_data:
        return ["legacy_symptoms_block"]
    diagnostic = fm.get("diagnostic") or {}
    if isinstance(diagnostic, dict) and "symptoms" in diagnostic:
        return ["legacy_symptoms_block"]
    return []


def gate_schema_version(fm: dict) -> list[str]:
    """schema_version must be 1.0.0 or 2.0.0 (cohabitation pendant Phase 4 migration)."""
    v = str(fm.get("schema_version") or "")
    if v not in {"1.0.0", "2.0.0"}:
        return [f"schema_version_invalid:{v or 'missing'}"]
    return []


def gate_diagnostic_relations_fk(fm: dict, canon_slugs: set[str], catalog_slugs: set[str]) -> list[str]:
    """Validate diagnostic_relations[] FK + relation_to_part presence."""
    if fm.get("entity_type") != "gamme":
        return []
    relations = fm.get("diagnostic_relations")
    if relations is None:
        return []  # optional per ADR-033 §D6
    if not isinstance(relations, list):
        return ["diagnostic_relations_not_array"]
    reasons = []
    for i, rel in enumerate(relations):
        if not isinstance(rel, dict):
            reasons.append(f"diagnostic_relations[{i}]_not_object")
            continue
        if not rel.get("relation_to_part"):
            reasons.append("relation_to_part_missing")
        sym = rel.get("symptom_slug")
        if sym and sym not in canon_slugs:
            reasons.append(f"symptom_slug_unknown:{sym}")
        for src in rel.get("sources") or []:
            if src not in catalog_slugs:
                reasons.append(f"source_slug_unknown:{src}")
    return reasons


# ── Main ─────────────────────────────────────────────────────────────────────


def gather_files(args, wiki_path: Path) -> list[Path]:
    if args.all:
        roots = [wiki_path / "proposals", wiki_path / "wiki"]
        files: list[Path] = []
        for root in roots:
            if root.exists():
                files.extend(p for p in root.rglob("*.md") if not p.name.startswith("_"))
        return files
    return [Path(p).resolve() for p in args.files]


def process_file(path: Path, wiki_path: Path, canon_slugs: set[str], catalog_slugs: set[str]) -> tuple[bool, list[str]]:
    """Returns (passed, blocked_reasons)."""
    rel = str(path.relative_to(wiki_path)) if path.is_absolute() and wiki_path in path.parents else path.name
    text = path.read_text(encoding="utf-8")
    parsed = split_frontmatter(text)
    if parsed is None:
        return False, ["frontmatter_unparseable"]
    fm, _body = parsed

    reasons: list[str] = []
    reasons.extend(gate_path_anti_patterns(rel))
    reasons.extend(gate_legacy_symptoms_block(fm))
    reasons.extend(gate_schema_version(fm))
    # Only run FK strict validation if schema_version 2.0.0 (cohabitation)
    if str(fm.get("schema_version") or "") == "2.0.0":
        reasons.extend(gate_diagnostic_relations_fk(fm, canon_slugs, catalog_slugs))
    return (len(reasons) == 0), reasons


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="*", help="Files to validate (or --all)")
    ap.add_argument("--all", action="store_true", help="Scan all wiki/proposals/*.md and wiki/<entity_type>/*.md")
    ap.add_argument("--wiki-path", default=str(DEFAULT_WIKI_PATH), help=f"Path to automecanik-wiki repo (default: {DEFAULT_WIKI_PATH})")
    ap.add_argument("--json", action="store_true", help="Output JSON instead of human-readable")
    args = ap.parse_args()

    if not args.all and not args.files:
        ap.print_help()
        return 2

    wiki_path = Path(args.wiki_path).resolve()
    if not wiki_path.exists():
        sys.stderr.write(f"FATAL: wiki path {wiki_path} does not exist\n")
        return 2

    canon_slugs, canon_msg = load_canon_symptom_slugs(wiki_path)
    catalog_slugs = load_source_catalog(wiki_path)

    if not args.json:
        sys.stderr.write(f"[validate] wiki: {wiki_path}\n")
        sys.stderr.write(f"[validate] canon symptoms: {canon_msg}\n")
        sys.stderr.write(f"[validate] source-catalog: {len(catalog_slugs)} registered slugs\n")

    files = gather_files(args, wiki_path)
    if not files:
        sys.stderr.write("WARN: no files to validate\n")
        return 0

    results = []
    failed = 0
    for f in files:
        passed, reasons = process_file(f, wiki_path, canon_slugs, catalog_slugs)
        rel = str(f.relative_to(wiki_path)) if wiki_path in f.parents else str(f)
        results.append({"file": rel, "passed": passed, "blocked_reasons": reasons})
        if not passed:
            failed += 1
            if not args.json:
                print(f"FAIL {rel}: {', '.join(reasons)}")
        elif not args.json:
            print(f"PASS {rel}")

    if args.json:
        print(json.dumps({"summary": {"total": len(files), "passed": len(files) - failed, "failed": failed}, "results": results}, indent=2))
    else:
        sys.stderr.write(f"\n[validate] {len(files) - failed}/{len(files)} PASS, {failed} FAIL\n")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
