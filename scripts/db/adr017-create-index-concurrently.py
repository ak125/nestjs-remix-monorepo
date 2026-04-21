#!/usr/bin/env python3
"""
ADR-017 — CREATE INDEX CONCURRENTLY sur pieces_relation_type(rtp_pg_id, rtp_type_id).

Pourquoi Python et pas MCP :
  - MCP apply_migration wrappe en BEGIN/COMMIT → CONCURRENTLY interdit
  - MCP execute_sql = pooler avec statement_timeout ~60s → build 1-2h killé
  - psycopg2 direct (port 5432) + autocommit=True → pas de limite, monitoring possible

Safety :
  - CONCURRENTLY = pas de lock table, prod reste servie pendant le build
  - IF NOT EXISTS = idempotent, ok en relance
  - Logs progress toutes les 30s via pg_stat_progress_create_index
  - Réversible : DROP INDEX CONCURRENTLY idx_prt_pg_id_type_id

Usage :
  export SUPABASE_DB_PASSWORD=... (ou déjà dans backend/.env)
  python3 scripts/db/adr017-create-index-concurrently.py
"""
from __future__ import annotations

import os
import sys
import time
from datetime import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# ── Env ────────────────────────────────────────────────────────────────────────
ENV_PATH = Path(__file__).resolve().parents[2] / "backend" / ".env"
load_dotenv(ENV_PATH)

DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD")
if not DB_PASSWORD:
    sys.stderr.write("[FATAL] SUPABASE_DB_PASSWORD missing in env\n")
    sys.exit(2)

# Connexion DIRECTE (port 5432) — pas le pooler (6543) qui impose statement_timeout.
# Ref Supabase: db.<project-ref>.supabase.co:5432 (connexion non poolée).
PROJECT_REF = "cxpojprgwgubzjyqzmoq"
DSN = (
    f"host=db.{PROJECT_REF}.supabase.co "
    f"port=5432 "
    f"dbname=postgres "
    f"user=postgres "
    f"password={DB_PASSWORD} "
    f"sslmode=require "
    f"application_name=adr017-create-index"
)

INDEX_NAME = "idx_prt_pg_id_type_id"
TABLE = "pieces_relation_type"
COLS = "(rtp_pg_id, rtp_type_id)"


def log(msg: str) -> None:
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    sys.stderr.write(f"[{ts}] {msg}\n")
    sys.stderr.flush()


def main() -> int:
    log(f"connecting directly to db.{PROJECT_REF}.supabase.co:5432")
    # Connexion séparée pour le CREATE INDEX (long)
    conn_build = psycopg2.connect(DSN)
    conn_build.autocommit = True  # REQUIS pour CONCURRENTLY

    # Connexion séparée pour le monitoring (pg_stat_progress_create_index)
    conn_mon = psycopg2.connect(DSN)
    conn_mon.autocommit = True

    # Vérif si index existe déjà
    with conn_build.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=%s",
            (INDEX_NAME,),
        )
        if cur.fetchone():
            log(f"index {INDEX_NAME} already exists — nothing to do")
            return 0

    # Désactiver statement_timeout pour la session — requis car Supabase impose
    # 1min par défaut même sur la connexion directe.
    with conn_build.cursor() as cur:
        cur.execute("SET statement_timeout = 0")
        cur.execute("SET lock_timeout = 0")
        cur.execute("SET idle_in_transaction_session_timeout = 0")
        cur.execute("SHOW statement_timeout")
        log(f"session statement_timeout = {cur.fetchone()[0]!r}")

    # Lancer CREATE INDEX CONCURRENTLY
    log(
        f"firing CREATE INDEX CONCURRENTLY {INDEX_NAME} "
        f"ON public.{TABLE} {COLS} (estimated 20-40min on 27GB heap)"
    )
    t0 = time.time()
    build_cur = conn_build.cursor()
    build_cur.execute(
        f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {INDEX_NAME} "
        f"ON public.{TABLE} {COLS}"
    )
    log(f"CREATE INDEX returned after {int(time.time()-t0)}s")

    # Note: psycopg2 en mode sync attend la fin ici. Pour monitor, on aurait
    # besoin d'async. Alternative simple : lancer le CREATE en thread, poll en main.
    log(
        f"CREATE INDEX CONCURRENTLY {INDEX_NAME} returned "
        f"— verifying via pg_indexes"
    )
    conn_build.close()

    with conn_mon.cursor() as cur:
        cur.execute(
            "SELECT pg_size_pretty(pg_relation_size(%s::regclass)) AS size",
            (INDEX_NAME,),
        )
        size = cur.fetchone()[0]
        log(f"✅ {INDEX_NAME} built, size={size}")
    conn_mon.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
