"""pytest suite for engine-issues-from-evidence.py — projection évidence moteur → fiches RAW véhicule.

Couvre les invariants v3 :
  - kg = piste, jamais une preuve : une source `internal_kg` rejette le fait (ADR-086, repris par ADR-112) ;
  - `diagnostic_safe` toujours false en sortie (ADR-033 §D4), un `true` en entrée est noté ;
  - projection idempotente : la clé `engine_family:<code>` est reconstruite, relancer ne change rien ;
  - refus du run entier, sans écriture, si une panne relue (`reviewed: true`) serait écrasée ;
  - `validation_notes` dédoublonnées dans l'ordre ; `seed_ref` jamais recopié.

Imports via importlib (single-file convention canon, no package).
"""
import importlib.util
import sys
from pathlib import Path

import pytest
import yaml

SCRIPT_PATH = Path(__file__).parent / "engine-issues-from-evidence.py"
_spec = importlib.util.spec_from_file_location("engine_issues_from_evidence", SCRIPT_PATH)
inj = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(inj)

PRESSE = {"url": "https://presse.example/article", "source_type": "presse", "confidence": "medium"}
BASE = {"url": "https://base.example/fiche", "source_type": "base_technique", "confidence": "medium"}
FORUM = {"url": "https://forum.example/fil", "source_type": "forum", "confidence": "medium"}
KG = {"url": "internal://kg_engine_families/TST", "source_type": "internal_kg", "confidence": "high"}
GAMMES = {"vanne-egr"}
DIAGS = {"injection"}


# === Helpers ===

def _fault(slug="egr", sources=None, **extra):
    fault = {
        "issue": slug,
        "label": "Vanne EGR encrassée",
        "symptoms": ["Perte de puissance"],
        "severity": "medium",
        "related_gammes": ["vanne-egr"],
        "related_diagnostic": ["injection"],
        "sources": [PRESSE, BASE] if sources is None else sources,
    }
    fault.update(extra)
    return fault


def _ev(faults, vehicles=("test-auto",)):
    return {
        "engine_family": "tst",
        "fuel": "diesel",
        "displacement_liter": 2.0,
        "manufacturer": "VAG",
        "market": "EU",
        "applies_to_vehicles": list(vehicles),
        "faults": faults,
        "maintenance": [],
    }


def _block(key, value, script="script:test@v1"):
    return (f"# >>> DB-MANAGED BLOCK: {key} — {script} (ne pas éditer à la main)\n"
            + yaml.safe_dump({key: value}, sort_keys=False, allow_unicode=True)
            + f"# <<< END DB-MANAGED BLOCK: {key}\n")


def _fiche(kibe=None, notes=None):
    text = "---\ntitle: Test Auto\n"
    text += _block("motorizations", [{"fuel": "Diesel", "displacement_l": 2.0}])
    text += _block("known_issues_by_engine", kibe or {})
    if notes is not None:
        text += _block("validation_notes", notes)
    return text + "---\n\nCorps de fiche inchangé.\n"


def _valid(faults, notes=None):
    notes = [] if notes is None else notes
    return [i for i in (inj.validate_fault(f, "tst", GAMMES, DIAGS, notes) for f in faults) if i]


def _raw_tree(tmp_path, fiches):
    for sub in ("gammes", "diagnostic", "vehicles"):
        (tmp_path / "recycled" / "rag-knowledge" / sub).mkdir(parents=True)
    (tmp_path / "recycled/rag-knowledge/gammes/vanne-egr.md").write_text("---\n---\n", encoding="utf-8")
    (tmp_path / "recycled/rag-knowledge/diagnostic/injection.md").write_text("---\n---\n", encoding="utf-8")
    for slug, text in fiches.items():
        (tmp_path / "recycled/rag-knowledge/vehicles" / f"{slug}.md").write_text(text, encoding="utf-8")


def _run_main(monkeypatch, raw, evidence_path):
    monkeypatch.setattr(inj, "RAW_REPO", raw)
    monkeypatch.setattr(sys, "argv", ["engine-issues-from-evidence.py", "--evidence", str(evidence_path), "--merge"])
    return inj.main()


# === kg = piste, jamais une preuve ===

def test_internal_kg_is_neither_trusted_nor_valid():
    assert "internal_kg" not in inj.HIGH_TRUST_TYPES
    assert "internal_kg" not in inj.VALID_SOURCE_TYPES


def test_internal_kg_source_rejects_fact_with_dedicated_note():
    notes = []
    assert inj.validate_fault(_fault(sources=[KG, PRESSE, BASE]), "tst", GAMMES, DIAGS, notes) is None
    assert len(notes) == 1
    assert "piste kg, pas une preuve" in notes[0]
    assert "seed_ref" in notes[0]


def test_seed_ref_without_sources_is_rejected_with_the_lead_named():
    notes = []
    fault = _fault(sources=[], seed_ref="internal://kg_engine_families/TST")
    assert inj.validate_fault(fault, "tst", GAMMES, DIAGS, notes) is None
    assert "aucune source" in notes[0]
    assert "internal://kg_engine_families/TST" in notes[0]


def test_seed_ref_is_never_copied_into_the_issue():
    issue = inj.validate_fault(_fault(seed_ref="internal://kg_engine_families/TST", needs_augmentation=True),
                               "tst", GAMMES, DIAGS, [])
    assert issue is not None
    assert "seed_ref" not in issue
    assert "needs_augmentation" not in issue


# === Corroboration : le bonus ne dépend plus de kg ===

