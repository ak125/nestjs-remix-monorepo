#!/usr/bin/env python3
"""
SEO Snapshot Baseline Rates — D-0 anti-duplicate balise baseline.

Computes the 5 baseline rates of the plan (Track A, D-0) from the OBSERVED
balises captured by the SyntheticCrawler into __seo_snapshot_synthetic
(title / h1 / meta-description, + http_code / robots / x-robots for indexability).

These are HEAD-level (balise) signals — exactly the anti-duplicate-balise
surface the plan measures (title/desc/h1). Body-content fingerprints are a
SEPARATE concern (SeoFingerprintCore / r8-diversity-check.py, live producer
tables) and are deliberately NOT mixed in here.

Pattern aligned with scripts/qa/r8-diversity-check.py (psycopg2 direct,
deterministic, pure rate functions for testability).

Sibling grouping : pages sharing the same parent path (route_path minus its
last segment) are siblings — motorisations of the same model (R8) or the same
gamme×marque×modele (R2). Exact/near duplicate is measured WITHIN sibling groups
(only pages that can legitimately collide).

Usage:
    # R8 (constructeurs) baseline, last 24h
    python3 scripts/qa/seo-snapshot-baseline-rates.py --route-prefix /constructeurs/

    # R2 (pieces) baseline, last 48h, with a known universe size for coverage
    python3 scripts/qa/seo-snapshot-baseline-rates.py --route-prefix /pieces/ \
        --freshness-hours 48 --expected-total 102510

    # JSON output for CI / dashboards
    python3 scripts/qa/seo-snapshot-baseline-rates.py --route-prefix /constructeurs/ --format json

Exit codes:
    0 — Report produced (baseline is report-only by design; no gating verdict)
    3 — Technical error (DB connection, SQL, or no rows in the window)

References:
    Plan : balises R0→R8, Track A, D-0 (SyntheticCrawler étendu)
    Table read : __seo_snapshot_synthetic (colonnes balise ajoutées 2026-06-27)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# ── Env / DSN (mirror r8-diversity-check.py) ────────────────────────────────

ENV_PATH = Path(__file__).resolve().parents[2] / "backend" / ".env"
load_dotenv(ENV_PATH)

PROJECT_REF = "cxpojprgwgubzjyqzmoq"
DB_PASSWORD = os.getenv("SUPABASE_DB_PASSWORD")

DEFAULT_FRESHNESS_HOURS = 24


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
        f"application_name=seo-snapshot-baseline-rates"
    )


# Latest snapshot row per URL within the freshness window + route scope.
# DISTINCT ON (url) ORDER BY created_at DESC dedupes the append-only history
# (analogous to r8-diversity-check's latest_fingerprints CTE).
LATEST_SNAPSHOT_SQL = """
SELECT DISTINCT ON (url)
    url,
    route_path,
    http_code,
    robots_meta,
    x_robots_tag,
    has_title,
    title_text,
    has_h1,
    h1_text,
    has_canonical,
    has_meta_description,
    meta_description
FROM public.__seo_snapshot_synthetic
WHERE created_at >= NOW() - (%(freshness_hours)s * INTERVAL '1 hour')
  AND route_path LIKE %(route_like)s
