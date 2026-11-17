#!/usr/bin/env python3
"""Tests du générateur des canons distribués.

Portés de `governance-vault/_scripts/test_canon_hashes.py` pour le gate de statut et la
non-régression du registre ; ajoutés pour le contrôle des copies, que le vault confiait
à `sync_canon_mirrors.py` sans test. Les tests du mode `json_jcs` ne sont pas portés :
ce mode ne l'est pas non plus (voir l'en-tête du générateur).
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("cch", REPO / "scripts" / "canon" / "compute-canon-hashes.py")
cch = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cch)

SOURCE = "---\ntype: rules-document\nstatus: canon\n---\n\n# Titre\n\ncorps é\n"
BODY = "# Titre\n\ncorps é\n"
LOCAL_COPY = "copies/regle.md"


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@pytest.fixture
def repo(tmp_path):
    """Dépôt minimal : une source, une copie locale et une copie d'un autre dépôt."""
    canons = {
        "regle": {
            "name": "Règle",
            "canon_path": "canon/regle.md",
            "version": "1.0.0",
            "hash_mode": "text_sha256",
            "publishable_when": ["canon"],
            "consumers": [
                {"repo": "ak125/automecanik-wiki", "path": "_meta/regle.md"},
                {"repo": cch.MONOREPO, "path": LOCAL_COPY},
            ],
        }
    }
    (tmp_path / "canon").mkdir()
    (tmp_path / "canon" / "regle.md").write_bytes(SOURCE.encode("utf-8"))
    return tmp_path, canons


# --------------------------------------------------------------------------- #
# 1. Empreintes
# --------------------------------------------------------------------------- #
def test_strip_frontmatter_removes_the_block_and_its_blank_lines():
    assert cch.strip_frontmatter(SOURCE) == BODY


def test_strip_frontmatter_leaves_a_text_without_frontmatter():
    assert cch.strip_frontmatter(BODY) == BODY


def test_strip_frontmatter_removes_only_the_first_block():
    text = SOURCE + "---\nautre: bloc\n---\n"
    assert cch.strip_frontmatter(text) == BODY + "---\nautre: bloc\n---\n"


def test_compute_hashes_the_whole_file_and_the_distributed_body(repo):
    root, canons = repo
    entry = cch.compute(root, canons)["canons"]["regle"]
    assert entry["canon_sha256"] == sha(SOURCE)
    assert entry["distribution_sha256"] == sha(BODY)
    assert entry["canon_sha256"] != entry["distribution_sha256"]


def test_manifest_keeps_the_schema_of_the_vault_manifest(repo):
    root, canons = repo
    manifest = cch.compute(root, canons)
    assert list(manifest) == ["$comment", "version", "updated", "canons"]
    assert list(manifest["canons"]["regle"]) == [
        "name", "canon_path", "canon_sha256", "distribution_sha256", "hash_mode", "version", "consumers",
    ]


# --------------------------------------------------------------------------- #
# 2. Refus — fail-closed
# --------------------------------------------------------------------------- #
def _entry(**over):
    base = {"name": "T", "canon_path": "x.md", "version": "1", "publishable_when": ["canon"]}
    base.update(over)
    return base


def _doc(status):
    return "---\nid: R1\n---\n\ncorps\n" if status is None else f"---\nid: R1\nstatus: {status}\n---\n\ncorps\n"


@pytest.mark.parametrize("status", ["proposed", "conditional", "deprecated", "accepted", "CANON"])
def test_status_not_in_publishable_when_is_refused(status):
    with pytest.raises(SystemExit) as exc:
        cch.enforce_publishable("t", _entry(), _doc(status))
    assert "publishable_when" in str(exc.value)


def test_status_absent_is_refused():
    with pytest.raises(SystemExit, match="ne déclare aucun statut"):
        cch.enforce_publishable("t", _entry(), _doc(None))


def test_document_without_frontmatter_is_refused():
    with pytest.raises(SystemExit, match="ne déclare aucun statut"):
        cch.enforce_publishable("t", _entry(), "status: canon\n\ncorps\n")


def test_publishable_when_absent_is_refused():
    """Une entrée qui ne déclare pas ses statuts admissibles est refusée : l'oubli
    ne vaut pas permission."""
    entry = _entry()
    del entry["publishable_when"]
    with pytest.raises(SystemExit, match="publishable_when"):
        cch.enforce_publishable("t", entry, _doc("canon"))


def test_declared_status_in_the_list_passes():
    cch.enforce_publishable("t", _entry(), _doc("canon"))
    cch.enforce_publishable("t", _entry(publishable_when=["accepted"]), _doc("accepted"))


