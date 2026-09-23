/**
 * tests/registry/db-column-parser.test.ts — covers the column replay of
 * scripts/registry/build-db-registry.js against `fixtures/db-column-edge-cases.sql`.
 *
 * Contract under test : the column set of `audit/registry/db.json` is the state
 * obtained by replaying the migrations in runner order. Whatever cannot be
 * parsed cleanly is REPORTED (diagnostics) and never invented — no column is
 * ever fabricated from a CHECK / DEFAULT fragment, a comment, or an ALTER on a
 * table the migrations never created.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  buildTableStates,
  buildEntries,
  loadMigrations,
  parseColumnDef,
  splitTopLevelRanges,
  normIdent,
} from "../../scripts/registry/build-db-registry.js";
import { lexViews } from "../../scripts/registry/lib/sql-lex.js";

const FIXTURE_PATH = path.join(__dirname, "fixtures", "db-column-edge-cases.sql");
const FIXTURE_SQL = fs.readFileSync(FIXTURE_PATH, "utf8");

type Col = {
  name: string;
  type: string;
  notNull: boolean;
  identity: boolean;
  genStored: boolean;
  explicitDefault: boolean;
};

const replay = buildTableStates([{ name: "fixture.sql", sql: FIXTURE_SQL }]);

function cols(key: string): Map<string, Col> {
  const st = replay.states.get(key);
  assert.ok(st, `expected a final state for ${key}`);
  return st.columns as Map<string, Col>;
}

function parseDef(src: string) {
  const { topLevel, commentsMasked } = lexViews(src);
  return parseColumnDef(topLevel, commentsMasked);
}

describe("splitTopLevelRanges", () => {
  test("splits on commas at depth 0 only, strings already blanked by the lexer", () => {
    const src = "a NUMERIC(5,2), b text DEFAULT 'x,y', c int CHECK (c IN (1,2))";
    const { topLevel } = lexViews(src);
    const parts = splitTopLevelRanges(topLevel, ",").map(([s, e]: [number, number]) =>
      src.slice(s, e).trim()
    );
    assert.deepEqual(parts, ["a NUMERIC(5,2)", "b text DEFAULT 'x,y'", "c int CHECK (c IN (1,2))"]);
  });
});

describe("normIdent", () => {
  test("unquoted identifiers fold to lower case, quoted ones are kept verbatim", () => {
    assert.equal(normIdent("FooBar"), "foobar");
    assert.equal(normIdent('"Mixed Case"'), "Mixed Case");
    assert.equal(normIdent('"a""b"'), 'a"b');
  });
});

describe("parseColumnDef", () => {
  test("type stops at the first column-constraint keyword", () => {
    const r = parseDef("price NUMERIC(5,2) NOT NULL DEFAULT 0");
    assert.equal(r.kind, "column");
    assert.equal(r.column.type, "NUMERIC(5,2)");
    assert.equal(r.column.notNull, true);
    assert.equal(r.column.explicitDefault, true);
  });

  test("inline CHECK with commas and quotes is not split and not a column", () => {
    const r = parseDef("status TEXT NOT NULL CHECK (status IN ('a,b', 'it''s'))");
    assert.equal(r.kind, "column");
    assert.equal(r.column.name, "status");
    assert.equal(r.column.type, "TEXT");
  });

  test("REFERENCES schema.table(col) ON DELETE CASCADE", () => {
    const r = parseDef("parent_id INTEGER REFERENCES other.parent(id) ON DELETE CASCADE");
    assert.equal(r.column.type, "INTEGER");
    assert.equal(r.column.notNull, false);
    assert.equal(r.column.explicitDefault, false);
  });

  test("DEFAULT fn(a, b) and DEFAULT '…,…'::text", () => {
    assert.equal(parseDef("created_at TIMESTAMPTZ DEFAULT timezone('utc', now())").column.type, "TIMESTAMPTZ");
    const r = parseDef("label TEXT DEFAULT 'x,y'::text");
    assert.equal(r.column.type, "TEXT");
    assert.equal(r.column.explicitDefault, true);
  });

  test("GENERATED ALWAYS AS IDENTITY → not null + default", () => {
    const r = parseDef("id BIGINT GENERATED ALWAYS AS IDENTITY");
    assert.equal(r.column.type, "BIGINT");
    assert.equal(r.column.identity, true);
    assert.equal(r.column.notNull, true);
  });

  test("DEFAULT NULL (optionally cast) stores no default, DEFAULT nullif(…) does", () => {
    assert.equal(parseDef("v TIMESTAMPTZ DEFAULT NULL").column.explicitDefault, false);
    assert.equal(parseDef("v varchar(3) DEFAULT NULL::character varying(3) NOT NULL").column.explicitDefault, false);
    assert.equal(parseDef("v text DEFAULT nullif(a, b)").column.explicitDefault, true);
  });

  test("serial types imply NOT NULL + DEFAULT", () => {
    const r = parseDef("seq bigserial");
    assert.equal(r.column.notNull, true);
    assert.equal(r.column.explicitDefault, true);
  });

  test("table constraints are classified, never turned into columns", () => {
    assert.equal(parseDef("CONSTRAINT u UNIQUE (a, b)").kind, "constraint");
    assert.equal(parseDef("CHECK (a >= 0)").kind, "constraint");
    assert.equal(parseDef("FOREIGN KEY (a) REFERENCES t(id)").kind, "constraint");
    assert.deepEqual(parseDef("PRIMARY KEY (a, b)").pkColumns, ["a", "b"]);
  });

  test("an element without a readable type is reported as unparsed", () => {
    assert.equal(parseDef("lonely").kind, "unparsed");
  });
});

describe("buildTableStates — fixture replay", () => {
  test("fixture_main has exactly the expected final column set, in order", () => {
    assert.deepEqual(
      [...cols("public.fixture_main").keys()],
      [
        "id",
        "price",
        "status",
        "parent_id",
        "created_at",
        "title",
        "Mixed Case",
        "tags",
        "total",
        "seq",
        "note",
        "added_col",
        "a1",
        "a2",
        "do_col",
      ]
    );
  });

  test("column types survive commas, parens, arrays and COLLATE", () => {
    const c = cols("public.fixture_main");
    assert.equal(c.get("price")!.type, "NUMERIC(5,2)");
    assert.equal(c.get("Mixed Case")!.type, "VARCHAR(10)");
    assert.equal(c.get("total")!.genStored, true);
    assert.equal(c.get("note")!.type, "text");
  });

  test("no phantom column from CHECK / DEFAULT fragments or comments", () => {
    const names = [...cols("public.fixture_main").keys()];
    for (const phantom of ["'a", "b'", "c;d'", "y'", "ghost_col", "fn_col", "FOREIGN", "CHECK", "CONSTRAINT"]) {
      assert.ok(!names.includes(phantom), `phantom column ${phantom}`);
    }
  });

  test("fake DDL inside -- and /* */ comments is ignored", () => {
    assert.ok(!replay.everCreated.has("public.fixture_ghost_line"));
    assert.ok(!replay.everCreated.has("public.fixture_ghost_block"));
    assert.ok(!replay.everCreated.has("public.fixture_x"));
    assert.ok(replay.states.has("public.fixture_main"), "commented DROP TABLE must not drop fixture_main");
  });

  test("ALTER ADD / DROP / RENAME COLUMN", () => {
    const c = cols("public.fixture_main");
    assert.ok(c.has("added_col"));
    assert.equal(c.get("added_col")!.notNull, true);
    assert.ok(!c.has("score"), "DROP COLUMN");
    assert.ok(!c.has("label") && c.has("title"), "RENAME COLUMN");
    assert.equal(c.get("title")!.explicitDefault, true, "rename keeps attributes");
  });

  test("ALTER COLUMN TYPE / SET|DROP NOT NULL / SET|DROP DEFAULT", () => {
    const c = cols("public.fixture_main");
    assert.equal(c.get("tags")!.type, "varchar(20)[]", "TYPE cut at USING");
    assert.equal(c.get("Mixed Case")!.notNull, true, "SET NOT NULL");
    assert.equal(c.get("price")!.notNull, false, "DROP NOT NULL");
    assert.equal(c.get("created_at")!.explicitDefault, false, "DROP DEFAULT");
    assert.equal(c.get("parent_id")!.explicitDefault, true, "SET DEFAULT");
    assert.equal(c.get("a1")!.explicitDefault, false, "SET DEFAULT NULL");
  });

  test("table-level PRIMARY KEY marks its columns NOT NULL", () => {
    const c = cols("public.fixture_pk_table");
    assert.equal(c.get("a")!.notNull, true);
    assert.equal(c.get("b")!.notNull, true);
  });

  test("DROP then re-CREATE keeps only the second definition", () => {
    assert.deepEqual([...cols("public.fixture_recreated").keys()], ["new_col"]);
  });

  test("CREATE then DROP leaves no state", () => {
    assert.ok(!replay.states.has("public.fixture_dropped"));
    assert.ok(replay.dropped.has("public.fixture_dropped"));
  });

  test("DDL inside a DO block is applied; a quoted table name keeps its offsets", () => {
    assert.ok(cols("public.fixture_main").has("do_col"));
    // Regression : `ALTER TABLE "t" ADD …` once produced a table named `add`.
    assert.ok(!replay.states.has("public.add"));
    assert.ok(!replay.everCreated.has("public.add"));
  });

  test("a function body is not executed at migration time", () => {
    assert.ok(!replay.everCreated.has("public.fixture_in_function"));
    assert.ok(!cols("public.fixture_main").has("fn_col"));
  });

  test("ALTER on a table never created is reported and creates no partial state", () => {
    assert.ok(!replay.states.has("public.fixture_legacy_only"));
    const reported = replay.diagnostics.details.filter(
      (d: { category: string; table: string }) =>
        d.category === "alter-without-create" && d.table === "public.fixture_legacy_only"
    );
    assert.equal(reported.length, 1, "the ADD COLUMN is journaled once");
    assert.equal(replay.diagnostics.counts["alter-without-create-column-neutral"], 1, "ENABLE RLS is counted only");
  });

  test("quoted table name + RENAME TO moves the state", () => {
    assert.ok(!replay.states.has("public.fixture_Quoted"));
    assert.deepEqual([...cols("public.fixture_renamed").keys()], ["Col A"]);
  });

  test("PARTITION OF and CTAS are reported, never synthesised", () => {
    assert.ok(!replay.states.has("public.fixture_part_2026"));
    assert.ok(!replay.states.has("public.fixture_ctas"));
    assert.equal(replay.diagnostics.counts["create-partition-of-skipped"], 1);
    assert.equal(replay.diagnostics.counts["create-as-or-typed-not-parsed"], 1);
  });
});

