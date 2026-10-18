#!/usr/bin/env python3
"""validate-gamme-diagnostic-relations.py — ADR-033 §"Phase 2" CI validator (monorepo side).

Validates wiki gamme fiches against the ADR-033 v2.0.0 frontmatter contract :
  - schema_version 2.0.0 strict
  - NO entity_data.symptoms[] block (anti-pattern §D2 → blocked_reasons:[legacy_symptoms_block])
  - NO file under wiki/systemes/ (anti-pattern §D3 → forbidden_systemes_dir)
  - NO file matching wiki/diagnostic/<symptom>-*.md regex (anti-pattern §D3 → forbidden_per_symptom_file)
  - diagnostic_relations[].symptom_slug ∈ canon symptoms (FK strict)
  - diagnostic_relations[].system_slug ∈ canon systems (FK strict, P3)
  - diagnostic_relations[] composite : symptom_slug must belong to declared system_slug (P3)
  - diagnostic_relations[].sources[] ∈ _meta/source-catalog.yaml
  - relation_to_part required per entry (§D1 → relation_to_part_missing)
  - diagnostic_relations[].cause_slug ∈ canon causes, and the cause belongs to the declared
    system_slug (ADR-112 §Amendements ADR-033 → cause_slug_unknown / cause_system_mismatch).
    Same rule as the engine : a symptom's causes are read in its own system only
    (backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts,
    `.eq('system_id', symptom.system_id) // Guard: only same-system causes`), and a
    cross-system link makes it throw "Diagnostic cause coverage incomplete".
  - diagnostic.quick_checks[].cause_slug ∈ canon causes (ADR-112 D1)
  - safety_rules[].system_slug ∈ canon systems (ADR-112 D1)
  - diagnostic_not_applicable and a non-empty diagnostic_relations[] are mutually exclusive
    (ADR-113 §Amendements ADR-033 → diagnostic_not_applicable_with_relations ; same condition
    as the wiki gate gate_diagnostic_not_applicable, ADR-033 D5 = wiki CI + monorepo CI)

Causes come from `causes` in exports/diag-canon.json (canon version 1.1.0). An export without
`causes` (1.0.0, legacy array) cannot vouch for a cause : any declared cause_slug is then
blocked (canon_causes_missing), never accepted unchecked.

Complementary to the wiki repo's _scripts/quality-gates.py (which has 9 gates including
overclaim, source policy, maintenance advice). This monorepo-side validator is a
narrower contract enforcer focused on FK validation and the 3 anti-patterns figés §D3.
The source slugs, evidence and RAW anchors of quick_checks[] / safety_rules[] / citations[]
stay wiki-side (they depend on wiki data only) ; this validator adds only what depends on
the DB canon export.
The wiki repo CI runs the full 9 gates ; this monorepo CI runs the FK-strict subset
to catch regressions when monorepo changes (skill updates, content/ embed changes)
would invalidate wiki fiches.

**Plan humble-cuddling-scott P3** — canon source = exports/diag-canon.json (flat map).
Plus de FALLBACK_CANON_SYMPTOM_SLUGS hardcodé : si l'export est absent, fail-fast pour
forcer l'invariant cron-PR-D vivant (vérifié par wiki-readiness-check.py C3).

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
  - Plan humble-cuddling-scott §P3 (composite FK, drop hardcoded fallback)
  - canon : automecanik-wiki/_meta/schema/frontmatter.schema.json v2.0.0
  - source registry : automecanik-wiki/_meta/source-catalog.yaml
  - canon DB slugs : automecanik-wiki/exports/diag-canon.json (P3 cible)
                     automecanik-wiki/exports/diag-canon-slugs.json (legacy, transition)
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

# Pattern interdit ADR-033 §D3 : wiki/diagnostic/<symptom>-*.md
FORBIDDEN_PER_SYMPTOM_FILE_PATTERN = re.compile(
    r"^wiki/diagnostic/(bruit|grincement|vibration|voyant|fumee|surchauffe|fuite|usure|symptome|claquement|sifflement)-.*\.md$"
)

# blocked_reasons enum (subset des 9 quality-gates wiki, focused FK + anti-patterns §D3 + composite P3)
BLOCKED_REASONS = (
    "schema_version_invalid",
    "legacy_symptoms_block",
    "forbidden_systemes_dir",
    "forbidden_per_symptom_file",
    "relation_to_part_missing",
    "symptom_slug_unknown",
    "system_slug_unknown",         # P3
    "symptom_system_mismatch",     # P3 — composite FK violation
    "source_slug_unknown",
    "canon_export_missing",        # P3 — fail-fast si cron PR-D mort
    "cause_slug_unknown",          # ADR-112 — cause absente du canon (__diag_cause actives)
    "cause_system_mismatch",       # ADR-112 — cause d'un autre système que system_slug
    "canon_causes_missing",        # ADR-112 — export sans `causes` : cause_slug invérifiable
    "diagnostic_not_applicable_with_relations",  # ADR-113
)


# ── Canon loaders ────────────────────────────────────────────────────────────


def load_canon(wiki_path: Path) -> tuple[set[str], set[str], dict[str, str], dict[str, str] | None, str]:
    """Plan P3 — charge le flat map exports/diag-canon.json.

    Returns:
        (symptom_slugs, system_slugs, symptom_to_system, cause_to_system, source_msg)

    cause_to_system vaut None quand l'export ne porte pas `causes` (version 1.0.0 ou
    format legacy) : les cause_slug déclarés sont alors bloqués (canon_causes_missing).

    Fallback transition : si diag-canon.json absent, lit l'ancien diag-canon-slugs.json
    (array format) pendant la cohabitation. Si AUCUN export n'existe, fail-fast
    (force l'invariant cron PR-D vivant — wiki-readiness-check.py C3).
    """
    flat_path = wiki_path / "exports" / "diag-canon.json"
    if flat_path.exists():
        try:
            data = json.loads(flat_path.read_text(encoding="utf-8"))
            symptoms_map = data.get("symptoms") or {}
            systems_set = set(data.get("systems") or [])
            if not isinstance(symptoms_map, dict) or not isinstance(systems_set, set):
                raise ValueError("diag-canon.json malformed: symptoms must be object, systems must be array")
            causes_map = data.get("causes")
            if causes_map is not None and not isinstance(causes_map, dict):
                raise ValueError("diag-canon.json malformed: causes must be object")
            cause_to_system = dict(causes_map) if causes_map is not None else None
            symptom_slugs = set(symptoms_map.keys())
            causes_msg = f"{len(cause_to_system)} causes" if cause_to_system is not None else "no causes"
            return (
                symptom_slugs,
                systems_set,
                dict(symptoms_map),
                cause_to_system,
                f"loaded flat map from {flat_path} ({len(symptom_slugs)} symptoms, {len(systems_set)} systems, {causes_msg})",
            )
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            sys.stderr.write(f"FATAL: cannot parse {flat_path}: {e}\n")
            sys.exit(2)

    # Transition fallback : legacy array format (diag-canon-slugs.json).
    legacy_path = wiki_path / "exports" / "diag-canon-slugs.json"
    if legacy_path.exists():
        try:
            data = json.loads(legacy_path.read_text(encoding="utf-8"))
            if not isinstance(data, list):
                raise ValueError("diag-canon-slugs.json must be a JSON array")
            symptom_slugs: set[str] = set()
            systems_set: set[str] = set()
            mapping: dict[str, str] = {}
            for entry in data:
                if not isinstance(entry, dict):
                    continue
                sym = entry.get("symptom_slug")
                sys_slug = entry.get("system_slug")
                if sym:
                    symptom_slugs.add(sym)
                if sys_slug:
                    systems_set.add(sys_slug)
                if sym and sys_slug:
                    mapping[sym] = sys_slug
            return (
                symptom_slugs,
                systems_set,
                mapping,
                None,
                f"loaded legacy array from {legacy_path} ({len(symptom_slugs)} symptoms, {len(systems_set)} systems) — transition mode, prefer diag-canon.json",
            )
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            sys.stderr.write(f"FATAL: cannot parse {legacy_path}: {e}\n")
            sys.exit(2)

    # P3 — fail-fast : pas de fallback hardcoded. Force PR-D cron vivant.
    sys.stderr.write(
        f"FATAL: canon export absent ({flat_path} et {legacy_path}). "
        "Le cron PR-D ADR-033 doit être vivant (wiki-readiness-check.py C3). "
        "Pas de fallback hardcoded — c'était précisément l'anti-pattern à éliminer (Plan §P3).\n"
    )
    sys.exit(2)


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


def check_cause_slug(
    cause: object,
    sys_declared: object,
    canon_systems: set[str],
    cause_to_system: dict[str, str] | None,
) -> list[str]:
    """ADR-112 §Amendements (ADR-033) — cause_slug FK against the exported __diag_cause canon.

    The system check runs only when the declared system is itself canon (otherwise
    system_slug_unknown is already reported — same no-double-noise rule as the symptom).
    """
    if cause_to_system is None:
        return [f"canon_causes_missing:{cause}"]
    if not isinstance(cause, str) or cause not in cause_to_system:
        return [f"cause_slug_unknown:{cause}"]
    sys_canon = cause_to_system[cause]
    if isinstance(sys_declared, str) and sys_declared in canon_systems and sys_canon != sys_declared:
        return [f"cause_system_mismatch:{cause}:{sys_declared}:{sys_canon}"]
    return []


def gate_diagnostic_relations_fk(
    fm: dict,
    canon_symptoms: set[str],
    canon_systems: set[str],
    symptom_to_system: dict[str, str],
    cause_to_system: dict[str, str] | None,
    catalog_slugs: set[str],
) -> list[str]:
    """Validate diagnostic_relations[] FK + composite + relation_to_part presence.

    P3 — composite FK : si symptom_slug est canon ET system_slug est canon, vérifie
    que symptom appartient au system déclaré. Émet symptom_system_mismatch sinon.
    """
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
        sys_declared = rel.get("system_slug")
        if sym and sym not in canon_symptoms:
            reasons.append(f"symptom_slug_unknown:{sym}")
        if sys_declared and sys_declared not in canon_systems:
            reasons.append(f"system_slug_unknown:{sys_declared}")
        # Composite FK : seulement si les 2 slugs sont individuellement canon.
        # (Si l'un des deux est unknown, l'erreur est déjà signalée — pas de double bruit.)
        if sym and sys_declared and sym in canon_symptoms and sys_declared in canon_systems:
            sys_canon = symptom_to_system.get(sym)
            if sys_canon and sys_canon != sys_declared:
                reasons.append(f"symptom_system_mismatch:{sym}:{sys_declared}:{sys_canon}")
        if "cause_slug" in rel:
            reasons.extend(check_cause_slug(rel["cause_slug"], sys_declared, canon_systems, cause_to_system))
        for src in rel.get("sources") or []:
            if src not in catalog_slugs:
                reasons.append(f"source_slug_unknown:{src}")
    return reasons


def gate_quick_checks_fk(fm: dict, canon_systems: set[str], cause_to_system: dict[str, str] | None) -> list[str]:
    """ADR-112 D1 — diagnostic.quick_checks[].cause_slug ∈ canon causes.

    The link to a cause_slug of the same fiche (quick_check_cause_unlinked) is checked
    wiki-side ; this gate checks the DB canon FK only."""
    diagnostic = fm.get("diagnostic")
    if not isinstance(diagnostic, dict) or "quick_checks" not in diagnostic:
        return []
    checks = diagnostic["quick_checks"]
    if not isinstance(checks, list):
        return ["quick_checks_not_array"]
    reasons = []
    for i, qc in enumerate(checks):
        if not isinstance(qc, dict):
            reasons.append(f"quick_checks[{i}]_not_object")
            continue
        if "cause_slug" in qc:
            reasons.extend(check_cause_slug(qc["cause_slug"], None, canon_systems, cause_to_system))
    return reasons


def gate_safety_rules_fk(fm: dict, canon_systems: set[str]) -> list[str]:
    """ADR-112 D1 — safety_rules[].system_slug ∈ canon systems.

    The fixed path and rule_slug uniqueness are checked wiki-side."""
    rules = fm.get("safety_rules")
    if rules is None:
        return []
    if not isinstance(rules, list):
        return ["safety_rules_not_array"]
    reasons = []
    for i, rule in enumerate(rules):
        if not isinstance(rule, dict):
            reasons.append(f"safety_rules[{i}]_not_object")
            continue
        if "system_slug" in rule:
            sys_slug = rule["system_slug"]
            if not isinstance(sys_slug, str) or sys_slug not in canon_systems:
                reasons.append(f"system_slug_unknown:{sys_slug}")
    return reasons


def gate_diagnostic_not_applicable(fm: dict) -> list[str]:
    """ADR-113 — « aucune relation » and diagnostic_relations[] are mutually exclusive."""
    if "diagnostic_not_applicable" in fm and (fm.get("diagnostic_relations") or []):
        return ["diagnostic_not_applicable_with_relations"]
    return []


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


def process_file(
    path: Path,
    wiki_path: Path,
    canon_symptoms: set[str],
    canon_systems: set[str],
    symptom_to_system: dict[str, str],
    cause_to_system: dict[str, str] | None,
    catalog_slugs: set[str],
) -> tuple[bool, list[str]]:
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
        reasons.extend(
            gate_diagnostic_relations_fk(fm, canon_symptoms, canon_systems, symptom_to_system, cause_to_system, catalog_slugs)
        )
    # ADR-112 / ADR-113 blocks : new fields, no 1.0.0 cohabitation to protect → checked
    # whatever the schema_version (fail-closed).
    reasons.extend(gate_quick_checks_fk(fm, canon_systems, cause_to_system))
    reasons.extend(gate_safety_rules_fk(fm, canon_systems))
    reasons.extend(gate_diagnostic_not_applicable(fm))
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

    canon_symptoms, canon_systems, symptom_to_system, cause_to_system, canon_msg = load_canon(wiki_path)
    catalog_slugs = load_source_catalog(wiki_path)

    if not args.json:
        sys.stderr.write(f"[validate] wiki: {wiki_path}\n")
        sys.stderr.write(f"[validate] canon: {canon_msg}\n")
        sys.stderr.write(f"[validate] source-catalog: {len(catalog_slugs)} registered slugs\n")

    files = gather_files(args, wiki_path)
    if not files:
        sys.stderr.write("WARN: no files to validate\n")
        return 0

    results = []
    failed = 0
    for f in files:
        passed, reasons = process_file(
            f, wiki_path, canon_symptoms, canon_systems, symptom_to_system, cause_to_system, catalog_slugs
        )
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
