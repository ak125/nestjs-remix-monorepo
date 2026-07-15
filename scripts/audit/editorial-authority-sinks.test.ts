import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EDITORIAL_AUTHORITY_SINKS,
  EDITORIAL_AUTHORITY_SINK_TABLES,
  registryInvariants,
} from "./editorial-authority-sinks.ts";
import { SERVED_TABLES } from "./check-served-content-write-sinks-ratchet.ts";

// ── The registry pins the exact P0 set (audit §6): 2 served-tracked + 15 ratchet-blind. ──
test("registry has the 17 enumerated names, no duplicates", () => {
  const inv = registryInvariants();
  assert.equal(
    inv.total,
    17,
    "audit §6 enumerated set = 17 (prose 18 is an off-by-one)",
  );
  assert.equal(inv.servedTracked, 2);
  assert.equal(inv.ratchetBlind, 15);
  assert.deepEqual(inv.duplicates, [], "no duplicate table names");
});

test("every entry is a concrete __seo_ table (no rN wildcard / pattern)", () => {
  for (const s of EDITORIAL_AUTHORITY_SINKS) {
    assert.match(
      s.table,
      /^__seo_[a-z0-9_]+$/,
      `${s.table} must be a concrete table name`,
    );
    assert.doesNotMatch(
      s.table,
      /[*?]/,
      `${s.table} must not be a glob/pattern`,
    );
  }
});

// ── The reason the registry exists: the served ratchet is BLIND to the blind rows. ──
test("the 2 served-tracked sinks ARE in SERVED_TABLES", () => {
  const served = new Set(SERVED_TABLES);
  for (const s of EDITORIAL_AUTHORITY_SINKS.filter(
    (x) => x.servedRatchetTracked,
  )) {
    assert.ok(
      served.has(s.table),
      `${s.table} should be in SERVED_TABLES (served-at-render)`,
    );
  }
});

test("the 15 ratchet-blind sinks are NOT in SERVED_TABLES (the blindness this registry fixes)", () => {
  const served = new Set(SERVED_TABLES);
  for (const s of EDITORIAL_AUTHORITY_SINKS.filter(
    (x) => !x.servedRatchetTracked,
  )) {
    assert.ok(
      !served.has(s.table),
      `${s.table} is marked ratchet-blind but is in SERVED_TABLES — reclassify servedRatchetTracked`,
    );
  }
});

// ── Every entry is evidence-linked (plan: "each entry linked to a proven writer/caller"). ──
test("writer attribution matches evidence tier", () => {
  for (const s of EDITORIAL_AUTHORITY_SINKS) {
    if (s.evidence === "no_in_app_writer") {
      assert.equal(
        s.writer,
        "",
        `${s.table}: no_in_app_writer must have empty writer`,
      );
    } else {
      assert.notEqual(
        s.writer,
        "",
        `${s.table}: evidence ${s.evidence} requires a named writer`,
      );
    }
  }
});

test("EDITORIAL_AUTHORITY_SINK_TABLES mirrors the registry order", () => {
  assert.deepEqual(
    EDITORIAL_AUTHORITY_SINK_TABLES,
    EDITORIAL_AUTHORITY_SINKS.map((s) => s.table),
  );
});