def test_missing_source_is_refused(repo):
    root, canons = repo
    (root / "canon" / "regle.md").unlink()
    with pytest.raises(SystemExit, match="absente"):
        cch.compute(root, canons)


def test_canon_without_consumer_is_refused(repo):
    root, canons = repo
    canons["regle"]["consumers"] = []
    with pytest.raises(SystemExit, match="aucun consommateur"):
        cch.compute(root, canons)


def test_unsupported_hash_mode_is_refused(repo):
    root, canons = repo
    canons["regle"]["hash_mode"] = "json_jcs"
    with pytest.raises(SystemExit, match="hash_mode"):
        cch.compute(root, canons)


# --------------------------------------------------------------------------- #
# 3. --write puis --check
# --------------------------------------------------------------------------- #
def test_write_creates_manifest_and_local_copies_only(repo):
    root, canons = repo
    assert cch.write(root, canons) == 0
    assert (root / LOCAL_COPY).read_bytes() == BODY.encode("utf-8")
    assert not (root / "_meta" / "regle.md").exists(), "la copie d'un autre dépôt ne s'écrit pas ici"
    manifest = json.loads((root / cch.MANIFEST_PATH).read_text(encoding="utf-8"))
    assert manifest["canons"]["regle"]["distribution_sha256"] == sha(BODY)
    assert manifest["updated"]
    assert cch.check(root, canons) == 0


