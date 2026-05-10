#!/usr/bin/env python3
"""check-prompt-registry-drift.py - Validate paths cited in prompt-registry.md exist on filesystem.

Implemente le critere C2 d'ADR-048 sprint 2 P1 (prompt-registry.md
enforcement) en repondant **exactement** a la regle de maintenance §3
du canon : "Les paths doivent pointer vers des fichiers existants
(verifier avec `ls`)".

Approche path-validation (pas Zod schema sur la structure markdown) :
le drift le plus dangereux dans ce registre n'est PAS la structure du
fichier (markdown stable hand-written) -- c'est un agent renomme/
supprime sans mise a jour du registre. Le canon §3 demande exactement
cette verification ; on l'execute mecaniquement.

Le script :
  1. Parse `.spec/00-canon/prompt-registry.md`
  2. Extrait les paths backtick-quotees qui ressemblent a des fichiers
     reels (.md/.ts/.json/.yaml dans .claude/ ou backend/ ou frontend/
     ou packages/)
  3. Skip explicitement : paths absolus (/opt/, /tmp/), paths
     contenant `{slug}`/`{brand}` (templates de routes), wildcards
     (`__seo_r8_*` = DB tables, pas filesystem), paths root-level
     non-canon (CLAUDE.md, package.json)
  4. Pour chaque path retenu, verifie `(REPO_ROOT / path).exists()`
  5. Flag les paths morts comme `error` (drift critique : registry
     casse la regle §3)

Mode warn-only initial (coherent strategie escalade ADR-048 J+30) :
les findings `error` sont visibles via `::error::` annotations CI mais
n'echouent pas la PR. Promo `--strict` apres 30j d'observation si le
signal est clair.

Usage:
  python3 scripts/spec-canon/check-prompt-registry-drift.py [--json] [--strict]

Reference :
  - .spec/00-canon/prompt-registry.md §"Regle de maintenance" l.221-227
  - ADR-048 §Implementation Sprint 2 P1
  - Pattern coherent avec scripts/spec-canon/check-repo-map-drift.py
    (PR #358 monorepo + REG-002 PR #201 vault)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

CHECK_NAME = "prompt-registry-drift"

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PROMPT_REGISTRY_PATH = REPO_ROOT / ".spec" / "00-canon" / "prompt-registry.md"

# Path roots qu'on verifie (relatifs au repo). Tout autre path est skip.
TRACKED_PREFIXES = (".claude/", "backend/", "frontend/", "packages/")

# Path extensions qu'on accepte comme "fichier reel verifiable".
TRACKED_EXTENSIONS = (".md", ".ts", ".tsx", ".json", ".yaml", ".yml", ".cjs", ".mjs")


def _is_template_or_dynamic(path: str) -> bool:
    """Detecte les paths avec template variables, wildcards, ou notations canon
    `...` (signifiant "quelque part dans...") qu'on ne peut pas verifier."""
    if "..." in path:
        return True
    return any(c in path for c in ("{", "}", "*", "$"))


def _is_tracked(path: str) -> bool:
    """Filtre : path commence par un prefix suivi ET termine par une extension suivie."""
    if _is_template_or_dynamic(path):
        return False
    if not path.startswith(TRACKED_PREFIXES):
        return False
    if not path.endswith(TRACKED_EXTENSIONS):
        return False
    return True


def extract_paths_from_markdown(text: str) -> set[str]:
    """Extract backtick-quoted paths from markdown content.

    Pattern : `<path>` avec backticks. On garde uniquement ceux qui
    matchent _is_tracked (filtre filesystem-checkable).
    """
    paths: set[str] = set()
    # Match backtick-quoted strings (1 backtick, pas triple-backtick code blocks)
    for m in re.finditer(r"`([^`\n]+)`", text):
        candidate = m.group(1).strip()
        # Multi-paths possibles via virgule (ex. "page-contract-r4.schema.ts, page-contract-r4-media.schema.ts")
        for sub in candidate.split(","):
            sub = sub.strip()
            if _is_tracked(sub):
                paths.add(sub)
    return paths


