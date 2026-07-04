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
