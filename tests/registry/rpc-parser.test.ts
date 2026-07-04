/**
 * tests/registry/rpc-parser.test.ts — covers build-rpc-registry.js parse modes
 * against `fixtures/rpc-edge-cases.sql`.
 *
 * Per ADR-058 invariant V1-3, the parser MUST classify into one of 3 modes
 * (parsed / partially_parsed / unknown_signature) without throwing.
 *
 * Per ADR-058 invariant V1-5, this fixture-based test is the V1 floor.
 * V1.5 will add `fast-check` property-based testing on top.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  parseFunctionBlock,
  parseArg,
  splitTopLevel,
  findFunctionBlocks,
  lexViews,
  lexSql,
  maskComments,
  sigHash,
} from "../../scripts/registry/build-rpc-registry.js";

const FIXTURE_PATH = path.join(__dirname, "fixtures", "rpc-edge-cases.sql");
const FIXTURE_SQL = fs.readFileSync(FIXTURE_PATH, "utf8");

describe("splitTopLevel", () => {
  test("splits at top-level commas only (parens ignored)", () => {
    assert.deepEqual(
      splitTopLevel("a, b, c(d, e), f", ","),
      ["a", " b", " c(d, e)", " f"]
    );
  });

  test("handles nested parens", () => {
    assert.deepEqual(
      splitTopLevel("integer[], text, jsonb DEFAULT '{}'::jsonb", ","),
      ["integer[]", " text", " jsonb DEFAULT '{}'::jsonb"]
    );
  });
});

describe("parseArg", () => {
  test("named typed arg", () => {
    assert.deepEqual(parseArg("p_id integer"), {
      name: "p_id",
      type: "integer",
      mode: "IN",
    });
  });

  test("anonymous typed arg", () => {
    assert.deepEqual(parseArg("text"), { name: "", type: "text", mode: "IN" });
  });

  test("OUT mode prefix", () => {
    assert.deepEqual(parseArg("OUT total integer"), {
      name: "total",
      type: "integer",
      mode: "OUT",
    });
  });

  test("VARIADIC mode", () => {
    assert.deepEqual(parseArg("VARIADIC nums integer[]"), {
      name: "nums",
      type: "integer[]",
      mode: "VARIADIC",
    });
  });

  test("strips DEFAULT clause", () => {
    assert.deepEqual(parseArg("p_id integer DEFAULT 0"), {
      name: "p_id",
      type: "integer",
      mode: "IN",
    });
  });
});

describe("findFunctionBlocks on fixture SQL", () => {
  test("finds at least the documented fixtures", () => {
    const positions = findFunctionBlocks(FIXTURE_SQL);
    // 7 documented CREATE FUNCTION cases in fixture
    assert.ok(
      positions.length >= 7,
      `expected ≥ 7 CREATE FUNCTION blocks, found ${positions.length}`
    );
  });
});

describe("parseFunctionBlock — edge cases (V1-3 : 3 parse modes, never throw)", () => {
  function parseAll(sql: string) {
    const positions = findFunctionBlocks(sql);
    return positions.map((p) => parseFunctionBlock(sql, p)).filter(Boolean);
  }

  test("Case 1 : simple parsed function (fixture_simple_add)", () => {
    const all = parseAll(FIXTURE_SQL);
    const f = all.find((r: any) => r?.funcName === "fixture_simple_add");
    assert.ok(f, "fixture_simple_add not found");
    assert.equal((f as any).parseMode, "parsed");
    assert.equal((f as any).schemaName, "public");
    assert.equal((f as any).language, "sql");
    assert.equal((f as any).returnType, "integer");
    assert.equal((f as any).args.length, 2);
  });

  test("Case 2 : SECURITY DEFINER + SET search_path captured (fixture_secure_writer)", () => {
    const all = parseAll(FIXTURE_SQL);
    const f = all.find((r: any) => r?.funcName === "fixture_secure_writer");
    assert.ok(f);
    assert.equal((f as any).parseMode, "parsed");
    assert.equal((f as any).securityDefiner, true);
    assert.deepEqual((f as any).searchPath, ["public", "pg_temp"]);
  });

  test("Case 3 : overloaded function emits 2 entries with different sigHash", () => {
    const all = parseAll(FIXTURE_SQL);
    const overloads = all.filter((r: any) => r?.funcName === "fixture_overloaded");
    assert.equal(overloads.length, 2);
    const hashes = overloads.map((o: any) => sigHash(o.args));
    assert.notEqual(hashes[0], hashes[1]);
  });

  test("Case 4 : quoted identifier strips quotes (Fixture_Quoted)", () => {
    const all = parseAll(FIXTURE_SQL);
    const f = all.find((r: any) => r?.funcName === "Fixture_Quoted");
    assert.ok(f, "Fixture_Quoted not found");
    assert.equal((f as any).parseMode, "parsed");
  });

  test("Case 5 : extension schema preserved (pgcrypto.fixture_extension_fake)", () => {
    const all = parseAll(FIXTURE_SQL);
    const f = all.find((r: any) => r?.funcName === "fixture_extension_fake");
    assert.ok(f);
    assert.equal((f as any).schemaName, "pgcrypto");
  });

  test("Case 6 : VARIADIC + OUT modes recognized (fixture_variadic)", () => {
    const all = parseAll(FIXTURE_SQL);
    const f = all.find((r: any) => r?.funcName === "fixture_variadic");
    assert.ok(f);
    const modes = (f as any).args.map((a: any) => a.mode);
    assert.ok(modes.includes("VARIADIC"));
    assert.ok(modes.includes("OUT"));
  });

  test("Case 7 : missing LANGUAGE → partially_parsed (fixture_no_language)", () => {
    const all = parseAll(FIXTURE_SQL);
    const f = all.find((r: any) => r?.funcName === "fixture_no_language");
    assert.ok(f);
    assert.equal((f as any).parseMode, "partially_parsed");
    assert.ok(
      (f as any).parseWarnings.some((w: string) => /LANGUAGE/i.test(w)),
      "expected LANGUAGE warning"
    );
  });

  test("parser never throws even on malformed input (V1-3 totality)", () => {
    const malformed = `CREATE FUNCTION broken(\n  this is not valid SQL anywhere\n`;
    assert.doesNotThrow(() => {
      const positions = findFunctionBlocks(malformed);
      for (const p of positions) {
        parseFunctionBlock(malformed, p);
      }
    });
  });
});

describe("Case 8 : comment / string / body awareness (no phantom functions)", () => {
  const names = () =>
    findFunctionBlocks(FIXTURE_SQL)
      .map((p) => parseFunctionBlock(FIXTURE_SQL, p))
      .filter(Boolean)
      .map((r: any) => r.funcName);

  test("skips CREATE FUNCTION inside a line comment", () => {
    const found = names();
    assert.ok(!found.includes("fixture_line_commented"), "line-commented fn leaked");
    // the real-world `public.grant` phantom came from `… CREATE FUNCTION grant …`
    assert.ok(!found.includes("grant"), "`grant` phantom leaked from prose comment");
  });

  test("skips CREATE FUNCTION inside a block comment", () => {
    assert.ok(
      !names().includes("fixture_block_commented"),
      "block-commented fn leaked"
    );
  });

  test("skips CREATE FUNCTION text inside a dollar-quoted body (dynamic SQL)", () => {
    assert.ok(!names().includes("fixture_inside_body"), "body-embedded fn leaked");
  });

  test("still extracts the real function that emits dynamic DDL", () => {
    const f = findFunctionBlocks(FIXTURE_SQL)
      .map((p) => parseFunctionBlock(FIXTURE_SQL, p))
      .find((r: any) => r?.funcName === "fixture_dynamic_ddl_emitter");
    assert.ok(f, "real emitter function not found");
    assert.equal((f as any).parseMode, "parsed");
  });

  test("no parse yields the unknown_signature fallback on this fixture", () => {
    const modes = findFunctionBlocks(FIXTURE_SQL)
      .map((p) => parseFunctionBlock(FIXTURE_SQL, p))
      .filter(Boolean)
      .map((r: any) => r.parseMode);
    assert.ok(
      !modes.includes("unknown_signature"),
      "fixture should no longer yield unknown_signature phantoms"
    );
  });
});

describe("Case 9 : comment-masked parsing (comments never enter args or sigHash)", () => {
  // The production pipeline: lex once → { masked, blocks } → parse the MASKED view.
  function extract(sql: string) {
    const { masked, blocks } = lexSql(sql);
    return blocks.map((p) => parseFunctionBlock(masked, p)).filter(Boolean);
  }

  // Same PostgreSQL signature, one copy carrying inline comments, one without.
  const withComments = `CREATE FUNCTION fixture_cwv_gap(
  p_window_hours INT,   -- heures récentes (job @ :05 + retries)
  -- borne = TTL raw (au-dela : partition purgee)
  p_grace_hours  INT,
  p_min_missing  INT
) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;`;
  const withoutComments = `CREATE FUNCTION fixture_cwv_gap(
  p_window_hours INT,
  p_grace_hours  INT,
  p_min_missing  INT
) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;`;

  test("same signature with vs without inline comments → identical sigHash (one registry signature)", () => {
    const a = extract(withComments)[0] as any;
    const b = extract(withoutComments)[0] as any;
    assert.equal(sigHash(a.args), sigHash(b.args));
  });

  test("no argument type contains comment markers or newlines; names/types are clean", () => {
    const a = extract(withComments)[0] as any;
    for (const arg of a.args) {
      assert.ok(!/--|\/\*|\n/.test(arg.type), `polluted type: ${JSON.stringify(arg.type)}`);
    }
    assert.deepEqual(a.args.map((x: any) => x.type), ["INT", "INT", "INT"]);
    assert.deepEqual(
      a.args.map((x: any) => x.name),
      ["p_window_hours", "p_grace_hours", "p_min_missing"]
    );
  });

  test("trailing inline comment on a type is stripped", () => {
    const f = extract(
      `CREATE FUNCTION fixture_trailing(p_x INT -- price in centimes\n) RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;`
    )[0] as any;
    assert.equal(f.args[0].type, "INT");
  });
});

describe("Case 10 : lexer hardening (E-strings, nested block comments, quoted identifiers)", () => {
  function names(sql: string) {
    const { masked, blocks } = lexSql(sql);
    return blocks.map((p) => (parseFunctionBlock(masked, p) as any)?.funcName);
  }

  test("E'…' escape string (with \\' and --) does not swallow a following function", () => {
    const sql =
      `SELECT E'it\\'s a -- not a comment';\n` +
      `CREATE FUNCTION fixture_after_estring(a int) RETURNS int LANGUAGE sql AS $$ SELECT a $$;`;
    assert.deepEqual(names(sql), ["fixture_after_estring"]);
  });

  test("nested block comment is fully skipped; a following real function is still found", () => {
    const sql =
      `/* outer /* CREATE FUNCTION fixture_nested_phantom() */ still comment */\n` +
      `CREATE FUNCTION fixture_after_nested(a int) RETURNS int LANGUAGE sql AS $$ SELECT a $$;`;
    const found = names(sql);
    assert.ok(!found.includes("fixture_nested_phantom"), "phantom from nested comment leaked");
    assert.ok(found.includes("fixture_after_nested"), "real function after nested comment missed");
  });

  test("a quoted identifier containing CREATE FUNCTION text is not detected", () => {
    assert.equal(lexSql(`CREATE TABLE t ("CREATE FUNCTION evil" integer);`).blocks.length, 0);
  });
});

describe("Case 11 : two-view lexer robustness (Unicode idents, $-in-identifier boundary)", () => {
  // These are the detection improvements the combined lexer adopts: the `topLevel`
  // view classifies with PostgreSQL identifier rules, so a `$` that continues an
  // identifier (`amount$rate`) does NOT open a dollar body, and a Unicode-named
  // dollar tag is still a real body. Regression guard for the RPC producer's B1 fix.
  function names(sql: string) {
    const { masked, blocks } = lexSql(sql);
    return blocks.map((p) => (parseFunctionBlock(masked, p) as any)?.funcName);
  }

  test("`$` inside an identifier does not open a dollar-quoted body (function after it still found)", () => {
    // If `amount$rate` were mis-read as a `$…$` open, everything up to the next `$`
    // would be swallowed and the following CREATE FUNCTION would be lost.
    const sql =
      `SELECT amount$rate FROM t;\n` +
      `CREATE FUNCTION fixture_after_dollar_ident(a int) RETURNS int LANGUAGE sql AS $$ SELECT a $$;`;
    assert.deepEqual(names(sql), ["fixture_after_dollar_ident"]);
  });

  test("a real dollar-quoted body still masks a CREATE FUNCTION it contains", () => {
    const sql =
      `CREATE FUNCTION fixture_real_emitter() RETURNS void LANGUAGE plpgsql AS $body$\n` +
      `BEGIN EXECUTE 'CREATE FUNCTION phantom_in_body() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$'; END;\n` +
      `$body$;`;
    const found = names(sql);
    assert.ok(found.includes("fixture_real_emitter"), "real emitter missed");
    assert.ok(!found.includes("phantom_in_body"), "phantom inside dollar body leaked");
  });

  test("commentsMasked preserves string/body bytes; topLevel blanks them (same offsets)", () => {
    const sql = `CREATE FUNCTION f(p int) RETURNS int LANGUAGE sql AS $$ SELECT -- hi\n 1 $$;`;
    const { topLevel, commentsMasked } = lexViews(sql);
    assert.equal(topLevel.length, sql.length);
    assert.equal(commentsMasked.length, sql.length);
    // The dollar body `SELECT … 1` is blanked in topLevel but preserved in commentsMasked.
    assert.ok(!/SELECT/.test(topLevel), "dollar body leaked into detection view");
    assert.ok(/SELECT/.test(commentsMasked), "dollar body lost from parsing view");
  });
});

describe("sigHash determinism", () => {
  test("same args → same hash", () => {
    const args = [
      { name: "a", type: "integer", mode: "IN" },
      { name: "b", type: "text", mode: "IN" },
    ];
    assert.equal(sigHash(args), sigHash(args));
  });

  test("different arg types → different hash", () => {
    const a = [{ name: "x", type: "integer", mode: "IN" }];
    const b = [{ name: "x", type: "text", mode: "IN" }];
    assert.notEqual(sigHash(a), sigHash(b));
  });
});
