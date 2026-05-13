"""
Tests Python contractuels sur la migration RPC `get_active_seo_projection`.

Vérifications statiques (sans connexion DB) :
- SECURITY DEFINER présent
- STABLE function (pas VOLATILE)
- search_path forcé (anti-hijack)
- Validation entity_id pattern
- GRANT EXECUTE explicite
- AUCUN INSERT/UPDATE/DELETE dans le body
- Mention 'No Direct Page SQL' / cohérence ADR-059
"""
from __future__ import annotations

from pathlib import Path

import pytest


MIGRATION_PATH = (
    Path(__file__).resolve().parents[2]
    / "backend"
    / "supabase"
    / "migrations"
    / "20260513204943_seo_projection_read_rpc.sql"
)


@pytest.fixture(scope="module")
def sql() -> str:
    assert MIGRATION_PATH.exists(), f"migration missing: {MIGRATION_PATH}"
    return MIGRATION_PATH.read_text(encoding="utf-8")


def test_function_name_canonical(sql: str) -> None:
    assert "FUNCTION get_active_seo_projection(" in sql


def test_security_definer(sql: str) -> None:
    assert "SECURITY DEFINER" in sql, "RPC must be SECURITY DEFINER (bypass RLS internal)"


def test_stable_function(sql: str) -> None:
    assert "\nSTABLE\n" in sql or " STABLE\n" in sql, "RPC must be STABLE (cacheable per Postgres)"


def test_search_path_forced(sql: str) -> None:
    assert "SET search_path = public" in sql, "search_path must be forced (anti-hijack)"


def test_entity_id_pattern_validated(sql: str) -> None:
    assert "RAISE EXCEPTION 'invalid entity_id pattern" in sql
    # Singulier + support exclu dans la regex
    assert "gamme|vehicle|constructeur|diagnostic" in sql
    # Support pas dans la regex
    assert "(gamme|vehicle|constructeur|diagnostic|support)" not in sql


def test_role_pattern_validated(sql: str) -> None:
    assert "invalid role pattern" in sql
    assert "R[0-9]_[A-Z_]+" in sql


def test_no_destructive_writes(sql: str) -> None:
    # Comments OK, mais aucun INSERT/UPDATE/DELETE en statement
    # Strip lines starting with -- (SQL comments)
    code_only = "\n".join(
        line for line in sql.splitlines() if not line.strip().startswith("--")
    )
    for needle in ("INSERT INTO ", "UPDATE __seo", "DELETE FROM ", "TRUNCATE ", "DROP "):
        assert needle not in code_only.upper(), f"forbidden SQL '{needle}' must not appear in RPC body"


def test_explicit_grants(sql: str) -> None:
    assert "REVOKE ALL ON FUNCTION get_active_seo_projection" in sql
    assert "GRANT EXECUTE ON FUNCTION get_active_seo_projection(text, text) TO service_role" in sql
    assert "GRANT EXECUTE ON FUNCTION get_active_seo_projection(text, text) TO authenticated" in sql
    assert "GRANT EXECUTE ON FUNCTION get_active_seo_projection(text, text) TO anon" in sql


def test_returns_jsonb(sql: str) -> None:
    assert "RETURNS jsonb" in sql


def test_reads_materialized_views(sql: str) -> None:
    """RPC consomme bien les MVs PR-6a (transitional acceleration)."""
    assert "FROM mv_seo_entity_facts_current" in sql
    assert "FROM mv_seo_content_blocks_current" in sql


def test_reads_sources_table(sql: str) -> None:
    assert "FROM __seo_entity_sources" in sql


def test_projection_contract_version_in_output(sql: str) -> None:
    """Le payload doit toujours indiquer projection_contract_version."""
    assert "'projection_contract_version'" in sql
    assert "'1.0.0'" in sql


def test_transaction_wrapped(sql: str) -> None:
    assert sql.strip().endswith("COMMIT;")
    assert "BEGIN;" in sql


def test_comment_references_adr_059(sql: str) -> None:
    assert "ADR-059" in sql


def test_no_function_returns_table_or_setof(sql: str) -> None:
    """RPC retourne 1 seul JSONB (pas SETOF/TABLE) — simplifie cache + serialization."""
    assert "RETURNS SETOF" not in sql
    assert "RETURNS TABLE" not in sql
