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

  C3 — diag-canon export à jour :
       - automecanik-wiki/exports/diag-canon-slugs.json + diag-canon.json exist
       - ≥ 5 distinct slugs (validity, read from diag-canon-slugs.json)
       - export cron is ALIVE : the diag-canon-slugs-export.yml workflow had a
         successful run < 7 days ago. Liveness is measured from THIS repo's
         GitHub Actions run-history, NOT from commit recency: the export now only
         commits when the symptom→system map actually changes (no more nightly
         `generated_at`-only churn), so commit age is no longer a liveness signal.
         Local mode (no GITHUB_TOKEN) reports liveness as UNVERIFIED and asserts
         validity only — the authoritative liveness check runs in CI.

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
import time
import urllib.error
import urllib.request
from pathlib import Path


# ── Configuration ────────────────────────────────────────────────────────────

DEFAULT_WIKI_PATH = Path(os.environ.get("AUTOMECANIK_WIKI_PATH", "/opt/automecanik/automecanik-wiki"))
DEFAULT_RAG_PATH = Path(os.environ.get("AUTOMECANIK_RAG_PATH", "/opt/automecanik/rag"))
DEFAULT_MONOREPO_PATH = Path(os.environ.get("AUTOMECANIK_MONOREPO_PATH", "/opt/automecanik/app"))

EXPORT_FRESHNESS_DAYS = 7  # C3 : last SUCCESSFUL export run < 7 days = "alive"
# C3 liveness is measured from this workflow's GitHub Actions run-history (the
# authoritative "did the scheduled export run" signal), decoupled from content
# commit recency (the export is now idempotent on `generated_at`).
EXPORT_WORKFLOW_FILE = "diag-canon-slugs-export.yml"
DEFAULT_GITHUB_REPO = "ak125/nestjs-remix-monorepo"


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


def export_workflow_liveness(
    repo: str | None = None,
    token: str | None = None,
    now: datetime.datetime | None = None,
    attempts: int = 3,
) -> tuple[bool | None, str]:
    """Liveness of the nightly diag-canon export, read from THIS repo's GitHub
    Actions run-history — the authoritative "did the SCHEDULED job run" signal,
    decoupled from content-commit recency.

    Only `event=schedule` runs count: a manual `workflow_dispatch` must not mask a
    dead nightly cron (a one-off manual run would otherwise read as "alive" for up
    to EXPORT_FRESHNESS_DAYS). Transient API errors are retried (bounded, with
    backoff) before we fail-closed, so a single blip does not spuriously red a PR.

    Returns (status, detail):
      (True,  detail) — a successful SCHEDULED run happened < EXPORT_FRESHNESS_DAYS ago.
      (False, detail) — no recent successful scheduled run, OR the API query kept
                        failing (after retries) while a token WAS present
                        (fail-closed: never mask a dead cron).
      (None,  detail) — no token (local mode). Caller MUST treat liveness as
                        UNVERIFIED and say so explicitly (authoritative = CI).
    """
    token = token or os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        return None, (
            "no GITHUB_TOKEN/GH_TOKEN — CI run-history not queryable "
            "(run in CI for the authoritative liveness check)"
        )
    repo = repo or os.environ.get("GITHUB_REPOSITORY") or DEFAULT_GITHUB_REPO
    now = now or datetime.datetime.now(tz=datetime.timezone.utc)
    url = (
        f"https://api.github.com/repos/{repo}/actions/workflows/"
        f"{EXPORT_WORKFLOW_FILE}/runs?status=success&event=schedule&per_page=1"
    )
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "wiki-readiness-check",
        },
    )
    n = max(1, attempts)
    last_err = ""
    payload = None
    for attempt in range(1, n + 1):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            last_err = f"{type(e).__name__}: {e}"
            if attempt < n:
                time.sleep(min(2 ** (attempt - 1), 4))  # 1s, 2s, 4s … capped
    if payload is None:
        # Token present but the API kept erroring: fail-closed rather than
        # silently pass a liveness gate (CLAUDE.md — no silent fallback).
        return False, f"GitHub API query failed after {n} attempts ({last_err}) — fail-closed"

    runs = payload.get("workflow_runs") or []
    if not runs:
        return False, (
            f"no successful scheduled run of {EXPORT_WORKFLOW_FILE} found via API "
            "(nightly cron may be dead/disabled)"
        )
    created = runs[0].get("created_at") or runs[0].get("run_started_at")
    try:
        started = datetime.datetime.fromisoformat(str(created).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return False, f"API run record has unparseable timestamp: {created!r}"
    age_days = (now - started).total_seconds() / 86_400.0
    if age_days >= EXPORT_FRESHNESS_DAYS:
        return False, (
            f"last successful scheduled export run was {age_days:.1f}d ago "
            f"(expected < {EXPORT_FRESHNESS_DAYS}d) — cron may be dead"
        )
    return True, f"last successful scheduled export run {age_days:.1f}d ago"


def c3_export_diag_canon_slugs_fresh(
    wiki_path: Path, liveness_fn=export_workflow_liveness
) -> tuple[bool, str]:
    """C3 — diag-canon export is alive: ≥ 5 slugs present AND the export cron ran
    successfully < EXPORT_FRESHNESS_DAYS ago.

    Content validity (≥ 5 distinct slugs) is read from the legacy array
    `diag-canon-slugs.json`. Liveness is measured from the export workflow's
    GitHub Actions run-history (see `export_workflow_liveness`), NOT from commit
    recency: the export is now idempotent on `generated_at` (it only commits when
    the symptom→system map changes), so commit age no longer proves the cron ran.
    In local mode (no GITHUB_TOKEN) liveness cannot be queried, so C3 asserts
    validity only and labels liveness UNVERIFIED — a documented, observable skip
    (CLAUDE.md no-silent-fallback exception); the authoritative check runs in CI.
    """
    slugs_file = wiki_path / "exports" / "diag-canon-slugs.json"
    fresh_file = wiki_path / "exports" / "diag-canon.json"
    for f in (slugs_file, fresh_file):
        if not f.exists():
            return False, f"FAIL: {f} missing (PR-D ADR-033 cron not yet wired)"

    try:
        data = json.loads(slugs_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return False, f"FAIL: {slugs_file} not valid JSON: {e}"

    if not isinstance(data, list):
        return False, "FAIL: export should be a JSON array"
    slugs = {entry.get("symptom_slug") for entry in data if isinstance(entry, dict)}
    if len(slugs) < 5:
        return False, f"FAIL: only {len(slugs)} distinct slugs (expected ≥ 5)"

    # Liveness via CI run-history (decoupled from content commits).
    live_ok, detail = liveness_fn()
    if live_ok is None:
        # Local mode: cannot verify the CI cron. Assert validity only and label
        # liveness explicitly (observable, not a silent pass).
        sys.stderr.write(f"[C3] liveness UNVERIFIED: {detail}\n")
        return True, (
            f"{len(slugs)} slugs ✓ | liveness UNVERIFIED locally ({detail}) — "
            f"authoritative check = CI run-history"
        )
    if not live_ok:
        return False, f"FAIL: export liveness — {detail}"
    return True, f"{len(slugs)} slugs; export workflow {detail} ✓"


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
