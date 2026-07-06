import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectTsSinks,
  detectSqlSinks,
  diffFindings,
  scanSinks,
  type Finding,
} from "./check-served-content-write-sinks-ratchet.ts";

const F = (mechanism: Finding["mechanism"], id: string, count = 1): Finding => ({ mechanism, id, count });

// ── Detector sensitivity = mutation guards ────────────────────────────────────
// Each asserts a detector catches the REAL write shape found in the codebase.
// Weakening a detector regex (dropping a verb/alias/channel) makes its test go RED.

test("direct_literal: .from('served').upsert is a sink (count 1)", () => {
  assert.deepEqual(
    detectTsSinks("x.ts", `await c.from('__seo_gamme_conseil').upsert({ a: 1 })`),
    [F("direct_literal", "x.ts::__seo_gamme_conseil", 1)],
  );
});

test("const_map: multiline .from(R7_TABLES.pages)…upsert is a sink", () => {
  assert.deepEqual(
    detectTsSinks("r7.ts", `this.client.from(R7_TABLES.pages)\n      .upsert({})`),
    [F("const_map", "r7.ts::R7_TABLES", 1)],
  );
});

test("const_map: member channel .from(TABLES.blog_advice).insert is a sink", () => {
  assert.deepEqual(detectTsSinks("b.ts", `.from(TABLES.blog_advice).insert({})`), [
    F("const_map", "b.ts::TABLES.blog_advice", 1),
  ]);
});

test("const_map: member channel .from(TABLES.meta_tags_ariane).delete is a sink", () => {
  assert.deepEqual(detectTsSinks("m.ts", `await c.from(TABLES.meta_tags_ariane).delete()`), [
    F("const_map", "m.ts::TABLES.meta_tags_ariane", 1),
  ]);
});

test("rpc_publisher: governed callRpc<Generic>('__seo_r8_publish_snapshot') is a sink", () => {
  assert.deepEqual(
    detectTsSinks("r8.ts", `const { data } = await this.callRpc<Row[]>(\n  '__seo_r8_publish_snapshot', { p: 1 })`),
    [F("rpc_publisher", "r8.ts::__seo_r8_publish_snapshot", 1)],
  );
});

test("direct_literal: a READ (.select) is NOT a sink", () => {
  assert.deepEqual(detectTsSinks("x.ts", `.from('__seo_r7_pages').select('*')`), []);
});

test("const_map: a NON-served TABLES member is NOT flagged (member precision)", () => {
  assert.deepEqual(detectTsSinks("x.ts", `.from(TABLES.pieces_gamme).update({})`), []);
});

// ── GAP 1 — a SECOND writer to the same file::target must be visible (occurrence count) ──
test("GAP1: two writers to the same file+table count as 2 (a 2nd writer is not hidden)", () => {
  const text = `
    async a() { await c.from('__seo_gamme').upsert({ x: 1 }); }
    async b() { await c.from('__seo_gamme').update({ y: 2 }); }
  `;
  assert.deepEqual(detectTsSinks("dup.ts", text), [F("direct_literal", "dup.ts::__seo_gamme", 2)]);
});

test("GAP1: baseline count 1 → current count 2 surfaces as `added` (the new 2nd writer)", () => {
  const baseline = [F("direct_literal", "a.ts::__seo_gamme", 1)];
  const current = [F("direct_literal", "a.ts::__seo_gamme", 2)];
  const { added, removed } = diffFindings(current, baseline);
  assert.equal(added.length, 1);
  assert.equal(added[0].count, 2);
  assert.equal(removed.length, 0);
});

// ── GAP 2 — a coverage loss / closure must FAIL unless the baseline is refreshed ──
test("GAP2: a DISAPPEARED key surfaces as `removed` (must fail, not a free reduction)", () => {
  const baseline = [F("const_map", "x.ts::R7_TABLES", 3), F("direct_literal", "y.ts::__seo_gamme", 1)];
  const { added, removed } = diffFindings([F("const_map", "x.ts::R7_TABLES", 3)], baseline);
  assert.equal(added.length, 0);
  assert.equal(removed.length, 1);
  assert.equal(removed[0].id, "y.ts::__seo_gamme");
});

test("GAP2: a DECREASED count (detector went partially blind) surfaces as `removed`", () => {
  const baseline = [F("const_map", "r7.ts::R7_TABLES", 5)];
  const { removed } = diffFindings([F("const_map", "r7.ts::R7_TABLES", 4)], baseline);
  assert.equal(removed.length, 1);
  assert.equal(removed[0].count, 5);
});

test("count-exact match (same keys AND counts) = no drift", () => {
  const b = [F("const_map", "x.ts::R7_TABLES", 5), F("sql_migration", "m.sql::__seo_gamme", 2)];
  assert.deepEqual(diffFindings([...b], b), { added: [], removed: [] });
});

// ── GAP 3 — SQL DELETE FROM / TRUNCATE destroy served content and must be detected ──
test("sql_migration: INSERT INTO served table is a sink", () => {
  assert.deepEqual(detectSqlSinks("m.sql", `INSERT INTO __seo_gamme (sg_content) VALUES ('x');`), [
    F("sql_migration", "m.sql::__seo_gamme", 1),
  ]);
});

test("GAP3: DELETE FROM served table is a sink", () => {
  assert.deepEqual(detectSqlSinks("m.sql", `DELETE FROM __seo_gamme WHERE id = 1;`), [
    F("sql_migration", "m.sql::__seo_gamme", 1),
  ]);
});

test("GAP3: TRUNCATE (and TRUNCATE TABLE) served table is a sink", () => {
  assert.deepEqual(detectSqlSinks("a.sql", `TRUNCATE __seo_r8_pages;`), [
    F("sql_migration", "a.sql::__seo_r8_pages", 1),
  ]);
  assert.deepEqual(detectSqlSinks("b.sql", `TRUNCATE TABLE __seo_r8_pages;`), [
    F("sql_migration", "b.sql::__seo_r8_pages", 1),
  ]);
});

test("sql_migration: UPDATE inside CREATE FUNCTION body is a sink", () => {
  assert.deepEqual(
    detectSqlSinks("f.sql", `CREATE FUNCTION f() ... BEGIN UPDATE __seo_r8_pages SET x=1; END`),
    [F("sql_migration", "f.sql::__seo_r8_pages", 1)],
  );
});

// ── End-to-end: a NEW file writing served content is detected by the scanner ──
test("scanSinks: a newly-added file writing a served table is detected end-to-end", () => {
  const root = mkdtempSync(join(tmpdir(), "b1b-scan-"));
  const dir = join(root, "backend/src/modules/rogue");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "rogue-writer.service.ts"),
    `export class Rogue {\n  async go() {\n    await this.client.from('__seo_gamme').upsert({ sg_content: 'x' });\n  }\n}\n`,
  );
  const sinks = scanSinks(root);
  assert.ok(
    sinks.some((s) => s.mechanism === "direct_literal" && s.id.endsWith("rogue-writer.service.ts::__seo_gamme") && s.count === 1),
    `expected the rogue served-write to be detected, got: ${JSON.stringify(sinks)}`,
  );
});
