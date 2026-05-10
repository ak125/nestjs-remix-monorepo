import sys
import zipfile
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from run_audit import run_audit


SAMPLE_MANIFEST = {
    "version": 1,
    "adr_reference": "ADR-002",
    "files_regenerated": [
        {"path": "00-Meta/README.md",
         "must_contain": [{"pattern": "ADR-002"}]},
    ],
    "files_unchanged": [],
    "cross_ref_aggregate": {
        "adr_002_min_files_referencing": 1,
        "adr_002_max_files_referencing: 5": 5,
    },
    "matching_rules": {
        "unicode_normalization": "NFC",
        "case_sensitive_default": False,
    },
}


# Fix the typo in dict key
SAMPLE_MANIFEST["cross_ref_aggregate"] = {
    "adr_002_min_files_referencing": 1,
    "adr_002_max_files_referencing": 5,
}


def _make_vault_zip(tmp_path, files):
    zip_path = tmp_path / "v.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return zip_path


def test_happy_path_without_subagent(tmp_path):
    zip_path = _make_vault_zip(tmp_path, {
        "00-Meta/README.md": "Voir [[ADR-002-maillage-interne-first]]. Ref ADR-002.",
    })
    manifest_path = tmp_path / "manifest.yaml"
    manifest_path.write_text(yaml.safe_dump(SAMPLE_MANIFEST))

    result = run_audit(str(zip_path), str(manifest_path), subagent_result=None)

    assert result["verdict"] in ("PARTIAL_COVERAGE", "REVIEW_REQUIRED")
    assert result["content_checks"][0]["pass"] is True


def test_missing_file_yields_review_required(tmp_path):
    zip_path = _make_vault_zip(tmp_path, {
        "autre.md": "content",
    })
    manifest_path = tmp_path / "manifest.yaml"
    manifest_path.write_text(yaml.safe_dump(SAMPLE_MANIFEST))

    result = run_audit(str(zip_path), str(manifest_path), subagent_result=None)
    assert result["verdict"] == "REVIEW_REQUIRED"


def test_corrupt_zip_yields_insufficient_evidence(tmp_path):
    bad = tmp_path / "bad.zip"
    bad.write_bytes(b"garbage")
    manifest_path = tmp_path / "manifest.yaml"
    manifest_path.write_text(yaml.safe_dump(SAMPLE_MANIFEST))

    result = run_audit(str(bad), str(manifest_path), subagent_result=None)
    assert result["verdict"] == "INSUFFICIENT_EVIDENCE"


def test_scope_scanned_with_ok_subagent(tmp_path):
    zip_path = _make_vault_zip(tmp_path, {
        "00-Meta/README.md": "Voir [[ADR-002-maillage-interne-first]]. Ref ADR-002.",
    })
    manifest_path = tmp_path / "manifest.yaml"
    manifest_path.write_text(yaml.safe_dump(SAMPLE_MANIFEST))

    subagent_result = {
        "dimensions": [
            {"name": "pilier_primaire_secondaire", "status": "OK", "evidence": "README.md", "comment": "cohérent"},
            {"name": "anti_sur_optimisation", "status": "OK", "evidence": "-", "comment": "-"},
            {"name": "kpis_mesurables", "status": "OK", "evidence": "-", "comment": "-"},
            {"name": "outreach_opportuniste", "status": "OK", "evidence": "-", "comment": "-"},
        ],
        "overall_status": "OK",
        "overall_comment": "OK global",
    }

    result = run_audit(str(zip_path), str(manifest_path), subagent_result=subagent_result)
    assert result["verdict"] == "SCOPE_SCANNED"


def test_subagent_flag_yields_review_required(tmp_path):
    zip_path = _make_vault_zip(tmp_path, {
        "00-Meta/README.md": "Voir [[ADR-002-maillage-interne-first]]. Ref ADR-002.",
    })
    manifest_path = tmp_path / "manifest.yaml"
    manifest_path.write_text(yaml.safe_dump(SAMPLE_MANIFEST))

    subagent_result = {
        "dimensions": [
            {"name": "pilier_primaire_secondaire", "status": "FLAG", "evidence": "...", "comment": "contradiction"},
        ],
        "overall_status": "FLAG",
        "overall_comment": "-",
    }

    result = run_audit(str(zip_path), str(manifest_path), subagent_result=subagent_result)
    assert result["verdict"] == "REVIEW_REQUIRED"
