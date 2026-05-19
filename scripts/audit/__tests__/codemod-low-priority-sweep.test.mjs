// scripts/audit/__tests__/codemod-low-priority-sweep.test.mjs
//
// Combined transform handling impeccable's low-priority categories :
//   - border-accent-on-rounded : `border-{l|r|t|b}-{2|4|8}` co-occurring with
//     `rounded-{X}` → remove the border-side-thickness token AND any adjacent
//     `border-{color}-{shade}` token on the same element.
//   - gradient-text : co-occurrence `bg-clip-text` + `text-transparent` +
//     `bg-gradient-to-{dir}` + `from-X`/`to-X`/`via-X` → replace ALL of these
//     with `text-foreground` (flat semantic).
//
// overused-font (2 CSS cases in global.css) is NOT a JSX className transform
// and is handled by a manual edit, not by this codemod.

import { test } from "node:test";
import assert from "node:assert/strict";
import { transformLowPriority } from "../codemod-low-priority-sweep.mjs";

// --- border-accent-on-rounded ---

test("border-accent : border-b-2 + rounded-lg → drops border-b-2", () => {
  const src = `<div className="border-b-2 border-blue-500 rounded-lg p-4"/>`;
  const { source } = transformLowPriority(src);
  assert.match(source, /className="rounded-lg p-4"/);
});

test("border-accent : border-t-4 + rounded-md → drops border-t-4 (no color)", () => {
  const src = `<div className="border-t-4 rounded-md"/>`;
  const { source } = transformLowPriority(src);
  assert.match(source, /className="rounded-md"/);
});

test("border-accent : no rounded → NO CHANGE", () => {
  const src = `<div className="border-b-2 border-blue-500 p-4"/>`;
  const { source, count } = transformLowPriority(src);
  assert.equal(source, src);
  assert.equal(count, 0);
});

test("border-accent : drops adjacent border-color but keeps non-color border tokens", () => {
  const src = `<div className="border-l-4 border-purple-600 rounded-md"/>`;
  const { source } = transformLowPriority(src);
  assert.match(source, /className="rounded-md"/);
});

// --- gradient-text ---

test("gradient-text : bg-clip-text + text-transparent + bg-gradient → text-foreground", () => {
  const src = `<h1 className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">Hi</h1>`;
  const { source } = transformLowPriority(src);
  assert.match(source, /className="text-foreground"/);
});

test("gradient-text : preserves unrelated tokens", () => {
  const src = `<h1 className="font-bold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-cyan-500 mb-4"/>`;
  const { source } = transformLowPriority(src);
  assert.match(source, /font-bold/);
  assert.match(source, /text-2xl/);
  assert.match(source, /mb-4/);
  assert.match(source, /text-foreground/);
  assert.doesNotMatch(source, /bg-clip-text|text-transparent|bg-gradient-to-r|from-blue-500|to-cyan-500/);
});

test("gradient-text : missing one of the triplet → NO CHANGE", () => {
  // only bg-clip-text without text-transparent and bg-gradient → not an anti-pattern
  const src = `<div className="bg-clip-text font-bold"/>`;
  const { source, count } = transformLowPriority(src);
  assert.equal(source, src);
  assert.equal(count, 0);
});

// --- combined ---

test("border-accent + gradient-text on same file are both fixed", () => {
  const src = `
    <>
      <div className="border-b-2 border-red-500 rounded-lg" />
      <h1 className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">Hi</h1>
    </>
  `;
  const { source } = transformLowPriority(src);
  assert.match(source, /className="rounded-lg"/);
  assert.match(source, /className="text-foreground"/);
});
