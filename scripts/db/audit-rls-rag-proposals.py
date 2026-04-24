#!/usr/bin/env python3
"""
A03 — RLS audit for __rag_proposals (ADR-022 R8 RAG Control Plane).

Audits the __rag_proposals table against ADR-021 zero-trust invariants :
  C1. RLS enabled on table
  C2. Exactly one policy, named 'service_role_all', FOR ALL TO service_role
  C3. No anon grants (zero-trust)
  C4. No authenticated grants (zero-trust)
  C5. 4 CHECK constraints present (target_kind, status, risk_level, approved_requires_validation)
  C6. 7 indexes present (pkey + proposal_uuid uniq + 5 explicit)
  C7. Supabase advisor returns no finding for __rag_proposals (checked via MCP or skipped)

Pattern aligned with scripts/db/adr017-create-index-concurrently.py (psycopg2 direct).

Usage :
  export SUPABASE_DB_PASSWORD=... (or backend/.env)
  python3 scripts/db/audit-rls-rag-proposals.py

Exit 0 if all checks pass, 1 otherwise. Intended for CI and manual audit.
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
    f"application_name=adr022-audit-rls"
)

passed = 0
failed = 0


def check(name: str, expected: str | int, actual: str | int) -> None:
    global passed, failed
    if str(expected) == str(actual):
        print(f"  ✓ {name} = {actual}")
        passed += 1
    else:
        print(f"  ✗ {name} expected={expected} actual={actual}")
        failed += 1


def main() -> int:
    conn = psycopg2.connect(DSN)
    conn.autocommit = True
    cur = conn.cursor()

    print("=== A03 RLS Audit __rag_proposals ===\n")

    # C1: RLS enabled
    print("[C1] RLS enabled")
    cur.execute(
        "SELECT relrowsecurity FROM pg_class "
        "WHERE relname = '__rag_proposals' "
        "AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')"
    )
    row = cur.fetchone()
    check("rls_enabled", True, row[0] if row else None)

    # C2: exactly 1 policy named 'service_role_all'
    print("[C2] Exactly one policy 'service_role_all'")
    cur.execute(
        "SELECT COUNT(*) FROM pg_policies "
        "WHERE schemaname='public' AND tablename='__rag_proposals'"
    )
    check("policy_count", 1, cur.fetchone()[0])

    cur.execute(
        "SELECT policyname FROM pg_policies "
        "WHERE schemaname='public' AND tablename='__rag_proposals' LIMIT 1"
    )
    row = cur.fetchone()
    check("policy_name", "service_role_all", row[0] if row else "missing")

    cur.execute(
        "SELECT roles::text FROM pg_policies "
        "WHERE schemaname='public' AND tablename='__rag_proposals' LIMIT 1"
    )
    row = cur.fetchone()
    check("policy_role", "{service_role}", row[0] if row else "missing")

    # C3: no anon grants
    print("[C3] No anon grants (zero-trust)")
    cur.execute(
        "SELECT COUNT(*) FROM information_schema.role_table_grants "
        "WHERE table_schema='public' AND table_name='__rag_proposals' AND grantee='anon'"
    )
    check("anon_grants", 0, cur.fetchone()[0])

    # C4: no authenticated grants
    print("[C4] No authenticated grants (zero-trust)")
    cur.execute(
        "SELECT COUNT(*) FROM information_schema.role_table_grants "
        "WHERE table_schema='public' AND table_name='__rag_proposals' AND grantee='authenticated'"
    )
    check("authenticated_grants", 0, cur.fetchone()[0])

    # C5: 4 CHECK constraints
    print("[C5] 4 CHECK constraints")
    cur.execute(
        "SELECT COUNT(*) FROM pg_constraint "
        "WHERE conrelid='public.__rag_proposals'::regclass AND contype='c'"
    )
    check("check_count", 4, cur.fetchone()[0])

    expected_checks = {
        "chk_target_kind",
        "chk_status",
        "chk_risk_level",
        "chk_approved_requires_validation",
    }
    cur.execute(
        "SELECT conname FROM pg_constraint "
        "WHERE conrelid='public.__rag_proposals'::regclass AND contype='c'"
    )
    actual_checks = {row[0] for row in cur.fetchall()}
    check("check_names_match", expected_checks == actual_checks, True)

    # C6: 7 indexes
    print("[C6] 7 indexes")
    cur.execute(
        "SELECT COUNT(*) FROM pg_indexes "
        "WHERE schemaname='public' AND tablename='__rag_proposals'"
    )
    check("index_count", 7, cur.fetchone()[0])

    expected_indexes = {
        "__rag_proposals_pkey",
        "__rag_proposals_proposal_uuid_key",
        "idx_rag_proposals_status_expires",
        "idx_rag_proposals_target_slug",
        "idx_rag_proposals_fingerprint_active",
        "idx_rag_proposals_depends_on",
        "idx_rag_proposals_superseded_by",
    }
    cur.execute(
        "SELECT indexname FROM pg_indexes "
        "WHERE schemaname='public' AND tablename='__rag_proposals'"
    )
    actual_indexes = {row[0] for row in cur.fetchall()}
    missing = expected_indexes - actual_indexes
    unexpected = actual_indexes - expected_indexes
    if missing or unexpected:
        print(f"  ✗ index_names missing={missing} unexpected={unexpected}")
        globals()["failed"] = failed + 1  # type: ignore
    else:
        print(f"  ✓ index_names_match = True")
        globals()["passed"] = passed + 1  # type: ignore

    cur.close()
    conn.close()

    print(f"\n=== Summary : {passed} passed / {failed} failed ===")

    if failed > 0:
        print("FAIL")
        return 1

    print("PASS — __rag_proposals RLS audit clean (ADR-021 zero-trust aligned)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