describe("buildEntries", () => {
  test("output columns carry name/type/nullable/hasDefault; unknown tables get []", () => {
    const usageMap = {
      tables: {
        fixture_main: { used_by_count: 1, used_by: ["x.ts"], in_migrations: ["fixture.sql"], rls_present: true },
        fixture_legacy_only: { used_by_count: 1, used_by: ["y.ts"], in_migrations: [] },
      },
    };
    const { entries } = buildEntries(usageMap, [{ name: "fixture.sql", sql: FIXTURE_SQL }]);
    const main = entries.find((e: { name: string }) => e.name === "fixture_main");
    const id = main.columns.find((c: { name: string }) => c.name === "id");
    assert.deepEqual(id, { name: "id", type: "BIGINT", nullable: false, hasDefault: true });
    assert.equal(main.sourceConfidence, "high");
    const legacy = entries.find((e: { name: string }) => e.name === "fixture_legacy_only");
    assert.deepEqual(legacy.columns, []);
  });
});

describe("loadMigrations", () => {
  test(".down.sql rollbacks are excluded (the runner ignores them)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "db-cols-"));
    try {
      fs.writeFileSync(path.join(dir, "20260101_b.sql"), "CREATE TABLE t (a int);");
      fs.writeFileSync(path.join(dir, "20260101_b.down.sql"), "DROP TABLE t;");
      fs.writeFileSync(path.join(dir, "20250101_a.sql"), "SELECT 1;");
      const files = loadMigrations(dir);
      assert.deepEqual(
        files.map((f: { name: string }) => f.name),
        ["20250101_a.sql", "20260101_b.sql"]
      );
      const r = buildTableStates(files);
      assert.ok(r.states.has("public.t"), "the rollback must not drop the table");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
