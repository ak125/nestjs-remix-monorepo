#!/usr/bin/env python3
"""
promote-raw-gammes-to-wiki.py — Promote RAW v5 SSOT gammes to WIKI v2.0.0 proposals.

Phase 1 WIKI bootstrap (multi-role : R1/R8/R2/R3 consumers downstream).
Mirror convention canon `gamme-from-web-corpus-generator.py` (single-file Python).

Canon doctrine 2026-05-27 :
  - RAG data is allowed as RAW candidate.
  - RAG data is forbidden only when silently promoted as confirmed WIKI/runtime truth.
  - candidate (from RAG) + confirmed (from OEM web) parallel, with cross_check_status.

Configurable via env :
  AUTOMECANIK_RAW_PATH  (default /opt/automecanik/automecanik-raw)
  AUTOMECANIK_WIKI_PATH (default /opt/automecanik/automecanik-wiki)
  SCHEMA_OPTION         (A | B | C — default C : dimensions in body+review_notes, schema unchanged)

Usage Phase A :
  python3 scripts/wiki-generators/promote-raw-gammes-to-wiki.py --gamme <slug> --dry-run [--verbose]

Refs :
  - Plan : ~/.claude/plans/verdict-verdict-oui-avec-cheeky-catmull.md
  - Schema : automecanik-wiki/_meta/schema/entity-data/gamme.schema.json (v2.0.0)
  - Canon mémoire : feedback_rag_to_raw_candidate_requalification
"""
import os
import re
import sys
import json
import uuid
import hashlib
import argparse
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
    import jsonschema
except ImportError:
    sys.stderr.write("Manque : pip install pyyaml jsonschema\n")
    sys.exit(1)

# === ENV CONFIG (mirror gamme-from-web-corpus-generator.py convention) ===
RAW_REPO = Path(os.getenv("AUTOMECANIK_RAW_PATH", "/opt/automecanik/automecanik-raw"))
WIKI_REPO = Path(os.getenv("AUTOMECANIK_WIKI_PATH", "/opt/automecanik/automecanik-wiki"))
GAMMES_DIR = RAW_REPO / "recycled" / "rag-knowledge" / "gammes"
WEB_DIR = RAW_REPO / "recycled" / "rag-knowledge" / "web"
PROPOSALS_DIR = WIKI_REPO / "proposals"
SCHEMA_PATH = WIKI_REPO / "_meta" / "schema" / "entity-data" / "gamme.schema.json"
RUN_LOG_DIR = Path("/opt/automecanik/app/audit/wiki-bootstrap-runs")

SCHEMA_OPTION_DEFAULT = "C"  # safe : dimensions in body + review_notes, schema unchanged

# === Task 3 : RAW reader + RAG candidate guard + web corpus aggregator ===

# Taxonomic frontmatter fields toujours safe (structural metadata, pas prose RAG-generated)
TAXONOMIC_SAFE_FIELDS = {"slug", "title", "pg_id", "category", "intent_targets", "business_priority"}


def is_rag_recycled_candidate(frontmatter):
    """Detect RAG-enriched content for candidate requalification (canon doctrine 2026-05-27).

    Returns True if frontmatter signature indicates RAG-recycled auto-generated content.
    Per canon : RAG data is allowed as RAW candidate (statut rag_recycled_candidate,
    requires_review:true), forbidden only when silently promoted as confirmed WIKI/runtime.
    """
    if not isinstance(frontmatter, dict):
        return False
    lifecycle = frontmatter.get("lifecycle", {}) or {}
    enricher = (lifecycle.get("last_enriched_by") or "").lower()
    stage = (lifecycle.get("stage") or "").lower()
    return (
        "rag-enrich" in enricher
        or "rag_enrich" in enricher
        or stage == "auto_generated"
        or bool(lifecycle.get("v5_migrated_at"))
    )


def _build_safe_taxonomic_fields(fm):
    """Extract structural taxonomic metadata always safe (slug, pg_id, family, related_parts).

    These fields are not RAG-generated prose — they come from DB canonical (pg_alias)
    and are merely copied into rag-knowledge files. Always reliable.
    """
    safe = {k: v for k, v in fm.items() if k in TAXONOMIC_SAFE_FIELDS}
    dom = fm.get("domain", {}) or {}
    if "related_parts" in dom:
        safe["related_parts"] = dom["related_parts"]
    return safe