def test_write_is_idempotent_and_keeps_the_date(repo):
    root, canons = repo
    cch.write(root, canons)
    path = root / cch.MANIFEST_PATH
    dated = json.loads(path.read_text(encoding="utf-8"))
    dated["updated"] = "2001-01-01"
    path.write_text(json.dumps(dated, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    before = path.read_bytes()
    cch.write(root, canons)
    assert path.read_bytes() == before


def test_check_fails_without_manifest(repo, capsys):
    root, canons = repo
    assert cch.check(root, canons) == 1
    assert "manifeste absent" in capsys.readouterr().out


def test_check_fails_when_the_source_changes(repo, capsys):
    root, canons = repo
    cch.write(root, canons)
    (root / "canon" / "regle.md").write_bytes((SOURCE + "ajout\n").encode("utf-8"))
    assert cch.check(root, canons) == 1
    out = capsys.readouterr().out
    assert "regle.distribution_sha256" in out and "copie différente" in out


def test_check_fails_when_only_the_frontmatter_changes(repo, capsys):
    """Le corps distribué est inchangé, mais `canon_sha256` ne décrit plus la source."""
    root, canons = repo
    cch.write(root, canons)
    (root / "canon" / "regle.md").write_bytes(SOURCE.replace("rules-document", "rules").encode("utf-8"))
    assert cch.check(root, canons) == 1
    out = capsys.readouterr().out
    assert "regle.canon_sha256" in out and "distribution_sha256" not in out


def test_check_fails_on_one_changed_byte_in_a_copy(repo, capsys):
    root, canons = repo
    cch.write(root, canons)
    (root / LOCAL_COPY).write_bytes(BODY.replace("corps", "corpS").encode("utf-8"))
    assert cch.check(root, canons) == 1
    assert f"copie différente de sa source : {LOCAL_COPY}" in capsys.readouterr().out


def test_check_fails_on_crlf_copy(repo):
    """`read_text` traduirait CRLF en LF et cacherait l'écart que `sha256sum` voit."""
    root, canons = repo
    cch.write(root, canons)
    (root / LOCAL_COPY).write_bytes(BODY.replace("\n", "\r\n").encode("utf-8"))
    assert cch.check(root, canons) == 1


def test_check_fails_on_missing_copy(repo, capsys):
    root, canons = repo
    cch.write(root, canons)
    (root / LOCAL_COPY).unlink()
    assert cch.check(root, canons) == 1
    assert "copie absente" in capsys.readouterr().out


def test_check_fails_when_the_registry_changes(repo, capsys):
    """Version ou consommateurs se déclarent dans le registre : le manifeste suit."""
    root, canons = repo
    cch.write(root, canons)
    canons["regle"]["version"] = "1.1.0"
    assert cch.check(root, canons) == 1
    assert "regle.version" in capsys.readouterr().out


def test_check_fails_on_a_hand_edited_manifest(repo, capsys):
    root, canons = repo
    cch.write(root, canons)
    path = root / cch.MANIFEST_PATH
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["canons"]["fantome"] = dict(manifest["canons"]["regle"])
    path.write_text(json.dumps(manifest), encoding="utf-8")
    assert cch.check(root, canons) == 1
    assert "'fantome' : en trop" in capsys.readouterr().out


def test_check_writes_nothing(repo):
    root, canons = repo
    cch.write(root, canons)
    (root / LOCAL_COPY).write_bytes(b"autre\n")
    cch.check(root, canons)
    assert (root / LOCAL_COPY).read_bytes() == b"autre\n"


# --------------------------------------------------------------------------- #
# 4. Le dépôt réel
# --------------------------------------------------------------------------- #
def test_registered_canons_all_declare_publishable_when():
    for key, meta in cch.CANONS.items():
        assert meta.get("publishable_when"), f"{key} sans publishable_when"


def test_registered_sources_live_in_the_canon_directory():
    for key, meta in cch.CANONS.items():
        assert meta["canon_path"].startswith(cch.CANON_DIR + "/"), key


def test_registered_canons_compute_without_error():
    out = cch.compute()
    assert set(out["canons"]) == set(cch.CANONS)
    for val in out["canons"].values():
        assert val["hash_mode"] == "text_sha256"
        assert len(val["distribution_sha256"]) == 64


def test_repository_is_in_sync():
    """Le contrôle de CI : manifeste et copies du dépôt conformes aux sources."""
    assert cch.check() == 0


# --------------------------------------------------------------------------- #
# 5. Plan d'annonce aux dépôts consommateurs (canon-publish.yml)
# --------------------------------------------------------------------------- #
def _manifest(**digests):
    """Manifeste réduit : deux dépôts consommateurs et une copie du monorepo par canon."""
    return {
        "canons": {
            key: {
                "distribution_sha256": digest,
                "consumers": [
                    {"repo": "ak125/automecanik-wiki", "path": f"_meta/{key}.md"},
                    {"repo": "ak125/automecanik-raw", "path": f"{key}.md"},
                    {"repo": cch.MONOREPO, "path": f"copies/{key}.md"},
                ],
            }
            for key, digest in digests.items()
        }
    }


def test_dispatch_plan_is_empty_when_no_distributed_body_changed():
    assert cch.dispatch_plan(_manifest(a="1", b="2"), before=_manifest(a="1", b="2")) == []


def test_dispatch_plan_names_only_the_changed_canon_and_never_the_monorepo():
    plan = cch.dispatch_plan(_manifest(a="1", b="9"), before=_manifest(a="1", b="2"))
    assert plan == [
        {"canon": "b", "repo": "ak125/automecanik-wiki"},
        {"canon": "b", "repo": "ak125/automecanik-raw"},
    ]


def test_dispatch_plan_announces_a_canon_absent_from_the_old_manifest():
    plan = cch.dispatch_plan(_manifest(a="1", b="2"), before=_manifest(a="1"))
    assert {p["canon"] for p in plan} == {"b"}
    assert len(plan) == 2


def test_dispatch_plan_announces_a_new_consumer_repo_of_an_unchanged_canon():
    before = _manifest(a="1")
    before["canons"]["a"]["consumers"].pop(1)  # l'ancien manifeste ne déclarait pas raw
    assert cch.dispatch_plan(_manifest(a="1"), before=before) == [
        {"canon": "a", "repo": "ak125/automecanik-raw"}
    ]


def test_dispatch_plan_forced_canon_lists_all_its_external_repos():
    plan = cch.dispatch_plan(_manifest(a="1", b="2"), canon="a")
    assert plan == [
        {"canon": "a", "repo": "ak125/automecanik-wiki"},
        {"canon": "a", "repo": "ak125/automecanik-raw"},
    ]


def test_dispatch_plan_refuses_an_unknown_canon():
    with pytest.raises(SystemExit) as exc:
        cch.dispatch_plan(_manifest(a="1"), canon="inconnu")
    assert "canon inconnu" in str(exc.value)


@pytest.mark.parametrize("kwargs", [{}, {"before": {"canons": {}}, "canon": "a"}])
def test_dispatch_plan_refuses_neither_or_both_selectors(kwargs):
    with pytest.raises(SystemExit):
        cch.dispatch_plan(_manifest(a="1"), **kwargs)


def test_registered_canons_plan_matches_the_declared_external_consumers():
    """Sur le dépôt réel : l'AEC s'annonce au wiki et à raw, la voix de marque à personne."""
    manifest = cch.load_manifest(cch.REPO_ROOT)
    assert cch.dispatch_plan(manifest, canon="aec") == [
        {"canon": "aec", "repo": "ak125/automecanik-wiki"},
        {"canon": "aec", "repo": "ak125/automecanik-raw"},
    ]
    assert cch.dispatch_plan(manifest, canon="marketing_voice") == []
