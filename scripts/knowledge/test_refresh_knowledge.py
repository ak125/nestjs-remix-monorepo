#!/usr/bin/env python3
"""Tests for refresh-knowledge.py `--headers-only` last_scan preservation.

Run:  python3 scripts/knowledge/test_refresh_knowledge.py
Exit 0 = all pass. Stdlib + pyyaml only (same deps as the script under test).
Wired into `.husky/pre-commit`: it runs (and must pass) whenever a
`scripts/knowledge/*.py` file is staged, so the daily-churn regression cannot
silently return.

Guards the fix for the daily 49-module churn: `--headers-only` must preserve
`last_scan` when a module's derived content is unchanged, and bump it to today
only when the content actually changed. Coverage:
  - unit: replace_frontmatter preserve/bump/default paths (pure function)
  - integration: process() writes ONLY the modules whose content changed (disk)
  - drift guard: _CONTENT_KEYS stays in sync with build_frontmatter's emitted set
    (else a future added field would silently stop bumping last_scan)
"""
from __future__ import annotations

import contextlib
import importlib.util
import io
import sys
import tempfile
from datetime import date
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
APP_ROOT = HERE.parents[1]

_spec = importlib.util.spec_from_file_location("refresh_knowledge", HERE / "refresh-knowledge.py")
rk = importlib.util.module_from_spec(_spec)
sys.modules["refresh_knowledge"] = rk  # let @dataclass resolve cls.__module__ during exec
_spec.loader.exec_module(rk)

TODAY = str(date.today())
OLD = "2020-01-01"
assert OLD != TODAY, "sanity: fixed OLD date must differ from today"


def make_mod(depends_on: list[str], name: str = "foo") -> "rk.ModuleInfo":
    mod_dir = APP_ROOT / "backend" / "src" / "modules" / name
    return rk.ModuleInfo(
        name=name,
        module_file=mod_dir / f"{name}.module.ts",
        primary_files=[mod_dir / f"{name}.service.ts"],
        exports=[f"{name.capitalize()}Service"],
        providers=[f"{name.capitalize()}Service"],
        depends_on=list(depends_on),
    )


def existing_md(mod: "rk.ModuleInfo", last_scan: str) -> str:
    return f"---\n{rk.build_frontmatter(mod, last_scan=last_scan)}\n---\n\n# Module {mod.name}\n\n## Rôle\n_x_\n"


# ── Unit: pure-function last_scan logic ──────────────────────────────────────

def test_case1_no_churn() -> None:
    """Derived content unchanged → last_scan preserved, file byte-identical."""
    mod = make_mod(["BarModule"])
    existing = existing_md(mod, OLD)
    out = rk.replace_frontmatter(existing, mod, preserve_unchanged=True)
    assert f"last_scan: '{OLD}'" in out, f"last_scan not preserved:\n{out}"
    assert TODAY not in out, "today leaked in despite unchanged content"
    assert out == existing, "unchanged module was rewritten (would churn)"


def test_case2_bump_on_change() -> None:
    """Derived content changed (depends_on) → last_scan bumps to today."""
    mod = make_mod(["BarModule"])
    stale = existing_md(make_mod(["OldModule"]), OLD)  # .md derived from old code
    out = rk.replace_frontmatter(stale, mod, preserve_unchanged=True)
    assert f"last_scan: '{TODAY}'" in out, f"last_scan not bumped:\n{out}"
    assert "BarModule" in out and "OldModule" not in out, "depends_on not refreshed"


def test_default_path_still_bumps() -> None:
    """Non-headers-only (full refresh) path is unchanged: always bumps to today."""
    mod = make_mod(["BarModule"])
    out = rk.replace_frontmatter(existing_md(mod, OLD), mod)  # preserve_unchanged=False
    assert f"last_scan: '{TODAY}'" in out, "default path must still bump to today"


# ── Integration: process() writes ONLY changed modules (the real Case 3) ─────

