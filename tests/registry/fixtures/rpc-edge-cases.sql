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

-- Case 8 : a CREATE FUNCTION mentioned INSIDE a comment must NOT be detected.
-- This was a documented limitation ("V1.5+ : strip comments before parsing"). The
-- old note claimed the fixture avoided triggering it — it did not : the `-- Case N :
-- CREATE FUNCTION …` headers above are themselves commented mentions that the raw
-- scan matched. The limitation was live in this very file. It is now ENFORCED : the producer runs
-- detection on the `topLevel` view of scripts/registry/lib/sql-lex.js, where every
-- non-executable region is blanked. Both lines below are documentation, not DDL.
--   CREATE FUNCTION fixture_commented_out(x integer) RETURNS integer AS $$ SELECT x $$;
/* CREATE FUNCTION fixture_block_commented(y text) RETURNS text AS $$ SELECT y $$; */

-- 8b : la prose qui a RÉELLEMENT fabriqué un fantôme. `public.grant` figurait dans
-- `audit/registry/rpc.json` jusqu'à #1510, extrait d'une phrase de ce genre — le
-- repli `unknown_signature` devinait un nom dans un extrait illisible.
-- EXECUTE : verrouiller. CREATE FUNCTION grant EXECUTE à PUBLIC, ET les default-privileges
-- restent à révoquer explicitement.   (copie littérale de
-- 20260619_adr059_pr6c_mv_revoke_and_refresh_rpc.sql:77 — de la prose, pas du DDL)

-- 8c : un `CREATE FUNCTION` vivant dans le corps dollar-quoté d'une VRAIE fonction
-- (DDL dynamique) ne doit pas être compté comme une fonction de plus. La vue
-- `topLevel` blanchit les corps `$$…$$`, donc seul l'émetteur est déclaré.
CREATE FUNCTION fixture_dynamic_ddl_emitter()
  RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  EXECUTE 'CREATE FUNCTION fixture_inside_body(x int) RETURNS int LANGUAGE sql AS ''SELECT x''';
END;
$$;

-- Case 9 : inline comments inside the ARGUMENT LIST must not leak into the parsed
-- types. Otherwise the same PostgreSQL signature, written with and without inline
-- documentation, yields two different sigHash — and the registry invents an
-- overload. Mesuré sur ce dépôt : 19 arguments portaient un marqueur de commentaire
-- dans leur type, et `public.pricing_commit_chunk#sig:e0a855c1` était une surcharge
-- qui n'a jamais existé.
CREATE FUNCTION fixture_commented_args(
  p_batch_id uuid,   -- governed batch id, required for commit
  p_rows     jsonb   /* payload : [{ "id": <bigint> }] */
) RETURNS void AS $$ BEGIN END $$ LANGUAGE plpgsql;

-- Case 7 : Partially parseable — missing LANGUAGE (intentional, will be
-- partially_parsed).
--
-- CE CAS DOIT RESTER LE DERNIER DU FICHIER. Sa classification dépend du lookahead
-- borné à 1 Ko de `parseFunctionBlock` : tout `LANGUAGE` apparaissant dans les 1024
-- octets qui suivent le ferait basculer en `parsed`. Il avait été déplacé en amont
-- de deux cas contenant `LANGUAGE`, et n'était resté correct que par une marge de
-- 453 octets — un hasard, pas une intention. Contrainte reprise de la PR #1227, et
-- désormais asservie par un test qui mesure cette distance.
CREATE FUNCTION fixture_no_language(x integer)
  RETURNS integer
AS $$
  SELECT x
$$;
