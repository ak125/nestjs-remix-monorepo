#!/usr/bin/env python3
"""check-repo-map-drift.py - Detect drift between .spec/00-canon/repo-map.md claims and filesystem reality.

Implemente le critere C2 d'ADR-048 sprint 2 P1 : detecter mecaniquement les
ecarts entre les chiffres declares dans `repo-map.md` (canon prose au
2026-01-06) et la realite du filesystem.

Approche :
  1. Parse `.spec/00-canon/repo-map.md` table "Statistiques"
  2. Compare les claims numeriques (Backend modules, Frontend routes,
     Shared packages, Docker configs) a la realite filesystem
  3. Flag chaque metric avec drift en `warning` ; exit 0 toujours en
     mode default (warn-only, coherent ADR-048 escalade J+30) ; exit 1
     en mode `--strict` (test local)

Usage:
  python3 scripts/spec-canon/check-repo-map-drift.py [--json] [--strict]

Reference :
  - ADR-048 §Implementation Sprint 2 ("PR monorepo : repo-map.md auto
    -generator + drift CI")
  - REG-002 (governance-vault) : repo-map.md state prose-only -> enforced
    (post-merge cette PR)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

CHECK_NAME = "repo-map-drift"

REPO_ROOT = Path(__file__).resolve().parent.parent.parent  # scripts/spec-canon/<this> -> repo root
REPO_MAP_PATH = REPO_ROOT / ".spec" / "00-canon" / "repo-map.md"


def parse_repo_map_claims(text: str) -> dict[str, int]:
    """Extract numeric claims from repo-map.md "Statistiques" table.

    Expected pattern: `| Backend modules | 40 |` etc.
    """
    claims: dict[str, int] = {}
    # Match table rows like "| Metric Name | 123 |"
    for m in re.finditer(r"\|\s*([A-Z][\w\s]+?)\s*\|\s*(\d+)(\+|k\+)?\s*\|", text):
        metric = m.group(1).strip()
        value = int(m.group(2))
        # Only keep the "structurel" metrics (not "Produits DB 4M+" / "Utilisateurs 59k+" / "Categories 9k+"
        # which are external/data-driven, not filesystem-driven)
        if metric in {
            "Backend modules",
            "Frontend routes",
            "Shared packages",
            "Docker configs",
        }:
            claims[metric] = value
    return claims


def count_filesystem_reality() -> dict[str, int]:
    """Count actual filesystem state for each tracked metric."""
    reality: dict[str, int] = {}

    # Backend modules : dirs in backend/src/modules/ (exclude .module.ts files)
    backend_modules_dir = REPO_ROOT / "backend" / "src" / "modules"
    if backend_modules_dir.exists():
        reality["Backend modules"] = sum(
            1 for p in backend_modules_dir.iterdir() if p.is_dir()
        )
    else:
        reality["Backend modules"] = 0

    # Frontend routes : .tsx + .ts files in frontend/app/routes/ (top-level only)
    frontend_routes_dir = REPO_ROOT / "frontend" / "app" / "routes"
    if frontend_routes_dir.exists():
        reality["Frontend routes"] = sum(
            1
            for p in frontend_routes_dir.iterdir()
            if p.is_file() and p.suffix in {".tsx", ".ts"}
        )
    else:
        reality["Frontend routes"] = 0

    # Shared packages : dirs in packages/
    packages_dir = REPO_ROOT / "packages"
    if packages_dir.exists():
        reality["Shared packages"] = sum(
            1 for p in packages_dir.iterdir() if p.is_dir()
        )
    else:
        reality["Shared packages"] = 0

    # Docker configs : docker-compose*.yml at repo root
    reality["Docker configs"] = sum(
        1 for p in REPO_ROOT.iterdir() if p.is_file() and p.name.startswith("docker-compose") and p.suffix == ".yml"
    )

    return reality


def main(argv: list[str]) -> int:
    args = list(argv[1:])
    emit_json = "--json" in args
    strict = "--strict" in args

    findings: list[dict] = []

    if not REPO_MAP_PATH.exists():
        findings.append({
            "severity": "error",
            "file": str(REPO_MAP_PATH.relative_to(REPO_ROOT)),
            "rule": f"{CHECK_NAME}.repo-map-missing",
            "message": f"repo-map.md introuvable a {REPO_MAP_PATH}. Le check ne peut pas s'executer.",
        })
    else:
        try:
            text = REPO_MAP_PATH.read_text(encoding="utf-8", errors="ignore")
        except OSError as e:
            findings.append({
                "severity": "error",
                "file": str(REPO_MAP_PATH.relative_to(REPO_ROOT)),
                "rule": f"{CHECK_NAME}.repo-map-unreadable",
                "message": f"Lecture impossible : {e}",
            })
        else:
            claims = parse_repo_map_claims(text)
            reality = count_filesystem_reality()

            if not claims:
                findings.append({
                    "severity": "warning",
                    "file": str(REPO_MAP_PATH.relative_to(REPO_ROOT)),
                    "rule": f"{CHECK_NAME}.no-claims-found",
                    "message": "Aucun claim numerique extrait de repo-map.md table 'Statistiques'. Le format a peut-etre change.",
                })

            for metric, claimed in claims.items():
                actual = reality.get(metric, 0)
                if claimed != actual:
                    findings.append({
                        "severity": "warning",
                        "file": str(REPO_MAP_PATH.relative_to(REPO_ROOT)),
                        "rule": f"{CHECK_NAME}.metric-drift",
                        "metric": metric,
                        "claimed": claimed,
                        "actual": actual,
                        "drift": actual - claimed,
                        "message": (
                            f"{metric} : claim={claimed}, reel={actual} "
                            f"(drift={actual - claimed:+d}). repo-map.md est stale."
                        ),
                    })

            # Detect metrics in reality but not in claims (new tracked dimensions ?)
            for metric in reality:
                if metric not in claims:
                    findings.append({
                        "severity": "warning",
                        "file": str(REPO_MAP_PATH.relative_to(REPO_ROOT)),
                        "rule": f"{CHECK_NAME}.metric-not-claimed",
                        "metric": metric,
                        "actual": reality[metric],
                        "message": (
                            f"Metric {metric} ({reality[metric]} sur filesystem) "
                            f"absente de repo-map.md table Statistiques."
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
        print(json.dumps({"check": CHECK_NAME, "findings": findings, "summary": summary}, indent=2))
    else:
        print(f"# Repo Map Drift Check ({REPO_MAP_PATH.relative_to(REPO_ROOT)})")
        print()
        if findings:
            for f in findings:
                marker = "[ERROR]" if f["severity"] == "error" else "[WARN]"
                print(f"{marker} {f['rule']}: {f['message']}")
            print()
        print(f"Total: {summary['error']} error(s), {summary['warning']} warning(s)")
        if "Backend modules" in (claim_dict := parse_repo_map_claims(text) if REPO_MAP_PATH.exists() else {}):
            reality = count_filesystem_reality()
            print()
            print("| Metric | Claimed | Actual | Drift |")
            print("|---|---:|---:|---:|")
            for metric in sorted(set(list(claim_dict.keys()) + list(reality.keys()))):
                c = claim_dict.get(metric, "—")
                a = reality.get(metric, "—")
                d = (a - c) if isinstance(c, int) and isinstance(a, int) else "—"
                d_str = f"{d:+d}" if isinstance(d, int) else d
                print(f"| {metric} | {c} | {a} | {d_str} |")

    return 1 if summary["error"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