def read_raw_gamme(path):
    """Read RAW gamme file. Body conservé même si RAG-candidate (canon doctrine corrigée).

    Returns dict with:
      - frontmatter_full : full YAML frontmatter
      - safe_taxonomic_fields : structural metadata always safe
      - body : markdown body (preserved, marked candidate if RAG-recycled)
      - is_rag_candidate : True if RAG-enriched legacy detected
      - candidate_status : "rag_recycled_candidate" | "ssot_confirmed"
      - requires_review : True if RAG candidate
      - source_path : absolute path str
    """
    if not path.exists():
        raise FileNotFoundError(f"RAW gamme not found: {path}")
    content = path.read_text(encoding="utf-8")
    m = re.match(r'^---\n(.*?)\n---\n(.*)$', content, re.DOTALL)
    if not m:
        raise ValueError(f"No YAML frontmatter in {path}")
    fm_full = yaml.safe_load(m.group(1))
    is_cand = is_rag_recycled_candidate(fm_full)
    return {
        "frontmatter_full": fm_full,
        "safe_taxonomic_fields": _build_safe_taxonomic_fields(fm_full),
        "body": m.group(2).strip(),
        "is_rag_candidate": is_cand,
        "candidate_status": "rag_recycled_candidate" if is_cand else "ssot_confirmed",
        "requires_review": is_cand,
        "source_path": str(path),
    }


def aggregate_web_corpus_by_slug(web_dir, slug):
    """Read web/*.md OEM-scraped corpus, return entries with slug_gamme==slug + source_uri."""
    results = []
    if not web_dir.exists():
        return results
    for f in sorted(web_dir.glob("*.md")):
        try:
            content = f.read_text(encoding="utf-8")
            m = re.match(r'^---\n(.*?)\n---\n(.*)$', content, re.DOTALL)
            if not m:
                continue
            fm = yaml.safe_load(m.group(1))
            if not isinstance(fm, dict) or fm.get("slug_gamme") != slug:
                continue
            source_uri = fm.get("source_uri") or fm.get("source_url")
            if not source_uri:
                continue  # Guard : web source sans URL traçable = REFUS
            results.append({
                "slug_gamme": fm.get("slug_gamme"),
                "source_uri": source_uri,
                "source_domain": fm.get("source_domain"),
                "title": fm.get("title"),
                "body": m.group(2).strip(),
                "content_hash": fm.get("content_hash"),
                "path": str(f),
            })
        except (OSError, yaml.YAMLError):
            continue
    return results


# === Function stubs populated by Tasks 4-7 via TDD ===

def classify_source_tier(domain, frontmatter=None): raise NotImplementedError("Task 4")
def extract_dimensions(raw, web_corpus): raise NotImplementedError("Task 4")
def evaluate_variant_readiness(dimensions, is_r2_sensitive): raise NotImplementedError("Task 5")
def validate_anti_filler(body): raise NotImplementedError("Task 5")
def compute_content_hash(body): raise NotImplementedError("Task 5")
def build_proposal_v2(raw, web_corpus, dimensions, schema_option): raise NotImplementedError("Task 6")
def validate_schema(frontmatter, schema_option): raise NotImplementedError("Task 6")
def write_run_log(run_data): raise NotImplementedError("Task 7")


def main():
    """Phase A CLI : --gamme <slug> --dry-run --verbose only (refuse autres flags)."""
    parser = argparse.ArgumentParser(
        description="Promote RAW v5 SSOT gamme to WIKI v2.0.0 proposal (Phase A single-gamme).",
    )
    parser.add_argument("--gamme", required=True, help="Single gamme slug (Phase A LOCKED to single-gamme)")
    parser.add_argument("--dry-run", action="store_true", help="No writes, stdout report only")
    parser.add_argument("--verbose", action="store_true", help="Per-step trace")
    args = parser.parse_args()

    # Phase A : skeleton placeholder (wired in Task 6)
    print(f"[skeleton] would process gamme={args.gamme} dry_run={args.dry_run} verbose={args.verbose}")
    print(f"[skeleton] RAW_REPO={RAW_REPO}")
    print(f"[skeleton] WIKI_REPO={WIKI_REPO}")
    print(f"[skeleton] SCHEMA_OPTION={os.getenv('SCHEMA_OPTION', SCHEMA_OPTION_DEFAULT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
