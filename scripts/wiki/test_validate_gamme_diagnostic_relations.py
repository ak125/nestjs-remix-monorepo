"""pytest suite for validate-gamme-diagnostic-relations.py — ADR-112 / ADR-113 canon gates.

Single-file convention canon: load the hyphenated script via
importlib.util.spec_from_file_location (no package, no sys.path mutation).

Scope: the gates added for ADR-112 phase 0 (cause_slug FK, cause ↔ system,
quick_checks[].cause_slug, safety_rules[].system_slug) and ADR-113
(diagnostic_not_applicable vs diagnostic_relations[]), plus the canon loader
that now reads `causes` from exports/diag-canon.json 1.1.0. The pre-existing
symptom/system gates are exercised only as regression guards.

The blocked-reason strings asserted here are the same as those asserted by
backend/src/config/diag-canon.schema.test.ts for checkDiagnosticRelation —
change both sides together.
"""
import importlib.util
import json
from pathlib import Path

import pytest
import yaml

SCRIPT_PATH = Path(__file__).parent / "validate-gamme-diagnostic-relations.py"
_spec = importlib.util.spec_from_file_location("validate_gamme_diagnostic_relations", SCRIPT_PATH)
vg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vg)

SYSTEMS = ["filtration", "freinage"]
SYMPTOMS = {"brake_noise_metallic": "freinage", "perte_puissance": "filtration"}
CAUSES = {"plaquettes_usees": "freinage", "filtre_colmate": "filtration"}


def _make_wiki(tmp_path: Path, canon: object) -> Path:
    """Minimal wiki checkout: exports/diag-canon.json (or legacy array) + source catalog."""
    (tmp_path / "exports").mkdir(parents=True)
    if isinstance(canon, list):
        (tmp_path / "exports" / "diag-canon-slugs.json").write_text(json.dumps(canon), encoding="utf-8")
    else:
        (tmp_path / "exports" / "diag-canon.json").write_text(json.dumps(canon), encoding="utf-8")
    (tmp_path / "_meta").mkdir()
    (tmp_path / "_meta" / "source-catalog.yaml").write_text(
        yaml.safe_dump({"sources": [{"slug": "src_ok", "type": "oem_manual"}]}), encoding="utf-8"
    )
    return tmp_path


def _canon_v11() -> dict:
    return {
        "version": "1.1.0",
        "generated_at": "2026-10-05T02:00:00Z",
        "systems": SYSTEMS,
        "symptoms": SYMPTOMS,
        "causes": CAUSES,
    }


def _canon_v10() -> dict:
    return {"version": "1.0.0", "generated_at": "2026-10-05T02:00:00Z", "systems": SYSTEMS, "symptoms": SYMPTOMS}


def _relation(**overrides) -> dict:
    rel = {
        "symptom_slug": "brake_noise_metallic",
        "system_slug": "freinage",
        "relation_to_part": "possible_cause",
        "sources": ["src_ok"],
    }
    rel.update(overrides)
    return rel


def _validate(wiki: Path, fm: dict, name: str = "fiche.md") -> tuple[bool, list[str]]:
    """Write one fiche under wiki/gamme/ and run process_file with the loaded canon."""
    base = {"schema_version": "2.0.0", "entity_type": "gamme"}
    base.update(fm)
    path = wiki / "wiki" / "gamme" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("---\n" + yaml.safe_dump(base, allow_unicode=True) + "---\n\n# fiche\n", encoding="utf-8")
    symptoms, systems, symptom_to_system, cause_to_system, _msg = vg.load_canon(wiki)
    catalog = vg.load_source_catalog(wiki)
    return vg.process_file(path, wiki, symptoms, systems, symptom_to_system, cause_to_system, catalog)


# ── canon loader ─────────────────────────────────────────────────────────────


def test_load_canon_v11_returns_causes(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v11())
    symptoms, systems, symptom_to_system, cause_to_system, msg = vg.load_canon(wiki)
    assert symptoms == set(SYMPTOMS)
    assert systems == set(SYSTEMS)
    assert symptom_to_system == SYMPTOMS
    assert cause_to_system == CAUSES
    assert "2 causes" in msg


def test_load_canon_v10_has_no_causes(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v10())
    *_rest, cause_to_system, msg = vg.load_canon(wiki)
    assert cause_to_system is None
    assert "no causes" in msg


