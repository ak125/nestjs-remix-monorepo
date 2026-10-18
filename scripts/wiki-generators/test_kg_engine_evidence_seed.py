"""pytest suite for kg-engine-evidence-seed.py — le kg ne produit que des PISTES non sourcées.

Couvre :
  - chaque panne seedée porte `seed_ref` (traçabilité), `sources: []`, `needs_augmentation`,
    et aucun `diagnostic_safe` (ADR-086 repris par ADR-112 ; ADR-033 §D4) ;
  - contrat avec engine-issues-from-evidence.py : une piste seedée est rejetée tant qu'elle
    n'est pas sourcée.

Imports via importlib (single-file convention canon, no package). Le module lit `backend/.env`
à l'import si `SUPABASE_SERVICE_ROLE_KEY` est absent : une valeur factice est posée le temps
de l'import pour qu'aucun test ne lise un secret, puis l'environnement est restauré.
"""
import importlib.util
import os
from pathlib import Path

HERE = Path(__file__).parent

_saved_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-dummy-not-a-key"
try:
    _spec = importlib.util.spec_from_file_location("kg_engine_evidence_seed", HERE / "kg-engine-evidence-seed.py")
    seed = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(seed)
finally:
    if _saved_key is None:
        os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)
    else:
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = _saved_key

_ispec = importlib.util.spec_from_file_location("engine_issues_from_evidence", HERE / "engine-issues-from-evidence.py")
inj = importlib.util.module_from_spec(_ispec)
_ispec.loader.exec_module(inj)

FAMILY = {
    "family_code": "TST",
    "family_name": "Test",
    "manufacturer": "VAG",
    "fuel_type": "Diesel",
    "displacement_cc": 1968,
    "common_issues": {"egr": "Encrassement de la vanne", "volant_moteur": "Bruit au ralenti"},
}


def test_every_seeded_fault_is_an_unsourced_lead():
    ev = seed.family_to_evidence(FAMILY)
    assert [f["issue"] for f in ev["faults"]] == ["egr", "volant_moteur"]
    for fault in ev["faults"]:
        assert fault["seed_ref"] == "internal://kg_engine_families/TST"
        assert fault["sources"] == []
        assert fault["needs_augmentation"] is True
        assert "diagnostic_safe" not in fault


def test_no_internal_kg_source_type_is_emitted():
    ev = seed.family_to_evidence(FAMILY)
    assert all(s.get("source_type") != "internal_kg" for f in ev["faults"] for s in f["sources"])


def test_seeded_lead_is_rejected_by_the_injector_until_sourced():
    fault = seed.family_to_evidence(FAMILY)["faults"][0]
    notes = []
    assert inj.validate_fault(fault, "tst", {"vanne-egr"}, {"injection"}, notes) is None
    assert "internal://kg_engine_families/TST" in notes[0]

    sourced = dict(fault, sources=[
        {"url": "https://presse.example/article", "source_type": "presse", "confidence": "medium"},
        {"url": "https://base.example/fiche", "source_type": "base_technique", "confidence": "medium"},
    ])
    issue = inj.validate_fault(sourced, "tst", {"vanne-egr"}, {"injection"}, [])
    assert issue is not None
    assert "seed_ref" not in issue
    assert issue["diagnostic_safe"] is False


def test_family_without_common_issues_gives_nothing():
    assert seed.family_to_evidence(dict(FAMILY, common_issues={})) is None
