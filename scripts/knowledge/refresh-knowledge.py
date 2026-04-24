#!/usr/bin/env python3
"""Refresh .claude/knowledge/ files from the codebase.

Modes
-----
    bootstrap              Create missing .md files, never overwrite human edits.
    refresh                Rewrite only the `<!-- AUTO-GENERATED -->` block in
                           existing .md files. Idempotent.
    --headers-only         Update the YAML frontmatter only. Fast; designed for
                           the pre-commit hook.
    --module NAME          Limit to a single module.

Non-goals
---------
    * No deletion of .md files even if the underlying module disappears.
    * No touch to prose sections ("Rôle", "Pourquoi", "Gotchas", "Références")
      — those are human-owned.
    * No network, no LLM, no embeddings. pyyaml + stdlib only.
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Iterable

import yaml

APP_ROOT = Path(__file__).resolve().parents[2]
KNOWLEDGE_DIR = APP_ROOT / ".claude" / "knowledge"
MODULES_DIR = KNOWLEDGE_DIR / "modules"
BACKEND_MODULES_DIR = APP_ROOT / "backend" / "src" / "modules"

AUTO_GEN_BEGIN = "<!-- AUTO-GENERATED (refresh-knowledge.py — ne pas éditer sous cette ligne) -->"
AUTO_GEN_END = "<!-- END AUTO-GENERATED -->"

MODULE_CLASS_RE = re.compile(r"class\s+(\w+Module)\b")
IMPORTS_ARRAY_RE = re.compile(r"imports\s*:\s*\[([^\]]*)\]", re.DOTALL)
EXPORTS_ARRAY_RE = re.compile(r"exports\s*:\s*\[([^\]]*)\]", re.DOTALL)
PROVIDERS_ARRAY_RE = re.compile(r"providers\s*:\s*\[([^\]]*)\]", re.DOTALL)
CLASS_ID_RE = re.compile(r"\b([A-Z][A-Za-z0-9_]*)\b")

# JS/TS comment strippers — apply to source before regex extraction so that
# words inside // or /* */ don't leak into the detected identifiers list.
LINE_COMMENT_RE = re.compile(r"//[^\n]*")
BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)

# Heuristic suffix filter: NestJS providers/exports/imports almost always end
# with one of these. Words without a recognised suffix are likely comment
# fragments, not real class identifiers. Keeps `Module` for imports matching,
# and domain suffixes for providers/exports.
NEST_CLASS_SUFFIXES = (
    "Module",
    "Service",
    "Controller",
    "Repository",
    "Guard",
    "Interceptor",
    "Pipe",
    "Filter",
    "Strategy",
    "Provider",
    "Gateway",
    "Middleware",
    "Factory",
    "Handler",
    "Resolver",
)


def _strip_comments(src: str) -> str:
    return BLOCK_COMMENT_RE.sub("", LINE_COMMENT_RE.sub("", src))


def _looks_like_nest_class(ident: str) -> bool:
    return ident.endswith(NEST_CLASS_SUFFIXES)


@dataclass
class ModuleInfo:
    name: str
    module_file: Path
    primary_files: list[Path] = field(default_factory=list)
    exports: list[str] = field(default_factory=list)
    providers: list[str] = field(default_factory=list)
    depends_on: list[str] = field(default_factory=list)


def detect_modules(only: str | None = None) -> list[ModuleInfo]:
    if not BACKEND_MODULES_DIR.exists():
        return []
    modules: list[ModuleInfo] = []
    for mod_dir in sorted(BACKEND_MODULES_DIR.iterdir()):
        if not mod_dir.is_dir():
            continue
        if only and mod_dir.name != only:
            continue
        module_file = mod_dir / f"{mod_dir.name}.module.ts"
        if not module_file.exists():
            # some folders use a different naming convention
            candidates = list(mod_dir.glob("*.module.ts"))
            if not candidates:
                continue
            module_file = candidates[0]
        modules.append(analyze_module(mod_dir, module_file))
    return modules


def analyze_module(mod_dir: Path, module_file: Path) -> ModuleInfo:
    raw = module_file.read_text(encoding="utf-8", errors="replace")
    # Strip comments before regex-matching @Module arrays — otherwise fragments
    # like `// SAFE changes`, `// Data services`, `/* Callback Gate */` leak
    # into the detected identifiers list and pollute the knowledge .md.
    content = _strip_comments(raw)

    imports_match = IMPORTS_ARRAY_RE.search(content)
    exports_match = EXPORTS_ARRAY_RE.search(content)
    providers_match = PROVIDERS_ARRAY_RE.search(content)

    this_module_class_names = {m.group(1) for m in MODULE_CLASS_RE.finditer(content)}

    depends_on: list[str] = []
    if imports_match:
        for ident in CLASS_ID_RE.findall(imports_match.group(1)):
            if ident.endswith("Module") and ident not in this_module_class_names:
                if ident not in depends_on:
                    depends_on.append(ident)

    exports: list[str] = []
    if exports_match:
        for ident in CLASS_ID_RE.findall(exports_match.group(1)):
            if _looks_like_nest_class(ident) and ident not in exports:
                exports.append(ident)

    providers: list[str] = []
    if providers_match:
        for ident in CLASS_ID_RE.findall(providers_match.group(1)):
            if _looks_like_nest_class(ident) and ident not in providers:
                providers.append(ident)

    primary_files = sorted(
        p for p in mod_dir.rglob("*.ts")
        if not p.name.endswith(".spec.ts")
        and not p.name.endswith(".e2e-spec.ts")
        and not p.name.endswith(".d.ts")
    )[:8]

    return ModuleInfo(
        name=mod_dir.name,
        module_file=module_file,
        primary_files=primary_files,
        exports=exports,
        providers=providers,
        depends_on=depends_on,
    )


def _rel(p: Path) -> str:
    return str(p.relative_to(APP_ROOT))


def build_frontmatter(mod: ModuleInfo) -> str:
    fm: dict = {
        "module": mod.name,
        "sources": [_rel(mod.module_file.parent)],
        "last_scan": str(date.today()),
        "primary_files": [_rel(p) for p in mod.primary_files],
        "depends_on": mod.depends_on,
    }
    return yaml.safe_dump(fm, default_flow_style=False, allow_unicode=True, sort_keys=False).strip()


def build_auto_block(mod: ModuleInfo) -> str:
    exports_list = "\n".join(f"- `{e}`" for e in mod.exports) or "- _(aucun export dans le `@Module({exports: [...]})`)_"
    providers_list = "\n".join(f"- `{p}`" for p in mod.providers[:15]) or "- _(aucun provider détecté)_"
    files_list = "\n".join(f"- [{_rel(p)}](../../../{_rel(p)})" for p in mod.primary_files)

    return f"""{AUTO_GEN_BEGIN}

