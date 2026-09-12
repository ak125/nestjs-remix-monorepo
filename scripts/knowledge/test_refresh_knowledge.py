#!/usr/bin/env python3
"""Tests for refresh-knowledge.py freshness, no-churn and staged-content isolation.

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
import os
import sys
import tempfile
import subprocess
from unittest.mock import patch
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


def test_full_refresh_preserves_date_and_repairs_retired_export() -> None:
    """Actual full refresh: no daily churn; an export-only change repairs the body."""
    mod = make_mod(['BarModule'])
    existing = existing_md(mod, OLD) + rk.build_auto_block(mod) + '\n\nHuman prose stays.\n'
    with tempfile.TemporaryDirectory(dir=APP_ROOT) as directory, patch.object(rk, 'MODULES_DIR', Path(directory)):
        doc = Path(directory) / 'foo.md'; doc.write_text(existing, encoding='utf-8')
        with contextlib.redirect_stdout(io.StringIO()):
            assert rk.process('refresh', [mod], headers_only=False) == (0, 0)
        assert doc.read_text(encoding='utf-8') == existing
        mod.exports = ['NewService']
        with contextlib.redirect_stdout(io.StringIO()):
            assert rk.process('refresh', [mod], headers_only=False) == (0, 1)
        fresh = doc.read_text(encoding='utf-8')
        assert '`NewService`' in fresh and '`FooService`' not in fresh.split('### Providers')[0]
        assert TODAY in fresh and 'Human prose stays.' in fresh
        with contextlib.redirect_stdout(io.StringIO()):
            assert rk.process('refresh', [mod], headers_only=False) == (0, 0)


def test_index_check_ignores_unstaged_edits_and_detects_deletion() -> None:
    """A working-tree repair cannot conceal a stale staged projection or be auto-staged."""
    # Hooks export repository-local GIT_* variables. -C alone does not override
    # those: clear them for the entire fixture, including the checker subprocesses.
    fixture_env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
    with patch.dict(os.environ, fixture_env, clear=True), tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        def git(*args):
            return subprocess.check_output(['git', '-C', directory, *args], stderr=subprocess.DEVNULL)
        git('init')
        module = root/'backend/src/modules/foo'; module.mkdir(parents=True)
        source = module/'foo.module.ts'
        source.write_text('@Module({exports: [OldService]}) export class FooModule {}')
        primary = module/'foo.service.ts'; primary.write_text('export class OldService {}')
        docs = root/'.claude/knowledge/modules'; docs.mkdir(parents=True)
        doc = docs/'foo.md'
        with patch.object(rk, 'APP_ROOT', root), patch.object(rk, 'MODULES_DIR', docs):
            def regenerate():
                mod = rk.analyze_module(module, source)
                if not doc.exists(): doc.write_text(rk.build_full_md(mod), encoding='utf-8')
                else: rk.process('refresh', [mod], headers_only=False)
            def check():
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    return rk.check_staged()
            regenerate()
            # Unrelated historical debt must not block a targeted commit.
            (docs/'unrelated.md').write_text('stale unrelated projection', encoding='utf-8')
            git('add', '.'); git('-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','base')
            source.write_text('@Module({exports: [NewService]}) export class FooModule {}')
            git('add', str(source.relative_to(root)))
            regenerate()  # fixed in worktree, deliberately NOT staged
            index_before = (root/'.git/index').read_bytes(); doc_before = doc.read_bytes()
            assert check() == 1, 'stale staged export must fail despite unstaged repair'
            assert (root/'.git/index').read_bytes() == index_before and doc.read_bytes() == doc_before
            git('add', str(doc.relative_to(root)))
            assert check() == 0
            source.write_text('@Module({exports: [UnstagedService]}) export class FooModule {}')
            doc.write_text(doc.read_text(encoding='utf-8') + '\nUnstaged operator prose.\n', encoding='utf-8')
            index_before = (root/'.git/index').read_bytes(); doc_before = doc.read_bytes()
            assert check() == 0, 'only index content belongs to the candidate'
            assert (root/'.git/index').read_bytes() == index_before and doc.read_bytes() == doc_before
            source.write_text('@Module({exports: [NewService]}) export class FooModule {}')
            renamed = module/'renamed.service.ts'
            git('mv', str(primary.relative_to(root)), str(renamed.relative_to(root)))
            assert check() == 1, 'renamed primary file must invalidate staged paths'
            regenerate(); git('add', str(doc.relative_to(root)))
            assert check() == 0
            primary = renamed
            git('rm', '-f', str(primary.relative_to(root)))
            assert check() == 1, 'deleted primary file must invalidate staged documentation'
            regenerate(); git('add', str(doc.relative_to(root)))
            assert check() == 0
            git('rm', '-f', str(source.relative_to(root)))
            assert check() == 1, 'retained documentation for a removed module requires review'


def test_fixture_preserves_calling_repository_under_hook_environment() -> None:
    """A fixture run from a hook cannot commit to or stage into its caller."""
    clean_env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        def git(*args):
            return subprocess.check_output(['git', '-C', directory, *args], env=clean_env, stderr=subprocess.DEVNULL)
        git('init')
        (root/'sentinel').write_text('caller content', encoding='utf-8')
        git('add', '.')
        git('-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','caller')
        head = git('rev-parse','HEAD')
        index = (root/'.git/index').read_bytes()
        config = (root/'.git/config').read_bytes()
        hostile_env = dict(clean_env, GIT_DIR=str(root/'.git'), GIT_WORK_TREE=str(root),
                           GIT_INDEX_FILE=str(root/'.git/index'), GIT_PREFIX='',
                           GIT_COMMON_DIR=str(root/'.git'), GIT_OBJECT_DIRECTORY=str(root/'.git/objects'))
        with patch.dict(os.environ, hostile_env, clear=True):
            test_index_check_ignores_unstaged_edits_and_detects_deletion()
        assert git('rev-parse','HEAD') == head, 'fixture changed caller HEAD'
        assert (root/'.git/index').read_bytes() == index, 'fixture changed caller index'
        assert (root/'.git/config').read_bytes() == config, 'fixture changed caller config'
        assert (root/'sentinel').read_text(encoding='utf-8') == 'caller content'


def test_targeted_refresh_does_not_build_repo_map() -> None:
    """A single-module refresh cannot mutate unrelated registry projections."""
    with patch.object(sys, 'argv', ['refresh-knowledge.py', 'refresh', '--module', 'foo']), \
         patch.object(rk, 'detect_modules', return_value=[make_mod([])]), \
         patch.object(rk, 'process', return_value=(0, 0)), \
         patch.object(rk, '_maybe_refresh_repo_map') as rebuild:
        with contextlib.redirect_stdout(io.StringIO()): assert rk.main() == 0
        rebuild.assert_not_called()


def test_staged_cli_reports_skips_and_rejects_unsupported_entries() -> None:
    """Explicit skips and fail-closed paths preserve the real fixture index."""
    clean_env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
    with patch.dict(os.environ, clean_env, clear=True), tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        def git(*args, data=None):
            return subprocess.check_output(['git', '-C', directory, *args], input=data, stderr=subprocess.DEVNULL)
        git('init')
        docs = root/'.claude/knowledge/modules'
        with patch.object(rk, 'APP_ROOT', root), patch.object(rk, 'MODULES_DIR', docs):
            def check():
                output = io.StringIO()
                with patch.object(sys, 'argv', ['refresh-knowledge.py', 'refresh', '--check-staged']), \
                     contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                    code = rk.main()
                assert rk.APP_ROOT == root, 'temporary renderer root leaked after check'
                return code, output.getvalue()
            code, output = check()
            assert code == 0 and 'no affected modules' in output
            module = root/'backend/src/modules/foo'; module.mkdir(parents=True)
            source = module/'foo.module.ts'
            source.write_text('@Module({exports: [FooService]}) export class FooModule {}', encoding='utf-8')
            git('add', '.')
            code, output = check()
            assert code == 0 and 'SKIP foo' in output and 'bootstrap' in output
            docs.mkdir(parents=True)
            doc = docs/'foo.md'
            doc.write_text(rk.build_full_md(rk.analyze_module(module, source)), encoding='utf-8')
            git('add', '.')
            assert check()[0] == 0
            doc_name = doc.relative_to(root).as_posix()
            # A link may not be followed, even if its target would be a valid doc.
            oid = git('hash-object', '-w', '--stdin', data=b'missing-target').decode().strip()
            git('update-index', '--cacheinfo', f'120000,{oid},{doc_name}')
            index = (root/'.git/index').read_bytes(); content = doc.read_bytes()
            code, output = check()
            assert code == 1 and 'Unsupported staged entry' in output
            assert (root/'.git/index').read_bytes() == index and doc.read_bytes() == content
            # Unmerged index stages must fail explicitly as well.
            git('update-index', '--index-info', data=(f'0 {"0"*40}\t{doc_name}\n'
                f'100644 {oid} 1\t{doc_name}\n100644 {oid} 2\t{doc_name}\n100644 {oid} 3\t{doc_name}\n').encode())
            index = (root/'.git/index').read_bytes()
            code, output = check()
            assert code == 1 and 'Unsupported staged entry' in output
            assert (root/'.git/index').read_bytes() == index


def test_fallback_descriptor_selection_matches_staged_check() -> None:
    """Refresh and check select the same descriptor regardless of filesystem order."""
    clean_env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
    with patch.dict(os.environ, clean_env, clear=True), tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        subprocess.run(['git', '-C', directory, 'init', '-q'], check=True)
        modules = root/'backend/src/modules'; module = modules/'foo'; module.mkdir(parents=True)
        # Create in reverse lexical order: no descriptor matches the folder name.
        for name in ['Zeta', 'Alpha']:
            (module/f'{name.lower()}.module.ts').write_text(
                f'@Module({{exports: [{name}Service]}}) export class {name}Module {{}}', encoding='utf-8')
        docs = root/'.claude/knowledge/modules'
        with patch.object(rk, 'APP_ROOT', root), patch.object(rk, 'MODULES_DIR', docs), \
             patch.object(rk, 'BACKEND_MODULES_DIR', modules):
            # Directory iteration order is unspecified; exercise a valid reverse
            # order explicitly rather than relying on the host filesystem.
            with patch.object(Path, 'glob', return_value=iter([
                module/'zeta.module.ts', module/'alpha.module.ts'
            ])):
                detected = rk.detect_modules(only='foo')
            assert detected[0].module_file.name == 'alpha.module.ts', 'fallback selection depends on filesystem order'
            with contextlib.redirect_stdout(io.StringIO()):
                assert rk.process('bootstrap', detected, headers_only=False) == (1, 0)
            subprocess.run(['git', '-C', directory, 'add', '.'], check=True)
            with contextlib.redirect_stdout(io.StringIO()):
                assert rk.check_staged() == 0, 'generator and checker disagree on fallback descriptor'


ALL_TESTS = [
    test_case1_no_churn,
    test_case2_bump_on_change,
    test_default_path_still_bumps,
    test_process_only_writes_changed_modules,
    test_content_keys_stay_in_sync_with_build_frontmatter,
    test_full_refresh_preserves_date_and_repairs_retired_export,
    test_index_check_ignores_unstaged_edits_and_detects_deletion,
    test_fixture_preserves_calling_repository_under_hook_environment,
    test_targeted_refresh_does_not_build_repo_map,
    test_staged_cli_reports_skips_and_rejects_unsupported_entries,
    test_fallback_descriptor_selection_matches_staged_check,
]


def run() -> None:
    for t in ALL_TESTS:
        t()
    print(f"OK — {len(ALL_TESTS)} tests passed "
          "(no-churn, full-refresh, staged isolation, rename/deletion, targeted scope)")


if __name__ == "__main__":
    run()