def test_two_independent_sources_with_a_high_tier_keep_the_bonus():
    assert inj.compute_corroboration([PRESSE, BASE]) == {"independent_sources": 2, "confidence_effective": "high"}


def test_two_independent_sources_without_high_tier_get_no_bonus():
    assert inj.compute_corroboration([PRESSE, FORUM]) == {"independent_sources": 2, "confidence_effective": "medium"}


# === diagnostic_safe : jamais promu par projection ===

def test_diagnostic_safe_true_in_evidence_is_forced_false_and_noted():
    notes = []
    issue = inj.validate_fault(_fault(diagnostic_safe=True), "tst", GAMMES, DIAGS, notes)
    assert issue["diagnostic_safe"] is False
    assert issue["reviewed"] is False
    assert any("`diagnostic_safe` vrai" in n and "ADR-033" in n for n in notes)


def test_diagnostic_safe_absent_gives_false_without_note():
    notes = []
    issue = inj.validate_fault(_fault(), "tst", GAMMES, DIAGS, notes)
    assert issue["diagnostic_safe"] is False
    assert notes == []


# === Projection idempotente ===

def test_projection_rebuilds_the_key_from_the_evidence():
    stale = {"engine_family:tst": {"axis_key_type": "engine_family", "applies_to": {"market": "FR"},
                                   "issues": [{"issue": "ancienne", "reviewed": False}]}}
    content, before, created, _ = inj.inject_vehicle(_fiche(stale), _ev([]), "test-auto", _valid([_fault()]), [], [])
    kibe = inj.extract_block_value(content, "known_issues_by_engine")
    assert before == ["ancienne"]
    assert created is False
    assert [i["issue"] for i in kibe["engine_family:tst"]["issues"]] == ["egr"]
    assert kibe["engine_family:tst"]["applies_to"]["market"] == "EU"


def test_projection_leaves_other_engine_keys_untouched():
    other = {"engine_family:autre": {"axis_key_type": "engine_family", "issues": [{"issue": "x", "reviewed": True}]}}
    content, _, created, _ = inj.inject_vehicle(_fiche(other), _ev([]), "test-auto", _valid([_fault()]), [], [])
    kibe = inj.extract_block_value(content, "known_issues_by_engine")
    assert created is True
    assert kibe["engine_family:autre"] == other["engine_family:autre"]


def test_projection_is_idempotent_and_keeps_text_outside_blocks():
    ev = _ev([_fault(), _fault("injecteurs", diagnostic_safe=True)])
    notes = []
    issues = _valid(ev["faults"], notes)
    first, _, _, _ = inj.inject_vehicle(_fiche(notes=["note héritée"]), ev, "test-auto", issues, [], notes)
    second, _, _, _ = inj.inject_vehicle(first, ev, "test-auto", issues, [], notes)
    assert second == first
    assert first.endswith("---\n\nCorps de fiche inchangé.\n")


def test_validation_notes_are_deduplicated_in_order():
    content, _, _, _ = inj.inject_vehicle(_fiche(notes=["a", "b", "a"]), _ev([]), "test-auto", [], [], ["b", "c", "c"])
    assert inj.extract_block_value(content, "validation_notes") == ["a", "b", "c"]


def test_reviewed_issue_raises_conflict():
    reviewed = {"engine_family:tst": {"issues": [{"issue": "egr", "reviewed": True}]}}
    with pytest.raises(inj.ReviewedIssueConflict, match="egr"):
        inj.inject_vehicle(_fiche(reviewed), _ev([]), "test-auto", _valid([_fault()]), [], [])


# === main() : run atomique ===

def test_main_twice_gives_identical_files(tmp_path, monkeypatch):
    raw = tmp_path / "raw"
    _raw_tree(raw, {"test-auto": _fiche(notes=["note héritée"])})
    evidence = tmp_path / "engine-tst.yml"
    evidence.write_text(yaml.safe_dump(_ev([_fault(diagnostic_safe=True)]), allow_unicode=True), encoding="utf-8")
    fiche = raw / "recycled/rag-knowledge/vehicles/test-auto.md"

    assert _run_main(monkeypatch, raw, evidence) == 0
    first = fiche.read_text(encoding="utf-8")
    assert _run_main(monkeypatch, raw, evidence) == 0
    assert fiche.read_text(encoding="utf-8") == first
    assert "script:engine-issues-from-evidence@v3" in first
    # La note ne reprend pas le motif YAML : un grep « diagnostic_safe: true » sur RAW reste fiable.
    assert "diagnostic_safe: true" not in first
    issues = inj.extract_block_value(first, "known_issues_by_engine")["engine_family:tst"]["issues"]
    assert [i["diagnostic_safe"] for i in issues] == [False]


def test_main_refuses_whole_run_and_writes_nothing_on_reviewed_issue(tmp_path, monkeypatch, capsys):
    raw = tmp_path / "raw"
    clean = _fiche()
    reviewed = _fiche({"engine_family:tst": {"issues": [{"issue": "egr", "reviewed": True}]}})
    _raw_tree(raw, {"a-propre": clean, "b-relue": reviewed})
    evidence = tmp_path / "engine-tst.yml"
    evidence.write_text(yaml.safe_dump(_ev([_fault()], vehicles=("a-propre", "b-relue"))), encoding="utf-8")

    assert _run_main(monkeypatch, raw, evidence) == 3
    vehicles = raw / "recycled/rag-knowledge/vehicles"
    assert (vehicles / "a-propre.md").read_text(encoding="utf-8") == clean
    assert (vehicles / "b-relue.md").read_text(encoding="utf-8") == reviewed
    assert "b-relue" in capsys.readouterr().err
