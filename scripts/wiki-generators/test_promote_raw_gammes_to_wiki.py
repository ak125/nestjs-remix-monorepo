"""pytest suite for promote-raw-gammes-to-wiki.py — single-file convention canon.

Imports via importlib.util.spec_from_file_location to load script-file without package.
Pas de subpackage, pas de PYTHONPATH, pas de sys.path mutation.
"""
import importlib.util
import subprocess
from pathlib import Path

SCRIPT_PATH = Path(__file__).parent / "promote-raw-gammes-to-wiki.py"
_spec = importlib.util.spec_from_file_location("promote_raw_gammes_to_wiki", SCRIPT_PATH)
promote = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(promote)

VANNE_EGR_PATH = promote.GAMMES_DIR / "vanne-egr.md"


# === Task 2 skeleton smoke tests ===

def test_skeleton_loads_module():
    assert hasattr(promote, "read_raw_gamme")
    assert hasattr(promote, "main")
    assert hasattr(promote, "is_rag_recycled_candidate")
    assert hasattr(promote, "extract_dimensions")
    assert hasattr(promote, "evaluate_variant_readiness")
    assert hasattr(promote, "build_proposal_v2")
    assert hasattr(promote, "GAMMES_DIR")
    assert hasattr(promote, "WEB_DIR")
    assert hasattr(promote, "PROPOSALS_DIR")
    assert hasattr(promote, "SCHEMA_PATH")


def test_cli_smoke_runs():
    result = subprocess.run(
        ["python3", str(SCRIPT_PATH), "--gamme", "vanne-egr", "--dry-run"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, f"stderr: {result.stderr}"
    assert "vanne-egr" in result.stdout
    assert "skeleton" in result.stdout  # placeholder marker
