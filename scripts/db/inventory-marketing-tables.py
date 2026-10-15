#!/usr/bin/env python3
"""
ADR-036 Phase 1 — Inventory existing marketing tables before any CREATE.

Inventaire historique étendu pour la réconciliation Phase1 : vérifier le schéma
effectif et les deux registres avant de préparer un correctif. Le code local
et un statut de migration ne prouvent pas la présence des objets en base.

Tables ciblées :
  - 9 tables __marketing_* existantes (schéma + row_count)
  - ___xtr_customer (cherche cst_*marketing*|cst_*consent* déjà présents)

Pourquoi Python et pas MCP : grep règle utilisateur "utiliser python au lieu de mcp".
Mode : transaction READ ONLY. Aucun changement de schema ni de registre.
--prepare-phase1 FILE : prepare hors ligne le preflight cible, sans connexion.

Usage :
  python3 scripts/db/inventory-marketing-tables.py
"""
from __future__ import annotations

import os
import sys
import argparse
import hashlib
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parents[2] / "backend" / ".env"
PROJECT_REF = "cxpojprgwgubzjyqzmoq"


def connect():
    import psycopg2
    from dotenv import load_dotenv
    load_dotenv(ENV_PATH)
    password = os.environ.get("SUPABASE_DB_PASSWORD")
    if not password:
        raise RuntimeError("SUPABASE_DB_PASSWORD missing in env")
    conn = psycopg2.connect(
        host=f"db.{PROJECT_REF}.supabase.co", port=5432, dbname="postgres",
        user="postgres", password=password, sslmode="require",
        application_name="adr036-inventory", connect_timeout=10,
    )
    conn.set_session(readonly=True, autocommit=False, isolation_level="REPEATABLE READ")
    return conn


def prepare_phase1(path: Path) -> int:
    source = Path(__file__).with_name("marketing-phase1-inventory.sql")
    try:
        sql = source.read_text(encoding="utf-8")
        digest = hashlib.sha256(sql.encode()).hexdigest()
        with path.open("x", encoding="utf-8", newline="\n") as out:
            out.write(f"-- Source: {source.name}; SHA256 UTF-8/LF: {digest}\n" + sql)
    except (OSError, ValueError) as error:
        sys.stderr.write(f"[FATAL] {error}\n")
        return 1
    print(f"[prepared] {path}; offline, not executed")
    return 0

MARKETING_TABLES = [
    "__marketing_backlinks",
    "__marketing_brand_rules",
    "__marketing_campaigns",
    "__marketing_content_roadmap",
    "__marketing_kpi_snapshots",
    "__marketing_outreach",
    "__marketing_social_posts",
    "__marketing_utm_registry",
    "__marketing_weekly_plans",
]

CUSTOMER_PATTERNS = [
    "cst_%marketing%",
    "cst_%consent%",
    "cst_%opt_in%",
    "cst_%newsletter%",
    "cst_%mail_consent%",
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare-phase1", type=Path, metavar="FILE")
    args = parser.parse_args()
    if args.prepare_phase1:
        return prepare_phase1(args.prepare_phase1)
    print(f"[connect] {PROJECT_REF}.supabase.co:5432 (direct, non-pooler)")
    conn = connect()
    cur = conn.cursor()
    cur.execute("SET LOCAL statement_timeout = '15s'")
    cur.execute("SET LOCAL lock_timeout = '2s'")

    # ── Section 1: existing __marketing_* table schemas ─────────────────────
    print("\n" + "=" * 80)
    print("SECTION 1 — existing __marketing_* tables (schema + row count)")
    print("=" * 80)

    for table in MARKETING_TABLES:
        # Existence check
        cur.execute(
            """
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name=%s
            )
            """,
            (table,),
        )
        exists = cur.fetchone()[0]

        print(f"\n[{table}] exists={exists}")
        if not exists:
            continue

        # Columns
        cur.execute(
            """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name=%s
            ORDER BY ordinal_position
            """,
            (table,),
        )
        cols = cur.fetchall()
        for col in cols:
            null_str = "NULL" if col[2] == "YES" else "NOT NULL"
            default_str = f" DEFAULT {col[3]}" if col[3] else ""
            print(f"  - {col[0]}: {col[1]} {null_str}{default_str}")

        # Row count
        cur.execute(f'SELECT COUNT(*) FROM public."{table}"')
        count = cur.fetchone()[0]
        print(f"  → rows: {count}")

        # CHECK constraints
        cur.execute(
            """
            SELECT con.conname, pg_get_constraintdef(con.oid)
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname='public' AND rel.relname=%s AND con.contype='c'
            """,
            (table,),
        )
        constraints = cur.fetchall()
        for c in constraints:
            print(f"  CHECK: {c[0]} → {c[1]}")

    # ── Section 2: ___xtr_customer marketing/consent columns ─────────────────
    print("\n" + "=" * 80)
    print("SECTION 2 — ___xtr_customer existing marketing/consent columns")
    print("=" * 80)

    for pattern in CUSTOMER_PATTERNS:
        cur.execute(
            """
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name='___xtr_customer'
              AND column_name ILIKE %s
            """,
            (pattern,),
        )
        rows = cur.fetchall()
        if rows:
            print(f"\n  pattern '{pattern}':")
            for r in rows:
                print(f"    - {r[0]}: {r[1]} ({'NULL' if r[2]=='YES' else 'NOT NULL'})")
        else:
            print(f"  pattern '{pattern}': no match")

    # All cst_* columns for context
    print("\n  All ___xtr_customer columns (full inventory):")
    cur.execute(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='___xtr_customer'
        ORDER BY ordinal_position
        """
    )
    for r in cur.fetchall():
        print(f"    - {r[0]}: {r[1]}")

    # ── Section 3: feedback/retention/brief candidates ──────────────────────
    print("\n" + "=" * 80)
    print("SECTION 3 — search for retention/brief/feedback patterns")
    print("=" * 80)

    cur.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema='public'
          AND (table_name ILIKE '%brief%'
               OR table_name ILIKE '%retention%'
               OR table_name ILIKE '%trigger_rule%'
               OR table_name ILIKE '%feedback%'
               OR table_name ILIKE '%consent%')
        ORDER BY table_name
        """
    )
    rows = cur.fetchall()
    if rows:
        for r in rows:
            print(f"  - {r[0]}")
    else:
        print("  no match")

    cur.close()
    conn.rollback()
    conn.close()
    print("\n[done]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
