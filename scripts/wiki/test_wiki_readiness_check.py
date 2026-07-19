"""pytest suite for wiki-readiness-check.py — focused on C3 liveness re-point.

Single-file convention canon: load the hyphenated script via
importlib.util.spec_from_file_location (no package, no sys.path mutation).

Scope: the C3 change that decouples "export cron liveness" from content-commit
recency (the export is now idempotent on `generated_at`, so commit age is no
longer a liveness signal). Liveness now comes from the export workflow's GitHub
Actions run-history; local mode (no token) reports it UNVERIFIED, never a silent
pass.
"""
import datetime
import importlib.util
import io
import json
from pathlib import Path

SCRIPT_PATH = Path(__file__).parent / "wiki-readiness-check.py"
_spec = importlib.util.spec_from_file_location("wiki_readiness_check", SCRIPT_PATH)
wr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(wr)

UTC = datetime.timezone.utc


def _make_wiki(tmp_path: Path, n_slugs: int = 6) -> Path:
    """Build a minimal valid wiki checkout: exports/ with the 2 files C3 reads."""
    exports = tmp_path / "exports"
    exports.mkdir(parents=True)
    slugs = [{"symptom_slug": f"symptom_{i}", "system_slug": "freinage"} for i in range(n_slugs)]
    (exports / "diag-canon-slugs.json").write_text(json.dumps(slugs), encoding="utf-8")
    (exports / "diag-canon.json").write_text(
        json.dumps({"generated_at": "2026-01-01T00:00:00Z", "symptoms": {}, "systems": {}, "version": "1"}),
        encoding="utf-8",
    )
    return tmp_path


# ── module smoke ──────────────────────────────────────────────────────────────


def test_module_exposes_new_liveness_api():
    assert hasattr(wr, "export_workflow_liveness")
    assert hasattr(wr, "c3_export_diag_canon_slugs_fresh")
    assert wr.EXPORT_FRESHNESS_DAYS == 7
    assert wr.EXPORT_WORKFLOW_FILE == "diag-canon-slugs-export.yml"


# ── export_workflow_liveness tri-state ────────────────────────────────────────


def test_liveness_none_when_no_token(monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GH_TOKEN", raising=False)
    status, detail = wr.export_workflow_liveness()
    assert status is None
    assert "no GITHUB_TOKEN" in detail


def _fake_urlopen(payload: dict):
    class _Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def _open(req, timeout=0):
        return _Resp(json.dumps(payload).encode("utf-8"))

    return _open


def test_liveness_alive_recent_run(monkeypatch):
    now = datetime.datetime(2026, 7, 19, 12, 0, tzinfo=UTC)
    payload = {"workflow_runs": [{"created_at": "2026-07-19T03:00:00Z"}]}  # ~9h ago
    monkeypatch.setattr(wr.urllib.request, "urlopen", _fake_urlopen(payload))
    status, detail = wr.export_workflow_liveness(repo="x/y", token="t", now=now)
    assert status is True
    assert "0.4d ago" in detail or "ago" in detail


def test_liveness_dead_when_run_too_old(monkeypatch):
    now = datetime.datetime(2026, 7, 19, 12, 0, tzinfo=UTC)
    payload = {"workflow_runs": [{"created_at": "2026-07-01T03:00:00Z"}]}  # ~18d ago
    monkeypatch.setattr(wr.urllib.request, "urlopen", _fake_urlopen(payload))
    status, detail = wr.export_workflow_liveness(repo="x/y", token="t", now=now)
    assert status is False
    assert "cron may be dead" in detail


def test_liveness_dead_when_no_scheduled_runs(monkeypatch):
    payload = {"workflow_runs": []}
    monkeypatch.setattr(wr.urllib.request, "urlopen", _fake_urlopen(payload))
    status, detail = wr.export_workflow_liveness(repo="x/y", token="t")
    assert status is False
    assert "no successful scheduled run" in detail


def test_liveness_failclosed_after_retries(monkeypatch):
    monkeypatch.setattr(wr.time, "sleep", lambda *a, **k: None)  # no real backoff
    calls = {"n": 0}

    def _boom(req, timeout=0):
        calls["n"] += 1
        raise wr.urllib.error.URLError("network down")

    monkeypatch.setattr(wr.urllib.request, "urlopen", _boom)
    status, detail = wr.export_workflow_liveness(repo="x/y", token="t", attempts=3)
    assert status is False  # fail-closed, never mask a dead cron
    assert "fail-closed" in detail
    assert calls["n"] == 3  # bounded retry before giving up


def test_liveness_retries_then_succeeds(monkeypatch):
    monkeypatch.setattr(wr.time, "sleep", lambda *a, **k: None)
    now = datetime.datetime(2026, 7, 19, 12, 0, tzinfo=UTC)
    payload = {"workflow_runs": [{"created_at": "2026-07-19T03:00:00Z"}]}
    state = {"n": 0}

    class _Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def _flaky(req, timeout=0):
        state["n"] += 1
        if state["n"] < 3:
            raise wr.urllib.error.URLError("transient")
        return _Resp(json.dumps(payload).encode("utf-8"))

    monkeypatch.setattr(wr.urllib.request, "urlopen", _flaky)
    status, detail = wr.export_workflow_liveness(repo="x/y", token="t", now=now, attempts=3)
    assert status is True  # recovered on the 3rd attempt
    assert state["n"] == 3


# ── C3 decision logic (liveness injected) ─────────────────────────────────────


def test_c3_local_mode_passes_validity_only(tmp_path):
    wiki = _make_wiki(tmp_path)
    ok, evidence = wr.c3_export_diag_canon_slugs_fresh(wiki, liveness_fn=lambda: (None, "no token"))
    assert ok is True
    assert "UNVERIFIED" in evidence


def test_c3_alive_passes(tmp_path):
    wiki = _make_wiki(tmp_path)
    ok, evidence = wr.c3_export_diag_canon_slugs_fresh(
        wiki, liveness_fn=lambda: (True, "last successful export run 0.4d ago")
    )
    assert ok is True
    assert "export workflow" in evidence


def test_c3_dead_fails(tmp_path):
    wiki = _make_wiki(tmp_path)
    ok, evidence = wr.c3_export_diag_canon_slugs_fresh(
        wiki, liveness_fn=lambda: (False, "last successful export run 18d ago — cron may be dead")
    )
    assert ok is False
    assert "liveness" in evidence


def test_c3_insufficient_slugs_fails_before_liveness(tmp_path):
    wiki = _make_wiki(tmp_path, n_slugs=3)
    # liveness would pass, but validity must fail first (and never call liveness).
    called = {"n": 0}

    def _liveness():
        called["n"] += 1
        return (True, "alive")

    ok, evidence = wr.c3_export_diag_canon_slugs_fresh(wiki, liveness_fn=_liveness)
    assert ok is False
    assert "distinct slugs" in evidence
    assert called["n"] == 0  # validity short-circuits before the network call


def test_c3_missing_files_fail(tmp_path):
    ok, evidence = wr.c3_export_diag_canon_slugs_fresh(tmp_path, liveness_fn=lambda: (True, "alive"))
    assert ok is False
    assert "missing" in evidence