def check_paths_exist(paths: set[str]) -> tuple[list[str], list[str]]:
    """Returns (alive, dead) lists. Alive = file exists, dead = missing."""
    alive: list[str] = []
    dead: list[str] = []
    for path in sorted(paths):
        full = REPO_ROOT / path
        if full.exists():
            alive.append(path)
        else:
            dead.append(path)
    return alive, dead


def main(argv: list[str]) -> int:
    args = list(argv[1:])
    emit_json = "--json" in args
    strict = "--strict" in args

    findings: list[dict] = []
    paths: set[str] = set()
    alive: list[str] = []
    dead: list[str] = []

    if not PROMPT_REGISTRY_PATH.exists():
        findings.append({
            "severity": "error",
            "file": str(PROMPT_REGISTRY_PATH.relative_to(REPO_ROOT)),
            "rule": f"{CHECK_NAME}.prompt-registry-missing",
            "message": f"prompt-registry.md introuvable a {PROMPT_REGISTRY_PATH}. Le check ne peut pas s'executer.",
        })
    else:
        try:
            text = PROMPT_REGISTRY_PATH.read_text(encoding="utf-8")
        except OSError as e:
            findings.append({
                "severity": "error",
                "file": str(PROMPT_REGISTRY_PATH.relative_to(REPO_ROOT)),
                "rule": f"{CHECK_NAME}.prompt-registry-unreadable",
                "message": f"Lecture impossible : {e}",
            })
        else:
            paths = extract_paths_from_markdown(text)
            if not paths:
                findings.append({
                    "severity": "error",
                    "file": str(PROMPT_REGISTRY_PATH.relative_to(REPO_ROOT)),
                    "rule": f"{CHECK_NAME}.no-paths-found",
                    "message": (
                        "Aucun path backtick-quote extrait de prompt-registry.md. "
                        "Le format a change ou le fichier est vide -- detector casse."
                    ),
                })
            else:
                alive, dead = check_paths_exist(paths)
                for path in dead:
                    findings.append({
                        "severity": "error",
                        "file": str(PROMPT_REGISTRY_PATH.relative_to(REPO_ROOT)),
                        "rule": f"{CHECK_NAME}.dead-path",
                        "path": path,
                        "message": (
                            f"Path cite dans prompt-registry.md introuvable sur filesystem : "
                            f"`{path}`. Viole la regle de maintenance §3 du canon "
                            f"(\"Les paths doivent pointer vers des fichiers existants\")."
                        ),
                    })

    if strict:
        for f in findings:
            if f["severity"] == "warning":
                f["severity"] = "error"

    summary = {"error": 0, "warning": 0, "info": 0}
    for f in findings:
        summary[f["severity"]] = summary.get(f["severity"], 0) + 1

    if emit_json:
        print(json.dumps({
            "check": CHECK_NAME,
            "findings": findings,
            "summary": summary,
            "stats": {
                "total_paths_extracted": len(paths),
                "alive": len(alive),
                "dead": len(dead),
            },
        }, indent=2))
    else:
        print(f"# Prompt Registry Path Drift Check ({PROMPT_REGISTRY_PATH.relative_to(REPO_ROOT)})")
        print()
        if findings:
            for f in findings:
                marker = "[ERROR]" if f["severity"] == "error" else "[WARN]"
                print(f"{marker} {f['rule']}: {f['message']}")
            print()
        print(f"Total paths extraits: {len(paths)} (alive={len(alive)}, dead={len(dead)})")
        print(f"Findings: {summary['error']} error(s), {summary['warning']} warning(s)")
        if dead:
            print()
            print("## Dead paths (registre casse §3 maintenance)")
            for p in dead:
                print(f"- `{p}`")

    return 1 if summary["error"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
