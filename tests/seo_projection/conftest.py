"""Résout l'import depuis scripts/seo-projection/ (filename avec tiret)."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / "scripts" / "seo-projection" / "replay_projection.py"


def _load_replay_module():
    """importlib loader pour le script (dossier avec tiret non-importable direct)."""
    spec = importlib.util.spec_from_file_location("replay_projection", SCRIPT_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["replay_projection"] = module
    spec.loader.exec_module(module)
    return module


# Expose pour les tests
replay = _load_replay_module()
