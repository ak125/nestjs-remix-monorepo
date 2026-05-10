import io
import sys
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from vault_extract import extract_vault


def _make_zip_bytes(files: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buf.getvalue()


def test_extract_happy_path(tmp_path):
    zip_bytes = _make_zip_bytes({
        "vault/00-Meta/README.md": "hello",
        "vault/02-ADR/ADR-001.md": "adr body",
    })
    zip_path = tmp_path / "v.zip"
    zip_path.write_bytes(zip_bytes)

    manifest = extract_vault(str(zip_path))

    assert "zip_sha256" in manifest
    assert len(manifest["zip_sha256"]) == 64
    assert Path(manifest["extract_dir"]).exists()
    assert len(manifest["files"]) == 2
    paths = {f["path"] for f in manifest["files"]}
    assert "vault/00-Meta/README.md" in paths
    for f in manifest["files"]:
        assert len(f["sha256"]) == 64


def test_extract_corrupt_zip(tmp_path):
    bad = tmp_path / "bad.zip"
    bad.write_bytes(b"not a zip")
    with pytest.raises(Exception):
        extract_vault(str(bad))


def test_extract_missing_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        extract_vault(str(tmp_path / "nope.zip"))
