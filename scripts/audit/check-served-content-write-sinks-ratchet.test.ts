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

const F = (mechanism: Finding["mechanism"], id: string): Finding => ({ mechanism, id });

// ── Detector sensitivity = mutation guards ────────────────────────────────────
// Each asserts a detector catches the REAL write shape found in the codebase.
// Weakening a detector regex (dropping a verb/alias/channel) makes its test go RED.

test("direct_literal: .from('served').upsert is a sink", () => {
  assert.deepEqual(
    detectTsSinks("x.ts", `await c.from('__seo_gamme_conseil').upsert({ a: 1 })`),
    [F("direct_literal", "x.ts::__seo_gamme_conseil")],
  );
});

test("const_map: multiline .from(R7_TABLES.pages)…upsert is a sink", () => {
  assert.deepEqual(
    detectTsSinks("r7.ts", `this.client.from(R7_TABLES.pages)\n      .upsert({})`),
    [F("const_map", "r7.ts::R7_TABLES")],
  );
});

test("const_map: member channel .from(TABLES.blog_advice).insert is a sink", () => {
  assert.deepEqual(
    detectTsSinks("b.ts", `.from(TABLES.blog_advice).insert({})`),
    [F("const_map", "b.ts::TABLES.blog_advice")],
  );
});

test("const_map: member channel .from(TABLES.meta_tags_ariane).delete is a sink", () => {
  assert.deepEqual(
    detectTsSinks("m.ts", `await c.from(TABLES.meta_tags_ariane).delete()`),
    [F("const_map", "m.ts::TABLES.meta_tags_ariane")],
  );
});

test("rpc_publisher: governed callRpc<Generic>('__seo_r8_publish_snapshot') is a sink", () => {
  assert.deepEqual(
    detectTsSinks("r8.ts", `const { data } = await this.callRpc<Row[]>(\n  '__seo_r8_publish_snapshot', { p: 1 })`),
    [F("rpc_publisher", "r8.ts::__seo_r8_publish_snapshot")],
  );
});

test("direct_literal: a READ (.select) is NOT a sink", () => {
  assert.deepEqual(detectTsSinks("x.ts", `.from('__seo_r7_pages').select('*')`), []);
});

test("const_map: a NON-served TABLES member is NOT flagged (member precision)", () => {
  assert.deepEqual(detectTsSinks("x.ts", `.from(TABLES.pieces_gamme).update({})`), []);
});

test("sql_migration: INSERT INTO served table is a sink", () => {
  assert.deepEqual(
    detectSqlSinks("m.sql", `INSERT INTO __seo_gamme (sg_content) VALUES ('x');`),
    [F("sql_migration", "m.sql::__seo_gamme")],
  );
});

test("sql_migration: UPDATE inside CREATE FUNCTION body is a sink", () => {
  assert.deepEqual(
    detectSqlSinks("f.sql", `CREATE FUNCTION f() ... BEGIN UPDATE __seo_r8_pages SET x=1; END`),
    [F("sql_migration", "f.sql::__seo_r8_pages")],
  );
});

// ── Ratchet logic: RED (new sink blocks) → GREEN (baselined) → reductions allowed ──

test("RED: a NEW served-write sink not in baseline surfaces as `added`", () => {
  const baseline = [F("direct_literal", "a.ts::__seo_gamme")];
  const current = [...baseline, F("const_map", "new-writer.ts::R8_TABLES")];
  const { added, removed } = diffFindings(current, baseline);
  assert.equal(added.length, 1);
  assert.equal(added[0].id, "new-writer.ts::R8_TABLES");
  assert.equal(removed.length, 0);
});

test("GREEN: once the new sink is in the baseline, no `added`", () => {
  const baseline = [F("direct_literal", "a.ts::__seo_gamme"), F("const_map", "new-writer.ts::R8_TABLES")];
  assert.deepEqual(diffFindings([...baseline], baseline), { added: [], removed: [] });
});

test("reduction (B2 closing a bypass) surfaces as `removed`, never `added`", () => {
  const baseline = [F("const_map", "x.ts::R7_TABLES"), F("direct_literal", "y.ts::__seo_gamme")];
  const { added, removed } = diffFindings([F("const_map", "x.ts::R7_TABLES")], baseline);
  assert.equal(added.length, 0);
  assert.equal(removed.length, 1);
  assert.equal(removed[0].id, "y.ts::__seo_gamme");
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
    sinks.some((s) => s.mechanism === "direct_literal" && s.id.endsWith("rogue-writer.service.ts::__seo_gamme")),
    `expected the rogue served-write to be detected, got: ${JSON.stringify(sinks)}`,
  );
});
