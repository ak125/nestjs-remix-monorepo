#!/usr/bin/env python3
"""wiki-readiness-check.py — ADR-033 plan rev 6 §9 / plan rev 3 PR-F.

Aggregates the 6 measurable criteria C1-C6 that gate Partie 3 (consumers
DB / RAG / SEO / blog / diagnostic / chatbot). Returns READY only when
all 6 are simultaneously PASS — guarantees no premature consumer
branchement (garde-fou utilisateur #12 : pas de bricolage hybride
transitoire, big-bang quand la chaîne est prête).

Criteria (each is independent, returns PASS/FAIL with evidence) :

  C1 — schema v2.0.0 propagated :
       - automecanik-wiki/_meta/templates/gamme.md mentions schema_version: 2.0.0
       - automecanik-rag/docs/GAMME_PAGE_CONTRACT.md mentions GammeContentContract.v2.0
         (or v2.0.0)

  C2 — validateur CI bloquant actif :
       - .github/workflows/wiki-validate.yml exists in monorepo
       - workflow includes blocking validator step (no continue-on-error)

  C3 — exports/diag-canon-slugs.json à jour :
       - automecanik-wiki/exports/diag-canon-slugs.json exists
       - last commit on this file < 7 days old (proof cron is alive)
       - jq shows ≥ 5 distinct slugs (DB has at least the 5 brake_*)

  C4 — fiches gamme migrées :
       - 0 hits for `entity_data.symptoms:` or `^symptoms:` in
         automecanik-wiki/wiki/gammes/*.md
       - if wiki/gammes/ is empty, C4 is N/A (returns PASS — no legacy
         to migrate ; activates in real terms when sync-from-rag arrives
         in Partie 3)

  C5 — quality gates green sur tout wiki/gammes/ :
       - python3 _scripts/quality-gates.py --all (côté wiki repo) exit 0
       - if running from monorepo, shells out to wiki repo's script

  C6 — skill wiki-proposal-writer opérationnel :
       - workspaces/wiki/.claude/skills/wiki-proposal-writer/SKILL.md exists
       - frontmatter `name` = wiki-proposal-writer
       - file mentions ADR-033 v2.0.0 + diagnostic_relations[]

Output : READY ssi C1∧C2∧C3∧C4∧C5∧C6, sinon NOT_READY with detailed
gap report.

Usage :
  python3 scripts/wiki/wiki-readiness-check.py
  python3 scripts/wiki/wiki-readiness-check.py --json
  python3 scripts/wiki/wiki-readiness-check.py --wiki-path /path/to/wiki

Exit :
  0 — READY (all 6 PASS)
  1 — NOT_READY (≥ 1 FAIL)
  2 — script error (missing critical path)

Refs :
  - ADR-033 plan rev 6 §9 — 6 criterion C1-C6
  - plan rev 3 PR-F : /home/deploy/.claude/plans/mvp-et-raw-et-wobbly-brooks.md
  - garde-fou utilisateur #12 (handoff §8) : pas de bricolage hybride transitoire
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import subprocess
import sys
from pathlib import Path


# ── Configuration ────────────────────────────────────────────────────────────

DEFAULT_WIKI_PATH = Path(os.environ.get("AUTOMECANIK_WIKI_PATH", "/opt/automecanik/automecanik-wiki"))
DEFAULT_RAG_PATH = Path(os.environ.get("AUTOMECANIK_RAG_PATH", "/opt/automecanik/rag"))
DEFAULT_MONOREPO_PATH = Path(os.environ.get("AUTOMECANIK_MONOREPO_PATH", "/opt/automecanik/app"))

EXPORT_FRESHNESS_DAYS = 7  # C3 : commit < 7 days = "alive"


# ── Criteria ─────────────────────────────────────────────────────────────────


def c1_schema_v2_propagated(wiki_path: Path, rag_path: Path) -> tuple[bool, str]:
    """C1 — schema v2.0.0 propagated to canon templates and RAG contract."""
    template = wiki_path / "_meta" / "templates" / "gamme.md"
    contract = rag_path / "docs" / "GAMME_PAGE_CONTRACT.md"
    evidence = []
    ok = True

    if not template.exists():
        return False, f"FAIL: missing {template}"
    if "schema_version: 2.0.0" not in template.read_text(encoding="utf-8"):
        ok = False
        evidence.append(f"{template} does not mention schema_version: 2.0.0")
    else:
        evidence.append(f"{template.relative_to(wiki_path)}: schema_version: 2.0.0 ✓")

    if not contract.exists():
        return False, f"FAIL: missing {contract}"
    contract_text = contract.read_text(encoding="utf-8")
    if "GammeContentContract.v2.0" not in contract_text and "GammeContentContract.v2" not in contract_text:
        ok = False
        evidence.append(f"{contract} does not mention GammeContentContract.v2 or v2.0")
    else:
        evidence.append(f"{contract.relative_to(rag_path)}: v2.0 mentioned ✓")

    return ok, " | ".join(evidence)


def c2_validator_ci_active(monorepo_path: Path) -> tuple[bool, str]:
    """C2 — wiki-validate.yml workflow present + blocking."""
    workflow = monorepo_path / ".github" / "workflows" / "wiki-validate.yml"
    if not workflow.exists():
        return False, f"FAIL: {workflow} missing"
    text = workflow.read_text(encoding="utf-8")
    if "validate-gamme-diagnostic-relations" not in text:
        return False, "FAIL: workflow exists but does not invoke validate-gamme-diagnostic-relations"
    if "continue-on-error: true" in text:
        return False, "FAIL: workflow uses continue-on-error (non-blocking)"
    return True, f"{workflow.relative_to(monorepo_path)} present and blocking ✓"


def c3_export_diag_canon_slugs_fresh(wiki_path: Path) -> tuple[bool, str]:
    """C3 — exports/diag-canon-slugs.json exists, commit < 7 days, ≥ 5 slugs."""
    export_file = wiki_path / "exports" / "diag-canon-slugs.json"
    if not export_file.exists():
        return False, f"FAIL: {export_file} missing (PR-D ADR-033 cron not yet wired)"

    try:
        data = json.loads(export_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return False, f"FAIL: {export_file} not valid JSON: {e}"

    if not isinstance(data, list):
        return False, "FAIL: export should be a JSON array"
    slugs = {entry.get("symptom_slug") for entry in data if isinstance(entry, dict)}
    if len(slugs) < 5:
        return False, f"FAIL: only {len(slugs)} distinct slugs (expected ≥ 5)"

    # Check git log freshness — last commit on this file
    try:
        result = subprocess.run(
            ["git", "-C", str(wiki_path), "log", "-1", "--format=%ct", "--", "exports/diag-canon-slugs.json"],
            capture_output=True, text=True, check=True
        )
        ts = int(result.stdout.strip())
        last_commit = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc)
        age = datetime.datetime.now(tz=datetime.timezone.utc) - last_commit
        if age.days >= EXPORT_FRESHNESS_DAYS:
            return False, f"FAIL: last commit on export was {age.days}d ago (expected < {EXPORT_FRESHNESS_DAYS}d)"
        return True, f"{export_file.relative_to(wiki_path)}: {len(slugs)} slugs, last commit {age.days}d ago ✓"
    except (subprocess.CalledProcessError, ValueError) as e:
        return False, f"FAIL: cannot read git log: {e}"


def c4_fiches_migrated(wiki_path: Path) -> tuple[bool, str]:
    """C4 — no entity_data.symptoms[] or top-level symptoms[] in wiki/gammes/."""
    gammes_dir = wiki_path / "wiki" / "gammes"
    if not gammes_dir.exists():
        return True, "wiki/gammes/ does not exist yet (N/A — Partie 3 sync-from-rag pending) ✓"

    md_files = list(gammes_dir.glob("*.md"))
    if not md_files:
        return True, "wiki/gammes/ is empty (N/A — no legacy to migrate) ✓"

    legacy_pattern = re.compile(r"^([\s]*)symptoms:|entity_data:\s*\n[\s\S]*?[\s]+symptoms:", re.MULTILINE)
    legacy_hits = []
    for f in md_files:
        text = f.read_text(encoding="utf-8")
        # Simple heuristic : look for "symptoms:" inside frontmatter (between --- markers)
        if text.startswith("---\n"):
            end = text.find("\n---\n", 4)
            if end > 0:
                fm = text[4:end]
                if re.search(r"^[\s]*symptoms:", fm, re.MULTILINE) and "diagnostic_relations:" not in fm:
                    legacy_hits.append(f.name)
                elif re.search(r"^[\s]+symptoms:", fm, re.MULTILINE) and re.search(r"^entity_data:", fm, re.MULTILINE):
                    # Indented "symptoms:" inside entity_data: block
                    legacy_hits.append(f.name)

    if legacy_hits:
        return False, f"FAIL: {len(legacy_hits)} fiches still legacy (e.g. {legacy_hits[:3]})"
    return True, f"all {len(md_files)} wiki/gammes/ fiches migrated ✓"


def c5_quality_gates_green(wiki_path: Path) -> tuple[bool, str]:
    """C5 — wiki repo's quality-gates.py --all exit 0."""
    script = wiki_path / "_scripts" / "quality-gates.py"
    if not script.exists():
        return False, f"FAIL: {script} missing"

    try:
        result = subprocess.run(
            ["python3", str(script), "--all"],
            cwd=str(wiki_path),
            capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            tail = result.stdout.strip().split("\n")[-1] if result.stdout else ""
            return False, f"FAIL: quality-gates --all exit {result.returncode} ({tail})"
        # Extract summary line e.g. "18/18 PASS — 0 FAIL — 1 WARN"
        for line in result.stdout.split("\n"):
            if "PASS" in line and "FAIL" in line:
                return True, f"quality-gates: {line.strip()} ✓"
        return True, "quality-gates exit 0 (no summary line found) ✓"
    except subprocess.TimeoutExpired:
        return False, "FAIL: quality-gates timeout > 60s"


def c6_skill_proposal_writer_present(monorepo_path: Path) -> tuple[bool, str]:
    """C6 — workspaces/wiki/.claude/skills/wiki-proposal-writer/SKILL.md operational."""
    skill = monorepo_path / "workspaces" / "wiki" / ".claude" / "skills" / "wiki-proposal-writer" / "SKILL.md"
    if not skill.exists():
        return False, f"FAIL: {skill} missing"
    text = skill.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return False, "FAIL: SKILL.md missing YAML frontmatter"
    end = text.find("\n---\n", 4)
    if end < 0:
        return False, "FAIL: SKILL.md frontmatter unterminated"
    fm = text[4:end]
    if "name: wiki-proposal-writer" not in fm:
        return False, "FAIL: SKILL.md frontmatter name mismatch"
    body = text[end + 5 :]
    if "diagnostic_relations" not in body:
        return False, "FAIL: SKILL.md does not mention diagnostic_relations[]"
    if "ADR-033" not in body:
        return False, "FAIL: SKILL.md does not reference ADR-033"
    return True, f"{skill.relative_to(monorepo_path)}: name + diagnostic_relations + ADR-033 ✓"


# ── Main ─────────────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--wiki-path", default=str(DEFAULT_WIKI_PATH))
    ap.add_argument("--rag-path", default=str(DEFAULT_RAG_PATH))
    ap.add_argument("--monorepo-path", default=str(DEFAULT_MONOREPO_PATH))
    ap.add_argument("--json", action="store_true", help="Output JSON instead of human-readable")
    args = ap.parse_args()

    wiki_path = Path(args.wiki_path).resolve()
    rag_path = Path(args.rag_path).resolve()
    monorepo_path = Path(args.monorepo_path).resolve()

    for p, name in [(wiki_path, "wiki"), (rag_path, "rag"), (monorepo_path, "monorepo")]:
        if not p.exists():
            sys.stderr.write(f"FATAL: {name} path {p} does not exist\n")
            return 2

    criteria = [
        ("C1", "schema v2.0.0 propagated", lambda: c1_schema_v2_propagated(wiki_path, rag_path)),
        ("C2", "validateur CI bloquant actif", lambda: c2_validator_ci_active(monorepo_path)),
        ("C3", "exports/diag-canon-slugs.json fresh", lambda: c3_export_diag_canon_slugs_fresh(wiki_path)),
        ("C4", "fiches gamme migrées", lambda: c4_fiches_migrated(wiki_path)),
        ("C5", "quality gates green", lambda: c5_quality_gates_green(wiki_path)),
        ("C6", "skill wiki-proposal-writer operational", lambda: c6_skill_proposal_writer_present(monorepo_path)),
    ]

    results = []
    all_pass = True
    for code, name, check in criteria:
        ok, evidence = check()
        results.append({"code": code, "name": name, "passed": ok, "evidence": evidence})
        if not ok:
            all_pass = False

    verdict = "READY" if all_pass else "NOT_READY"

    if args.json:
        print(json.dumps({"verdict": verdict, "criteria": results}, indent=2))
    else:
        print(f"\n=== Wiki Readiness Check (ADR-033 plan rev 6 §9) ===\n")
        for r in results:
            status = "✓ PASS" if r["passed"] else "✗ FAIL"
            print(f"{r['code']} ({r['name']}): {status}")
            print(f"     {r['evidence']}\n")
        print(f"=== Verdict: {verdict} ===")
        if not all_pass:
            print("\nGap analysis : address the FAIL criteria above before unlocking Partie 3 consumers.")
            print("Big-bang quand la chaîne est prête (garde-fou utilisateur #12).")

    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