def test_load_canon_legacy_array_has_no_causes(tmp_path):
    wiki = _make_wiki(tmp_path, [{"symptom_slug": "brake_noise_metallic", "system_slug": "freinage"}])
    *_rest, cause_to_system, _msg = vg.load_canon(wiki)
    assert cause_to_system is None


def test_load_canon_rejects_non_object_causes(tmp_path):
    canon = _canon_v11()
    canon["causes"] = ["plaquettes_usees"]
    wiki = _make_wiki(tmp_path, canon)
    with pytest.raises(SystemExit) as exc:
        vg.load_canon(wiki)
    assert exc.value.code == 2


# ── diagnostic_relations[].cause_slug ────────────────────────────────────────


def test_relation_with_canon_cause_of_same_system_passes(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v11())
    assert _validate(wiki, {"diagnostic_relations": [_relation(cause_slug="plaquettes_usees")]}) == (True, [])


def test_relation_with_unknown_cause_is_blocked(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v11())
    passed, reasons = _validate(wiki, {"diagnostic_relations": [_relation(cause_slug="cause_fantome")]})
    assert not passed
    assert reasons == ["cause_slug_unknown:cause_fantome"]


def test_relation_with_cause_of_other_system_is_blocked(tmp_path):
    """Engine guard parity: a freinage symptom cannot be explained by a filtration cause."""
    wiki = _make_wiki(tmp_path, _canon_v11())
    passed, reasons = _validate(wiki, {"diagnostic_relations": [_relation(cause_slug="filtre_colmate")]})
    assert not passed
    assert reasons == ["cause_system_mismatch:filtre_colmate:freinage:filtration"]


def test_relation_with_unknown_system_reports_no_cause_mismatch(tmp_path):
    """No double noise: the system error is enough, the cause/system pair is not judged."""
    wiki = _make_wiki(tmp_path, _canon_v11())
    passed, reasons = _validate(
        wiki, {"diagnostic_relations": [_relation(system_slug="badsys", cause_slug="filtre_colmate")]}
    )
    assert not passed
    assert reasons == ["system_slug_unknown:badsys"]


def test_relation_cause_blocked_when_export_has_no_causes(tmp_path):
    """Export 1.0.0 cannot vouch for a cause: blocked, never accepted unchecked."""
    wiki = _make_wiki(tmp_path, _canon_v10())
    passed, reasons = _validate(wiki, {"diagnostic_relations": [_relation(cause_slug="plaquettes_usees")]})
    assert not passed
    assert reasons == ["canon_causes_missing:plaquettes_usees"]


def test_relation_without_cause_passes_on_both_canon_versions(tmp_path):
    """Backward compatibility: existing fiches (no cause_slug) are unaffected by the new gates."""
    for i, canon in enumerate((_canon_v10(), _canon_v11())):
        wiki = _make_wiki(tmp_path / str(i), canon)
        assert _validate(wiki, {"diagnostic_relations": [_relation()]}) == (True, [])


def test_existing_symptom_gates_unchanged(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v11())
    passed, reasons = _validate(wiki, {"diagnostic_relations": [_relation(system_slug="filtration")]})
    assert not passed
    assert reasons == ["symptom_system_mismatch:brake_noise_metallic:filtration:freinage"]


# ── diagnostic.quick_checks[].cause_slug ─────────────────────────────────────


def test_quick_check_with_canon_cause_passes(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v11())
    fm = {"diagnostic": {"quick_checks": [{"cause_slug": "filtre_colmate", "check": "Contrôler l'élément."}]}}
    assert _validate(wiki, fm) == (True, [])


def test_quick_check_with_unknown_cause_is_blocked(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v11())
    fm = {"diagnostic": {"quick_checks": [{"cause_slug": "cause_fantome", "check": "Contrôler l'élément."}]}}
    assert _validate(wiki, fm) == (False, ["cause_slug_unknown:cause_fantome"])


def test_quick_check_cause_blocked_when_export_has_no_causes(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v10())
    fm = {"diagnostic": {"quick_checks": [{"cause_slug": "filtre_colmate", "check": "Contrôler l'élément."}]}}
    assert _validate(wiki, fm) == (False, ["canon_causes_missing:filtre_colmate"])


