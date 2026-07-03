#!/usr/bin/env python3
"""Tests for refresh-knowledge.py `--headers-only` last_scan preservation.

Run:  python3 scripts/knowledge/test_refresh_knowledge.py
Exit 0 = all pass. Stdlib + pyyaml only (same deps as the script under test).

Guards the fix for the daily 49-module churn: `--headers-only` must preserve
`last_scan` when a module's derived content is unchanged, and bump it to today
only when the content actually changed.
"""
from __future__ import annotations

import importlib.util
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP_ROOT = HERE.parents[1]

_spec = importlib.util.spec_from_file_location("refresh_knowledge", HERE / "refresh-knowledge.py")
rk = importlib.util.module_from_spec(_spec)
sys.modules["refresh_knowledge"] = rk  # let @dataclass resolve cls.__module__ during exec
_spec.loader.exec_module(rk)

TODAY = str(date.today())
OLD = "2020-01-01"
assert OLD != TODAY, "sanity: fixed OLD date must differ from today"


def make_mod(depends_on: list[str]) -> "rk.ModuleInfo":
    mod_dir = APP_ROOT / "backend" / "src" / "modules" / "foo"
    return rk.ModuleInfo(
        name="foo",
        module_file=mod_dir / "foo.module.ts",
        primary_files=[mod_dir / "foo.service.ts"],
        exports=["FooService"],
        providers=["FooService"],
        depends_on=list(depends_on),
    )


def existing_md(mod: "rk.ModuleInfo", last_scan: str) -> str:
    return f"---\n{rk.build_frontmatter(mod, last_scan=last_scan)}\n---\n\n# Module Foo\n\n## Rôle\n_x_\n"


def run() -> None:
    mod = make_mod(["BarModule"])

    # Case 1 — derived content unchanged → last_scan preserved, file byte-identical
    # (no calendar-day churn). This is the core regression the fix removes.
    existing = existing_md(mod, OLD)
    out1 = rk.replace_frontmatter(existing, mod, preserve_unchanged=True)
    assert f"last_scan: '{OLD}'" in out1, f"Case 1: last_scan not preserved:\n{out1}"
    assert TODAY not in out1, "Case 1: today leaked in despite unchanged content"
    assert out1 == existing, "Case 1: unchanged module was rewritten (would churn)"

    # Case 2 — derived content changed (depends_on) → last_scan bumps to today.
    stale = existing_md(make_mod(["OldModule"]), OLD)              # .md derived from old code
    out2 = rk.replace_frontmatter(stale, mod, preserve_unchanged=True)  # mod now depends on BarModule
    assert f"last_scan: '{TODAY}'" in out2, f"Case 2: last_scan not bumped:\n{out2}"
    assert "BarModule" in out2 and "OldModule" not in out2, "Case 2: depends_on not refreshed"

    # Case 3 — isolation: an unchanged module is not rewritten, so process() writes
    # ONLY the modules whose content changed (Case 1 = no-op, Case 2 = diff).
    assert rk.replace_frontmatter(existing, mod, preserve_unchanged=True) == existing

    # Guard — default (non-headers-only) path is unchanged: always bumps to today.
    out_default = rk.replace_frontmatter(existing, mod)  # preserve_unchanged=False
    assert f"last_scan: '{TODAY}'" in out_default, "Default path must still bump to today"

    print("OK — Case 1 (no-churn), Case 2 (bump-on-change), Case 3 (isolation), default unchanged")


if __name__ == "__main__":
    run()
