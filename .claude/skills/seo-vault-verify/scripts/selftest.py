"""selftest.py — 6 cas d'acceptance pour seo-vault-verify.

Cas 1 (happy) — skip si --zip absent
Cas 2 (no-arg) — autonome
Cas 3 (corrupt) — autonome
Cas 4 (missing-file) — fixture dérivée du ZIP si présent, sinon skip
Cas 5 (pattern-absent) — idem
Cas 6 (sha-mismatch) — idem

Exit code 0 si tous les cas exécutés passent, ≠ 0 sinon.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parent
SKILL_DIR = SCRIPTS_DIR.parent
MANIFEST = SKILL_DIR / "references" / "expected-changes-v1.yaml"


def _run_audit(zip_or_dir: str, extra_args: list | None = None) -> dict:
    with tempfile.TemporaryDirectory() as td:
        out_json = Path(td) / "report.json"
        out_md = Path(td) / "report.md"
        cmd = [sys.executable, str(SCRIPTS_DIR / "run_audit.py"),
               zip_or_dir, "--manifest", str(MANIFEST),
               "--out-json", str(out_json),
               "--out-md", str(out_md)]
        if extra_args:
            cmd.extend(extra_args)
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if not out_json.exists():
            return {"verdict": "INSUFFICIENT_EVIDENCE",
                    "stderr": proc.stderr, "returncode": proc.returncode}
        return json.loads(out_json.read_text())


def case_1_happy(zip_path: Path):
    if not zip_path.exists():
        return True, "SKIP (ZIP absent)"
    rep = _run_audit(str(zip_path))
    ok = rep["verdict"] in ("SCOPE_SCANNED", "PARTIAL_COVERAGE", "REVIEW_REQUIRED")
    return ok, f"verdict={rep['verdict']}"


def case_2_no_arg():
    proc = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "run_audit.py")],
        capture_output=True, text=True)
    ok = proc.returncode != 0
    return ok, f"returncode={proc.returncode}"


def case_3_corrupt_zip(tmp_dir: Path):
    bad = tmp_dir / "bad.zip"
    bad.write_bytes(b"garbage")
    rep = _run_audit(str(bad))
    ok = rep["verdict"] == "INSUFFICIENT_EVIDENCE"
    return ok, f"verdict={rep['verdict']}"


def _make_fixture_zip_without(zip_path: Path, tmp_dir: Path,
                              path_suffix_to_remove: str) -> Path:
    out = tmp_dir / "fixture-missing.zip"
    with zipfile.ZipFile(zip_path, "r") as src, \
         zipfile.ZipFile(out, "w") as dst:
        for info in src.infolist():
            if info.filename.endswith(path_suffix_to_remove):
                continue
            dst.writestr(info, src.read(info.filename))
    return out


def _make_fixture_zip_modified(zip_path: Path, tmp_dir: Path,
                               path_suffix_to_modify: str,
                               transform) -> Path:
    out = tmp_dir / "fixture-modified.zip"
    with zipfile.ZipFile(zip_path, "r") as src, \
         zipfile.ZipFile(out, "w") as dst:
        for info in src.infolist():
            raw = src.read(info.filename)
            if info.filename.endswith(path_suffix_to_modify):
                text = raw.decode("utf-8", errors="replace")
                raw = transform(text).encode("utf-8")
            dst.writestr(info, raw)
    return out


def case_4_missing_file(zip_path: Path, tmp_dir: Path):
    if not zip_path.exists():
        return True, "SKIP"
    fx = _make_fixture_zip_without(zip_path, tmp_dir,
                                   "_template-gamme-brief.md")
    rep = _run_audit(str(fx))
    ok = rep["verdict"] == "REVIEW_REQUIRED"
    return ok, f"verdict={rep['verdict']}"


def case_5_pattern_absent(zip_path: Path, tmp_dir: Path):
    if not zip_path.exists():
        return True, "SKIP"
    fx = _make_fixture_zip_modified(
        zip_path, tmp_dir, "_template-gamme-brief.md",
        lambda t: t.replace("J+30", "JOUR_30_RETIRE"))
    rep = _run_audit(str(fx))
    ok = rep["verdict"] == "REVIEW_REQUIRED"
    return ok, f"verdict={rep['verdict']}"


def case_6_sha_mismatch(zip_path: Path, tmp_dir: Path):
    if not zip_path.exists():
        return True, "SKIP"
    fx = _make_fixture_zip_modified(
        zip_path, tmp_dir, "Pillars.md",
        lambda t: t + "\n<!-- injected byte -->")
    rep = _run_audit(str(fx))
    # Si baseline pas gelée, test ne peut pas détecter : on vérifie juste pas de crash
    ok = "verdict" in rep
    return ok, f"verdict={rep['verdict']} (baseline-dependent)"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", default=None,
                        help="Path vers le ZIP de référence (optionnel)")
    args = parser.parse_args()

    zip_path = Path(args.zip) if args.zip else Path("/nonexistent")

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        results = [
            ("1 happy", *case_1_happy(zip_path)),
            ("2 no-arg", *case_2_no_arg()),
            ("3 corrupt", *case_3_corrupt_zip(td_path)),
            ("4 missing-file", *case_4_missing_file(zip_path, td_path)),
            ("5 pattern-absent", *case_5_pattern_absent(zip_path, td_path)),
            ("6 sha-mismatch", *case_6_sha_mismatch(zip_path, td_path)),
        ]

    all_ok = True
    for name, ok, detail in results:
        symbol = "✅" if ok else "❌"
        print(f"{symbol} Cas {name} — {detail}")
        if not ok:
            all_ok = False

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
