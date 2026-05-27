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

# === FUNCTION STUBS (populated by Tasks 3-7 via TDD) ===

def is_rag_recycled_candidate(frontmatter): raise NotImplementedError("Task 3")
def read_raw_gamme(path): raise NotImplementedError("Task 3")
def aggregate_web_corpus_by_slug(web_dir, slug): raise NotImplementedError("Task 3")
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
