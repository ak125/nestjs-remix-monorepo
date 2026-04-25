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
