/**
 * Tests de check-rpc-declared-ratchet.ts (incident #2144).
 * `npm run audit:rpc-declared-ratchet:test`
 */
import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  DYNAMIC,
  declaredFunctions,
  detectWrappers,
  diffBaseline,
  offendersByKey,
  scanRpcSites,
  type Baseline,
  type SourceFile,
} from "./check-rpc-declared-ratchet.ts";

const src = (path: string, text: string): SourceFile => ({ path, text });

test("cas #2144 : callRpc vers une fonction absente des migrations est relevé", () => {
  const files = [
    src(
      "backend/src/workers/processors/seo-monitor.processor.ts",
      `class P { async f() {
        const { data, error } = await this.callRpc<Array<{ type_id: number }>>(
          'get_random_vehicle_gamme_combinations',
          { limit_count: 20 },
          { source: 'internal' },
        );
      } }`,
    ),
  ];
  const sites = scanRpcSites(files);
  assert.equal(sites.length, 1);
  assert.deepEqual(sites[0].names, ["get_random_vehicle_gamme_combinations"]);
  assert.deepEqual(offendersByKey(sites, new Set(["get_all_seo_references"])), {
    "backend/src/workers/processors/seo-monitor.processor.ts::get_random_vehicle_gamme_combinations": 1,
  });
});

test("un nom déclaré par une migration n'est pas relevé", () => {
  const sites = scanRpcSites([
    src("a.ts", `this.callRpc('get_all_seo_references', {});`),
  ]);
  assert.deepEqual(
    offendersByKey(sites, new Set(["get_all_seo_references"])),
    {},
  );
});

test(".rpc direct, constante locale, propriété readonly et objet constant sont résolus", () => {
  const sites = scanRpcSites([
    src(
      "a.ts",
      `const RPC = 'fn_const';
       const MAP = { a: 'fn_a', b: 'fn_b' } as const;
       class S {
         private readonly NAME = 'fn_prop';
         async g(k: 'a' | 'b') {
           await this.supabase.rpc('fn_direct');
           await this.callRpc(RPC, {});
           await this.callRpc(this.NAME, {});
           await this.callRpc(MAP.a, {});
           const n = MAP[k];
           await this.callRpc(n, {});
         }
       }`,
    ),
  ]);
  assert.deepEqual(
    sites.map((s) => s.names),
    [["fn_direct"], ["fn_const"], ["fn_prop"], ["fn_a"], ["fn_a", "fn_b"]],
  );
});

test("un wrapper qui transmet son paramètre est détecté, et ses appelants sont relevés", () => {
  const files = [
    src(
      "w.ts",
      `class C {
         private async invokeRpc<T>(name: string, params: object) {
           return this.callRpc<T>(name, params);
         }
         async outer(fn: string) { return this.invokeRpc(fn, {}); }
         async use() {
           await this.invokeRpc('fn_wrapped', {});
           await this.outer('fn_wrapped_twice');
         }
       }`,
    ),
  ];
  const w = detectWrappers(files);
  assert.equal(w.invokeRpc, 0);
  assert.equal(w.outer, 0);
  const sites = scanRpcSites(files);
  // Les transmissions internes (callRpc(name), invokeRpc(fn)) ne sont pas des sites.
  assert.deepEqual(
    sites.map((s) => [s.callee, s.names]),
    [
      ["invokeRpc", ["fn_wrapped"]],
      ["outer", ["fn_wrapped_twice"]],
    ],
  );
});

test("un nom non résolvable est gelé comme <dynamic>, jamais déclaré conforme", () => {
  const sites = scanRpcSites([
    src(
      "d.ts",
      "async function h(x: { n: string }) { await client.rpc(x.n); }",
    ),
  ]);
  assert.equal(sites.length, 1);
  assert.deepEqual(sites[0].names, []);
  assert.deepEqual(offendersByKey(sites, new Set()), {
    [`d.ts::${DYNAMIC}`]: 1,
  });
});

test("une constante déclarée deux fois dans le fichier est ambiguë → <dynamic>", () => {
  const sites = scanRpcSites([
    src(
      "amb.ts",
      `function a() { const N = 'fn_one'; return client.rpc(N); }
       function b() { const N = 'fn_two'; return client.rpc(N); }`,
    ),
  ]);
  assert.deepEqual(
    sites.map((s) => s.names),
    [[], []],
  );
});

test("declaredFunctions réutilise scanMigrations : DROP postérieur retire la fonction", () => {
  const dir = mkdtempSync(join(tmpdir(), "rpc-declared-"));
  try {
    writeFileSync(
      join(dir, "20260101000000_a.sql"),
      `-- CREATE FUNCTION fn_in_comment() ...
       CREATE OR REPLACE FUNCTION public.fn_live() RETURNS int LANGUAGE sql AS $$ select 1 $$;
       CREATE FUNCTION fn_dropped() RETURNS int LANGUAGE sql AS $$ select 1 $$;`,
    );
    writeFileSync(
      join(dir, "20260102000000_b.sql"),
      "DROP FUNCTION IF EXISTS fn_dropped();",
    );
    const d = declaredFunctions(dir);
    assert.ok(d.has("fn_live"));
    assert.ok(!d.has("fn_dropped"));
    assert.ok(!d.has("fn_in_comment"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const base = (entries: Record<string, number>): Baseline => ({
  check: "rpc-declared",
  total: Object.values(entries).reduce((a, b) => a + b, 0),
  entries,
});

test("gel : identique → ok", () => {
  assert.equal(diffBaseline({ "a.ts::x": 2 }, base({ "a.ts::x": 2 })).ok, true);
});

test("gel : entrée nouvelle → échec", () => {
  const r = diffBaseline(
    { "a.ts::x": 1, "b.ts::y": 1 },
    base({ "a.ts::x": 1 }),
  );
  assert.equal(r.ok, false);
  assert.deepEqual(r.drift.newKeys, ["b.ts::y"]);
});

test("gel : hausse → échec", () => {
  const r = diffBaseline({ "a.ts::x": 3 }, base({ "a.ts::x": 2 }));
  assert.equal(r.ok, false);
  assert.deepEqual(r.drift.increased, [{ key: "a.ts::x", from: 2, to: 3 }]);
});

test("gel : baisse sans rafraîchissement → échec (count-exact)", () => {
  const r = diffBaseline({}, base({ "a.ts::x": 1 }));
  assert.equal(r.ok, false);
  assert.deepEqual(r.drift.reducedWithoutRefresh, [
    { key: "a.ts::x", from: 1, to: 0 },
  ]);
});
