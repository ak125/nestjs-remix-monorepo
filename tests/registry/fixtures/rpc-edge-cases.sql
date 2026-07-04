-- tests/registry/fixtures/rpc-edge-cases.sql
--
-- Fixtures for build-rpc-registry.js — exercises all 7 edge cases listed in
-- ADR-058 PR-C plan + invariant V1-3 (3 parse modes).
--
-- Each fixture is named with `fixture_*` prefix to keep them isolated from
-- real production functions in regression assertions.

-- Case 1 : Simple CREATE FUNCTION → parse mode: parsed
CREATE FUNCTION fixture_simple_add(a integer, b integer)
  RETURNS integer
  LANGUAGE sql
  AS $$ SELECT a + b $$;

-- Case 2 : CREATE OR REPLACE FUNCTION with SECURITY DEFINER + SET search_path
CREATE OR REPLACE FUNCTION fixture_secure_writer(p_user_id uuid, p_payload jsonb)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN p_user_id;
END;
$$;

-- Case 3 : Overloaded function (same name, different args)
CREATE FUNCTION fixture_overloaded(x integer)
  RETURNS integer
  LANGUAGE sql
  AS $$ SELECT x $$;

CREATE FUNCTION fixture_overloaded(x text, y text)
  RETURNS text
  LANGUAGE sql
  AS $$ SELECT x || y $$;

-- Case 4 : Quoted identifier (uppercase name preserved)
CREATE FUNCTION "Fixture_Quoted"(p_name text)
  RETURNS text
  LANGUAGE sql
  AS $$ SELECT p_name $$;

-- Case 5 : Extension function in pgcrypto schema → kind: extension, status: ARCHIVED
CREATE OR REPLACE FUNCTION pgcrypto.fixture_extension_fake(payload bytea)
  RETURNS bytea
  LANGUAGE c
  AS '$libdir/pgcrypto', 'fake_function';

-- Case 6 : Variadic args + OUT mode + IMMUTABLE/STABLE
CREATE FUNCTION fixture_variadic(VARIADIC nums integer[], OUT total integer, OUT count integer)
  RETURNS RECORD
  LANGUAGE plpgsql
  IMMUTABLE
AS $$
BEGIN
  total := 0;
  count := 0;
END;
$$;

-- Case 8 : CREATE FUNCTION mentions inside comments / strings / bodies must NOT
-- be extracted. findFunctionBlocks is now comment-aware (single-pass lexer that
-- skips line comments, closed block comments, single-quoted strings, and
-- dollar-quoted bodies). Historical false-positives this guards against:
-- `public.grant` and `public.unknown` (from `-- … CREATE FUNCTION grant …`),
-- and comment-block copies of real functions (e.g. pricing_commit_chunk).

-- 8a : line comment. CREATE FUNCTION fixture_line_commented(a int) — ignore me.
-- EXECUTE : verrouiller. CREATE FUNCTION grant EXECUTE à PUBLIC (prose, not DDL).

/* 8b : block comment.
   CREATE OR REPLACE FUNCTION fixture_block_commented(p uuid)
     RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;
*/

-- 8c : CREATE FUNCTION text living inside a real function's dollar-quoted body
-- (dynamic SQL) must not be double-counted as its own function.
CREATE FUNCTION fixture_dynamic_ddl_emitter()
  RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  EXECUTE 'CREATE FUNCTION fixture_inside_body(x int) RETURNS int LANGUAGE sql AS ''SELECT x''';
END;
$$;

-- Case 7 : Partially parseable — missing LANGUAGE (intentional, will be
-- partially_parsed). MUST stay last : its classification depends on the 1KB
-- lookahead finding no LANGUAGE keyword after it.
CREATE FUNCTION fixture_no_language(x integer)
  RETURNS integer
AS $$
  SELECT x
$$;
