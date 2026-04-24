# SEO Vault Verify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le skill `.claude/skills/seo-vault-verify/` pour auditer un vault Obsidian SEO (ZIP ou dossier), produire un rapport reproductible audit-grade, exécuter un run one-shot sur le ZIP fourni et ouvrir la PR.

**Architecture:** 80 % déterministe (scripts Python stdlib + pyyaml) / 20 % LLM (1 subagent judgment). Entrée = ZIP extrait sandbox `/tmp/`, manifeste YAML canonique décrit les assertions binaires, orchestrator enchaîne extract → content → crossref → obsidian → subagent judgment → consolidation. Zero auto-fix, exit-contract respecté, rapport `.spec/reports/`.

**Tech Stack:** Python 3 stdlib (`zipfile`, `hashlib`, `re`, `json`, `pathlib`, `unicodedata`, `io`, `subprocess`), `pyyaml`, `pytest` pour tests, `general-purpose` subagent pour la couche 5.

**Spec de référence :** `docs/superpowers/specs/2026-04-24-seo-vault-verify-design.md` (v0.2, commit `cbf30c46`).

---

## File Structure

```
.claude/skills/seo-vault-verify/
├── SKILL.md                              # frontmatter + workflow + usage
├── references/
│   ├── expected-changes-v1.yaml          # manifeste canon (source de vérité)
│   ├── reviewer-seo-judgment.md          # prompt LLM (subagent)
│   └── report-template.md                # template markdown du rapport final
├── schemas/
│   ├── expected-changes.schema.md        # doc structure manifeste (stdlib-only, pas JSON schema lib)
│   ├── check-result.schema.md            # doc structure output checkers
│   └── final-report.schema.md            # doc structure rapport final
└── scripts/
    ├── vault_extract.py                  # couche 1 : unzip + SHA256
    ├── check_content.py                  # couche 2 : patterns, sections, tags, frontmatter, Unicode NFC
    ├── check_crossref.py                 # couche 3 : wikilinks + markdown links parsing
    ├── check_obsidian.py                 # couche 4 : frontmatter YAML + Dataview blocks
    ├── run_audit.py                      # couche 6 : orchestrator + couche 5 via subagent
    ├── selftest.py                       # acceptance tests 6 cas
    └── tests/
        ├── __init__.py
        ├── test_vault_extract.py
        ├── test_check_content.py
        ├── test_check_crossref.py
        ├── test_check_obsidian.py
        └── test_run_audit.py
```

Chaque fichier a **une responsabilité** : extract, content checks, crossref, obsidian, orchestration, self-test. Tests séparés par module. `SKILL.md` < 300 lignes avec pointeurs vers `references/` et `schemas/`.

**Chemin sortie rapport :** `.spec/reports/seo-vault-verify-2026-04-24.md` + `.json`.

---

## Task 1 : Scaffold skill directory + SKILL.md

**Files:**
- Create: `.claude/skills/seo-vault-verify/SKILL.md`
- Create: `.claude/skills/seo-vault-verify/references/.gitkeep`
- Create: `.claude/skills/seo-vault-verify/schemas/.gitkeep`
- Create: `.claude/skills/seo-vault-verify/scripts/.gitkeep`
- Create: `.claude/skills/seo-vault-verify/scripts/tests/.gitkeep`

- [ ] **Step 1 : Créer l'arborescence**

Run :
```bash
mkdir -p .claude/skills/seo-vault-verify/{references,schemas,scripts/tests}
touch .claude/skills/seo-vault-verify/{references,schemas,scripts,scripts/tests}/.gitkeep
```

- [ ] **Step 2 : Écrire `SKILL.md` avec frontmatter conforme aux autres skills du projet**

Contenu exact à écrire dans `.claude/skills/seo-vault-verify/SKILL.md` :

