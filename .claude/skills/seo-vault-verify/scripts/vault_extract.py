"""vault_extract.py — Couche 1 du skill seo-vault-verify.

Responsabilité : dézipper un vault SEO dans un répertoire sandbox
/tmp/seo-vault-audit-<sha256[:12]>/ et calculer SHA256 du ZIP
+ de chaque fichier extrait. Produit un manifest JSON.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def extract_vault(zip_path: str) -> dict:
    """Extract zip into sandbox dir, return manifest with SHA256s.

    Raises FileNotFoundError if zip absent, zipfile.BadZipFile if corrupt.
    """
    src = Path(zip_path)
    if not src.exists():
        raise FileNotFoundError(f"ZIP introuvable : {zip_path}")

    with src.open("rb") as f:
        zip_sha = _sha256_bytes(f.read())

    extract_root = Path("/tmp") / f"seo-vault-audit-{zip_sha[:12]}"
    extract_root.mkdir(parents=True, exist_ok=True)

    files = []
    with zipfile.ZipFile(src, "r") as zf:
        zf.extractall(extract_root)
        for info in zf.infolist():
            if info.is_dir():
                continue
            extracted = extract_root / info.filename
            if extracted.is_file():
                files.append({
                    "path": info.filename,
                    "sha256": _sha256_file(extracted),
                    "size": extracted.stat().st_size,
                })

    return {
        "zip_path": str(src),
        "zip_sha256": zip_sha,
        "extract_dir": str(extract_root),
        "files": files,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract SEO vault ZIP.")
    parser.add_argument("zip_path", help="Path to vault ZIP")
    parser.add_argument("--json", action="store_true", help="Print manifest JSON")
    args = parser.parse_args()

    try:
        manifest = extract_vault(args.zip_path)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(manifest, indent=2))
    else:
        print(f"Extracted to {manifest['extract_dir']}")
        print(f"ZIP SHA256 : {manifest['zip_sha256']}")
        print(f"Files : {len(manifest['files'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
