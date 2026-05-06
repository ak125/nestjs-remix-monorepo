#!/usr/bin/env python3
"""
backfill-r1-safe-table.py — Backfill `r1s_safe_table_rows` JSONB array
for __seo_r1_gamme_slots rows where the field is NULL.

Mirrors `scripts/seo/backfill-r1-gatekeeper.py` pattern (psycopg2 +
.env + dry-run + resume-safe). Deterministic, non-LLM extraction from
RAG knowledge files at /opt/automecanik/rag/knowledge/gammes/<alias>.md.

Closes ADR-041 §2.C (vault PR #169) — gap measured by audit Q1 of
scripts/seo/audit-r1-coverage.sql (PR #326): 26/169 slots populated,
143/169 missing. After this run, has_safe_table = 169/169.

Source RAG fields (per gamme):
  selection.cost_range  → row "Équipementiers et budget"
  selection.brands.premium → bundled into the same row
  domain.related_parts  → row "Pièces associées recommandées"
  domain.confusion_with → row "Distinction avec X" (if term ≠ placeholder)
  pg_name (DB)          → row "Compatibilité <pg_name>"

Canonical row count: 3 rows guaranteed (compat + brands+budget + related).
+1 row if confusion_with[0].term is specific (not 'piece-voisine-meme-systeme').

Idempotency: WHERE r1s_safe_table_rows IS NULL guard. Re-running touches
0 rows.

Usage:
  python3 scripts/seo/backfill-r1-safe-table.py [--limit N] [--dry-run] [--gamme alias]

Required env (backend/.env):
  SUPABASE_DB_PASSWORD
"""
from __future__ import annotations

import argparse
import json as jsonlib
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras
import yaml
from dotenv import load_dotenv

# ==========================================================================
# CONFIG
# ==========================================================================

ENV_PATH = Path(__file__).resolve().parents[2] / "backend" / ".env"
load_dotenv(ENV_PATH)

PROJECT_REF = "cxpojprgwgubzjyqzmoq"
RAG_GAMMES_DIR = Path("/opt/automecanik/rag/knowledge/gammes")
PLACEHOLDER_CONFUSION_TERM = "piece-voisine-meme-systeme"


def log(msg: str) -> None:
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    sys.stderr.write(f"[{ts}] {msg}\n")
    sys.stderr.flush()


def build_dsn() -> str:
    pwd = os.environ.get("SUPABASE_DB_PASSWORD")
    if not pwd:
        sys.stderr.write("[FATAL] SUPABASE_DB_PASSWORD missing in env\n")
        sys.exit(2)
    return (
        f"host=db.{PROJECT_REF}.supabase.co port=5432 dbname=postgres "
        f"user=postgres password={pwd} sslmode=require "
        f"application_name=backfill-r1-safe-table"
    )


# ==========================================================================
# DB
# ==========================================================================


def fetch_null_targets(conn) -> list[tuple[str, str, str]]:
    """Return [(pg_id_text, pg_alias, pg_name), ...] for r1 slots missing safe_table."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT r1s.r1s_pg_id, pg.pg_alias, pg.pg_name
            FROM __seo_r1_gamme_slots r1s
            LEFT JOIN pieces_gamme pg ON pg.pg_id::text = r1s.r1s_pg_id
            WHERE r1s.r1s_safe_table_rows IS NULL
              AND pg.pg_alias IS NOT NULL
            ORDER BY pg.pg_alias
            """
        )
        return [(row[0], row[1], row[2]) for row in cur.fetchall()]