### Exports publics du module
{exports_list}

### Providers (top 15)
{providers_list}

### Fichiers primaires
{files_list}

{AUTO_GEN_END}"""


def build_full_md(mod: ModuleInfo) -> str:
    title = mod.name.replace("-", " ").title()
    return f"""---
{build_frontmatter(mod)}
---

# Module {title}

## Rôle
<!-- À compléter à la main : 1–3 phrases sur ce que fait ce module, pourquoi il existe. -->
_Section à rédiger._

{build_auto_block(mod)}

## Pourquoi
<!-- À compléter à la main : contraintes architecturales, décisions historiques, trade-offs. -->
_Section à rédiger._

## Gotchas
<!-- À compléter à la main : pièges connus, bugs célèbres, invariants non évidents. -->
_Section à rédiger._

## Références
<!-- À compléter à la main : liens vers `.claude/rules/`, vault ADRs, MEMORY.md entries. -->
_Section à rédiger._
"""


def replace_auto_block(existing: str, mod: ModuleInfo) -> str:
    new_block = build_auto_block(mod)
    pattern = re.compile(
        rf"{re.escape(AUTO_GEN_BEGIN)}.*?{re.escape(AUTO_GEN_END)}",
        re.DOTALL,
    )
    if pattern.search(existing):
        return pattern.sub(new_block, existing, count=1)
    # delimiters missing: append block at end (conservative — no prose overwrite)
    return existing.rstrip() + "\n\n" + new_block + "\n"


def replace_frontmatter(existing: str, mod: ModuleInfo) -> str:
    new_fm = f"---\n{build_frontmatter(mod)}\n---\n"
    if existing.startswith("---\n"):
        return re.sub(r"^---\n.*?\n---\n", new_fm, existing, count=1, flags=re.DOTALL)
    return new_fm + existing


def process(mode: str, mods: Iterable[ModuleInfo], headers_only: bool) -> tuple[int, int]:
    MODULES_DIR.mkdir(parents=True, exist_ok=True)
    created = updated = 0
    for mod in mods:
        md_path = MODULES_DIR / f"{mod.name}.md"
        if not md_path.exists():
            if mode == "bootstrap":
                md_path.write_text(build_full_md(mod), encoding="utf-8")
                print(f"CREATED  {_rel(md_path)}")
                created += 1
            else:
                print(f"SKIP     {mod.name} (no .md, use `bootstrap` mode to create)")
            continue
        existing = md_path.read_text(encoding="utf-8")
        new = replace_frontmatter(existing, mod) if headers_only else replace_auto_block(existing, mod)
        if headers_only is False and not headers_only:
            # Always refresh frontmatter too in non-headers-only modes (keeps last_scan current)
            new = replace_frontmatter(new, mod)
        if new != existing:
            md_path.write_text(new, encoding="utf-8")
            print(f"UPDATED  {_rel(md_path)}")
            updated += 1
    return created, updated


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["bootstrap", "refresh"], help="bootstrap: create missing. refresh: only update AUTO blocks.")
    ap.add_argument("--module", help="Limit to one module name (directory name under backend/src/modules).")
    ap.add_argument("--headers-only", action="store_true", help="Only refresh the YAML frontmatter. Fast path for pre-commit.")
    args = ap.parse_args()

    modules = detect_modules(only=args.module)
    if not modules:
        print("No modules found under backend/src/modules/.", file=sys.stderr)
        return 1

    created, updated = process(args.mode, modules, headers_only=args.headers_only)
    print(f"Done. {len(modules)} modules scanned, {created} created, {updated} updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
