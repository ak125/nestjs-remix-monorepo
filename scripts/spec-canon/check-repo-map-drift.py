#!/usr/bin/env python3
"""check-repo-map-drift.py - Detect drift between .spec/00-canon/repo-map.md claims and filesystem reality.

Implemente le critere C2 d'ADR-048 sprint 2 P1 : detecter mecaniquement les
ecarts entre les chiffres declares dans `repo-map.md` (canon prose au
2026-01-06) et la realite du filesystem.

Approche :
  1. Parse `.spec/00-canon/repo-map.md` table "Statistiques"
  2. Compare les claims numeriques STABLES (Shared packages, Docker configs)
     a la realite filesystem
  3. Flag chaque metric avec drift en `warning` ; exit 0 toujours en
     mode default (warn-only, coherent ADR-048 escalade J+30) ; exit 1
     en mode `--strict` (test local)

Perimetre (ADR-048 follow-up 2026-06-20) : ce detecteur ne suit QUE les
metriques structurelles STABLES. "Backend modules" et "Frontend routes" ont
ete RETIRES (du canon prose ET d'ici, ensemble) car :
  - comptes derivables du filesystem qui changent a chaque nouveau
    bounded-context / route -> churn permanent -> drift garanti ;
  - duplication de l'inventaire deja porte par le Repository Control Plane
    (audit/registry/canonical.json, ADR-058) + sa projection generee
    `.claude/knowledge/REPO_MAP.md` (source de verite unique) ;
  - "Frontend routes" comptait des FICHIERS top-level, pas des routes Remix
    effectives (proxy trompeur) et bouge avec la migration React Router.
  Tenir ces comptes a la main dans le canon = re-derive garantie ; le canon
  pointe desormais vers la projection generee pour l'inventaire vivant.

Usage:
  python3 scripts/spec-canon/check-repo-map-drift.py [--json] [--strict]

Reference :
  - ADR-048 §Implementation Sprint 2 ("PR monorepo : repo-map.md auto
    -generator + drift CI")
  - ADR-048 follow-up (vault) : narrow drift detector to stable metrics ;
    FS-derivable counts owned by registry projection (ADR-058)
  - REG-002 (governance-vault) : repo-map.md state prose-only -> enforced
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

    Fix #2 (PR review) : regex ancree a la section `## Statistiques` pour
    eviter de matcher des tables ailleurs (changelog, exemple, futur).
    Si la section est absente, retourne dict vide -> finding `error`
    (no-claims-found, fix #5 : detector casse, pas un simple drift).

    Expected pattern within section : `| Shared packages | 12 |` etc.
    """
    claims: dict[str, int] = {}
    # Section anchor : depuis "## Statistiques" jusqu'au prochain H2 ou EOF
    section_match = re.search(
        r"^##\s+Statistiques.*?\n(.*?)(?=^##\s|\Z)",
        text,
        re.MULTILINE | re.DOTALL,
    )
    if not section_match:
        return claims
    section_body = section_match.group(1)

    # Match table rows like "| Metric Name | 123 |" within the section only
    for m in re.finditer(r"\|\s*([A-Z][\w\s]+?)\s*\|\s*(\d+)(\+|k\+)?\s*\|", section_body):
        metric = m.group(1).strip()
        value = int(m.group(2))
        # Only keep the STABLE structural metrics. Excluded:
        #  - data-driven ("Produits DB 4M+" / "Utilisateurs 59k+" / "Categories 9k+")
        #  - FS-derivable churn ("Backend modules" / "Frontend routes") -> owned by
        #    the registry projection (ADR-058), retired here (see module docstring).
        if metric in {
            "Shared packages",
            "Docker configs",
        }:
            claims[metric] = value
    return claims