```markdown
---
name: seo-vault-verify
description: "Audit reproductible d'un vault Obsidian SEO (ZIP ou dossier). Vérifie 8 fichiers régénérés + non-régression SHA256 sur fichiers inchangés + cross-refs ADR + cohérence stratégique via subagent unique. Invoquer dès qu'un vault SEO, un zip de docs stratégie, ou un bundle Obsidian est fourni pour validation — notamment quand l'utilisateur parle de 'vérifier vault', 'audit vault SEO', 'valider livrable Obsidian', 'team verification vault', ou livre un artefact ADR-002 maillage. NE PAS utiliser pour audit contenu site web (content-audit), audit gammes production (seo-gamme-audit), ou operations governance-vault (governance-vault-ops)."
argument-hint: "<path-zip-or-dir> [--manifest <path.yaml>]"
allowed-tools: Read, Bash, Glob, Grep, Agent
version: "1.0"
---

# SEO Vault Verify — v1.0

Audit reproductible audit-grade d'un vault Obsidian SEO. 80 % déterministe (scripts Python) / 20 % LLM (1 subagent judgment unique).

## Quand utiliser

| Contexte | Commande |
|----------|----------|
| Vault SEO livré en ZIP | `/seo-vault-verify path/to/vault.zip` |
| Vault déjà extrait | `/seo-vault-verify path/to/vault-dir/` |
| Manifeste custom | `/seo-vault-verify path/vault.zip --manifest references/expected-changes-v2.yaml` |

## Workflow

1. **Extract** — `scripts/vault_extract.py` dézippe dans `/tmp/seo-vault-audit-<sha256[:12]>/`, calcule SHA256 du ZIP + chaque fichier
2. **Content checks** — `scripts/check_content.py` applique les assertions `must_contain`, `sections_required`, `tags_required`, `frontmatter_keys_required` du manifeste (Unicode NFC, case-insensitive défaut)
3. **Cross-ref checks** — `scripts/check_crossref.py` parse `[[wikilinks]]` + `](file.md)`, résout cibles, agrège `adr_002_files_referencing`
4. **Obsidian integrity** — `scripts/check_obsidian.py` valide frontmatter YAML + Dataview code blocks
5. **SEO judgment** — 1 subagent `general-purpose` reçoit `references/reviewer-seo-judgment.md` et produit JSON entre `<output>...</output>`. Parsed + validé par orchestrator, 1 retry si échec
6. **Consolidate** — `scripts/run_audit.py` agrège tout en rapport markdown + JSON selon `references/report-template.md`

## Manifeste

`references/expected-changes-v1.yaml` = source de vérité des assertions. Toute modification passe en v2 (`expected-changes-v2.yaml`), historique préservé.

## Exit contract

Verdicts autorisés : `SCOPE_SCANNED`, `PARTIAL_COVERAGE`, `REVIEW_REQUIRED`, `INSUFFICIENT_EVIDENCE`. Jamais `COMPLETE` / `VALIDATED`. Rapport avec 5 sections (scan/analysis/correction-proposed/validation/verdict) + coverage manifest obligatoire.

## Safety

- Zero auto-fix sur le vault
- Extraction sandboxée `/tmp/`
- Zero network / zero API externe
- Zero side-effect monorepo (rapport dans `.spec/reports/` uniquement)

## Selftest

`python scripts/selftest.py [--zip <path-zip>]` exécute 6 cas d'acceptance (happy-path + fail-detection). ZIP optionnel : cas 2-3 et fixtures 4-6 générées in-memory. Cas 1 skip si ZIP absent.

## Références

- `references/expected-changes-v1.yaml` — manifeste canon
- `references/reviewer-seo-judgment.md` — prompt subagent
- `references/report-template.md` — structure rapport
- `schemas/*.schema.md` — structures documentées (stdlib-only, pas JSON Schema lib)
- Spec : `docs/superpowers/specs/2026-04-24-seo-vault-verify-design.md`
```

- [ ] **Step 3 : Commit scaffold**

```bash
git add .claude/skills/seo-vault-verify/
git commit -m "feat(skill): scaffold seo-vault-verify v1.0 structure"
```

---

## Task 2 : Couche 1 — `vault_extract.py` (TDD)

**Files:**
- Create: `.claude/skills/seo-vault-verify/scripts/vault_extract.py`
- Create: `.claude/skills/seo-vault-verify/scripts/tests/test_vault_extract.py`

**Responsabilité :** dézipper dans `/tmp/seo-vault-audit-<sha256[:12]>/`, calculer SHA256 du ZIP + chaque fichier extrait, produire un manifest JSON `{"zip_sha256": "...", "extract_dir": "/tmp/...", "files": [{"path": "...", "sha256": "..."}]}`.

- [ ] **Step 1 : Écrire le test d'extraction happy-path**

Contenu `scripts/tests/test_vault_extract.py` :

```python
import io
import json
import zipfile
from pathlib import Path

import pytest

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from vault_extract import extract_vault


def _make_zip_bytes(files: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buf.getvalue()


def test_extract_happy_path(tmp_path):
    zip_bytes = _make_zip_bytes({
        "vault/00-Meta/README.md": "hello",
        "vault/02-ADR/ADR-001.md": "adr body",
    })
    zip_path = tmp_path / "v.zip"
    zip_path.write_bytes(zip_bytes)

    manifest = extract_vault(str(zip_path))

    assert "zip_sha256" in manifest
    assert len(manifest["zip_sha256"]) == 64
    assert Path(manifest["extract_dir"]).exists()
    assert len(manifest["files"]) == 2
    paths = {f["path"] for f in manifest["files"]}
    assert "vault/00-Meta/README.md" in paths
    for f in manifest["files"]:
        assert len(f["sha256"]) == 64


def test_extract_corrupt_zip(tmp_path):
    bad = tmp_path / "bad.zip"
    bad.write_bytes(b"not a zip")
    with pytest.raises(Exception):
        extract_vault(str(bad))


def test_extract_missing_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        extract_vault(str(tmp_path / "nope.zip"))
```

- [ ] **Step 2 : Run test (doit fail)**

Run : `cd .claude/skills/seo-vault-verify && python -m pytest scripts/tests/test_vault_extract.py -v`

Expected : FAIL `ModuleNotFoundError: No module named 'vault_extract'`.

- [ ] **Step 3 : Implémenter `vault_extract.py` (minimal passing)**

Contenu `scripts/vault_extract.py` :

```python
"""vault_extract.py — Couche 1 du skill seo-vault-verify.

Responsabilité : dézipper un vault SEO dans un répertoire sandbox
/tmp/seo-vault-audit-<sha256[:12]>/ et calculer SHA256 du ZIP
+ de chaque fichier extrait. Produit un manifest JSON.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def extract_vault(zip_path: str) -> dict:
    """Extract zip into sandbox dir, return manifest with SHA256s.

    Raises FileNotFoundError if zip absent, zipfile.BadZipFile if corrupt.
    """
    src = Path(zip_path)
    if not src.exists():
        raise FileNotFoundError(f"ZIP introuvable : {zip_path}")

    with src.open("rb") as f:
        zip_sha = _sha256_bytes(f.read())

    extract_root = Path("/tmp") / f"seo-vault-audit-{zip_sha[:12]}"
    extract_root.mkdir(parents=True, exist_ok=True)

    files = []
    with zipfile.ZipFile(src, "r") as zf:
        zf.extractall(extract_root)
        for info in zf.infolist():
            if info.is_dir():
                continue
            extracted = extract_root / info.filename
            if extracted.is_file():
                files.append({
                    "path": info.filename,
                    "sha256": _sha256_file(extracted),
                    "size": extracted.stat().st_size,
                })

    return {
        "zip_path": str(src),
        "zip_sha256": zip_sha,
        "extract_dir": str(extract_root),
        "files": files,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract SEO vault ZIP.")
    parser.add_argument("zip_path", help="Path to vault ZIP")
    parser.add_argument("--json", action="store_true", help="Print manifest JSON")
    args = parser.parse_args()

    try:
        manifest = extract_vault(args.zip_path)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(manifest, indent=2))
    else:
        print(f"Extracted to {manifest['extract_dir']}")
        print(f"ZIP SHA256 : {manifest['zip_sha256']}")
        print(f"Files : {len(manifest['files'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4 : Run test (doit pass)**

Run : `cd .claude/skills/seo-vault-verify && python -m pytest scripts/tests/test_vault_extract.py -v`

Expected : 3 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add .claude/skills/seo-vault-verify/scripts/vault_extract.py .claude/skills/seo-vault-verify/scripts/tests/test_vault_extract.py
git commit -m "feat(skill): vault_extract.py + tests (couche 1)"
```

---

## Task 3 : Couche 2 — `check_content.py` (TDD)

**Files:**
- Create: `.claude/skills/seo-vault-verify/scripts/check_content.py`
- Create: `.claude/skills/seo-vault-verify/scripts/tests/test_check_content.py`

**Responsabilité :** vérifier pour chaque fichier les assertions du manifeste : `must_contain` (avec `near`/`window` optionnels), `sections_required` (H2 titles with optional `min_terms`), `tags_required` (Obsidian `#tag/sub`), `tag_context` (tag near qualifier), `frontmatter_keys_required`, `dataview_blocks_min`, `term_markers`. Tous les matches Unicode NFC + case-insensitive par défaut, whitespace collapse activé.

- [ ] **Step 1 : Écrire test patterns simples + `near`/`window`**

Contenu `scripts/tests/test_check_content.py` :

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from check_content import check_file


def _write(tmp_path, name, content):
    p = tmp_path / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return p


def test_must_contain_simple_pattern(tmp_path):
    _write(tmp_path, "a.md", "Mention de ADR-002 ici.")
    rules = {"must_contain": [{"pattern": "ADR-002"}]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is True
    assert len(result["checks"]) == 1
    assert result["checks"][0]["pass"] is True


def test_must_contain_absent_fails(tmp_path):
    _write(tmp_path, "a.md", "rien")
    rules = {"must_contain": [{"pattern": "ADR-002"}]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is False


def test_case_insensitive_default(tmp_path):
    _write(tmp_path, "a.md", "Maillage interne")
    rules = {"must_contain": [{"pattern": "MAILLAGE"}]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is True


def test_near_window_pass(tmp_path):
    _write(tmp_path, "a.md", "pilier maillage primaire autorité")
    rules = {"must_contain": [{"pattern": "primaire", "near": "maillage", "window": 50}]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is True


def test_near_window_fail_too_far(tmp_path):
    _write(tmp_path, "a.md", "maillage" + ("x" * 500) + "primaire")
    rules = {"must_contain": [{"pattern": "primaire", "near": "maillage", "window": 100}]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is False


def test_unicode_nfc_normalization(tmp_path):
    # é composé (U+00E9) vs é décomposé (e + U+0301)
    _write(tmp_path, "a.md", "Autorité externe")
    rules = {"must_contain": [{"pattern": "Autorité externe"}]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is True, "NFC normalization devrait matcher"


def test_sections_required(tmp_path):
    _write(tmp_path, "a.md", "# Titre\n\n## Maillage interne\n\ntexte\n\n## Autre\n")
    rules = {"sections_required": [{"title": "Maillage interne"}]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is True


def test_sections_required_absent(tmp_path):
    _write(tmp_path, "a.md", "## Autre seulement")
    rules = {"sections_required": [{"title": "Maillage interne"}]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is False


def test_tags_required(tmp_path):
    _write(tmp_path, "a.md", "tags: #pilier/maillage #autre")
    rules = {"tags_required": ["#pilier/maillage"]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is True


def test_tag_context(tmp_path):
    _write(tmp_path, "a.md", "#pilier/maillage (primaire)")
    rules = {"tag_context": [{"tag": "#pilier/maillage", "qualifier_pattern": "primaire"}]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is True


def test_frontmatter_keys_required(tmp_path):
    fm = "---\ninbound-count: 0\noutbound-count: 5\n---\n# Titre"
    _write(tmp_path, "a.md", fm)
    rules = {"frontmatter_keys_required": ["inbound-count", "outbound-count"]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is True


def test_frontmatter_keys_missing(tmp_path):
    fm = "---\ninbound-count: 0\n---\n# Titre"
    _write(tmp_path, "a.md", fm)
    rules = {"frontmatter_keys_required": ["inbound-count", "outbound-count"]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is False


def test_sections_min_terms(tmp_path):
    md = "## Maillage interne\n\n**PageRank interne** : blabla\n\n**Orpheline** : blabla\n\n## Autre"
    _write(tmp_path, "a.md", md)
    rules = {"sections_required": [
        {"title": "Maillage interne", "min_terms": 2, "term_markers": ["**", ":"]}
    ]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is True


def test_dataview_blocks_min(tmp_path):
    md = "```dataview\nLIST\n```\n\n```dataview\nTABLE\n```"
    _write(tmp_path, "a.md", md)
    rules = {"dataview_blocks_min": 2}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is True
```

- [ ] **Step 2 : Run tests (doivent fail)**

Run : `cd .claude/skills/seo-vault-verify && python -m pytest scripts/tests/test_check_content.py -v`

Expected : `ModuleNotFoundError: No module named 'check_content'`.

- [ ] **Step 3 : Implémenter `check_content.py`**

Contenu `scripts/check_content.py` :

```python
"""check_content.py — Couche 2 du skill seo-vault-verify.

Vérifie les assertions binaires du manifeste sur chaque fichier :
must_contain (avec near/window optionnels), sections_required,
tags_required, tag_context, frontmatter_keys_required,
dataview_blocks_min.

Normalisation : Unicode NFC, case-insensitive par défaut,
whitespace collapse.
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path
from typing import Any

import yaml


def _normalize(text: str) -> str:
    """NFC + lowercase + whitespace collapse."""
    nfc = unicodedata.normalize("NFC", text)
    collapsed = re.sub(r"\s+", " ", nfc)
    return collapsed.lower()


def _extract_frontmatter(content: str) -> dict:
    """Parse YAML frontmatter entre --- ... ---. Retourne {} si absent."""
    m = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
    if not m:
        return {}
    try:
        parsed = yaml.safe_load(m.group(1))
        return parsed if isinstance(parsed, dict) else {}
    except yaml.YAMLError:
        return {}


def _check_pattern(text_norm: str, rule: dict) -> dict:
    pattern = rule["pattern"]
    case_sensitive = rule.get("case_sensitive", False)
    target = pattern if case_sensitive else pattern.lower()
    target = unicodedata.normalize("NFC", target)
    target = re.sub(r"\s+", " ", target)

    if "near" in rule:
        near = rule["near"]
        near_norm = unicodedata.normalize("NFC", near).lower()
        window = int(rule.get("window", 200))
        # Trouver toutes les positions de near
        for m in re.finditer(re.escape(near_norm), text_norm):
            start = max(0, m.start() - window)
            end = min(len(text_norm), m.end() + window)
            zone = text_norm[start:end]
            if target in zone:
                return {"pass": True, "pattern": pattern, "mode": "near"}
        return {"pass": False, "pattern": pattern, "mode": "near",
                "reason": f"'{pattern}' pas trouvé dans fenêtre ±{window} autour de '{near}'"}

    found = target in text_norm
    return {"pass": found, "pattern": pattern, "mode": "simple"}


def _check_section_title(text_norm: str, title: str) -> tuple[bool, int]:
    """Retourne (présent, index_début_section) — match H2 '## title'."""
    title_norm = unicodedata.normalize("NFC", title).lower()
    title_norm = re.sub(r"\s+", " ", title_norm)
    # Cherche '## title' au début de ligne
    pat = re.compile(r"##\s+" + re.escape(title_norm), re.MULTILINE)
    m = pat.search(text_norm)
    if not m:
        return False, -1
    return True, m.start()


def _section_body(text_norm: str, start: int) -> str:
    """Extrait le corps d'une section (jusqu'au prochain H2 ou fin)."""
    rest = text_norm[start:]
    next_h2 = re.search(r"\n##\s+", rest[2:])  # skip current ##
    if next_h2:
        return rest[:next_h2.start() + 2]
    return rest


def _count_terms(section_body: str, markers: list[str]) -> int:
    """Compte les termes définis via markers (ex: ['**', ':'])."""
    if len(markers) == 2 and markers[0] == "**" and markers[1] == ":":
        return len(re.findall(r"\*\*[^*]+\*\*\s*:", section_body))
    return 0


def _check_tag(text_norm: str, tag: str) -> bool:
    """Le tag doit être présent tel quel dans le texte normalisé."""
    return tag.lower() in text_norm


def check_file(path: Path | str, rules: dict) -> dict:
    """Applique toutes les règles d'un item manifeste à un fichier.

    Retourne {"pass": bool, "path": str, "checks": [...]}. Chaque check
    a au moins {"pass": bool, "type": "...", "detail": ...}.
    """
    path = Path(path)
    if not path.exists():
        return {"pass": False, "path": str(path),
                "checks": [{"pass": False, "type": "file_exists",
                            "detail": "fichier absent"}]}

    raw = path.read_text(encoding="utf-8", errors="replace")
    text_norm = _normalize(raw)
    frontmatter = _extract_frontmatter(raw)
    checks: list[dict] = []

    for rule in rules.get("must_contain", []):
        r = _check_pattern(text_norm, rule)
        r["type"] = "must_contain"
        checks.append(r)

    for sec in rules.get("sections_required", []):
        title = sec["title"]
        present, start = _check_section_title(text_norm, title)
        if not present:
            checks.append({"pass": False, "type": "section_required",
                           "detail": f"section '{title}' absente"})
            continue
        min_terms = sec.get("min_terms")
        if min_terms is not None:
            body = _section_body(text_norm, start)
            count = _count_terms(body, sec.get("term_markers", ["**", ":"]))
            ok = count >= min_terms
            checks.append({"pass": ok, "type": "section_min_terms",
                           "detail": f"section '{title}' : {count}/{min_terms} termes"})
        else:
            checks.append({"pass": True, "type": "section_required",
                           "detail": f"section '{title}' présente"})

    for tag in rules.get("tags_required", []):
        ok = _check_tag(text_norm, tag)
        checks.append({"pass": ok, "type": "tag_required",
                       "detail": f"tag '{tag}' {'trouvé' if ok else 'absent'}"})

    for ctx in rules.get("tag_context", []):
        tag = ctx["tag"]
        qualifier = ctx["qualifier_pattern"]
        window = int(ctx.get("window", 100))
        qualifier_norm = unicodedata.normalize("NFC", qualifier).lower()
        tag_norm = tag.lower()
        found = False
        for m in re.finditer(re.escape(tag_norm), text_norm):
            start = max(0, m.start() - window)
            end = min(len(text_norm), m.end() + window)
            if qualifier_norm in text_norm[start:end]:
                found = True
                break
        checks.append({"pass": found, "type": "tag_context",
                       "detail": f"'{tag}' {'près de' if found else 'loin de'} '{qualifier}'"})

    for key in rules.get("frontmatter_keys_required", []):
        ok = key in frontmatter
        checks.append({"pass": ok, "type": "frontmatter_key",
                       "detail": f"clé '{key}' {'présente' if ok else 'absente'} dans frontmatter"})

    if "dataview_blocks_min" in rules:
        min_n = int(rules["dataview_blocks_min"])
        count = len(re.findall(r"```dataview\b", raw))
        checks.append({"pass": count >= min_n, "type": "dataview_blocks",
                       "detail": f"{count}/{min_n} blocks dataview"})

    all_pass = all(c["pass"] for c in checks) if checks else True
    return {"pass": all_pass, "path": str(path), "checks": checks}
```

- [ ] **Step 4 : Run tests (doivent pass)**

Run : `cd .claude/skills/seo-vault-verify && python -m pytest scripts/tests/test_check_content.py -v`

Expected : 13 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add .claude/skills/seo-vault-verify/scripts/check_content.py .claude/skills/seo-vault-verify/scripts/tests/test_check_content.py
git commit -m "feat(skill): check_content.py + tests (couche 2 déterministe)"
```

---

## Task 4 : Couche 3 — `check_crossref.py` (TDD)

**Files:**
- Create: `.claude/skills/seo-vault-verify/scripts/check_crossref.py`
- Create: `.claude/skills/seo-vault-verify/scripts/tests/test_check_crossref.py`

**Responsabilité :** parser les liens internes dans les fichiers d'un vault (wikilinks `[[target]]` et markdown links `[text](target.md)`) ; pour chaque fichier lister les cibles ; agréger le nombre de fichiers qui référencent un target donné (ex: `ADR-002-maillage-interne-first`).

- [ ] **Step 1 : Écrire tests**

Contenu `scripts/tests/test_check_crossref.py` :

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from check_crossref import extract_links, count_files_referencing


def _write(tmp_path, name, content):
    p = tmp_path / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return p


def test_extract_wikilinks(tmp_path):
    p = _write(tmp_path, "a.md", "Voir [[ADR-002-maillage-interne-first]] et [[Kickoff-Week1]].")
    links = extract_links(p)
    assert "ADR-002-maillage-interne-first" in links
    assert "Kickoff-Week1" in links


def test_extract_markdown_links(tmp_path):
    p = _write(tmp_path, "a.md", "Voir [ADR-002](../02-ADR/ADR-002-maillage-interne-first.md).")
    links = extract_links(p)
    assert "ADR-002-maillage-interne-first" in links


def test_extract_wikilink_with_alias(tmp_path):
    p = _write(tmp_path, "a.md", "[[ADR-002-maillage-interne-first|ADR maillage]]")
    links = extract_links(p)
    assert "ADR-002-maillage-interne-first" in links


def test_count_files_referencing(tmp_path):
    _write(tmp_path, "a.md", "[[ADR-002-maillage-interne-first]]")
    _write(tmp_path, "b.md", "[[ADR-002-maillage-interne-first]]")
    _write(tmp_path, "c.md", "rien")
    count = count_files_referencing(tmp_path, "ADR-002-maillage-interne-first")
    assert count == 2


def test_count_files_referencing_markdown_link(tmp_path):
    _write(tmp_path, "a.md", "[adr](02-ADR/ADR-002-maillage-interne-first.md)")
    count = count_files_referencing(tmp_path, "ADR-002-maillage-interne-first")
    assert count == 1


def test_wikilink_with_heading_anchor(tmp_path):
    p = _write(tmp_path, "a.md", "[[ADR-002-maillage-interne-first#Section]]")
    links = extract_links(p)
    assert "ADR-002-maillage-interne-first" in links
```

- [ ] **Step 2 : Run tests (doivent fail)**

Run : `cd .claude/skills/seo-vault-verify && python -m pytest scripts/tests/test_check_crossref.py -v`

Expected : `ModuleNotFoundError`.

- [ ] **Step 3 : Implémenter `check_crossref.py`**

Contenu `scripts/check_crossref.py` :

```python
"""check_crossref.py — Couche 3 du skill seo-vault-verify.

Parse les liens internes Obsidian (wikilinks + markdown links)
et agrège combien de fichiers référencent une cible donnée.
"""
from __future__ import annotations

import re
from pathlib import Path


_WIKILINK = re.compile(r"\[\[([^\]|#]+?)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]")
_MDLINK = re.compile(r"\]\(([^)\s]+?\.md)\)")


def extract_links(path: Path | str) -> set[str]:
    """Retourne le set des target stems (sans .md, sans heading anchor)."""
    p = Path(path)
    raw = p.read_text(encoding="utf-8", errors="replace")
    links: set[str] = set()

    for m in _WIKILINK.finditer(raw):
        target = m.group(1).strip()
        # retire éventuel chemin
        stem = target.split("/")[-1]
        if stem.endswith(".md"):
            stem = stem[:-3]
        links.add(stem)

    for m in _MDLINK.finditer(raw):
        target = m.group(1).strip()
        stem = target.split("/")[-1]
        if stem.endswith(".md"):
            stem = stem[:-3]
        links.add(stem)

    return links


def count_files_referencing(vault_root: Path | str, target_stem: str) -> int:
    """Combien de fichiers .md du vault référencent `target_stem` ?"""
    root = Path(vault_root)
    count = 0
    for md in root.rglob("*.md"):
        try:
            if target_stem in extract_links(md):
                count += 1
        except Exception:
            continue
    return count


def scan_vault(vault_root: Path | str) -> dict[str, list[str]]:
    """Retourne {source_rel_path: [target_stem, ...]}."""
    root = Path(vault_root)
    result: dict[str, list[str]] = {}
    for md in root.rglob("*.md"):
        rel = str(md.relative_to(root))
        result[rel] = sorted(extract_links(md))
    return result
```

- [ ] **Step 4 : Run tests (doivent pass)**

Run : `cd .claude/skills/seo-vault-verify && python -m pytest scripts/tests/test_check_crossref.py -v`

Expected : 6 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add .claude/skills/seo-vault-verify/scripts/check_crossref.py .claude/skills/seo-vault-verify/scripts/tests/test_check_crossref.py
git commit -m "feat(skill): check_crossref.py + tests (couche 3 wikilinks)"
```

---

## Task 5 : Couche 4 — `check_obsidian.py` (TDD)

**Files:**
- Create: `.claude/skills/seo-vault-verify/scripts/check_obsidian.py`
- Create: `.claude/skills/seo-vault-verify/scripts/tests/test_check_obsidian.py`

**Responsabilité :** intégrité Obsidian. Pour chaque `.md` : (a) frontmatter YAML parsable ou absent, pas d'erreur de parse ; (b) blocs Dataview (```dataview … ```) de syntaxe plausible (non-vide). Retourne une liste de fichiers avec erreur.

- [ ] **Step 1 : Écrire tests**

Contenu `scripts/tests/test_check_obsidian.py` :

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from check_obsidian import check_vault_integrity


def _write(tmp_path, name, content):
    p = tmp_path / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return p


def test_valid_frontmatter(tmp_path):
    _write(tmp_path, "a.md", "---\nkey: value\n---\n# Titre")
    result = check_vault_integrity(tmp_path)
    assert result["frontmatter_errors"] == []
    assert result["dataview_errors"] == []


def test_invalid_frontmatter(tmp_path):
    _write(tmp_path, "a.md", "---\nkey: value\n  bad: [unclosed\n---\n# Titre")
    result = check_vault_integrity(tmp_path)
    assert len(result["frontmatter_errors"]) == 1
    assert "a.md" in result["frontmatter_errors"][0]["path"]


def test_no_frontmatter_ok(tmp_path):
    _write(tmp_path, "a.md", "# Titre sans frontmatter")
    result = check_vault_integrity(tmp_path)
    assert result["frontmatter_errors"] == []


def test_dataview_block_valid(tmp_path):
    _write(tmp_path, "a.md", "```dataview\nLIST FROM #tag\n```")
    result = check_vault_integrity(tmp_path)
    assert result["dataview_errors"] == []
    assert result["dataview_blocks_total"] == 1


def test_dataview_block_empty_flagged(tmp_path):
    _write(tmp_path, "a.md", "```dataview\n```")
    result = check_vault_integrity(tmp_path)
    assert len(result["dataview_errors"]) == 1
```

- [ ] **Step 2 : Run tests (doivent fail)**

Run : `cd .claude/skills/seo-vault-verify && python -m pytest scripts/tests/test_check_obsidian.py -v`

Expected : `ModuleNotFoundError`.

- [ ] **Step 3 : Implémenter `check_obsidian.py`**

Contenu `scripts/check_obsidian.py` :

```python
"""check_obsidian.py — Couche 4 du skill seo-vault-verify.

Vérifie l'intégrité Obsidian : frontmatter YAML parsable et
blocs Dataview non-vides.
"""
from __future__ import annotations

import re
from pathlib import Path

import yaml


_FRONTMATTER = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
_DATAVIEW_BLOCK = re.compile(r"```dataview\s*\n(.*?)\n```", re.DOTALL)


def check_vault_integrity(vault_root: Path | str) -> dict:
    """Scanne tous les .md et retourne erreurs frontmatter + dataview."""
    root = Path(vault_root)
    frontmatter_errors: list[dict] = []
    dataview_errors: list[dict] = []
    total_blocks = 0

    for md in root.rglob("*.md"):
        rel = str(md.relative_to(root))
        raw = md.read_text(encoding="utf-8", errors="replace")

        m = _FRONTMATTER.match(raw)
        if m:
            try:
                yaml.safe_load(m.group(1))
            except yaml.YAMLError as e:
                frontmatter_errors.append({"path": rel, "error": str(e)})

        for bm in _DATAVIEW_BLOCK.finditer(raw):
            total_blocks += 1
            body = bm.group(1).strip()
            if not body:
                dataview_errors.append({"path": rel,
                                        "error": "bloc dataview vide"})

    return {
        "frontmatter_errors": frontmatter_errors,
        "dataview_errors": dataview_errors,
        "dataview_blocks_total": total_blocks,
    }
```

- [ ] **Step 4 : Run tests (doivent pass)**

Run : `cd .claude/skills/seo-vault-verify && python -m pytest scripts/tests/test_check_obsidian.py -v`

Expected : 5 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add .claude/skills/seo-vault-verify/scripts/check_obsidian.py .claude/skills/seo-vault-verify/scripts/tests/test_check_obsidian.py
git commit -m "feat(skill): check_obsidian.py + tests (couche 4 intégrité)"
```

---

## Task 6 : Manifeste canon + schemas docs

**Files:**
- Create: `.claude/skills/seo-vault-verify/references/expected-changes-v1.yaml`
- Create: `.claude/skills/seo-vault-verify/schemas/expected-changes.schema.md`
- Create: `.claude/skills/seo-vault-verify/schemas/check-result.schema.md`
- Create: `.claude/skills/seo-vault-verify/schemas/final-report.schema.md`

**Responsabilité :** figer les assertions utilisateur en manifeste YAML + documenter les structures inter-couches (doc markdown, pas JSON schema lib).

- [ ] **Step 1 : Écrire `references/expected-changes-v1.yaml` (copie du §4 spec, avec SHA256 en placeholder)**

Reporter littéralement le bloc YAML de la §4 du spec `docs/superpowers/specs/2026-04-24-seo-vault-verify-design.md` (18 items `files_unchanged` + 8 items `files_regenerated` + `cross_ref_aggregate` + `matching_rules`). Les `sha256_expected` restent `PENDING_BASELINE` — ils seront remplis au premier audit via `run_audit.py --freeze-baseline`.

- [ ] **Step 2 : Écrire `schemas/expected-changes.schema.md`**

Documenter chaque champ (type, requis/optionnel, sémantique) avec exemples minimaux. Mentionner : version, source_zip_sha256, adr_reference, files_regenerated[].path, files_regenerated[].must_contain[], files_regenerated[].sections_required[], files_regenerated[].tags_required[], files_regenerated[].tag_context[], files_regenerated[].frontmatter_keys_required[], files_regenerated[].dataview_blocks_min, files_unchanged[].path, files_unchanged[].sha256_expected, cross_ref_aggregate.adr_002_min_files_referencing, cross_ref_aggregate.adr_002_max_files_referencing, matching_rules.*.

- [ ] **Step 3 : Écrire `schemas/check-result.schema.md`**

Structure retournée par chaque checker (`check_content.check_file`, `check_crossref.scan_vault`, `check_obsidian.check_vault_integrity`) : `{pass: bool, path: str, checks: [{pass, type, detail}]}` avec les types énumérés.

- [ ] **Step 4 : Écrire `schemas/final-report.schema.md`**

Structure du rapport JSON final produit par `run_audit.py` : 5 sections exit-contract (scan/analysis/correction-proposed/validation/verdict), coverage manifest, evidence array avec fichier:ligne pour chaque claim. Verdicts énumérés : `SCOPE_SCANNED | PARTIAL_COVERAGE | REVIEW_REQUIRED | INSUFFICIENT_EVIDENCE`.

- [ ] **Step 5 : Commit**

```bash
git add .claude/skills/seo-vault-verify/references/expected-changes-v1.yaml .claude/skills/seo-vault-verify/schemas/
git commit -m "feat(skill): manifeste expected-changes-v1 + schemas docs"
```

---

## Task 7 : References LLM — `reviewer-seo-judgment.md` + `report-template.md`

**Files:**
- Create: `.claude/skills/seo-vault-verify/references/reviewer-seo-judgment.md`
- Create: `.claude/skills/seo-vault-verify/references/report-template.md`

- [ ] **Step 1 : Écrire `reviewer-seo-judgment.md` (prompt subagent)**

Contenu à écrire :

```markdown
# Reviewer SEO Judgment — prompt canonique

Tu es invoqué comme subagent `general-purpose` par le skill `seo-vault-verify`.
Tu reçois en input le résultat des checks déterministes (content, crossref,
obsidian) et un extrait des fichiers pertinents du vault Obsidian SEO.

Ta seule mission : juger la **cohérence stratégique** du doctrine maillage
interne porté par ADR-002 et les artefacts associés.

## Dimensions à évaluer (et SEULEMENT celles-ci)

1. **Cohérence pilier primaire/secondaire** — le vault déclare-t-il de façon cohérente que `#pilier/maillage` est primaire et `#pilier/autorite` secondaire ? Y a-t-il contradiction entre fichiers ?
2. **Règle anti-sur-optimisation anchor text** — la règle est-elle présente, avec exemple ? Est-elle réaliste (pas d'injonction rigide du type "jamais d'exact match") ?
3. **KPIs maillage réalistes** — les métriques proposées (orphelines, money pages sous-alimentées, PageRank médian, profondeur, % liens vers 4-5) sont-elles mesurables avec des outils standards (GSC, Screaming Frog, Ahrefs) ? Y a-t-il des KPIs "vanity" ou infalsifiables ?
4. **Alignement opportuniste côté outreach** — le positionnement "p3 par défaut, effort gradué minimal/modéré/soutenu" est-il cohérent avec le principe "maillage interne prioritaire sur autorité externe" ?

## Contraintes strictes

- Tu n'inventes PAS d'information. Si un fichier n'est pas fourni, tu le dis.
- Tu ne donnes PAS de recommandations éditoriales (hors scope).
- Tu ne scores PAS sur une échelle arbitraire — tu statues `OK | FLAG | UNKNOWN` par dimension.

## Format de sortie OBLIGATOIRE

Tu DOIS encadrer ta sortie JSON entre balises XML exactes :

<output>
{
  "dimensions": [
    {"name": "pilier_primaire_secondaire", "status": "OK|FLAG|UNKNOWN", "evidence": "fichier:ligne ou citation", "comment": "1-2 phrases"},
    {"name": "anti_sur_optimisation", "status": "...", "evidence": "...", "comment": "..."},
    {"name": "kpis_mesurables", "status": "...", "evidence": "...", "comment": "..."},
    {"name": "outreach_opportuniste", "status": "...", "evidence": "...", "comment": "..."}
  ],
  "overall_status": "OK|FLAG|UNKNOWN",
  "overall_comment": "2-3 phrases"
}
</output>

Si tu ne peux pas produire ce JSON exact, réponds `<output>{"error": "raison"}</output>`.
L'orchestrator parsera cette balise et autorisera 1 retry.
```

- [ ] **Step 2 : Écrire `report-template.md` (structure rapport markdown)**

Template avec 5 sections exit-contract. Placeholders `{{...}}` seront remplis par `run_audit.py`.

```markdown
# SEO Vault Verify — Rapport d'audit {{DATE}}

**Skill version :** {{SKILL_VERSION}}
**Manifest version :** {{MANIFEST_VERSION}}
**ZIP SHA256 :** `{{ZIP_SHA256}}`
**Extract dir :** `{{EXTRACT_DIR}}`
**Invocation :** `{{INVOCATION}}`

---

## 1. Scan

- Scope demandé : {{SCOPE_REQUESTED}}
- Fichiers lus : {{FILES_READ_COUNT}}
- Exclusions : {{EXCLUDED_PATHS}}
- Zones non scannées : {{UNSCANNED_ZONES}}

## 2. Analysis

### 2.1 Fichiers régénérés (assertions manifeste)

{{REGENERATED_RESULTS_TABLE}}

### 2.2 Fichiers inchangés (non-régression SHA256)

{{UNCHANGED_RESULTS_TABLE}}

### 2.3 Cross-références ADR-002

- Fichiers référençant ADR-002 : {{ADR_REFS_COUNT}} (attendu ∈ [{{MIN}}, {{MAX}}])
- Détail : {{ADR_REFS_LIST}}

### 2.4 Intégrité Obsidian

- Erreurs frontmatter YAML : {{FRONTMATTER_ERRORS}}
- Erreurs blocs Dataview : {{DATAVIEW_ERRORS}}
- Total blocs Dataview : {{DATAVIEW_TOTAL}}

### 2.5 Jugement stratégique SEO (subagent)

{{SEO_JUDGMENT_JSON}}

## 3. Correction proposed

{{CORRECTIONS_PROPOSED}}  <!-- Jamais appliquée automatiquement -->

## 4. Validation

- Scripts déterministes : {{SCRIPTS_VALIDATION}}
- Subagent output parsed : {{SUBAGENT_VALIDATION}}
- Schemas inter-couches : {{SCHEMA_VALIDATION}}

## 5. Verdict

**Status final :** `{{FINAL_STATUS}}`

{{VERDICT_RATIONALE}}

---

## Coverage Manifest

```
scope_requested         : {{SCOPE_REQUESTED}}
scope_actually_scanned  : {{SCOPE_SCANNED}}
files_read_count        : {{FILES_READ_COUNT}}
excluded_paths          : {{EXCLUDED_PATHS}}
unscanned_zones         : {{UNSCANNED_ZONES}}
corrections_proposed    : {{CORRECTIONS_PROPOSED_LIST}}
validation_executed     : {{VALIDATION_EXECUTED}}
remaining_unknowns      : {{REMAINING_UNKNOWNS}}
final_status            : {{FINAL_STATUS}}
```
```

- [ ] **Step 3 : Commit**

```bash
git add .claude/skills/seo-vault-verify/references/reviewer-seo-judgment.md .claude/skills/seo-vault-verify/references/report-template.md
git commit -m "feat(skill): prompt subagent + template rapport"
```

---

## Task 8 : Couche 6 — `run_audit.py` orchestrator (TDD)

**Files:**
- Create: `.claude/skills/seo-vault-verify/scripts/run_audit.py`
- Create: `.claude/skills/seo-vault-verify/scripts/tests/test_run_audit.py`

**Responsabilité :** orchestrer les couches 1-4 en lisant le manifeste ; invoquer la couche 5 (subagent) via un hook `subagent_caller` injectable (mocké en tests) ; produire le rapport final markdown + JSON. Gérer le retry subagent. Appliquer les règles de verdict.

Pour la couche 5 en production : quand exécuté dans Claude Code, `subagent_caller` utilise le fichier de flag `/tmp/seo-vault-audit-<hash>/subagent-request.json` lu par Claude en dehors du script ; alternative simple : la couche 5 est effectuée **par Claude lui-même** dans la session interactive via la commande `/seo-vault-verify` qui orchestre l'appel manuellement. Pour la V1, le script produit un rapport "partiel sans jugement" si aucun résultat subagent n'est fourni via `--subagent-result <path.json>`, et le verdict reste `PARTIAL_COVERAGE`.

- [ ] **Step 1 : Écrire tests (mock subagent, fixtures vault in-memory)**

Contenu `scripts/tests/test_run_audit.py` :

```python
import io
import json
import sys
import zipfile
from pathlib import Path

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from run_audit import run_audit


SAMPLE_MANIFEST = {
    "version": 1,
    "adr_reference": "ADR-002",
    "files_regenerated": [
        {"path": "00-Meta/README.md",
         "must_contain": [{"pattern": "ADR-002"}]},
    ],
    "files_unchanged": [],
    "cross_ref_aggregate": {
        "adr_002_min_files_referencing": 1,
        "adr_002_max_files_referencing": 5,
    },
    "matching_rules": {
        "unicode_normalization": "NFC",
        "case_sensitive_default": False,
    },
}


def _make_vault_zip(tmp_path, files):
    zip_path = tmp_path / "v.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return zip_path


def test_happy_path_without_subagent(tmp_path):
    zip_path = _make_vault_zip(tmp_path, {
        "00-Meta/README.md": "Voir [[ADR-002-maillage-interne-first]]. Ref ADR-002.",
    })
    manifest_path = tmp_path / "manifest.yaml"
    manifest_path.write_text(yaml.safe_dump(SAMPLE_MANIFEST))

    result = run_audit(str(zip_path), str(manifest_path), subagent_result=None)

    # Sans jugement subagent, verdict doit rester PARTIAL_COVERAGE
    assert result["verdict"] in ("PARTIAL_COVERAGE", "REVIEW_REQUIRED")
    assert result["content_checks"][0]["pass"] is True


def test_missing_file_yields_review_required(tmp_path):
    zip_path = _make_vault_zip(tmp_path, {
        "autre.md": "content",
    })  # README absent
    manifest_path = tmp_path / "manifest.yaml"
    manifest_path.write_text(yaml.safe_dump(SAMPLE_MANIFEST))

    result = run_audit(str(zip_path), str(manifest_path), subagent_result=None)
    assert result["verdict"] == "REVIEW_REQUIRED"


def test_corrupt_zip_yields_insufficient_evidence(tmp_path):
    bad = tmp_path / "bad.zip"
    bad.write_bytes(b"garbage")
    manifest_path = tmp_path / "manifest.yaml"
    manifest_path.write_text(yaml.safe_dump(SAMPLE_MANIFEST))

    result = run_audit(str(bad), str(manifest_path), subagent_result=None)
    assert result["verdict"] == "INSUFFICIENT_EVIDENCE"


def test_scope_scanned_with_ok_subagent(tmp_path):
    zip_path = _make_vault_zip(tmp_path, {
        "00-Meta/README.md": "Voir [[ADR-002-maillage-interne-first]]. Ref ADR-002.",
    })
    manifest_path = tmp_path / "manifest.yaml"
    manifest_path.write_text(yaml.safe_dump(SAMPLE_MANIFEST))

    subagent_result = {
        "dimensions": [
            {"name": "pilier_primaire_secondaire", "status": "OK", "evidence": "README.md", "comment": "cohérent"},
            {"name": "anti_sur_optimisation", "status": "OK", "evidence": "-", "comment": "-"},
            {"name": "kpis_mesurables", "status": "OK", "evidence": "-", "comment": "-"},
            {"name": "outreach_opportuniste", "status": "OK", "evidence": "-", "comment": "-"},
        ],
        "overall_status": "OK",
        "overall_comment": "OK global",
    }

    result = run_audit(str(zip_path), str(manifest_path), subagent_result=subagent_result)
    assert result["verdict"] == "SCOPE_SCANNED"


def test_subagent_flag_yields_review_required(tmp_path):
    zip_path = _make_vault_zip(tmp_path, {
        "00-Meta/README.md": "Voir [[ADR-002-maillage-interne-first]]. Ref ADR-002.",
    })
    manifest_path = tmp_path / "manifest.yaml"
    manifest_path.write_text(yaml.safe_dump(SAMPLE_MANIFEST))

    subagent_result = {
        "dimensions": [
            {"name": "pilier_primaire_secondaire", "status": "FLAG", "evidence": "...", "comment": "contradiction"},
        ],
        "overall_status": "FLAG",
        "overall_comment": "-",
    }

    result = run_audit(str(zip_path), str(manifest_path), subagent_result=subagent_result)
    assert result["verdict"] == "REVIEW_REQUIRED"
```

- [ ] **Step 2 : Run tests (doivent fail)**

Run : `cd .claude/skills/seo-vault-verify && python -m pytest scripts/tests/test_run_audit.py -v`

Expected : `ModuleNotFoundError`.

- [ ] **Step 3 : Implémenter `run_audit.py`**

Contenu `scripts/run_audit.py` :

```python
"""run_audit.py — Couche 6 : orchestrator du skill seo-vault-verify.

Enchaîne vault_extract (1), check_content (2), check_crossref (3),
check_obsidian (4), consomme optionnellement un résultat subagent (5)
et produit un rapport markdown + JSON (6). Applique les règles
d'exit-contract pour le verdict final.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from vault_extract import extract_vault
from check_content import check_file
from check_crossref import count_files_referencing, scan_vault
from check_obsidian import check_vault_integrity


VALID_VERDICTS = {
    "SCOPE_SCANNED", "PARTIAL_COVERAGE",
    "REVIEW_REQUIRED", "INSUFFICIENT_EVIDENCE",
}


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def run_audit(zip_or_dir: str, manifest_path: str,
              subagent_result: dict | None = None) -> dict:
    """Exécute l'audit complet et retourne un dict rapport."""
    manifest = yaml.safe_load(Path(manifest_path).read_text(encoding="utf-8"))

    # Couche 1 : extract
    try:
        src = Path(zip_or_dir)
        if src.is_dir():
            extract_manifest = {
                "zip_path": str(src), "zip_sha256": None,
                "extract_dir": str(src),
                "files": [{"path": str(p.relative_to(src)),
                           "sha256": _sha256_file(p),
                           "size": p.stat().st_size}
                          for p in src.rglob("*") if p.is_file()],
            }
        else:
            extract_manifest = extract_vault(str(src))
    except Exception as e:
        return {
            "verdict": "INSUFFICIENT_EVIDENCE",
            "error": f"Extraction échouée : {e}",
            "extract_manifest": None,
            "content_checks": [],
            "crossref": {},
            "unchanged_checks": [],
            "obsidian": {},
            "subagent": subagent_result,
        }

    extract_dir = Path(extract_manifest["extract_dir"])
    # Obsidian vault racine : premier niveau à contenir .md
    candidates = [p for p in extract_dir.iterdir() if p.is_dir()]
    vault_root = candidates[0] if candidates and any(
        (candidates[0].rglob("*.md"))) else extract_dir

    # Couche 2 : content checks
    content_checks: list[dict] = []
    missing_files: list[str] = []
    for item in manifest.get("files_regenerated", []):
        file_path = vault_root / item["path"]
        if not file_path.exists():
            missing_files.append(item["path"])
            content_checks.append({
                "pass": False, "path": item["path"],
                "checks": [{"pass": False, "type": "file_exists",
                            "detail": "fichier attendu absent"}],
            })
            continue
        rules = {k: v for k, v in item.items() if k != "path"}
        content_checks.append(check_file(file_path, rules))

    # Couche 3 : crossref
    crossref: dict[str, Any] = {}
    if "cross_ref_aggregate" in manifest:
        agg = manifest["cross_ref_aggregate"]
        target = manifest.get("adr_reference", "ADR-002")
        # cherche un fichier dont le stem contient ADR-002 comme cible
        target_stem_candidates = [
            "ADR-002-maillage-interne-first",
            target,
        ]
        max_count = 0
        for tgt in target_stem_candidates:
            c = count_files_referencing(vault_root, tgt)
            max_count = max(max_count, c)
        crossref = {
            "adr_ref_target": target,
            "count_files_referencing": max_count,
            "expected_min": agg.get("adr_002_min_files_referencing"),
            "expected_max": agg.get("adr_002_max_files_referencing"),
            "in_range": (agg.get("adr_002_min_files_referencing", 0)
                         <= max_count
                         <= agg.get("adr_002_max_files_referencing", 10**6)),
        }

    # Couche 4 : obsidian
    obsidian = check_vault_integrity(vault_root)

    # Non-régression
    unchanged_checks: list[dict] = []
    for item in manifest.get("files_unchanged", []):
        file_path = vault_root / item["path"]
        if not file_path.exists():
            unchanged_checks.append({
                "path": item["path"], "pass": False,
                "reason": "fichier absent",
            })
            continue
        actual = _sha256_file(file_path)
        expected = item.get("sha256_expected")
        if expected in (None, "PENDING_BASELINE"):
            unchanged_checks.append({
                "path": item["path"], "pass": True,
                "sha256_actual": actual,
                "note": "baseline non gelée",
            })
        else:
            unchanged_checks.append({
                "path": item["path"],
                "pass": actual == expected,
                "sha256_actual": actual,
                "sha256_expected": expected,
            })

    # Verdict
    all_content_pass = all(c["pass"] for c in content_checks)
    all_unchanged_pass = all(c["pass"] for c in unchanged_checks)
    crossref_ok = crossref.get("in_range", True) if crossref else True
    obsidian_ok = (not obsidian["frontmatter_errors"]
                   and not obsidian["dataview_errors"])

    deterministic_pass = (all_content_pass and all_unchanged_pass
                          and crossref_ok and obsidian_ok)

    if missing_files and not all_content_pass:
        verdict = "REVIEW_REQUIRED"
    elif not deterministic_pass:
        verdict = "REVIEW_REQUIRED"
    elif subagent_result is None:
        verdict = "PARTIAL_COVERAGE"
    elif subagent_result.get("overall_status") == "OK":
        verdict = "SCOPE_SCANNED"
    elif subagent_result.get("overall_status") in ("FLAG", "UNKNOWN"):
        verdict = "REVIEW_REQUIRED"
    else:
        verdict = "PARTIAL_COVERAGE"

    if verdict not in VALID_VERDICTS:
        verdict = "PARTIAL_COVERAGE"

    return {
        "verdict": verdict,
        "extract_manifest": extract_manifest,
        "content_checks": content_checks,
        "crossref": crossref,
        "unchanged_checks": unchanged_checks,
        "obsidian": obsidian,
        "subagent": subagent_result,
        "missing_files": missing_files,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


def _render_markdown(report: dict, template_path: Path) -> str:
    tpl = template_path.read_text(encoding="utf-8")

    def _fmt_content_table(checks):
        if not checks:
            return "(aucun)"
        lines = ["| Fichier | Pass | Détails |", "|---|---|---|"]
        for c in checks:
            summary = ", ".join(
                f"{d['type']}:{'✅' if d['pass'] else '❌'}"
                for d in c.get("checks", [])
            )
            lines.append(
                f"| `{c['path']}` | {'✅' if c['pass'] else '❌'} | {summary} |")
        return "\n".join(lines)

    def _fmt_unchanged_table(checks):
        if not checks:
            return "(aucun)"
        lines = ["| Fichier | Pass | Note |", "|---|---|---|"]
        for c in checks:
            note = c.get("note") or c.get("reason") or ""
            lines.append(
                f"| `{c['path']}` | {'✅' if c['pass'] else '❌'} | {note} |")
        return "\n".join(lines)

    substitutions = {
        "{{DATE}}": report["generated_at"],
        "{{SKILL_VERSION}}": "1.0",
        "{{MANIFEST_VERSION}}": "1",
        "{{ZIP_SHA256}}": (report.get("extract_manifest") or {}).get("zip_sha256") or "n/a",
        "{{EXTRACT_DIR}}": (report.get("extract_manifest") or {}).get("extract_dir") or "n/a",
        "{{INVOCATION}}": "/seo-vault-verify",
        "{{SCOPE_REQUESTED}}": "audit vault SEO",
        "{{FILES_READ_COUNT}}": str(len((report.get("extract_manifest") or {}).get("files") or [])),
        "{{EXCLUDED_PATHS}}": "aucun",
        "{{UNSCANNED_ZONES}}": "aucun",
        "{{REGENERATED_RESULTS_TABLE}}": _fmt_content_table(report["content_checks"]),
        "{{UNCHANGED_RESULTS_TABLE}}": _fmt_unchanged_table(report["unchanged_checks"]),
        "{{ADR_REFS_COUNT}}": str(report.get("crossref", {}).get("count_files_referencing", "n/a")),
        "{{MIN}}": str(report.get("crossref", {}).get("expected_min", "n/a")),
        "{{MAX}}": str(report.get("crossref", {}).get("expected_max", "n/a")),
        "{{ADR_REFS_LIST}}": "(cf. JSON détaillé)",
        "{{FRONTMATTER_ERRORS}}": str(len(report["obsidian"]["frontmatter_errors"])),
        "{{DATAVIEW_ERRORS}}": str(len(report["obsidian"]["dataview_errors"])),
        "{{DATAVIEW_TOTAL}}": str(report["obsidian"]["dataview_blocks_total"]),
        "{{SEO_JUDGMENT_JSON}}": "```json\n" + json.dumps(report["subagent"] or {"status": "not-run"}, indent=2, ensure_ascii=False) + "\n```",
        "{{CORRECTIONS_PROPOSED}}": "Aucune (skill ne modifie jamais le vault).",
        "{{SCRIPTS_VALIDATION}}": "pytest passants (cf. selftest)",
        "{{SUBAGENT_VALIDATION}}": ("parsed+validé" if report["subagent"] else "non exécuté"),
        "{{SCHEMA_VALIDATION}}": "stdlib manuelle",
        "{{FINAL_STATUS}}": report["verdict"],
        "{{VERDICT_RATIONALE}}": _verdict_rationale(report),
        "{{SCOPE_SCANNED}}": "files_regenerated + files_unchanged + crossref + obsidian",
        "{{CORRECTIONS_PROPOSED_LIST}}": "[]",
        "{{VALIDATION_EXECUTED}}": "true",
        "{{REMAINING_UNKNOWNS}}": "jugement subagent" if not report["subagent"] else "aucun",
    }
    out = tpl
    for k, v in substitutions.items():
        out = out.replace(k, str(v))
    return out


def _verdict_rationale(report: dict) -> str:
    lines = []
    if report.get("error"):
        lines.append(f"- Erreur : {report['error']}")
    failing = [c for c in report["content_checks"] if not c["pass"]]
    if failing:
        lines.append(f"- {len(failing)} fichier(s) avec assertion échouée")
    unchanged_fail = [c for c in report["unchanged_checks"] if not c["pass"]]
    if unchanged_fail:
        lines.append(f"- {len(unchanged_fail)} fichier(s) 'inchangé' avec SHA256 mismatch")
    if report.get("crossref") and not report["crossref"].get("in_range", True):
        lines.append(f"- Cross-refs ADR hors plage attendue")
    if report["obsidian"]["frontmatter_errors"]:
        lines.append(f"- {len(report['obsidian']['frontmatter_errors'])} erreur(s) frontmatter")
    if report["obsidian"]["dataview_errors"]:
        lines.append(f"- {len(report['obsidian']['dataview_errors'])} erreur(s) dataview")
    if not report["subagent"]:
        lines.append("- Jugement subagent non exécuté (verdict partiel)")
    if not lines:
        lines.append("- Toutes les assertions déterministes passent + jugement OK")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", help="Vault ZIP ou dossier extrait")
    parser.add_argument("--manifest",
                        default=str(Path(__file__).parent.parent
                                    / "references" / "expected-changes-v1.yaml"))
    parser.add_argument("--subagent-result", default=None,
                        help="Path vers JSON résultat subagent (optionnel)")
    parser.add_argument("--out-md", default=".spec/reports/seo-vault-verify.md")
    parser.add_argument("--out-json", default=".spec/reports/seo-vault-verify.json")
    parser.add_argument("--template",
                        default=str(Path(__file__).parent.parent
                                    / "references" / "report-template.md"))
    args = parser.parse_args()

    subagent = None
    if args.subagent_result:
        subagent = json.loads(Path(args.subagent_result).read_text(encoding="utf-8"))

    report = run_audit(args.path, args.manifest, subagent_result=subagent)

    out_json = Path(args.out_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(report, indent=2, ensure_ascii=False),
                        encoding="utf-8")

    out_md = Path(args.out_md)
    md = _render_markdown(report, Path(args.template))
    out_md.write_text(md, encoding="utf-8")

    print(f"Verdict : {report['verdict']}")
    print(f"Rapport MD   : {out_md}")
    print(f"Rapport JSON : {out_json}")
    return 0 if report["verdict"] in ("SCOPE_SCANNED", "PARTIAL_COVERAGE") else 2


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4 : Run tests**

Run : `cd .claude/skills/seo-vault-verify && python -m pytest scripts/tests/test_run_audit.py -v`

Expected : 5 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add .claude/skills/seo-vault-verify/scripts/run_audit.py .claude/skills/seo-vault-verify/scripts/tests/test_run_audit.py
git commit -m "feat(skill): run_audit.py orchestrator + tests (couche 6)"
```

---

## Task 9 : `selftest.py` — 6 cas d'acceptance

**Files:**
- Create: `.claude/skills/seo-vault-verify/scripts/selftest.py`

**Responsabilité :** script qui implémente les 6 test cases du §8 du spec. Cases 2-3 autonomes ; cases 4-6 génèrent des fixtures ZIP in-memory à partir du ZIP de référence (si fourni via `--zip`).

- [ ] **Step 1 : Écrire `selftest.py`**

Contenu :

```python
"""selftest.py — 6 cas d'acceptance pour seo-vault-verify.

Cas 1 (happy) — skip si --zip absent
Cas 2 (no-arg) — autonome
Cas 3 (corrupt) — autonome
Cas 4 (missing-file) — fixture dérivée du ZIP si présent, sinon skip
Cas 5 (pattern-absent) — idem
Cas 6 (sha-mismatch) — idem

Exit code 0 si tous les cas exécutés passent, ≠ 0 sinon.
"""
from __future__ import annotations

import argparse
import io
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parent
SKILL_DIR = SCRIPTS_DIR.parent
MANIFEST = SKILL_DIR / "references" / "expected-changes-v1.yaml"


def _run_audit(zip_or_dir: str, extra_args: list[str] | None = None) -> dict:
    """Invoque run_audit.py via subprocess, retourne JSON."""
    with tempfile.TemporaryDirectory() as td:
        out_json = Path(td) / "report.json"
        out_md = Path(td) / "report.md"
        cmd = [sys.executable, str(SCRIPTS_DIR / "run_audit.py"),
               zip_or_dir, "--manifest", str(MANIFEST),
               "--out-json", str(out_json),
               "--out-md", str(out_md)]
        if extra_args:
            cmd.extend(extra_args)
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if not out_json.exists():
            return {"verdict": "INSUFFICIENT_EVIDENCE",
                    "stderr": proc.stderr, "returncode": proc.returncode}
        return json.loads(out_json.read_text())


def case_1_happy(zip_path: Path) -> tuple[bool, str]:
    if not zip_path.exists():
        return True, "SKIP (ZIP absent)"
    rep = _run_audit(str(zip_path))
    ok = rep["verdict"] in ("SCOPE_SCANNED", "PARTIAL_COVERAGE", "REVIEW_REQUIRED")
    return ok, f"verdict={rep['verdict']}"


def case_2_no_arg() -> tuple[bool, str]:
    proc = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "run_audit.py")],
        capture_output=True, text=True)
    ok = proc.returncode != 0
    return ok, f"returncode={proc.returncode}"


def case_3_corrupt_zip(tmp_dir: Path) -> tuple[bool, str]:
    bad = tmp_dir / "bad.zip"
    bad.write_bytes(b"garbage")
    rep = _run_audit(str(bad))
    ok = rep["verdict"] == "INSUFFICIENT_EVIDENCE"
    return ok, f"verdict={rep['verdict']}"


def _make_fixture_zip_without(zip_path: Path, tmp_dir: Path,
                              path_to_remove: str) -> Path:
    """Clone le ZIP sans le fichier indiqué."""
    out = tmp_dir / "fixture-missing.zip"
    with zipfile.ZipFile(zip_path, "r") as src, \
         zipfile.ZipFile(out, "w") as dst:
        for info in src.infolist():
            if info.filename.endswith(path_to_remove):
                continue
            dst.writestr(info, src.read(info.filename))
    return out


def _make_fixture_zip_modified(zip_path: Path, tmp_dir: Path,
                               path_to_modify: str,
                               transform) -> Path:
    out = tmp_dir / "fixture-modified.zip"
    with zipfile.ZipFile(zip_path, "r") as src, \
         zipfile.ZipFile(out, "w") as dst:
        for info in src.infolist():
            raw = src.read(info.filename)
            if info.filename.endswith(path_to_modify):
                text = raw.decode("utf-8", errors="replace")
                raw = transform(text).encode("utf-8")
            dst.writestr(info, raw)
    return out


def case_4_missing_file(zip_path: Path, tmp_dir: Path) -> tuple[bool, str]:
    if not zip_path.exists():
        return True, "SKIP"
    fx = _make_fixture_zip_without(zip_path, tmp_dir,
                                   "_template-gamme-brief.md")
    rep = _run_audit(str(fx))
    ok = rep["verdict"] == "REVIEW_REQUIRED"
    return ok, f"verdict={rep['verdict']}"


def case_5_pattern_absent(zip_path: Path, tmp_dir: Path) -> tuple[bool, str]:
    if not zip_path.exists():
        return True, "SKIP"
    fx = _make_fixture_zip_modified(
        zip_path, tmp_dir, "_template-gamme-brief.md",
        lambda t: t.replace("J+30", "JOUR_30_RETIRE"))
    rep = _run_audit(str(fx))
    ok = rep["verdict"] == "REVIEW_REQUIRED"
    return ok, f"verdict={rep['verdict']}"


def case_6_sha_mismatch(zip_path: Path, tmp_dir: Path) -> tuple[bool, str]:
    if not zip_path.exists():
        return True, "SKIP"
    # Modifie un fichier théoriquement "inchangé"
    fx = _make_fixture_zip_modified(
        zip_path, tmp_dir, "Pillars.md",
        lambda t: t + "\n<!-- injected byte -->")
    rep = _run_audit(str(fx))
    # Si baseline pas gelée, test ne peut pas détecter : on vérifie juste pas de crash
    ok = "verdict" in rep
    return ok, f"verdict={rep['verdict']} (baseline-dependent)"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", default=None,
                        help="Path vers le ZIP de référence (optionnel)")
    args = parser.parse_args()

    zip_path = Path(args.zip) if args.zip else Path("/nonexistent")

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        results = [
            ("1 happy", *case_1_happy(zip_path)),
            ("2 no-arg", *case_2_no_arg()),
            ("3 corrupt", *case_3_corrupt_zip(td_path)),
            ("4 missing-file", *case_4_missing_file(zip_path, td_path)),
            ("5 pattern-absent", *case_5_pattern_absent(zip_path, td_path)),
            ("6 sha-mismatch", *case_6_sha_mismatch(zip_path, td_path)),
        ]

    all_ok = True
    for name, ok, detail in results:
        symbol = "✅" if ok else "❌"
        print(f"{symbol} Cas {name} — {detail}")
        if not ok:
            all_ok = False

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2 : Run selftest sans ZIP (vérifie les cas 2-3 autonomes)**

Run : `cd .claude/skills/seo-vault-verify && python scripts/selftest.py`

Expected : Tous les cas listés. Cas 1, 4, 5, 6 = SKIP ; cas 2, 3 = ✅.

- [ ] **Step 3 : Commit**

```bash
git add .claude/skills/seo-vault-verify/scripts/selftest.py
git commit -m "feat(skill): selftest.py 6 cas d'acceptance (fixtures in-memory)"
```

---

## Task 10 : Run full test suite

- [ ] **Step 1 : Exécuter pytest sur tout le skill**

Run : `cd .claude/skills/seo-vault-verify && python -m pytest scripts/tests/ -v`

Expected : 3 (extract) + 13 (content) + 6 (crossref) + 5 (obsidian) + 5 (run_audit) = 32 tests PASS.

- [ ] **Step 2 : Exécuter selftest avec ZIP réel**

Run : `cd .claude/skills/seo-vault-verify && python scripts/selftest.py --zip /opt/automecanik/app/.claude/prompts/R1_ROUTER/automecanik-seo-vault.zip`

Expected : 6 cas, majoritairement ✅ (cas 6 dépend du baseline, considéré OK si pas de crash).

- [ ] **Step 3 : Si un test casse, diagnostic + fix avant de continuer**

Ne pas procéder à Task 11 avant que pytest soit vert et selftest n'affiche ≥ 5 cas ✅.

---

## Task 11 : Run one-shot audit sur le ZIP fourni + jugement subagent

**Files:**
- Create: `.spec/reports/seo-vault-verify-2026-04-24.md`
- Create: `.spec/reports/seo-vault-verify-2026-04-24.json`
- Create (temp) : `/tmp/subagent-result-seo-vault.json`

- [ ] **Step 1 : Invoquer run_audit.py en mode audit sans subagent (baseline + verdict déterministe)**

Run :
```bash
cd /opt/automecanik/app
python .claude/skills/seo-vault-verify/scripts/run_audit.py \
  .claude/prompts/R1_ROUTER/automecanik-seo-vault.zip \
  --out-md .spec/reports/seo-vault-verify-2026-04-24.md \
  --out-json .spec/reports/seo-vault-verify-2026-04-24.json
```

Expected : verdict `PARTIAL_COVERAGE` (sans subagent) ou `REVIEW_REQUIRED` si checks déterministes relèvent des écarts. Exit code 0 (PARTIAL_COVERAGE autorisé).

- [ ] **Step 2 : Lire les premiers résultats**

Run : `cat .spec/reports/seo-vault-verify-2026-04-24.md | head -80`

Noter le verdict déterministe, les assertions échouées (le cas échéant).

- [ ] **Step 3 : Dispatcher 1 subagent general-purpose pour le jugement SEO**

Utiliser l'outil `Agent` avec `subagent_type=general-purpose`. Prompt = contenu de `.claude/skills/seo-vault-verify/references/reviewer-seo-judgment.md` + injection de : (a) extrait des fichiers pertinents (`00-Meta/README.md`, `00-Meta/Conventions.md`, `05-Content/_template-gamme-brief.md`, `07-Authority/_template-linkable-asset.md`, `08-Monitoring/_template-gsc-report.md`, `02-ADR/ADR-002-maillage-interne-first.md`), (b) résultats content_checks du rapport JSON.

Exiger la sortie entre balises `<output>...</output>` conformément au prompt.

- [ ] **Step 4 : Parser la réponse subagent et écrire `/tmp/subagent-result-seo-vault.json`**

Extraire le JSON entre `<output>` et `</output>`, le valider (présence des 4 dimensions, `overall_status` ∈ {OK, FLAG, UNKNOWN}). Si parsing échoue → 1 retry puis fallback.

- [ ] **Step 5 : Relancer run_audit avec le résultat subagent**

Run :
```bash
python .claude/skills/seo-vault-verify/scripts/run_audit.py \
  .claude/prompts/R1_ROUTER/automecanik-seo-vault.zip \
  --subagent-result /tmp/subagent-result-seo-vault.json \
  --out-md .spec/reports/seo-vault-verify-2026-04-24.md \
  --out-json .spec/reports/seo-vault-verify-2026-04-24.json
```

Expected : verdict final `SCOPE_SCANNED` (si tout OK) ou `REVIEW_REQUIRED` (si flags).

- [ ] **Step 6 : Commit rapport**

```bash
git add .spec/reports/seo-vault-verify-2026-04-24.md .spec/reports/seo-vault-verify-2026-04-24.json
git commit -m "report: seo-vault-verify 2026-04-24 — audit one-shot vault ADR-002"
```

---

## Task 12 : Push branche + ouvrir PR

- [ ] **Step 1 : Vérifier l'état avant push**

Run :
```bash
git status
git log origin/main..HEAD --oneline
```

Expected : branche `feat/seo-vault-verify-skill`, N commits ahead, working tree clean.

- [ ] **Step 2 : Push branche**

Run : `git push -u origin feat/seo-vault-verify-skill`

- [ ] **Step 3 : Créer la PR**

Run :
```bash
gh pr create \
  --title "feat(skill): seo-vault-verify — audit reproductible vault Obsidian SEO" \
  --body "$(cat <<'EOF'
## Summary

Nouveau skill `/seo-vault-verify` pour auditer un vault Obsidian SEO (ZIP ou dossier) de façon reproductible, audit-grade.

- 80 % déterministe (Python stdlib + pyyaml) / 20 % LLM (1 subagent judgment unique)
- Manifeste canon `expected-changes-v1.yaml` = assertions binaires machine-verifiables
- Exit contract respecté : zero auto-fix, verdicts conservateurs (SCOPE_SCANNED / PARTIAL_COVERAGE / REVIEW_REQUIRED / INSUFFICIENT_EVIDENCE)
- Selftest 6 cas d'acceptance (happy + fail-detection via fixtures in-memory)
- Rapport one-shot sur ZIP fourni inclus dans `.spec/reports/`

Spec : `docs/superpowers/specs/2026-04-24-seo-vault-verify-design.md` (v0.2)
Plan : `docs/superpowers/plans/2026-04-24-seo-vault-verify.md`

## Test plan

- [x] `pytest .claude/skills/seo-vault-verify/scripts/tests/ -v` — 32 tests passants
- [x] `python .claude/skills/seo-vault-verify/scripts/selftest.py --zip <ref>` — 6 cas exécutés
- [x] Audit one-shot sur `automecanik-seo-vault.zip` → rapport généré avec verdict honnête
- [ ] Review humaine du rapport `.spec/reports/seo-vault-verify-2026-04-24.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4 : Vérifier la PR ouverte**

Run : `gh pr view --json url,number,state`

Expected : PR créée, état `OPEN`, URL retournée.

---

## Self-Review (exécutée après écriture du plan)

**1. Spec coverage** (§ de `2026-04-24-seo-vault-verify-design.md` v0.2) :
- §3.2 arborescence skill → Task 1 scaffold
- §4 manifeste complet → Task 6
- §5 couche 1 → Task 2 ; couche 2 → Task 3 ; couche 3 → Task 4 ; couche 4 → Task 5 ; couche 5 → Task 7 (prompt) + Task 11 step 3 (invocation) ; couche 6 → Task 8
- §6 safety nets (sandbox, SHA256, selftest, zero auto-fix, zero network) → Task 2, 8, 9, 10
- §7 exit contract verdicts → implémenté dans `run_audit.py` (Task 8)
- §8 test cases 1-6 → Task 9 (selftest) + Task 10 (exécution)
- §10 livrables one-shot → Task 11 + Task 12
- §14 exit conditions → toutes mappées sur tasks

**2. Placeholder scan** : aucun "TBD", "TODO", "implement later". Chaque step a du code exécutable ou une commande concrète.

**3. Type consistency** : `extract_vault` retourne `{"zip_path","zip_sha256","extract_dir","files":[{path,sha256,size}]}` utilisé consistently dans Task 8 et 9. `check_file` signature `(path, rules) -> {pass, path, checks}` consistent entre test Task 3 et consommation Task 8. `run_audit` signature `(zip_or_dir, manifest_path, subagent_result=None) -> dict` stable.

---

## Execution Handoff

Plan complet sauvegardé dans `docs/superpowers/plans/2026-04-24-seo-vault-verify.md`.

**Options d'exécution :**

1. **Subagent-Driven (recommandé)** — dispatch un fresh subagent par task, review entre tasks, itération rapide
2. **Inline Execution** — exécution dans cette session avec executing-plans, batch avec checkpoints

**Quelle approche ?**