ORDER BY url, created_at DESC
"""


# ── Pure helpers (testable, no I/O) ─────────────────────────────────────────


def group_key(route_path: str) -> str:
    """Sibling group = parent path (route_path minus its last segment).

    /constructeurs/renault/clio-iii/1-5-dci.html -> /constructeurs/renault/clio-iii/
    """
    idx = route_path.rfind("/")
    return route_path[: idx + 1] if idx >= 0 else route_path


def normalize(text: Optional[str]) -> str:
    """Accent-fold + lowercase + whitespace-collapse for near-dup matching."""
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text)
    folded = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(folded.lower().split())


def is_effectively_indexable(http_code: int, robots_meta: Optional[str],
                             x_robots_tag: Optional[str]) -> bool:
    """Observed-effective indexability the bot actually saw."""
    if not (200 <= http_code <= 299):
        return False
    if robots_meta and "noindex" in robots_meta.lower():
        return False
    if x_robots_tag and "noindex" in x_robots_tag.lower():
        return False
    return True


def lacks_discriminant(row: dict) -> bool:
    """The balise lacks a distinguishing field (title or h1 absent/empty)."""
    if not row.get("has_title") or not (row.get("title_text") or "").strip():
        return True
    if not row.get("has_h1") or not (row.get("h1_text") or "").strip():
        return True
    return False


def _collision_pages(rows: list[dict], key_fn) -> set[int]:
    """Indices of rows whose key_fn(row) value is shared by ≥1 sibling (same group)."""
    by_group_value: dict[tuple, list[int]] = defaultdict(list)
    for i, r in enumerate(rows):
        val = key_fn(r)
        if val == "":  # absent field is "missing", not a collision
            continue
        by_group_value[(r["_group"], val)].append(i)
    colliding: set[int] = set()
    for idxs in by_group_value.values():
        if len(idxs) >= 2:
            colliding.update(idxs)
    return colliding


@dataclass
class BaselineRates:
    observed_pages: int
    sibling_pages: int  # pages in a group of size >= 2 (denominator for dup rates)
    indexable_effective_rate: float
    missing_discriminant_rate: float
    title_exact_dup_rate: float
    h1_exact_dup_rate: float
    metadesc_exact_dup_rate: float
    exact_duplicate_rate: float  # title OR h1 OR meta-desc exact collision (within siblings)
    near_duplicate_rate: float  # normalized collision beyond exact (within siblings)
    coverage_observed: int  # distinct fresh URLs observed
    coverage_rate: Optional[float]  # observed / expected_total (None if not provided)


def compute_rates(rows: list[dict], expected_total: Optional[int]) -> BaselineRates:
    n = len(rows)
    if n == 0:
        return BaselineRates(0, 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0, None)

    for r in rows:
        r["_group"] = group_key(r["route_path"])

    # Whole-population rates.
    indexable = sum(
        1 for r in rows
        if is_effectively_indexable(r["http_code"], r.get("robots_meta"), r.get("x_robots_tag"))
    )
    missing = sum(1 for r in rows if lacks_discriminant(r))

    # Sibling subset (only multi-member groups can collide).
    group_size = Counter(r["_group"] for r in rows)
    sibling_idx = [i for i, r in enumerate(rows) if group_size[r["_group"]] >= 2]
    sibling_rows = [rows[i] for i in sibling_idx]
    g = len(sibling_rows)

    def field_exact(field_name):
        return _collision_pages(sibling_rows, lambda r: (r.get(field_name) or "").strip())

    def field_norm(field_name):
        return _collision_pages(sibling_rows, lambda r: normalize(r.get(field_name)))

    title_exact = field_exact("title_text")
    h1_exact = field_exact("h1_text")
    metadesc_exact = field_exact("meta_description")
    any_exact = title_exact | h1_exact | metadesc_exact

    title_norm = field_norm("title_text")
    h1_norm = field_norm("h1_text")
    metadesc_norm = field_norm("meta_description")
    any_norm = title_norm | h1_norm | metadesc_norm
    near_only = any_norm - any_exact  # normalized collision not already exact

    def rate(count, denom):
        return round(count / denom, 4) if denom else 0.0

    return BaselineRates(
        observed_pages=n,
        sibling_pages=g,
        indexable_effective_rate=rate(indexable, n),
        missing_discriminant_rate=rate(missing, n),
        title_exact_dup_rate=rate(len(title_exact), g),
        h1_exact_dup_rate=rate(len(h1_exact), g),
        metadesc_exact_dup_rate=rate(len(metadesc_exact), g),
        exact_duplicate_rate=rate(len(any_exact), g),
        near_duplicate_rate=rate(len(near_only), g),
        coverage_observed=n,
        coverage_rate=(round(n / expected_total, 4) if expected_total else None),
    )


# ── Formatters ──────────────────────────────────────────────────────────────


def to_markdown(rates: BaselineRates, scope: dict) -> str:
    cov = (
        f"{rates.coverage_rate:.2%} ({rates.coverage_observed}/{scope['expected_total']})"
        if rates.coverage_rate is not None
        else f"{rates.coverage_observed} URL distinctes (denominateur --expected-total non fourni)"
    )
    return "\n".join([
        f"# SEO Snapshot Baseline Rates — {scope['route_prefix']}",
        "",
        f"- Fenêtre : {scope['freshness_hours']}h | route LIKE `{scope['route_like']}`",
        f"- Pages observées (latest/URL) : **{rates.observed_pages}** "
        f"(dont {rates.sibling_pages} en groupe sœurs ≥2)",
        f"- Généré : {scope['generated_at']}",
        "",
        "## Indexabilité & couverture",
        f"- `indexable_effective_rate` : **{rates.indexable_effective_rate:.2%}** "
        "(2xx ∧ ¬noindex robots ∧ ¬noindex x-robots, observé)",
        f"- `coverage_rate` : {cov}",
        f"- `missing_discriminant_rate` : **{rates.missing_discriminant_rate:.2%}** "
        "(title ou h1 absent/vide)",
        "",
        "## Duplication de balises (parmi sœurs)",
        f"- `exact_duplicate_rate` : **{rates.exact_duplicate_rate:.2%}** "
        "(title OU h1 OU meta-desc identique à une sœur)",
        f"    - title exact : {rates.title_exact_dup_rate:.2%}",
        f"    - h1 exact : {rates.h1_exact_dup_rate:.2%}",
        f"    - meta-desc exact : {rates.metadesc_exact_dup_rate:.2%}",
        f"- `near_duplicate_rate` : **{rates.near_duplicate_rate:.2%}** "
        "(collision normalisée au-delà de l'exact ; HEAD-only, calibration P-7)",
        "",
        "> Mesure HEAD-level (balises émises). Le duplicate de CONTENU (corps) est",
        "> mesuré séparément (SeoFingerprintCore / r8-diversity-check.py).",
    ])


def to_json(rates: BaselineRates, scope: dict) -> str:
    return json.dumps({"scope": scope, "rates": asdict(rates)}, indent=2, ensure_ascii=False)


# ── Main ──────────────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--route-prefix",
        required=True,
        help="Prefixe de route a scoper (ex: /constructeurs/ pour R8, /pieces/ pour R2)",
    )
    parser.add_argument(
        "--freshness-hours", type=int, default=DEFAULT_FRESHNESS_HOURS,
        help=f"Fenetre de fraicheur du snapshot (defaut {DEFAULT_FRESHNESS_HOURS}h)",
    )
    parser.add_argument(
        "--expected-total", type=int, default=None,
        help="Taille de l'univers attendu (pour coverage_rate ; sinon compte brut)",
    )
    parser.add_argument("--format", choices=["md", "json"], default="md")
    parser.add_argument("--out", default=None, help="Fichier de sortie (sinon stdout)")
    args = parser.parse_args()

    route_like = args.route_prefix + "%"
    scope = {
        "route_prefix": args.route_prefix,
        "route_like": route_like,
        "freshness_hours": args.freshness_hours,
        "expected_total": args.expected_total,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        conn = psycopg2.connect(_build_dsn())
    except psycopg2.Error as e:
        sys.stderr.write(f"[FATAL] DB connect failed: {e}\n")
        return 3

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(LATEST_SNAPSHOT_SQL, {
                "freshness_hours": args.freshness_hours,
                "route_like": route_like,
            })
            rows = [dict(r) for r in cur.fetchall()]
    except psycopg2.Error as e:
        sys.stderr.write(f"[FATAL] query failed: {e}\n")
        return 3
    finally:
        conn.close()

    if not rows:
        sys.stderr.write(
            f"[FATAL] aucun snapshot dans la fenetre {args.freshness_hours}h "
            f"pour route LIKE '{route_like}'. Le crawler etendu a-t-il tourne ? "
            "(crawl planifie q15min, ou run seed-list R8 manuel)\n"
        )
        return 3

    rates = compute_rates(rows, args.expected_total)
    out = to_json(rates, scope) if args.format == "json" else to_markdown(rates, scope)

    if args.out:
        Path(args.out).write_text(out + "\n", encoding="utf-8")
        sys.stderr.write(f"[OK] ecrit -> {args.out}\n")
    else:
        print(out)

    return 0


if __name__ == "__main__":
    sys.exit(main())
