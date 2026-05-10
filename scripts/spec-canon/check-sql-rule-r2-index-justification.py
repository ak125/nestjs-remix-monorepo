#!/usr/bin/env python3
"""check-sql-rule-r2-index-justification.py - Detect CREATE INDEX without R2 comment block.

Implemente sub-axe 2 (DB-P0) d'ADR-049 sprint DB-2 : enforce mecaniquement
la regle R2 de `.spec/00-canon/db-governance/sql-governance-rules.md` v1.0.0 :

> "Tout nouvel index doit avoir un commentaire dans la migration SQL"
> avec format :
>   -- INDEX: idx_xxx
>   -- Table: xxx (N rows, X GB)
>   -- Pattern: JOIN/WHERE sur colonne Y avec cast Z
>   -- Gain attendu: Seq Scan N rows -> Index Scan ~M rows
>   -- RPC concernees: rpc_name_1, rpc_name_2

Approche minimal MVP :
  1. Scan `backend/supabase/migrations/<files>.sql` (limite au scope CI :
     migrations modifiees dans la PR via --since=<git-ref> en mode CI ;
     scan complet en local par defaut)
  2. Pour chaque CREATE INDEX (incluant CREATE UNIQUE INDEX, CREATE INDEX
     CONCURRENTLY, etc.), verifier la presence du comment block R2 dans
     les 15 lignes precedentes
  3. Flag absence comme `error` (R2 violation = canon DB casse)

Mode warn-only initial (cohérent ADR-049 escalade J+30) : findings
visibles via ::error:: annotations CI mais n'echouent pas la PR. Promo
`--strict` apres 30j si signal clair.

Usage:
  python3 scripts/spec-canon/check-sql-rule-r2-index-justification.py [--json] [--strict] [--since=<git-ref>]

Reference :
  - .spec/00-canon/db-governance/sql-governance-rules.md v1.0.0 R2
  - ADR-049 §Sub-axe 2 DB-P0 sprint DB-2
  - REG-002 row sql-governance-rules.md (db_classification: active-rule,
    threshold 60j)
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

CHECK_NAME = "sql-rule-r2-index-justification"

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MIGRATIONS_DIR = REPO_ROOT / "backend" / "supabase" / "migrations"

# Pattern : CREATE [UNIQUE] INDEX [CONCURRENTLY] [IF NOT EXISTS] name ON ...
# Capture : nom de l'index pour reporting
CREATE_INDEX_PATTERN = re.compile(
    r"^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(?P<name>\w+)\s+ON\s",
    re.IGNORECASE | re.MULTILINE,
)

# R2 comment block markers (case-insensitive). Au moins 3 sur 5 doivent etre
# presents dans les 15 lignes precedentes pour considerer le commentaire valide.
# Pragmatique : 5/5 strict serait trop restrictif au baseline.
R2_MARKERS = [
    re.compile(r"--\s*INDEX\s*:", re.IGNORECASE),
    re.compile(r"--\s*Table\s*:", re.IGNORECASE),
    re.compile(r"--\s*Pattern\s*:", re.IGNORECASE),
    re.compile(r"--\s*Gain\s+attendu\s*:", re.IGNORECASE),
    re.compile(r"--\s*RPC\s+concernees?\s*:", re.IGNORECASE),
]
R2_MIN_MARKERS = 3  # Au moins 3 sur 5 markers requis


def get_migrations_to_scan(since_ref: str | None) -> list[Path]:
    """Return list of migration files to scan.

    If --since=<ref> provided : only files changed since that git ref (CI mode).
    Otherwise : all migrations in dir (local audit mode).
    """
    if since_ref:
        try:
            result = subprocess.run(
                ["git", "-C", str(REPO_ROOT), "diff", "--name-only", f"{since_ref}...HEAD"],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
            if result.returncode != 0:
                # git diff failed, fall back to all
                return sorted(MIGRATIONS_DIR.glob("*.sql"))
            changed = [REPO_ROOT / line.strip() for line in result.stdout.splitlines() if line.strip()]
            return [
                p for p in changed
                if p.is_file() and p.suffix == ".sql" and MIGRATIONS_DIR in p.parents
            ]
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return sorted(MIGRATIONS_DIR.glob("*.sql"))
    else:
        return sorted(MIGRATIONS_DIR.glob("*.sql"))


def check_migration(path: Path) -> list[dict]:
    """Check one migration file. Return list of findings (CREATE INDEX without R2)."""
    findings: list[dict] = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        findings.append({
            "severity": "warning",
            "file": str(path.relative_to(REPO_ROOT)),
            "rule": f"{CHECK_NAME}.unreadable",
            "message": f"Lecture impossible : {e}",
        })
        return findings

    lines = text.splitlines()
    for m in CREATE_INDEX_PATTERN.finditer(text):
        # Position dans le texte -> numero de ligne
        line_no = text.count("\n", 0, m.start()) + 1
        # Lignes precedentes : 15 lignes avant (idx 0-based)
        start_idx = max(0, line_no - 16)
        end_idx = line_no - 1  # ne pas inclure la ligne du CREATE INDEX
        preceding_text = "\n".join(lines[start_idx:end_idx])

        markers_found = sum(
            1 for marker_re in R2_MARKERS
            if marker_re.search(preceding_text)
        )

        if markers_found < R2_MIN_MARKERS:
            findings.append({
                "severity": "error",
                "file": str(path.relative_to(REPO_ROOT)),
                "line": line_no,
                "rule": f"{CHECK_NAME}.missing-r2-comment",
                "index_name": m.group("name"),
                "markers_found": markers_found,
                "markers_required": R2_MIN_MARKERS,
                "message": (
                    f"CREATE INDEX `{m.group('name')}` sans comment block R2 "
                    f"(trouve {markers_found}/{len(R2_MARKERS)} markers, minimum "
                    f"{R2_MIN_MARKERS} requis). Voir sql-governance-rules.md R2 "
                    f"pour le format attendu (-- INDEX:, -- Table:, -- Pattern:, "
                    f"-- Gain attendu:, -- RPC concernees:)."
                ),
            })
    return findings


def main(argv: list[str]) -> int:
    args = list(argv[1:])
    emit_json = "--json" in args
    strict = "--strict" in args

    since_ref: str | None = None
    for arg in args:
        if arg.startswith("--since="):
            since_ref = arg[len("--since="):].strip()

    findings: list[dict] = []
    files: list[Path] = []

    if not MIGRATIONS_DIR.exists():
        findings.append({
            "severity": "warning",
            "file": str(MIGRATIONS_DIR.relative_to(REPO_ROOT)),
            "rule": f"{CHECK_NAME}.migrations-dir-missing",
            "message": f"Migrations dir introuvable : {MIGRATIONS_DIR}",
        })
    else:
        files = get_migrations_to_scan(since_ref)
        for f in files:
            findings.extend(check_migration(f))

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
                "scope": "since-ref" if since_ref else "all-migrations",
                "since_ref": since_ref,
                "migrations_scanned": len(files),
                "violations": summary["error"] if not strict else summary["error"] - sum(1 for f in findings if f["rule"] != f"{CHECK_NAME}.missing-r2-comment"),
            },
        }, indent=2))
    else:
        print(f"# SQL Rule R2 (Index Justification) Check")
        print()
        print(f"Source de regle : .spec/00-canon/db-governance/sql-governance-rules.md (R2)")
        print(f"Scope           : {'depuis ' + since_ref if since_ref else 'toutes les migrations'}")
        print(f"Migrations scan : {len(files)}")
        print(f"Findings        : {summary['error']} error(s), {summary['warning']} warning(s)")
        print()
        if findings:
            print("## Violations")
            for f in findings:
                marker = "[ERROR]" if f["severity"] == "error" else "[WARN]"
                loc = f["file"] + (f":L{f['line']}" if "line" in f else "")
                print(f"{marker} {loc} ({f['rule']}): {f['message']}")

    return 1 if summary["error"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
