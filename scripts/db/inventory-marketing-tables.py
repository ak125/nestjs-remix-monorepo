#!/usr/bin/env python3
"""
ADR-036 Phase 1 — Inventory existing marketing tables before any CREATE.

Pourquoi : 9 tables __marketing_* existent déjà dans la DB (vérifiées via grep
backend/src/modules/marketing/), 0 migration dans backend/supabase/migrations/.
Avant tout CREATE TABLE pour Phase 1, vérifier si les structures existantes
peuvent être étendues plutôt que dupliquées (Q2 grep-first non-négociable).

Tables ciblées :
  - 9 tables __marketing_* existantes (schéma + row_count)
  - ___xtr_customer (cherche cst_*marketing*|cst_*consent* déjà présents)

Pourquoi Python et pas MCP : grep règle utilisateur "utiliser python au lieu de mcp".
Mode : SELECT only, non-destructif, safe sur prod read-only mirror.

Usage :
  python3 scripts/db/inventory-marketing-tables.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[2] / "backend" / ".env"
load_dotenv(ENV_PATH)

DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD")
if not DB_PASSWORD:
    sys.stderr.write("[FATAL] SUPABASE_DB_PASSWORD missing in env\n")
    sys.exit(2)

PROJECT_REF = "cxpojprgwgubzjyqzmoq"
DSN = (
    f"host=db.{PROJECT_REF}.supabase.co "
    f"port=5432 "
    f"dbname=postgres "
    f"user=postgres "
    f"password={DB_PASSWORD} "
    f"sslmode=require "
    f"application_name=adr036-inventory"
)

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
    print(f"[connect] {PROJECT_REF}.supabase.co:5432 (direct, non-pooler)")
    conn = psycopg2.connect(DSN, connect_timeout=10)
    conn.autocommit = True
    cur = conn.cursor()

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
    conn.close()
    print("\n[done]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
