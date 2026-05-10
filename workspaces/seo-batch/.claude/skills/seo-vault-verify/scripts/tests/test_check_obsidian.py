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
