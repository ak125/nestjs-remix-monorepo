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
    _write(tmp_path, "a.md", "Autorité externe")
    rules = {"must_contain": [{"pattern": "Autorité externe"}]}
    result = check_file(tmp_path / "a.md", rules)
    assert result["pass"] is True


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