def _count_dir_entries(
    metric: str,
    dir_path: Path,
    predicate,
    findings: list[dict],
    reality: dict[str, int],
) -> None:
    """Helper : count entries matching predicate, with explicit error findings.

    Fix #3 (PR review) : iterdir() peut lever PermissionError (NFS, sandbox),
    FileNotFoundError TOCTOU (dir disparait apres .exists()), ou autre OSError.
    Au lieu de silencieusement retourner 0 (ce qui masque la vraie cause comme
    drift), on emet un finding `error` distinct -> le reader voit "dir missing"
    pas "drift -40".
    """
    if not dir_path.exists():
        findings.append({
            "severity": "error",
            "file": str(dir_path.relative_to(REPO_ROOT)) if dir_path.is_relative_to(REPO_ROOT) else str(dir_path),
            "rule": f"{CHECK_NAME}.tracked-dir-missing",
            "metric": metric,
            "message": (
                f"Repertoire suivi pour metric '{metric}' introuvable : {dir_path}. "
                f"Drift detector ne peut pas compter -- dir absent != claim=0."
            ),
        })
        return
    try:
        reality[metric] = sum(1 for p in dir_path.iterdir() if predicate(p))
    except OSError as e:
        findings.append({
            "severity": "error",
            "file": str(dir_path.relative_to(REPO_ROOT)) if dir_path.is_relative_to(REPO_ROOT) else str(dir_path),
            "rule": f"{CHECK_NAME}.iterdir-failed",
            "metric": metric,
            "message": f"iterdir({dir_path}) leve {type(e).__name__}: {e}",
        })


def count_filesystem_reality() -> tuple[dict[str, int], list[dict]]:
    """Count actual filesystem state for each tracked metric.

    Fix #3 (PR review) : retourne (reality, findings) au lieu de juste reality.
    Les findings cumulent les erreurs FS (dir missing, PermissionError, OSError)
    distinctes du drift legitime.
    """
    reality: dict[str, int] = {}
    findings: list[dict] = []

    # Perimetre narrowed (ADR-048 follow-up 2026-06-20) : "Backend modules" et
    # "Frontend routes" RETIRES (churn permanent + duplication du registry
    # ADR-058 + proxy trompeur pour les routes). Voir docstring du module.
    # Seules les metriques structurelles STABLES restent suivies ci-dessous.

    # Shared packages : dirs in packages/
    _count_dir_entries(
        "Shared packages",
        REPO_ROOT / "packages",
        lambda p: p.is_dir(),
        findings,
        reality,
    )

    # Docker configs : docker-compose*.yml at repo root
    try:
        reality["Docker configs"] = sum(
            1 for p in REPO_ROOT.iterdir()
            if p.is_file() and p.name.startswith("docker-compose") and p.suffix == ".yml"
        )
    except OSError as e:
        findings.append({
            "severity": "error",
            "file": str(REPO_ROOT),
            "rule": f"{CHECK_NAME}.iterdir-failed",
            "metric": "Docker configs",
            "message": f"iterdir({REPO_ROOT}) leve {type(e).__name__}: {e}",
        })

    return reality, findings


def main(argv: list[str]) -> int:
    args = list(argv[1:])
    emit_json = "--json" in args
    strict = "--strict" in args

    findings: list[dict] = []
    # Fix #1 (PR review) : claims/reality au scope main, pas de re-parse
    # double + walrus avec `text` undefined dans le bloc human-readable.
    claims: dict[str, int] = {}
    reality: dict[str, int] = {}

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
            # Fix #3 : count_filesystem_reality retourne maintenant tuple (reality, fs_findings)
            reality, fs_findings = count_filesystem_reality()
            findings.extend(fs_findings)

            if not claims:
                # Fix #5 (PR review) : severity error (pas warning) -- format change
                # = detector casse, pas un simple drift. Doit etre visible
                # immediatement, pas noye dans des warnings drift.
                findings.append({
                    "severity": "error",
                    "file": str(REPO_MAP_PATH.relative_to(REPO_ROOT)),
                    "rule": f"{CHECK_NAME}.no-claims-found",
                    "message": (
                        "Aucun claim numerique extrait de repo-map.md table 'Statistiques'. "
                        "Le format a change ou la section est absente -- detector casse."
                    ),
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
        # Fix #1 : utilise claims/reality du scope, pas de re-parse + walrus.
        if claims or reality:
            print()
            print("| Metric | Claimed | Actual | Drift |")
            print("|---|---:|---:|---:|")
            for metric in sorted(set(list(claims.keys()) + list(reality.keys()))):
                c = claims.get(metric, "—")
                a = reality.get(metric, "—")
                d = (a - c) if isinstance(c, int) and isinstance(a, int) else "—"
                d_str = f"{d:+d}" if isinstance(d, int) else d
                print(f"| {metric} | {c} | {a} | {d_str} |")

    return 1 if summary["error"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