def test_quick_checks_malformed_shapes_are_blocked(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v11())
    assert _validate(wiki, {"diagnostic": {"quick_checks": "x"}}, "a.md") == (False, ["quick_checks_not_array"])
    assert _validate(wiki, {"diagnostic": {"quick_checks": ["x"]}}, "b.md") == (False, ["quick_checks[0]_not_object"])


# ── safety_rules[].system_slug ───────────────────────────────────────────────


def test_safety_rule_with_canon_system_passes(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v11())
    fm = {"entity_type": "diagnostic", "safety_rules": [{"rule_slug": "regle_a", "system_slug": "freinage"}]}
    assert _validate(wiki, fm) == (True, [])


def test_safety_rule_with_unknown_system_is_blocked(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v11())
    fm = {"entity_type": "diagnostic", "safety_rules": [{"rule_slug": "regle_a", "system_slug": "badsys"}]}
    assert _validate(wiki, fm) == (False, ["system_slug_unknown:badsys"])


def test_safety_rules_malformed_shapes_are_blocked(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v11())
    assert _validate(wiki, {"safety_rules": {"a": 1}}, "a.md") == (False, ["safety_rules_not_array"])
    assert _validate(wiki, {"safety_rules": [1]}, "b.md") == (False, ["safety_rules[0]_not_object"])


# ── diagnostic_not_applicable (ADR-113) ──────────────────────────────────────


def test_not_applicable_with_relations_is_blocked(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v11())
    fm = {
        "diagnostic_not_applicable": {"reason": "Pièce d'habillage sans effet sur un symptôme."},
        "diagnostic_relations": [_relation()],
    }
    assert _validate(wiki, fm) == (False, ["diagnostic_not_applicable_with_relations"])


def test_not_applicable_alone_or_with_empty_relations_passes(tmp_path):
    wiki = _make_wiki(tmp_path, _canon_v11())
    na = {"reason": "Pièce d'habillage sans effet sur un symptôme."}
    assert _validate(wiki, {"diagnostic_not_applicable": na}, "a.md") == (True, [])
    assert _validate(wiki, {"diagnostic_not_applicable": na, "diagnostic_relations": []}, "b.md") == (True, [])


# ── version independence + reasons enum ──────────────────────────────────────


def test_new_blocks_are_checked_whatever_the_schema_version(tmp_path):
    """New fields have no 1.0.0 cohabitation to protect: fail-closed on every version."""
    wiki = _make_wiki(tmp_path, _canon_v11())
    fm = {
        "schema_version": "1.0.0",
        "diagnostic": {"quick_checks": [{"cause_slug": "cause_fantome", "check": "Contrôler l'élément."}]},
        "safety_rules": [{"rule_slug": "regle_a", "system_slug": "badsys"}],
        "diagnostic_not_applicable": {"reason": "Pièce d'habillage sans effet sur un symptôme."},
        "diagnostic_relations": [_relation()],
    }
    passed, reasons = _validate(wiki, fm)
    assert not passed
    assert reasons == [
        "cause_slug_unknown:cause_fantome",
        "system_slug_unknown:badsys",
        "diagnostic_not_applicable_with_relations",
    ]


def test_blocked_reasons_enum_lists_new_codes():
    for code in (
        "cause_slug_unknown",
        "cause_system_mismatch",
        "canon_causes_missing",
        "diagnostic_not_applicable_with_relations",
    ):
        assert code in vg.BLOCKED_REASONS


# ── CLI end-to-end ───────────────────────────────────────────────────────────


def test_main_exit_codes(tmp_path, monkeypatch, capsys):
    wiki = _make_wiki(tmp_path, _canon_v11())
    _validate(wiki, {"diagnostic_relations": [_relation(cause_slug="plaquettes_usees")]}, "ok.md")
    monkeypatch.setattr("sys.argv", ["validate", "--all", "--wiki-path", str(wiki), "--json"])
    assert vg.main() == 0
    _validate(wiki, {"diagnostic_relations": [_relation(cause_slug="filtre_colmate")]}, "ko.md")
    capsys.readouterr()
    assert vg.main() == 1
    report = json.loads(capsys.readouterr().out)
    assert report["summary"] == {"total": 2, "passed": 1, "failed": 1}
