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

-- Case 7 : Partially parseable — missing LANGUAGE (intentional, will be partially_parsed)
CREATE FUNCTION fixture_no_language(x integer)
  RETURNS integer
AS $$
  SELECT x
$$;

-- Case bonus : a comment with 'CREATE FUNCTION' inside that should NOT match
-- because we look at top-level CREATE keyword, not inside a comment block.
-- The current parser doesn't strip SQL comments, so this is documented as a
-- known limitation : the regex matches the inline mention. V1.5+ : strip
-- comments before parsing. For now, fixture explicitly avoids triggering false
-- positives by not having CREATE inside comments here.
