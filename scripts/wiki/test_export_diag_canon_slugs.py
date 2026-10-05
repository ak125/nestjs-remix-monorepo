"""pytest suite for export-diag-canon-slugs.py — canon 1.1.0 `causes` (ADR-112 phase 0).

Single-file convention canon: load the hyphenated script via
importlib.util.spec_from_file_location (no package, no sys.path mutation).

Offline only: PostgREST is replaced by a stub of `_get_json_array`, so no
credential and no network are needed. Scope: the causes added in 1.1.0 (active
rows only, fail-closed on an incomplete row) and the contract with the
validator, whose loader must read what the exporter writes.
"""
import importlib.util
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).parent


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ex = _load("export_diag_canon_slugs", "export-diag-canon-slugs.py")
vg = _load("validate_gamme_diagnostic_relations", "validate-gamme-diagnostic-relations.py")

SYMPTOM_ROWS = [
    {"slug": "brake_noise_metallic", "label": "Bruit", "urgency": "haute", "active": True,
     "__diag_system": {"slug": "freinage"}},
    {"slug": "perte_puissance", "label": "Perte", "urgency": "moyenne", "active": True,
     "__diag_system": {"slug": "filtration"}},
]
CAUSE_ROWS = [
    {"slug": "plaquettes_usees", "active": True, "__diag_system": {"slug": "freinage"}},
    {"slug": "filtre_colmate", "active": True, "__diag_system": {"slug": "filtration"}},
]


def _stub_postgrest(monkeypatch, symptoms=SYMPTOM_ROWS, causes=CAUSE_ROWS):
    calls = []

    def fake(supabase_url, key, path):
        calls.append(path)
        if path == ex.QUERY_PATH:
            return symptoms
        if path == ex.CAUSES_QUERY_PATH:
            return causes
        raise AssertionError(f"unexpected PostgREST path {path}")

    monkeypatch.setattr(ex, "_get_json_array", fake)
    return calls


def test_causes_query_reads_active_causes_with_their_system():
    assert ex.CAUSES_QUERY_PATH.startswith("/rest/v1/__diag_cause?")
    assert "__diag_system(slug)" in ex.CAUSES_QUERY_PATH
    assert "&active=eq.true" in ex.CAUSES_QUERY_PATH


def test_fetch_canon_causes_maps_slug_to_system_sorted(monkeypatch):
    _stub_postgrest(monkeypatch)
    causes = ex.fetch_canon_causes("https://example.invalid", "k")
    assert causes == {"filtre_colmate": "filtration", "plaquettes_usees": "freinage"}
    assert list(causes) == ["filtre_colmate", "plaquettes_usees"]


@pytest.mark.parametrize("row", [
    {"slug": "sans_systeme", "active": True, "__diag_system": None},
    {"slug": "systeme_vide", "active": True, "__diag_system": {}},
    {"slug": None, "active": True, "__diag_system": {"slug": "freinage"}},
    "pas_un_objet",
])
def test_fetch_canon_causes_fails_closed_on_incomplete_row(monkeypatch, row):
    _stub_postgrest(monkeypatch, causes=CAUSE_ROWS + [row])
    with pytest.raises(SystemExit) as exc:
        ex.fetch_canon_causes("https://example.invalid", "k")
    assert exc.value.code == 1


def test_build_flat_map_is_version_1_1_with_causes():
    rows = [{"symptom_slug": "perte_puissance", "system_slug": "filtration"},
            {"symptom_slug": "brake_noise_metallic", "system_slug": "freinage"}]
    flat = ex.build_flat_map(rows, {"plaquettes_usees": "freinage", "filtre_colmate": "filtration"},
                             "2026-10-05T02:00:00Z")
    assert flat == {
        "version": "1.1.0",
        "generated_at": "2026-10-05T02:00:00Z",
        "systems": ["filtration", "freinage"],
        "symptoms": {"brake_noise_metallic": "freinage", "perte_puissance": "filtration"},
        "causes": {"filtre_colmate": "filtration", "plaquettes_usees": "freinage"},
    }


def test_main_output_is_read_by_the_validator_loader(monkeypatch, tmp_path):
    calls = _stub_postgrest(monkeypatch)
    monkeypatch.setenv("SUPABASE_URL", "https://example.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "k")
    out = tmp_path / "exports"
    monkeypatch.setattr(sys, "argv", ["export-diag-canon-slugs.py", "--output-dir", str(out)])
    assert ex.main() == 0
    assert calls == [ex.QUERY_PATH, ex.CAUSES_QUERY_PATH]

    flat = json.loads((out / "diag-canon.json").read_text(encoding="utf-8"))
    assert flat["version"] == ex.CANON_VERSION == "1.1.0"
    # The legacy array is unchanged : symptoms only.
    legacy = json.loads((out / "diag-canon-slugs.json").read_text(encoding="utf-8"))
    assert [r["symptom_slug"] for r in legacy] == ["brake_noise_metallic", "perte_puissance"]

    symptoms, systems, sym_to_sys, cause_to_sys, msg = vg.load_canon(tmp_path)
    assert symptoms == {"brake_noise_metallic", "perte_puissance"}
    assert systems == {"filtration", "freinage"}
    assert sym_to_sys == {"brake_noise_metallic": "freinage", "perte_puissance": "filtration"}
    assert cause_to_sys == {"filtre_colmate": "filtration", "plaquettes_usees": "freinage"}
    assert "2 causes" in msg
