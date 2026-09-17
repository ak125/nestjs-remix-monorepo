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

/**
 * Croisement `db-usage-map.json` → `rpc.json`.
 *
 * Les deux artefacts n'emploient pas le même mot : `db-usage-map` réserve
 * `used_by` aux TABLES et nomme les appels de FONCTION `called_by`. Le builder
 * lisait `used_by` sur les entrées RPC — un champ qui n'y existe pas. `hasUsage`
 * était donc toujours faux et `usedBy` toujours vide : 260 entrées sur 260 en
 * `UNKNOWN`, la branche `LIVE` inatteignable par construction.
 *
 * Un champ lu sous un nom absent ne lève rien — il rend `undefined`. C'est la
 * raison pour laquelle rien ne l'a signalé pendant si longtemps, et pourquoi le
 * croisement a besoin d'une assertion qui MEURT s'il redevient vide, et non
 * d'un simple parcours qui passerait sur zéro élément.
 */
describe("croisement db-usage-map → rpc.json", () => {
  const REPO_ROOT = path.join(__dirname, "..", "..");
  const usage = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "audit", "db-usage-map.json"), "utf8"),
  );
  const registry = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "audit", "registry", "rpc.json"), "utf8"),
  );
  const entries: any[] = registry.entries ?? registry;

  test("db-usage-map nomme les appels de fonction `called_by`, jamais `used_by`", () => {
    const keys = new Set<string>(
      Object.values(usage.rpc as Record<string, any>).flatMap((v) => Object.keys(v)),
    );
    assert.ok(keys.has("called_by"), "le producteur doit publier `called_by`");
    assert.ok(
      !keys.has("used_by"),
      "`used_by` est réservé aux TABLES — s'il apparaît ici, le vocabulaire a changé " +
        "et le builder doit être relu, pas adapté à l'aveugle",
    );
  });

  test("un RPC appelé depuis le backend porte ses callsites dans rpc.json", () => {
    const called = Object.entries(usage.rpc as Record<string, any>).filter(
      ([, v]) => (v.called_by_count || 0) > 0,
    );
    assert.ok(called.length > 0, "le dépôt appelle des RPC — le scan doit en voir");

    let crossed = 0;
    for (const [name, v] of called) {
      // Une surcharge produit plusieurs entrées pour un même nom : toutes la portent.
      const matching = entries.filter((e) => e.name === name);
      // Absente de rpc.json = aucun `CREATE FUNCTION` dans les migrations scannées.
      // Trou distinct (la fonction existe en base sans migration), pas l'objet de ce test.
      if (matching.length === 0) continue;
      for (const e of matching) {
        crossed++;
        assert.deepEqual(
          e.usedBy,
          [...v.called_by].sort(),
          `${name}: usedBy doit refléter called_by`,
        );
        if (e.parseMode !== "unknown_signature" && e.status !== "ARCHIVED") {
          assert.equal(e.status, "LIVE", `${name} est appelée : son status doit être LIVE`);
        }
      }
    }

    // L'assertion qui tient tout le test : sans elle, un `usedBy` redevenu vide
    // ferait boucler sur zéro croisement et passerait au vert.
    assert.ok(
      crossed > 0,
      "aucun RPC appelé n'a été croisé avec rpc.json — le croisement est mort, " +
        "pas satisfait (c'est exactement le défaut que ce test existe pour attraper)",
    );
  });
});
