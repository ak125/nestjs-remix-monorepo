#!/usr/bin/env python3
"""check-phase2-canon-enum-drift.py - Validate phase2-canon.md enums vs backend implementation.

Implemente le critere C2 d'ADR-048 sprint 2 P0 (phase2-canon.md
enforcement). phase2-canon.md definit 6 enums canoniques (listes
fermees) qui doivent etre implementes dans le backend TypeScript.

Approche enum drift detection :
  1. Source de verite = constante EXPECTED_ENUMS dans ce script,
     extraite manuellement de phase2-canon.md v1.1.0 (vérifiée
     2026-05-07). Pas de parsing markdown dynamique : le format des
     tables canon (multiples tables avec separators identiques) rend
     un parser fragile, alors qu'une baseline hardcoded auditable
     dans le source du script est plus robuste.
  2. Pour chaque valeur canon, grep recursif `'value'` ou `"value"`
     dans backend/src/ pour verifier qu'elle est implementee
  3. Flag valeur canon absente comme `error` (canon defini mais pas
     dans le code = drift critique)
  4. Detection inverse (valeur TS pas dans canon) skip pour MVP
     (trop bruyant : beaucoup de string literals utilises pour
     d'autres choses)
  5. Si phase2-canon.md evolue : mise a jour manuelle de
     EXPECTED_ENUMS dans une PR signee (ce qui est exactement le
     contrat canon : modifs canon = decision humaine tracee)

Mode warn-only initial (coherent strategie escalade ADR-048 J+30) :
findings `error` visibles via ::error:: annotations CI mais
n'echouent pas la PR. Promo `--strict` apres 30j si signal clair.

Usage:
  python3 scripts/spec-canon/check-phase2-canon-enum-drift.py [--json] [--strict]

Reference :
  - .spec/00-canon/phase2-canon.md v1.1.0 (extrait manuel ci-dessous)
  - ADR-048 §Implementation Sprint 2 P0
  - Pattern coherent avec scripts/spec-canon/check-{repo-map,prompt-
    registry}-drift.py
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

CHECK_NAME = "phase2-canon-enum-drift"

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PHASE2_CANON_PATH = REPO_ROOT / ".spec" / "00-canon" / "phase2-canon.md"

# Source de verite : extraits manuellement de phase2-canon.md v1.1.0 (2026-03-14)
# verifies 2026-05-07. Si phase2-canon.md evolue (nouvel enum value), maj cette
# constante en commit signe : c'est exactement le contrat canon (modifs sous
# controle humain). Le check `canon-baseline-presence` valide que ces valeurs
# sont toujours mentionnees dans phase2-canon.md (drift inverse).
EXPECTED_ENUMS = {
    "execution_mode": [
        "create", "regenerate", "refresh_partial", "refresh_full",
        "repair", "qa_only", "hold_only",
    ],
    "section_eligibility": [
        "ELIGIBLE", "ELIGIBLE_WITH_LIMITS", "BLOCKED",
        "MISSING_EVIDENCE", "OUT_OF_ROLE",
    ],
    "evidence_grade": [
        "strong", "support-only", "weak-support", "forbidden-for-claim",
    ],
    "qa_decision": ["PASS", "HOLD", "BLOCK", "ESCALATE"],
    "write_mode": [
        "shadow_write", "draft_write", "versioned_replace",
        "hold_write", "blocked_no_write",
    ],
    "publication_decision": ["HOLD", "BLOCK", "APPROVED", "REVIEW"],
}

# Repertoires ou chercher l'implementation TS.
BACKEND_SCOPE = REPO_ROOT / "backend" / "src"


def check_canon_baseline_presence(text: str) -> list[dict]:
    """Verify each EXPECTED_ENUMS value is mentioned in phase2-canon.md text.

    Drift inverse : si la baseline hardcoded contient des valeurs absentes du
    canon actuel, c'est que le canon a evolue et la baseline doit etre mise
    a jour (commit signe). Flag warning, pas error : c'est un signal de
    maintenance, pas un bug critique.
    """
    findings: list[dict] = []
    for enum_name, values in EXPECTED_ENUMS.items():
        for value in values:
            # Recherche tolerante : `value` (backtick), 'value' (quote), "value"
            # OR word boundary `\bvalue\b` (cas qa_decision (PASS | HOLD | ...))
            patterns_present = (
                f"`{value}`" in text
                or f"'{value}'" in text
                or f'"{value}"' in text
                or re.search(rf"\b{re.escape(value)}\b", text) is not None
            )
            if not patterns_present:
                findings.append({
                    "severity": "warning",
                    "file": str(PHASE2_CANON_PATH.relative_to(REPO_ROOT)),
                    "rule": f"{CHECK_NAME}.canon-baseline-mismatch",
                    "enum": enum_name,
                    "value": value,
                    "message": (
                        f"Valeur baseline '{value}' (enum {enum_name}) absente du canon. "
                        f"Soit le canon a evolue (mettre a jour EXPECTED_ENUMS), soit la "
                        f"baseline contient une erreur."
                    ),
                })
    return findings


def find_string_in_backend(value: str) -> bool:
    """Check if a string literal `'value'` or `"value"` exists in backend/src/.

    Uses ripgrep if available (faster), else grep -r fallback.
    """
    if not BACKEND_SCOPE.exists():
        return False

    # Search for both 'value' and "value" patterns
    patterns = [f"'{value}'", f'"{value}"']
    for pattern in patterns:
        try:
            # Use grep -rF (fixed string) for speed and simplicity
            result = subprocess.run(
                ["grep", "-rFq", "--include=*.ts", "--include=*.tsx",
                 pattern, str(BACKEND_SCOPE)],
                capture_output=True,
                timeout=30,
            )
            if result.returncode == 0:
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    return False


def main(argv: list[str]) -> int:
    args = list(argv[1:])
    emit_json = "--json" in args
    strict = "--strict" in args

    findings: list[dict] = []

    # Step 1 : verifier que la baseline EXPECTED_ENUMS est encore presente
    # dans phase2-canon.md (drift inverse, warning seulement)
    if not PHASE2_CANON_PATH.exists():
        findings.append({
            "severity": "error",
            "file": str(PHASE2_CANON_PATH.relative_to(REPO_ROOT)),
            "rule": f"{CHECK_NAME}.phase2-canon-missing",
            "message": f"phase2-canon.md introuvable a {PHASE2_CANON_PATH}.",
        })
    else:
        try:
            text = PHASE2_CANON_PATH.read_text(encoding="utf-8")
        except OSError as e:
            findings.append({
                "severity": "error",
                "file": str(PHASE2_CANON_PATH.relative_to(REPO_ROOT)),
                "rule": f"{CHECK_NAME}.phase2-canon-unreadable",
                "message": f"Lecture impossible : {e}",
            })
        else:
            findings.extend(check_canon_baseline_presence(text))

    # Step 2 : verifier que chaque valeur baseline est implementee dans backend/src/
    backend_findings_count = 0
    for enum_name, values in EXPECTED_ENUMS.items():
        for value in values:
            if not find_string_in_backend(value):
                findings.append({
                    "severity": "error",
                    "file": "backend/src/**/*.ts",
                    "rule": f"{CHECK_NAME}.canon-value-not-implemented",
                    "enum": enum_name,
                    "value": value,
                    "message": (
                        f"Valeur canon '{value}' (enum {enum_name}) non trouvee comme "
                        f"string literal dans backend/src/. Canon implemente "
                        f"incompletement ou valeur renommee silencieusement."
                    ),
                })
                backend_findings_count += 1

    if strict:
        for f in findings:
            if f["severity"] == "warning":
                f["severity"] = "error"

    summary = {"error": 0, "warning": 0, "info": 0}
    for f in findings:
        summary[f["severity"]] = summary.get(f["severity"], 0) + 1

    total_values = sum(len(v) for v in EXPECTED_ENUMS.values())

    if emit_json:
        print(json.dumps({
            "check": CHECK_NAME,
            "findings": findings,
            "summary": summary,
            "stats": {
                "enums_checked": len(EXPECTED_ENUMS),
                "total_values_checked": total_values,
                "values_missing_in_backend": backend_findings_count,
                "values_alive_in_backend": total_values - backend_findings_count,
            },
        }, indent=2))
    else:
        print(f"# Phase 2 Canon Enum Drift Check ({PHASE2_CANON_PATH.relative_to(REPO_ROOT)})")
        print()
        print(f"Enums verifies (baseline EXPECTED_ENUMS) : {len(EXPECTED_ENUMS)}")
        for enum_name, values in EXPECTED_ENUMS.items():
            print(f"  - {enum_name} : {len(values)} valeurs")
        print()
        print(f"Coverage backend/src/ : {total_values - backend_findings_count}/{total_values} alive ({backend_findings_count} missing)")
        print()
        if findings:
            for f in findings:
                marker = "[ERROR]" if f["severity"] == "error" else "[WARN]"
                print(f"{marker} {f['rule']}: {f['message']}")
            print()
        print(f"Total: {summary['error']} error(s), {summary['warning']} warning(s)")

    return 1 if summary["error"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
