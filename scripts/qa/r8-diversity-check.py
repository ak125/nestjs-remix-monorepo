#!/usr/bin/env python3
"""
R8 Diversity Check — ADR-022 anti-duplicate verification.

Measures fingerprint distinctness per sibling group (motorisations du même
modele_id) to ensure the R8 variation wire (PRs #145 + #146) produces
differentiated content across siblings. Prevents Google duplicate-content
penalties.

Pattern aligned with scripts/db/adr017-create-index-concurrently.py
(psycopg2 direct, deterministic, testable).

Usage:
    # Single constructor
    python3 scripts/qa/r8-diversity-check.py --brand smart

    # Single modele_id
    python3 scripts/qa/r8-diversity-check.py --modele-id 140004

    # Batch all indexed models
    python3 scripts/qa/r8-diversity-check.py --batch

    # JSON output for CI
    python3 scripts/qa/r8-diversity-check.py --brand smart --format json

    # Custom threshold
    python3 scripts/qa/r8-diversity-check.py --brand smart --threshold 75

Exit codes:
    0 — PASS (all slots ≥ threshold for all models)
    1 — REVIEW (1-2 slots sous seuil sur au moins 1 modele)
    2 — FAIL (≥ 3 slots sous seuil, ou ≥ 50% modeles en FAIL)
    3 — Technical error (DB connection, SQL)

References:
    ADR-022: R8 RAG Control Plane (Pilier 2d wire variation)
    PRs: #145 (pools), #146 (enricher wire)
    Tables read: __seo_r8_pages, __seo_r8_fingerprints, auto_type, auto_modele, auto_marque
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# ── Env / DSN ─────────────────────────────────────────────────────────────────

ENV_PATH = Path(__file__).resolve().parents[2] / "backend" / ".env"
load_dotenv(ENV_PATH)

PROJECT_REF = "cxpojprgwgubzjyqzmoq"
DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD")


def _build_dsn() -> str:
    """Build direct psycopg2 DSN (port 5432, not pooler)."""
    if not DB_PASSWORD:
        sys.stderr.write("[FATAL] SUPABASE_DB_PASSWORD missing in env\n")
        sys.exit(3)
    return (
        f"host=db.{PROJECT_REF}.supabase.co "
        f"port=5432 "
        f"dbname=postgres "
        f"user=postgres "
        f"password={DB_PASSWORD} "
        f"sslmode=require "
        f"application_name=r8-diversity-check"
    )


# ── Thresholds (canonical, align ADR-022 § 3b) ──────────────────────────────

DEFAULT_THRESHOLD_PCT = 80  # distinct fingerprints ratio threshold

# block_sequence should be stable (same block structure per sibling) → excluded
# from distinctness check. All other fingerprints must be distinct.
EXPECTED_STABLE_SLOTS = {"distinct_block_seq"}

SLOT_LABELS = {
    "distinct_content": "content",
    "distinct_normalized": "normalized_text",
    "distinct_block_seq": "block_sequence",
    "distinct_semantic": "semantic_key",
    "distinct_faq": "faq_signature",
    "distinct_category": "category_signature",
}

# Slot → pool R8 that drives it (for recommendation hint)
SLOT_TO_POOL_HINT = {
    "distinct_faq": "SEO_R8_FAQ_OPENING_VARIATIONS (N=7)",
    "distinct_category": "SEO_R8_CATALOG_ACCESS_VARIATIONS (N=7)",
    "distinct_content": "intro+variant+catalog+faq+trust (all 5 pools)",
    "distinct_normalized": "intro+variant+catalog+faq+trust",
    "distinct_semantic": "intro+variant (key signal pools)",
}


# ── Data classes ─────────────────────────────────────────────────────────────


@dataclass
class ModelReport:
    modele_id: int
    modele_name: str
    marque_name: str
    sibling_count: int
    distinct_content: int
    distinct_normalized: int
    distinct_block_seq: int
    distinct_semantic: int
    distinct_faq: int
    distinct_category: int
    avg_diversity_score: float | None
    index_count: int
    review_count: int
    regenerate_count: int
    reject_count: int
    slots_failing: list[str] = field(default_factory=list)
    verdict: str = "PASS"
    collisions: dict[str, list[dict[str, Any]]] = field(default_factory=dict)

    def compute_verdict(self, threshold_pct: int) -> None:
        """Evaluate per-slot distinct ratios and set verdict."""
        failing: list[str] = []
        for slot_key in SLOT_LABELS:
            if slot_key in EXPECTED_STABLE_SLOTS:
                continue  # block_sequence is expected stable
            distinct = getattr(self, slot_key)
            if self.sibling_count <= 1:
                continue  # single sibling = no duplicate possible
            ratio_pct = (distinct / self.sibling_count) * 100
            if ratio_pct < threshold_pct:
                failing.append(SLOT_LABELS[slot_key])

        self.slots_failing = failing
        if len(failing) == 0:
            self.verdict = "PASS"
        elif len(failing) <= 2:
            self.verdict = "REVIEW"
        else:
            self.verdict = "FAIL"


@dataclass
class RunSummary:
    run_at: str
    threshold_pct: int
    scope: str  # 'brand:smart' | 'modele:140004' | 'batch' | ...
    total_models: int
    pass_count: int
    review_count: int
    fail_count: int
    global_verdict: str  # PASS | REVIEW | FAIL


# ── Core queries ─────────────────────────────────────────────────────────────


AGGREGATE_SQL = """
WITH scope AS (
  SELECT unnest(%(modele_ids)s::int[]) AS modele_id
),
pages_with_fp AS (
  SELECT
    p.type_id::int AS type_id,
    t.type_modele_id_i AS modele_id,
    m.modele_name,
    br.marque_name,
    p.seo_decision,
    p.diversity_score,
    fp.content_fingerprint,
    fp.normalized_text_fingerprint,
    fp.block_sequence_fingerprint,
    fp.semantic_key_fingerprint,
    fp.faq_signature,
    fp.category_signature
  FROM public.__seo_r8_pages p
  JOIN public.__seo_r8_fingerprints fp ON fp.page_id = p.id
  JOIN public.auto_type t ON t.type_id = p.type_id::int
  JOIN public.auto_modele m ON m.modele_id = t.type_modele_id_i
  JOIN public.auto_marque br ON br.marque_id::text = m.modele_marque_id::text
  WHERE t.type_modele_id_i IN (SELECT modele_id FROM scope)
)
SELECT
  modele_id,
  modele_name,
  marque_name,
  COUNT(*) AS sibling_count,
  COUNT(DISTINCT content_fingerprint) AS distinct_content,
  COUNT(DISTINCT normalized_text_fingerprint) AS distinct_normalized,
  COUNT(DISTINCT block_sequence_fingerprint) AS distinct_block_seq,
  COUNT(DISTINCT semantic_key_fingerprint) AS distinct_semantic,
  COUNT(DISTINCT faq_signature) AS distinct_faq,
  COUNT(DISTINCT category_signature) AS distinct_category,
  ROUND(AVG(diversity_score)::numeric, 1) AS avg_diversity_score,
  COUNT(*) FILTER (WHERE seo_decision = 'INDEX') AS index_count,
  COUNT(*) FILTER (WHERE seo_decision = 'REVIEW') AS review_count,
  COUNT(*) FILTER (WHERE seo_decision = 'REGENERATE') AS regenerate_count,
  COUNT(*) FILTER (WHERE seo_decision = 'REJECT') AS reject_count
