-- tests/registry/fixtures/db-column-edge-cases.sql
--
-- Fixtures for build-db-registry.js (column replay). Every table is prefixed
-- `fixture_` so a regression assertion can never be satisfied by a real table.
--
-- Fake DDL in comments MUST be ignored :
-- CREATE TABLE fixture_ghost_line (ghost_col int);
-- DROP TABLE fixture_main;
/* Rollback block (a comment, never executed) :
   DROP TABLE fixture_main;
   CREATE TABLE fixture_ghost_block (ghost_col int, other int);
   ALTER TABLE fixture_main ADD COLUMN ghost_col int;
*/

-- Case 1 : one CREATE covering the column-level edge cases.
CREATE TABLE IF NOT EXISTS public.fixture_main (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  price NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('a,b', 'it''s', 'c;d')),
  parent_id INTEGER REFERENCES other_schema.fixture_parent(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  label TEXT DEFAULT 'x,y'::text,
  "Mixed Case" VARCHAR(10) COLLATE "C",
  tags TEXT[] DEFAULT '{}',
  score DOUBLE PRECISION, -- trailing comment, with a comma, and CREATE TABLE fixture_x (y int)
  total NUMERIC GENERATED ALWAYS AS (price * 2) STORED,
  seq SERIAL,
  /* inline block comment, with, commas */ note text,
  CONSTRAINT fixture_main_uniq UNIQUE (label, price),
  CHECK (price >= 0),
  FOREIGN KEY (parent_id) REFERENCES other_schema.fixture_parent (id)
);

-- Case 2 : table-level PRIMARY KEY makes its columns NOT NULL.
CREATE TABLE fixture_pk_table (
  a int,
  b text,
  PRIMARY KEY (a, b)
);

-- Case 3 : DROP then re-CREATE — only the second definition survives.
CREATE TABLE fixture_recreated (old_col int);
DROP TABLE IF EXISTS fixture_recreated;
CREATE TABLE fixture_recreated (new_col text NOT NULL);

-- Case 4 : CREATE then DROP — no state at the end of the replay.
CREATE TABLE fixture_dropped (x int);
DROP TABLE fixture_dropped;

-- Case 5 : ALTER ADD / DROP / RENAME COLUMN and ALTER COLUMN attributes.
ALTER TABLE fixture_main ADD COLUMN IF NOT EXISTS added_col jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE fixture_main DROP COLUMN IF EXISTS score;
ALTER TABLE fixture_main RENAME COLUMN label TO title;
ALTER TABLE fixture_main
  ALTER COLUMN tags TYPE varchar(20)[] USING tags::varchar(20)[],
  ALTER COLUMN "Mixed Case" SET NOT NULL;
ALTER TABLE fixture_main ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE fixture_main ALTER COLUMN parent_id SET DEFAULT 1;
ALTER TABLE fixture_main ALTER COLUMN price DROP NOT NULL;
ALTER TABLE ONLY public.fixture_main ADD COLUMN a1 int, ADD a2 text;
ALTER TABLE fixture_main ALTER COLUMN a1 SET DEFAULT NULL; -- NULL constant: no stored default
ALTER TABLE fixture_main ENABLE ROW LEVEL SECURITY;

-- Case 6 : DDL inside a DO block, with a quoted table identifier.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE column_name = 'do_col') THEN
    ALTER TABLE "fixture_main" ADD COLUMN do_col boolean DEFAULT false;
  END IF;
END $$;

-- Case 7 : a function body is NOT executed at migration time.
CREATE OR REPLACE FUNCTION fixture_fn() RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  CREATE TABLE fixture_in_function (z int);
  ALTER TABLE fixture_main ADD COLUMN fn_col int;
END
$fn$;

-- Case 8 : ALTER on a table never created in the migrations → reported, no state.
ALTER TABLE fixture_legacy_only ADD COLUMN x int;
ALTER TABLE fixture_legacy_only ENABLE ROW LEVEL SECURITY;

-- Case 9 : quoted table name + RENAME TO.
CREATE TABLE "fixture_Quoted" ("Col A" int NOT NULL);
ALTER TABLE "fixture_Quoted" RENAME TO fixture_renamed;

-- Case 10 : PARTITION OF / CTAS are reported, never synthesised.
CREATE TABLE fixture_part_2026 PARTITION OF fixture_main FOR VALUES FROM (1) TO (2);
CREATE TABLE fixture_ctas AS SELECT 1 AS one;