def write_safe_table(conn, pg_id: str, rows: list[dict[str, str]]) -> bool:
    """Idempotent UPDATE. Returns True iff a row was actually updated."""
    payload = jsonlib.dumps(rows, ensure_ascii=False)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE __seo_r1_gamme_slots
            SET r1s_safe_table_rows = %s::jsonb
            WHERE r1s_pg_id = %s
              AND r1s_safe_table_rows IS NULL
            """,
            (payload, pg_id),
        )
        return cur.rowcount == 1


# ==========================================================================
# RAG → safe_table_rows construction
# ==========================================================================


def read_rag_frontmatter(alias: str) -> dict[str, Any] | None:
    fp = RAG_GAMMES_DIR / f"{alias}.md"
    if not fp.exists():
        return None
    raw = fp.read_text(encoding="utf-8")
    parts = raw.split("---", 2)
    if len(parts) < 3:
        return None
    try:
        return yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError:
        return None


def build_compat_row(pg_name: str) -> dict[str, str]:
    return {
        "element": f"Compatibilité {pg_name} avec votre véhicule",
        "howToCheck": "Sélectionner marque, modèle et motorisation pour obtenir la référence constructeur",
    }


def build_brands_budget_row(fm: dict[str, Any]) -> dict[str, str] | None:
    """Compose 'Équipementiers et budget' from selection.brands + cost_range."""
    sel = fm.get("selection") or {}
    brands = (sel.get("brands") or {}).get("premium") or []
    cost = sel.get("cost_range") or {}

    has_brands = len(brands) >= 1
    has_cost = isinstance(cost.get("min"), (int, float)) and isinstance(cost.get("max"), (int, float))
    if not has_brands and not has_cost:
        return None

    parts: list[str] = []
    if has_brands:
        if len(brands) >= 2:
            parts.append(f"{brands[0]} et {brands[1]} en premium")
        else:
            parts.append(f"{brands[0]} en premium")
    if has_cost:
        unit = cost.get("unit") or "l'unité"
        currency = cost.get("currency") or "EUR"
        parts.append(f"budget de {cost['min']} à {cost['max']} {currency} selon {unit}")

    return {
        "element": "Équipementiers et budget indicatif",
        "howToCheck": " ; ".join(parts),
    }


def build_related_parts_row(fm: dict[str, Any]) -> dict[str, str] | None:
    related = (fm.get("domain") or {}).get("related_parts") or []
    # Filter out pseudo-related (verbs incorrectly placed in this field by old enrichers)
    real_related = [r for r in related if isinstance(r, str) and "-" in r]
    if not real_related:
        return None
    head = real_related[:2]
    if len(head) == 1:
        list_str = head[0]
    else:
        list_str = f"{head[0]} et {head[1]}"
    return {
        "element": "Pièces associées recommandées",
        "howToCheck": f"Vérifier également : {list_str} (usure souvent simultanée)",
    }


def build_confusion_row(fm: dict[str, Any]) -> dict[str, str] | None:
    cw_list = (fm.get("domain") or {}).get("confusion_with") or fm.get("confusion_with") or []
    if not isinstance(cw_list, list):
        return None
    for entry in cw_list:
        if not isinstance(entry, dict):
            continue
        term = entry.get("term") or ""
        diff = entry.get("difference") or ""
        if not term or term == PLACEHOLDER_CONFUSION_TERM:
            continue
        # truncate difference to keep row readable
        diff_short = diff[:200].rstrip()
        return {
            "element": f"Distinction avec {term.replace('-', ' ')}",
            "howToCheck": diff_short or f"Vérifier la référence exacte pour distinguer du {term}",
        }
    return None


def build_safe_table_rows(pg_name: str, fm: dict[str, Any]) -> list[dict[str, str]]:
    """Build 3 to 4 rows per gamme. Always-on: compat. Conditional: brands+budget,
    related_parts, confusion_with (if specific)."""
    rows: list[dict[str, str]] = [build_compat_row(pg_name)]
    bb = build_brands_budget_row(fm)
    if bb:
        rows.append(bb)
    rp = build_related_parts_row(fm)
    if rp:
        rows.append(rp)
    cw = build_confusion_row(fm)
    if cw:
        rows.append(cw)
    return rows


# ==========================================================================
# MAIN
# ==========================================================================


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Backfill r1s_safe_table_rows JSONB from RAG mirror frontmatter"
    )
    ap.add_argument("--limit", type=int, default=0, help="cap iterations (0=all)")
    ap.add_argument("--dry-run", action="store_true", help="no DB write")
    ap.add_argument("--gamme", help="restrict to one pg_alias (debug)")
    args = ap.parse_args()

    log(f"backfill-r1-safe-table start — dry_run={args.dry_run} limit={args.limit or 'all'}")

    conn = psycopg2.connect(build_dsn())
    try:
        targets = fetch_null_targets(conn)
        log(f"found {len(targets)} row(s) with r1s_safe_table_rows IS NULL")

        if args.gamme:
            targets = [t for t in targets if t[1] == args.gamme]
            if not targets:
                log(f"gamme '{args.gamme}' not in NULL set — nothing to do")
                return 0
        if args.limit > 0:
            targets = targets[: args.limit]

        log(f"processing {len(targets)} target(s)")

        stats = {
            "ok": 0,
            "skip_no_rag": 0,
            "skip_yaml_error": 0,
            "skip_no_rows": 0,
            "skip_idempotent": 0,
            "error": 0,
        }
        for i, (pg_id, alias, pg_name) in enumerate(targets, 1):
            fm = read_rag_frontmatter(alias)
            if fm is None:
                stats["skip_no_rag"] += 1
                log(f"  [{i:3d}/{len(targets)}] {alias} → SKIP no RAG file or YAML parse error")
                continue
            rows = build_safe_table_rows(pg_name, fm)
            if len(rows) < 2:
                stats["skip_no_rows"] += 1
                log(f"  [{i:3d}/{len(targets)}] {alias} → SKIP only {len(rows)} row(s) buildable (min 2)")
                continue

            if args.dry_run:
                stats["ok"] += 1
                log(f"  [{i:3d}/{len(targets)}] {alias} (pg_id={pg_id}) → [DRY] {len(rows)} rows ready")
                continue

            try:
                wrote = write_safe_table(conn, pg_id, rows)
                conn.commit()
                if wrote:
                    stats["ok"] += 1
                    log(f"  [{i:3d}/{len(targets)}] {alias} (pg_id={pg_id}) → OK {len(rows)} rows")
                else:
                    stats["skip_idempotent"] += 1
                    log(f"  [{i:3d}/{len(targets)}] {alias} (pg_id={pg_id}) → SKIP not NULL anymore")
            except Exception as exc:
                conn.rollback()
                stats["error"] += 1
                log(f"  [{i:3d}/{len(targets)}] {alias} (pg_id={pg_id}) → ERROR {type(exc).__name__}: {exc}")

        log(f"=== Résumé : {stats} ===")
        return 0 if stats["error"] == 0 else 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