FROM pages_with_fp
GROUP BY modele_id, modele_name, marque_name
HAVING COUNT(*) >= 1
ORDER BY marque_name, modele_name;
"""


COLLISION_SQL_TEMPLATE = """
SELECT
  fp.{fp_column} AS hash,
  COUNT(*) AS collision_count,
  array_agg(p.type_id::int ORDER BY p.type_id::int) AS type_ids
FROM public.__seo_r8_fingerprints fp
JOIN public.__seo_r8_pages p ON p.id = fp.page_id
JOIN public.auto_type t ON t.type_id = p.type_id::int
WHERE t.type_modele_id_i = %(modele_id)s
GROUP BY fp.{fp_column}
HAVING COUNT(*) >= 2
ORDER BY COUNT(*) DESC
LIMIT 20;
"""

SLOT_TO_FP_COLUMN = {
    "content": "content_fingerprint",
    "normalized_text": "normalized_text_fingerprint",
    "semantic_key": "semantic_key_fingerprint",
    "faq_signature": "faq_signature",
    "category_signature": "category_signature",
}


# ── Scope resolution ─────────────────────────────────────────────────────────


def resolve_modele_ids(
    cur: psycopg2.extensions.cursor,
    *,
    brand: str | None,
    modele_id: int | None,
    slug: str | None,
    batch: bool,
) -> tuple[list[int], str]:
    """Resolve the list of modele_ids to check based on CLI args. Returns (ids, scope_label)."""
    if modele_id is not None:
        return [modele_id], f"modele:{modele_id}"

    if slug:
        # slug like "renault-clio-3" → split brand + model
        parts = slug.split("-", 1)
        if len(parts) != 2:
            sys.stderr.write(f"[FATAL] --slug expects 'brand-model' format, got '{slug}'\n")
            sys.exit(3)
        brand_alias, model_alias = parts
        cur.execute(
            """
            SELECT m.modele_id FROM auto_modele m
            JOIN auto_marque br ON br.marque_id::text = m.modele_marque_id::text
            WHERE lower(br.marque_alias) = lower(%s)
              AND lower(m.modele_alias) = lower(%s)
            LIMIT 1
            """,
            (brand_alias, model_alias),
        )
        row = cur.fetchone()
        if not row:
            sys.stderr.write(f"[FATAL] Slug '{slug}' not found\n")
            sys.exit(3)
        return [row[0]], f"slug:{slug}"

    if brand:
        cur.execute(
            """
            SELECT m.modele_id
            FROM auto_modele m
            JOIN auto_marque br ON br.marque_id::text = m.modele_marque_id::text
            WHERE lower(br.marque_alias) = lower(%s)
              AND m.modele_display = '1'
            ORDER BY m.modele_name
            """,
            (brand,),
        )
        ids = [r[0] for r in cur.fetchall()]
        if not ids:
            sys.stderr.write(f"[FATAL] Brand '{brand}' has no active models\n")
            sys.exit(3)
        return ids, f"brand:{brand}"

    if batch:
        cur.execute(
            """
            SELECT DISTINCT t.type_modele_id_i
            FROM auto_type t
            JOIN public.__seo_r8_pages p ON p.type_id::int = t.type_id
            GROUP BY t.type_modele_id_i
            HAVING COUNT(*) >= 3
            """
        )
        ids = [r[0] for r in cur.fetchall()]
        return ids, "batch"

    sys.stderr.write("[FATAL] One of --brand / --modele-id / --slug / --batch required\n")
    sys.exit(3)


# ── Collision details ────────────────────────────────────────────────────────


def fetch_collisions(
    cur: psycopg2.extensions.cursor,
    modele_id: int,
    failing_slots: list[str],
) -> dict[str, list[dict[str, Any]]]:
    """For slots below threshold, list hashes shared by multiple type_ids."""
    result: dict[str, list[dict[str, Any]]] = {}
    for slot_label in failing_slots:
        fp_column = SLOT_TO_FP_COLUMN.get(slot_label)
        if not fp_column:
            continue
        sql = COLLISION_SQL_TEMPLATE.format(fp_column=fp_column)
        cur.execute(sql, {"modele_id": modele_id})
        rows = cur.fetchall()
        result[slot_label] = [
            {"hash": r[0][:16] + "...", "collision_count": r[1], "type_ids": r[2]}
            for r in rows
        ]
    return result


# ── Output formatters ────────────────────────────────────────────────────────


def format_markdown(summary: RunSummary, models: list[ModelReport]) -> str:
    """Human-readable markdown report."""
    lines: list[str] = []
    lines.append(f"# R8 Diversity Check — {summary.scope}")
    lines.append("")
    lines.append(f"**Run**: {summary.run_at}  ")
    lines.append(f"**Seuil**: {summary.threshold_pct}% distinct par slot  ")
    lines.append(
        f"**Verdict global**: **{summary.global_verdict}** "
        f"(PASS {summary.pass_count}, REVIEW {summary.review_count}, "
        f"FAIL {summary.fail_count} / {summary.total_models} modèles)"
    )
    lines.append("")
    lines.append("## Détail par modèle")
    lines.append("")
    lines.append(
        "| modele_id | Marque | Modèle | Sib | content | norm | blk_seq | semantic | faq | category | avg_div | Verdict |"
    )
    lines.append(
        "|-----------|--------|--------|-----|---------|------|---------|----------|-----|----------|---------|---------|"
    )

    def _ratio_cell(distinct: int, sib: int, stable: bool = False) -> str:
        if sib <= 0:
            return "—"
        pct = int((distinct / sib) * 100)
        if stable:
            return f"{distinct}/{sib}*"
        return f"{distinct}/{sib} ({pct}%)"

    verdict_emoji = {"PASS": "✅", "REVIEW": "⚠️", "FAIL": "❌"}

    for m in models:
        lines.append(
            f"| {m.modele_id} | {m.marque_name} | {m.modele_name[:30]} | {m.sibling_count} | "
            f"{_ratio_cell(m.distinct_content, m.sibling_count)} | "
            f"{_ratio_cell(m.distinct_normalized, m.sibling_count)} | "
            f"{_ratio_cell(m.distinct_block_seq, m.sibling_count, stable=True)} | "
            f"{_ratio_cell(m.distinct_semantic, m.sibling_count)} | "
            f"{_ratio_cell(m.distinct_faq, m.sibling_count)} | "
            f"{_ratio_cell(m.distinct_category, m.sibling_count)} | "
            f"{m.avg_diversity_score or 'n/a'} | "
            f"{verdict_emoji.get(m.verdict, '?')} {m.verdict} |"
        )

    lines.append("")
    lines.append("\\* `block_sequence` est attendu stable (structure des blocs constante).")
    lines.append("")

    # Collisions section
    failing_models = [m for m in models if m.verdict != "PASS"]
    if failing_models:
        lines.append("## Collisions détectées")
        lines.append("")
        for m in failing_models:
            lines.append(f"### {m.modele_id} {m.modele_name} — verdict {m.verdict}")
            lines.append("")
            lines.append(f"Slots sous seuil: {', '.join(m.slots_failing)}")
            lines.append("")
            for slot_label, coll_list in m.collisions.items():
                if not coll_list:
                    continue
                hint = SLOT_TO_POOL_HINT.get(f"distinct_{slot_label.replace('_fingerprint','').replace('_signature','')}", "")
                lines.append(f"**{slot_label}** (pool hint: {hint}) :")
                lines.append("")
                for c in coll_list[:10]:
                    lines.append(
                        f"- hash `{c['hash']}` → type_ids {c['type_ids']} "
                        f"({c['collision_count']} collisions)"
                    )
                lines.append("")

    lines.append("## Actions recommandées")
    lines.append("")
    if summary.global_verdict == "PASS":
        lines.append("- Aucune action. Diversité conforme au seuil.")
    else:
        lines.append("- Enrichir pools sous-dimensionnés ci-dessus (augmenter N vers prime supérieur).")
        lines.append("- Re-enrichir les modèles REVIEW/FAIL via `POST /api/admin/r8/enrich/:typeId`.")
        lines.append("- Re-run `r8-diversity-check` post-enrichement.")

    lines.append("")
    return "\n".join(lines)


def format_json(summary: RunSummary, models: list[ModelReport]) -> str:
    payload = {
        "summary": asdict(summary),
        "models": [asdict(m) for m in models],
    }
    return json.dumps(payload, indent=2, ensure_ascii=False, default=str)


# ── Orchestrator ─────────────────────────────────────────────────────────────


def run_check(
    *,
    brand: str | None,
    modele_id: int | None,
    slug: str | None,
    batch: bool,
    threshold_pct: int,
    output_format: str,
) -> int:
    """Main orchestrator. Returns exit code."""
    conn = psycopg2.connect(_build_dsn())
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # 1. Resolve scope
    cur_plain = conn.cursor()
    modele_ids, scope_label = resolve_modele_ids(
        cur_plain, brand=brand, modele_id=modele_id, slug=slug, batch=batch
    )
    cur_plain.close()

    # 2. Aggregate per modele_id
    cur.execute(AGGREGATE_SQL, {"modele_ids": modele_ids})
    rows = cur.fetchall()

    if not rows:
        sys.stderr.write(
            f"[WARN] No R8 pages found for scope {scope_label}. "
            f"Run enricher first (POST /api/admin/r8/enrich/:typeId).\n"
        )
        return 3

    # 3. Build reports + compute verdict
    models: list[ModelReport] = []
    for r in rows:
        m = ModelReport(
            modele_id=r["modele_id"],
            modele_name=r["modele_name"] or "",
            marque_name=r["marque_name"] or "",
            sibling_count=r["sibling_count"],
            distinct_content=r["distinct_content"],
            distinct_normalized=r["distinct_normalized"],
            distinct_block_seq=r["distinct_block_seq"],
            distinct_semantic=r["distinct_semantic"],
            distinct_faq=r["distinct_faq"],
            distinct_category=r["distinct_category"],
            avg_diversity_score=float(r["avg_diversity_score"])
            if r["avg_diversity_score"] is not None
            else None,
            index_count=r["index_count"],
            review_count=r["review_count"],
            regenerate_count=r["regenerate_count"],
            reject_count=r["reject_count"],
        )
        m.compute_verdict(threshold_pct)
        # 4. Fetch collisions if failing
        if m.verdict != "PASS":
            m.collisions = fetch_collisions(cur, m.modele_id, m.slots_failing)
        models.append(m)

    # 5. Global summary
    pass_count = sum(1 for m in models if m.verdict == "PASS")
    review_count = sum(1 for m in models if m.verdict == "REVIEW")
    fail_count = sum(1 for m in models if m.verdict == "FAIL")

    # Global verdict : FAIL si ≥ 50% modeles en FAIL, sinon REVIEW si ≥ 1 non-PASS
    if fail_count >= max(1, len(models) // 2) or any(m.verdict == "FAIL" for m in models) and len(models) == 1:
        global_verdict = "FAIL"
    elif review_count > 0 or fail_count > 0:
        global_verdict = "REVIEW"
    else:
        global_verdict = "PASS"

    summary = RunSummary(
        run_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        threshold_pct=threshold_pct,
        scope=scope_label,
        total_models=len(models),
        pass_count=pass_count,
        review_count=review_count,
        fail_count=fail_count,
        global_verdict=global_verdict,
    )

    # 6. Format output
    if output_format == "json":
        sys.stdout.write(format_json(summary, models))
        sys.stdout.write("\n")
    else:
        sys.stdout.write(format_markdown(summary, models))

    cur.close()
    conn.close()

    # 7. Exit code
    if global_verdict == "PASS":
        return 0
    if global_verdict == "REVIEW":
        return 1
    return 2


# ── CLI ──────────────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="R8 Diversity Check — ADR-022 anti-duplicate verification",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    scope = parser.add_mutually_exclusive_group(required=True)
    scope.add_argument("--brand", help="Marque alias (ex: smart, renault, dacia)")
    scope.add_argument("--modele-id", type=int, help="modele_id direct (ex: 140004)")
    scope.add_argument("--slug", help="Slug brand-model (ex: renault-clio-3)")
    scope.add_argument(
        "--batch", action="store_true", help="Tous modèles ≥ 3 pages R8 indexées"
    )

    parser.add_argument(
        "--threshold",
        type=int,
        default=DEFAULT_THRESHOLD_PCT,
        help=f"Seuil distinct %% (default {DEFAULT_THRESHOLD_PCT})",
    )
    parser.add_argument(
        "--format",
        choices=["markdown", "json"],
        default="markdown",
        help="Output format",
    )

    args = parser.parse_args(argv)

    try:
        return run_check(
            brand=args.brand,
            modele_id=args.modele_id,
            slug=args.slug,
            batch=args.batch,
            threshold_pct=args.threshold,
            output_format=args.format,
        )
    except psycopg2.Error as e:
        sys.stderr.write(f"[FATAL] DB error: {e}\n")
        return 3
    except Exception as e:
        sys.stderr.write(f"[FATAL] Unexpected error: {e}\n")
        return 3


if __name__ == "__main__":
    sys.exit(main())