def test_process_only_writes_changed_modules() -> None:
    """End-to-end on disk: an unchanged module is left byte-identical (no write,
    last_scan preserved); a module whose derived content changed is rewritten
    with last_scan bumped. Exercises process()'s `new != existing` write gate —
    the actual decision the churn fix targets, not just the pure function."""
    orig_dir = rk.MODULES_DIR
    try:
        # Under APP_ROOT so process()'s `_rel(md_path)` print resolves (it requires
        # paths to be inside the repo root); auto-removed on context exit.
        with tempfile.TemporaryDirectory(dir=APP_ROOT) as td:
            tdp = Path(td)
            rk.MODULES_DIR = tdp

            alpha = make_mod(["Dep"], name="alpha")            # content unchanged
            beta_now = make_mod(["NewDep"], name="beta")       # ModuleInfo after a code change
            beta_old = make_mod(["OldDep"], name="beta")       # what beta.md was derived from

            (tdp / "alpha.md").write_text(existing_md(alpha, OLD), encoding="utf-8")
            (tdp / "beta.md").write_text(existing_md(beta_old, OLD), encoding="utf-8")
            alpha_before = (tdp / "alpha.md").read_bytes()

            with contextlib.redirect_stdout(io.StringIO()):  # mute process()'s per-file prints
                created, updated = rk.process("refresh", [alpha, beta_now], headers_only=True)

            assert created == 0, f"no module should be created, got {created}"
            assert updated == 1, f"only the changed module should be written, got updated={updated}"

            # unchanged module: not rewritten, last_scan preserved (no churn)
            assert (tdp / "alpha.md").read_bytes() == alpha_before, "unchanged module was rewritten (churn)"
            assert f"last_scan: '{OLD}'" in (tdp / "alpha.md").read_text(encoding="utf-8")

            # changed module: last_scan bumped + depends_on refreshed
            beta_txt = (tdp / "beta.md").read_text(encoding="utf-8")
            assert f"last_scan: '{TODAY}'" in beta_txt, "changed module last_scan not bumped"
            assert "NewDep" in beta_txt and "OldDep" not in beta_txt, "changed module depends_on not refreshed"
    finally:
        rk.MODULES_DIR = orig_dir


# ── Drift guard: keep the freshness-vs-content split honest ──────────────────

def test_content_keys_stay_in_sync_with_build_frontmatter() -> None:
    """`_CONTENT_KEYS` (the fields whose change forces a last_scan bump) must equal
    exactly the set build_frontmatter emits, minus the `last_scan` freshness marker.
    Without this, a future derived field added to build_frontmatter but not to
    _CONTENT_KEYS would SILENTLY stop bumping last_scan when it changes — the
    no-silent-fallback class the repo forbids. This turns that trap into a loud
    failure. Also checks values, catching list()-vs-raw / comprehension drift
    between _content_fields and build_frontmatter."""
    mod = make_mod(["BarModule"])
    emitted = yaml.safe_load(rk.build_frontmatter(mod))
    assert set(emitted) - {"last_scan"} == set(rk._CONTENT_KEYS), (
        f"_CONTENT_KEYS drifted from build_frontmatter keys: "
        f"emitted={sorted(emitted)} _CONTENT_KEYS={sorted(rk._CONTENT_KEYS)}"
    )
    emitted.pop("last_scan", None)
    assert rk._content_fields(mod) == emitted, (
        f"_content_fields diverged from build_frontmatter values: "
        f"{rk._content_fields(mod)} != {emitted}"
    )


ALL_TESTS = [
    test_case1_no_churn,
    test_case2_bump_on_change,
    test_default_path_still_bumps,
    test_process_only_writes_changed_modules,
    test_content_keys_stay_in_sync_with_build_frontmatter,
]


def run() -> None:
    for t in ALL_TESTS:
        t()
    print(f"OK — {len(ALL_TESTS)} tests passed "
          "(no-churn, bump-on-change, default-path, process-isolation, content-keys-sync)")


if __name__ == "__main__":
    run()
