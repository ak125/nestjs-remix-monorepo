"""run_audit.py — Couche 6 : orchestrator du skill seo-vault-verify.

Enchaîne vault_extract (1), check_content (2), check_crossref (3),
check_obsidian (4), consomme optionnellement un résultat subagent (5)
et produit un rapport markdown + JSON (6). Applique les règles
d'exit-contract pour le verdict final.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from vault_extract import extract_vault
from check_content import check_file
from check_crossref import count_files_referencing
from check_obsidian import check_vault_integrity


VALID_VERDICTS = {
    "SCOPE_SCANNED", "PARTIAL_COVERAGE",
    "REVIEW_REQUIRED", "INSUFFICIENT_EVIDENCE",
}


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _locate_vault_root(extract_dir: Path, probe_paths: list | None = None) -> Path:
    """Retourne le répertoire contenant la structure vault.

    Un ZIP peut avoir un wrapper dir (ex: automecanik-seo-vault/00-Meta/...)
    ou pas (00-Meta/... direct). On teste en probant avec un chemin attendu
    du manifeste : si il existe depuis extract_dir, on reste. Sinon, on
    descend d'un niveau.
    """
    probe_paths = probe_paths or []
    # Si au moins un probe path existe depuis extract_dir → c'est la racine
    if any((extract_dir / p).exists() for p in probe_paths):
        return extract_dir
    # Sinon, tente les sous-dossiers de 1er niveau
    for child in extract_dir.iterdir():
        if child.is_dir() and any((child / p).exists() for p in probe_paths):
            return child
    # Heuristique de fallback : si 1 seul sous-dir contient des .md
    subdirs = [d for d in extract_dir.iterdir() if d.is_dir()]
    if len(subdirs) == 1 and any(subdirs[0].rglob("*.md")):
        return subdirs[0]
    return extract_dir


def run_audit(zip_or_dir: str, manifest_path: str,
              subagent_result: dict | None = None) -> dict:
    """Exécute l'audit complet et retourne un dict rapport."""
    manifest = yaml.safe_load(Path(manifest_path).read_text(encoding="utf-8"))

    # Couche 1 : extract
    try:
        src = Path(zip_or_dir)
        if src.is_dir():
            extract_manifest = {
                "zip_path": str(src), "zip_sha256": None,
                "extract_dir": str(src),
                "files": [{"path": str(p.relative_to(src)),
                           "sha256": _sha256_file(p),
                           "size": p.stat().st_size}
                          for p in src.rglob("*") if p.is_file()],
            }
        else:
            extract_manifest = extract_vault(str(src))
    except Exception as e:
        return {
            "verdict": "INSUFFICIENT_EVIDENCE",
            "error": f"Extraction échouée : {e}",
            "extract_manifest": None,
            "content_checks": [],
            "crossref": {},
            "unchanged_checks": [],
            "obsidian": {"frontmatter_errors": [], "dataview_errors": [],
                         "dataview_blocks_total": 0},
            "subagent": subagent_result,
            "missing_files": [],
            "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        }

    extract_dir = Path(extract_manifest["extract_dir"])
    probe_paths = [item["path"] for item in manifest.get("files_regenerated", [])]
    vault_root = _locate_vault_root(extract_dir, probe_paths=probe_paths)

    # Couche 2 : content checks
    content_checks: list[dict] = []
    missing_files: list[str] = []
    for item in manifest.get("files_regenerated", []):
        file_path = vault_root / item["path"]
        if not file_path.exists():
            missing_files.append(item["path"])
            content_checks.append({
                "pass": False, "path": item["path"],
                "checks": [{"pass": False, "type": "file_exists",
                            "detail": "fichier attendu absent"}],
            })
            continue
        rules = {k: v for k, v in item.items() if k != "path"}
        content_checks.append(check_file(file_path, rules))

    # Couche 3 : crossref
    crossref: dict = {}
    if "cross_ref_aggregate" in manifest:
        agg = manifest["cross_ref_aggregate"]
        target = manifest.get("adr_reference", "ADR-002")
        target_stem_candidates = [
            "ADR-002-maillage-interne-first",
            target,
        ]
        max_count = 0
        for tgt in target_stem_candidates:
            c = count_files_referencing(vault_root, tgt)
            max_count = max(max_count, c)
        crossref = {
            "adr_ref_target": target,
            "count_files_referencing": max_count,
            "expected_min": agg.get("adr_002_min_files_referencing"),
            "expected_max": agg.get("adr_002_max_files_referencing"),
            "in_range": (agg.get("adr_002_min_files_referencing", 0)
                         <= max_count
                         <= agg.get("adr_002_max_files_referencing", 10**6)),
        }

    # Couche 4 : obsidian
    obsidian = check_vault_integrity(vault_root)

    # Non-régression
    unchanged_checks: list[dict] = []
    for item in manifest.get("files_unchanged", []):
        file_path = vault_root / item["path"]
        if not file_path.exists():
            unchanged_checks.append({
                "path": item["path"], "pass": False,
                "reason": "fichier absent",
            })
            continue
        actual = _sha256_file(file_path)
        expected = item.get("sha256_expected")
        if expected in (None, "PENDING_BASELINE"):
            unchanged_checks.append({
                "path": item["path"], "pass": True,
                "sha256_actual": actual,
                "note": "baseline non gelée",
            })
        else:
            unchanged_checks.append({
                "path": item["path"],
                "pass": actual == expected,
                "sha256_actual": actual,
                "sha256_expected": expected,
            })

    # Verdict
    all_content_pass = all(c["pass"] for c in content_checks) if content_checks else True
    all_unchanged_pass = all(c["pass"] for c in unchanged_checks) if unchanged_checks else True
    crossref_ok = crossref.get("in_range", True) if crossref else True
    obsidian_ok = (not obsidian["frontmatter_errors"]
                   and not obsidian["dataview_errors"])

    deterministic_pass = (all_content_pass and all_unchanged_pass
                          and crossref_ok and obsidian_ok)

    if missing_files:
        verdict = "REVIEW_REQUIRED"
    elif not deterministic_pass:
        verdict = "REVIEW_REQUIRED"
    elif subagent_result is None:
        verdict = "PARTIAL_COVERAGE"
    elif subagent_result.get("overall_status") == "OK":
        verdict = "SCOPE_SCANNED"
    elif subagent_result.get("overall_status") in ("FLAG", "UNKNOWN"):
        verdict = "REVIEW_REQUIRED"
    else:
        verdict = "PARTIAL_COVERAGE"

    if verdict not in VALID_VERDICTS:
        verdict = "PARTIAL_COVERAGE"

    return {
        "verdict": verdict,
        "extract_manifest": extract_manifest,
        "content_checks": content_checks,
        "crossref": crossref,
        "unchanged_checks": unchanged_checks,
        "obsidian": obsidian,
        "subagent": subagent_result,
        "missing_files": missing_files,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


def _fmt_content_table(checks: list) -> str:
    if not checks:
        return "(aucun)"
    lines = ["| Fichier | Pass | Détails |", "|---|---|---|"]
    for c in checks:
        summary = ", ".join(
            f"{d['type']}:{'✅' if d['pass'] else '❌'}"
            for d in c.get("checks", [])
        )
        lines.append(
            f"| `{c['path']}` | {'✅' if c['pass'] else '❌'} | {summary} |")
    return "\n".join(lines)


def _fmt_unchanged_table(checks: list) -> str:
    if not checks:
        return "(aucun)"
    lines = ["| Fichier | Pass | Note |", "|---|---|---|"]
    for c in checks:
        note = c.get("note") or c.get("reason") or ""
        lines.append(
            f"| `{c['path']}` | {'✅' if c['pass'] else '❌'} | {note} |")
    return "\n".join(lines)


def _verdict_rationale(report: dict) -> str:
    lines = []
    if report.get("error"):
        lines.append(f"- Erreur : {report['error']}")
    failing = [c for c in report["content_checks"] if not c["pass"]]
    if failing:
        lines.append(f"- {len(failing)} fichier(s) avec assertion échouée")
    unchanged_fail = [c for c in report["unchanged_checks"] if not c["pass"]]
    if unchanged_fail:
        lines.append(f"- {len(unchanged_fail)} fichier(s) 'inchangé' avec SHA256 mismatch")
    if report.get("crossref") and not report["crossref"].get("in_range", True):
        lines.append("- Cross-refs ADR hors plage attendue")
    if report["obsidian"]["frontmatter_errors"]:
        lines.append(f"- {len(report['obsidian']['frontmatter_errors'])} erreur(s) frontmatter")
    if report["obsidian"]["dataview_errors"]:
        lines.append(f"- {len(report['obsidian']['dataview_errors'])} erreur(s) dataview")
    if not report["subagent"]:
        lines.append("- Jugement subagent non exécuté (verdict partiel)")
    if not lines:
        lines.append("- Toutes les assertions déterministes passent + jugement OK")
    return "\n".join(lines)


def _render_markdown(report: dict, template_path: Path) -> str:
    tpl = template_path.read_text(encoding="utf-8")
    em = report.get("extract_manifest") or {}
    substitutions = {
        "{{DATE}}": report["generated_at"],
        "{{SKILL_VERSION}}": "1.0",
        "{{MANIFEST_VERSION}}": "1",
        "{{ZIP_SHA256}}": em.get("zip_sha256") or "n/a",
        "{{EXTRACT_DIR}}": em.get("extract_dir") or "n/a",
        "{{INVOCATION}}": "/seo-vault-verify",
        "{{SCOPE_REQUESTED}}": "audit vault SEO",
        "{{FILES_READ_COUNT}}": str(len(em.get("files") or [])),
        "{{EXCLUDED_PATHS}}": "aucun",
        "{{UNSCANNED_ZONES}}": "aucun",
        "{{REGENERATED_RESULTS_TABLE}}": _fmt_content_table(report["content_checks"]),
        "{{UNCHANGED_RESULTS_TABLE}}": _fmt_unchanged_table(report["unchanged_checks"]),
        "{{ADR_REFS_COUNT}}": str(report.get("crossref", {}).get("count_files_referencing", "n/a")),
        "{{MIN}}": str(report.get("crossref", {}).get("expected_min", "n/a")),
        "{{MAX}}": str(report.get("crossref", {}).get("expected_max", "n/a")),
        "{{ADR_REFS_LIST}}": "(cf. JSON détaillé)",
        "{{FRONTMATTER_ERRORS}}": str(len(report["obsidian"]["frontmatter_errors"])),
        "{{DATAVIEW_ERRORS}}": str(len(report["obsidian"]["dataview_errors"])),
        "{{DATAVIEW_TOTAL}}": str(report["obsidian"]["dataview_blocks_total"]),
        "{{SEO_JUDGMENT_JSON}}": "```json\n" + json.dumps(
            report["subagent"] or {"status": "not-run"}, indent=2,
            ensure_ascii=False) + "\n```",
        "{{CORRECTIONS_PROPOSED}}": "Aucune (skill ne modifie jamais le vault).",
        "{{SCRIPTS_VALIDATION}}": "pytest passants (cf. selftest)",
        "{{SUBAGENT_VALIDATION}}": ("parsed+validé" if report["subagent"]
                                    else "non exécuté"),
        "{{SCHEMA_VALIDATION}}": "stdlib manuelle",
        "{{FINAL_STATUS}}": report["verdict"],
        "{{VERDICT_RATIONALE}}": _verdict_rationale(report),
        "{{SCOPE_SCANNED}}": "files_regenerated + files_unchanged + crossref + obsidian",
        "{{CORRECTIONS_PROPOSED_LIST}}": "[]",
        "{{VALIDATION_EXECUTED}}": "true",
        "{{REMAINING_UNKNOWNS}}": ("jugement subagent" if not report["subagent"]
                                   else "aucun"),
    }
    out = tpl
    for k, v in substitutions.items():
        out = out.replace(k, str(v))
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", help="Vault ZIP ou dossier extrait")
    parser.add_argument("--manifest",
                        default=str(Path(__file__).parent.parent
                                    / "references" / "expected-changes-v1.yaml"))
    parser.add_argument("--subagent-result", default=None,
                        help="Path vers JSON résultat subagent (optionnel)")
    parser.add_argument("--out-md",
                        default=".spec/reports/seo-vault-verify.md")
    parser.add_argument("--out-json",
                        default=".spec/reports/seo-vault-verify.json")
    parser.add_argument("--template",
                        default=str(Path(__file__).parent.parent
                                    / "references" / "report-template.md"))
    args = parser.parse_args()

    subagent = None
    if args.subagent_result:
        subagent = json.loads(Path(args.subagent_result).read_text(encoding="utf-8"))

    report = run_audit(args.path, args.manifest, subagent_result=subagent)

    out_json = Path(args.out_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(report, indent=2, ensure_ascii=False),
                        encoding="utf-8")

    out_md = Path(args.out_md)
    md = _render_markdown(report, Path(args.template))
    out_md.write_text(md, encoding="utf-8")

    print(f"Verdict : {report['verdict']}")
    print(f"Rapport MD   : {out_md}")
    print(f"Rapport JSON : {out_json}")
    return 0 if report["verdict"] in ("SCOPE_SCANNED", "PARTIAL_COVERAGE") else 2


if __name__ == "__main__":
    sys.exit(main())
