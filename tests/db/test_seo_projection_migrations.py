"""
Tests contractuels des migrations SEO projection (ADR-059 PR-6a).

Approche : parse les fichiers SQL et vérifie le shape attendu (présence
tables/MVs/colonnes/indexes/RLS/GRANTs). N'applique PAS les migrations
(pas de connexion DB en CI — c'est le job de Supabase migrations en deploy).

7 tables attendues :
    __seo_projection_runs, __seo_entity_facts, __seo_entity_fact_versions,
    __seo_entity_sources, __seo_content_blocks, __seo_content_block_versions,
    __seo_projection_conflicts

2 MVs attendues :
    mv_seo_entity_facts_current, mv_seo_content_blocks_current
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest


MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "backend" / "supabase" / "migrations"


@pytest.fixture(scope="module")
def tables_sql() -> str:
    path = MIGRATIONS_DIR / "20260513202231_seo_projection_tables.sql"
    assert path.exists(), f"migration absente : {path}"
    return path.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def mvs_sql() -> str:
    path = MIGRATIONS_DIR / "20260513202232_seo_projection_materialized_views.sql"
    assert path.exists(), f"migration absente : {path}"
    return path.read_text(encoding="utf-8")


# ───────────────────────── 7 tables ─────────────────────────

EXPECTED_TABLES = [
    "__seo_projection_runs",
    "__seo_entity_facts",
    "__seo_entity_fact_versions",
    "__seo_entity_sources",
    "__seo_content_blocks",
    "__seo_content_block_versions",
    "__seo_projection_conflicts",
]


@pytest.mark.parametrize("table_name", EXPECTED_TABLES)
def test_table_create_statement_present(tables_sql: str, table_name: str) -> None:
    pattern = rf"CREATE TABLE IF NOT EXISTS\s+{re.escape(table_name)}\b"
    assert re.search(pattern, tables_sql), f"missing CREATE TABLE for {table_name}"


def test_exactly_seven_tables(tables_sql: str) -> None:
    creates = re.findall(r"CREATE TABLE IF NOT EXISTS\s+(\w+)", tables_sql)
    assert len(creates) == 7, f"expected 7 CREATE TABLE, got {len(creates)}: {creates}"
    assert set(creates) == set(EXPECTED_TABLES)


# ───────────────────────── 2 materialized views ─────────────────────────

EXPECTED_MVS = ["mv_seo_entity_facts_current", "mv_seo_content_blocks_current"]


@pytest.mark.parametrize("mv_name", EXPECTED_MVS)
def test_mv_create_statement_present(mvs_sql: str, mv_name: str) -> None:
    pattern = rf"CREATE MATERIALIZED VIEW IF NOT EXISTS\s+{re.escape(mv_name)}\b"
    assert re.search(pattern, mvs_sql), f"missing CREATE MATERIALIZED VIEW for {mv_name}"


def test_exactly_two_mvs(mvs_sql: str) -> None:
    mvs = re.findall(r"CREATE MATERIALIZED VIEW IF NOT EXISTS\s+(\w+)", mvs_sql)
    assert len(mvs) == 2
    assert set(mvs) == set(EXPECTED_MVS)


@pytest.mark.parametrize("mv_name", EXPECTED_MVS)
def test_mv_has_unique_index_for_concurrent_refresh(mvs_sql: str, mv_name: str) -> None:
    """REFRESH ... CONCURRENTLY exige un UNIQUE INDEX sur la MV."""
    pattern = rf"CREATE UNIQUE INDEX[^;]+ON\s+{re.escape(mv_name)}\b"
    assert re.search(pattern, mvs_sql), (
        f"{mv_name} must have a UNIQUE INDEX to support REFRESH CONCURRENTLY"
    )


# ───────────────────────── Versions complètes (replay determinism) ───────────

VERSION_FIELDS = [
    "projection_contract_version",
    "builder_version",
    "pipeline_version",
    "extractor_version",
    "runner_version",
    "exports_snapshot_hash",
    "exports_snapshot_uri",
    "wiki_commit_sha",
    "trigger_kind",
    "replayed_from_run_id",
]


@pytest.mark.parametrize("field", VERSION_FIELDS)
def test_projection_runs_has_version_field(tables_sql: str, field: str) -> None:
    """ADR-059 §Versioning complet — chaque version field doit être dans __seo_projection_runs."""
    runs_block = _extract_table_block(tables_sql, "__seo_projection_runs")
    assert field in runs_block, f"__seo_projection_runs missing column: {field}"


def test_wiki_commit_authority_documented_as_informational(tables_sql: str) -> None:
    """Anti-replay-bug : wiki_commit_sha doit être documenté informational-only."""
    assert "INFORMATIONAL-ONLY" in tables_sql.upper()
    assert "tar.zst" in tables_sql or "exports_snapshot" in tables_sql


def test_exports_snapshot_hash_pattern_sha256(tables_sql: str) -> None:
    """exports_snapshot_hash doit avoir un CHECK pattern ^sha256:[a-f0-9]{64}$."""
    runs_block = _extract_table_block(tables_sql, "__seo_projection_runs")
    assert "sha256" in runs_block
    assert re.search(r"exports_snapshot_hash[^,]+sha256", runs_block)


# ───────────────────────── kg_v3 pattern ─────────────────────────

KG_V3_FIELDS_IN_VERSIONS = ["status", "valid_from", "valid_to", "source_type", "confidence_base", "content_hash"]


@pytest.mark.parametrize("field", KG_V3_FIELDS_IN_VERSIONS)
def test_fact_versions_has_kg_v3_field(tables_sql: str, field: str) -> None:
    block = _extract_table_block(tables_sql, "__seo_entity_fact_versions")
    assert field in block, f"__seo_entity_fact_versions missing kg_v3 field: {field}"


def test_facts_table_has_active_version_id_fk(tables_sql: str) -> None:
    block = _extract_table_block(tables_sql, "__seo_entity_facts")
    assert "active_version_id" in block
    assert "REFERENCES __seo_entity_fact_versions" in block


def test_blocks_table_has_active_version_id_fk(tables_sql: str) -> None:
    block = _extract_table_block(tables_sql, "__seo_content_blocks")
    assert "active_version_id" in block
    assert "REFERENCES __seo_content_block_versions" in block


# ───────────────────────── RLS zero-trust ─────────────────────────

@pytest.mark.parametrize("table_name", EXPECTED_TABLES)
def test_rls_enabled_on_all_tables(tables_sql: str, table_name: str) -> None:
    """ADR-021 : RLS activée sur toutes les nouvelles tables."""
    pattern = rf"ALTER TABLE\s+{re.escape(table_name)}\s+ENABLE ROW LEVEL SECURITY"
    assert re.search(pattern, tables_sql), f"RLS not enabled on {table_name}"


def test_no_select_policy_for_anon_or_authenticated(tables_sql: str) -> None:
    """Lecture publique doit passer par RPC SECURITY DEFINER (ADR-059 No Direct Page SQL)."""
    # No CREATE POLICY granting SELECT to anon/authenticated should exist
    bad_patterns = [
        r"CREATE POLICY[^;]+TO\s+anon[^;]+SELECT",
        r"CREATE POLICY[^;]+TO\s+authenticated[^;]+SELECT",
    ]
    for pat in bad_patterns:
        assert not re.search(pat, tables_sql, re.IGNORECASE), (
            f"forbidden SELECT policy for anon/authenticated: {pat}. "
            "Reads MUST go through RPC SECURITY DEFINER (PR-7)."
        )


# ───────────────────────── GRANTs explicites ─────────────────────────

@pytest.mark.parametrize("table_name", EXPECTED_TABLES)
def test_explicit_revoke_for_anon_authenticated(tables_sql: str, table_name: str) -> None:
    """feedback_supabase_grant_explicit : REVOKE ALL FROM anon/authenticated."""
    pattern = rf"REVOKE ALL ON\s+{re.escape(table_name)}\b[^;]*FROM[^;]*(anon|authenticated)"
    assert re.search(pattern, tables_sql), f"missing explicit REVOKE for {table_name}"


@pytest.mark.parametrize("table_name", EXPECTED_TABLES)
def test_grants_to_service_role_no_delete(tables_sql: str, table_name: str) -> None:
    """service_role doit avoir SELECT/INSERT/UPDATE mais JAMAIS DELETE (ADR-059 audit trail)."""
    pattern = rf"GRANT\s+SELECT,\s*INSERT,\s*UPDATE\s+ON\s+{re.escape(table_name)}\s+TO\s+service_role"
    assert re.search(pattern, tables_sql), f"missing GRANT to service_role on {table_name}"


def test_no_delete_grant_to_any_role(tables_sql: str) -> None:
    """ADR-059 §Rollback : jamais DELETE, audit trail préservé."""
    assert "GRANT DELETE" not in tables_sql.upper(), (
        "ADR-059 forbids DELETE on projection tables (rollback = UPDATE active_version_id only)"
    )


# ───────────────────────── No destructive statements ─────────────────────────

def test_no_drop_table_in_migrations(tables_sql: str, mvs_sql: str) -> None:
    combined = tables_sql + "\n" + mvs_sql
    assert not re.search(r"\bDROP TABLE\b", combined, re.IGNORECASE), (
        "PR-6a migrations must not contain DROP TABLE"
    )


def test_no_truncate_in_migrations(tables_sql: str, mvs_sql: str) -> None:
    combined = tables_sql + "\n" + mvs_sql
    assert not re.search(r"\bTRUNCATE\b", combined, re.IGNORECASE)


def test_no_delete_in_migrations(tables_sql: str, mvs_sql: str) -> None:
    combined = tables_sql + "\n" + mvs_sql
    # Allow ON DELETE RESTRICT (FK clause), forbid bare DELETE statements
    bare_delete = re.search(r"^\s*DELETE\s+FROM\b", combined, re.IGNORECASE | re.MULTILINE)
    assert bare_delete is None, "PR-6a must not contain DELETE FROM"


def test_transactions_wrapped(tables_sql: str, mvs_sql: str) -> None:
    """Chaque migration doit être dans BEGIN ... COMMIT pour atomicité."""
    for sql, name in [(tables_sql, "tables"), (mvs_sql, "mvs")]:
        assert re.search(r"^\s*BEGIN\s*;", sql, re.MULTILINE), f"{name} migration missing BEGIN"
        assert re.search(r"^\s*COMMIT\s*;", sql, re.MULTILINE), f"{name} migration missing COMMIT"


# ───────────────────────── Indexes critiques ─────────────────────────

CRITICAL_INDEXES = [
    "idx_seo_projection_runs_started_at",
    "idx_seo_projection_runs_exports_snapshot_hash",
    "idx_seo_entity_fact_versions_status",
    "idx_seo_entity_fact_versions_run",
    "idx_seo_content_block_versions_status",
    "idx_seo_projection_conflicts_pending",
]


@pytest.mark.parametrize("index_name", CRITICAL_INDEXES)
def test_critical_index_present(tables_sql: str, index_name: str) -> None:
    assert index_name in tables_sql, f"critical index missing: {index_name}"


# ───────────────────────── PR-6a scope strict (no worker/runner/replay) ─────

def test_no_function_or_trigger_in_pr6a(tables_sql: str, mvs_sql: str) -> None:
    """PR-6a = DDL pures. Functions/triggers = PR-6b/PR-7."""
    combined = tables_sql + "\n" + mvs_sql
    assert not re.search(r"CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b", combined, re.IGNORECASE), (
        "PR-6a must not contain CREATE FUNCTION (= PR-6b workers / PR-7 RPC)"
    )
    assert not re.search(r"CREATE\s+TRIGGER\b", combined, re.IGNORECASE), (
        "PR-6a must not contain CREATE TRIGGER (= PR-6b)"
    )


def test_no_insert_or_update_in_migrations(tables_sql: str, mvs_sql: str) -> None:
    """PR-6a = pure DDL, no data manipulation."""
    combined = tables_sql + "\n" + mvs_sql
    assert not re.search(r"^\s*INSERT\s+INTO\b", combined, re.MULTILINE | re.IGNORECASE)
    assert not re.search(r"^\s*UPDATE\s+\w+\s+SET\b", combined, re.MULTILINE | re.IGNORECASE)


# ───────────────────────── Helpers ─────────────────────────

def _extract_table_block(sql: str, table_name: str) -> str:
    """Retourne le bloc CREATE TABLE ... ) pour une table donnée."""
    pattern = rf"CREATE TABLE IF NOT EXISTS\s+{re.escape(table_name)}\s*\((.*?)\n\);"
    match = re.search(pattern, sql, re.DOTALL)
    assert match, f"could not extract table block for {table_name}"
    return match.group(1)
