// scripts/audit/__tests__/codemod-gray-on-color.test.mjs
//
// Tests for the gray-on-color transform logic. The transform fixes the
// impeccable `gray-on-color` anti-pattern (gray text washed out on a
// saturated colored background).
//
// Replacement strategy :
//   - Find `text-(gray|slate)-{300..600}` tokens
//   - If the same element has `bg-{family}-{50|100|200}` (light wash family) :
//       text token → `text-{family}-900` (darker shade, same family — keeps
//       brand color while restoring contrast)
//   - If the same element has `bg-{family}-{300..900}` (bold) :
//       text token → `text-white`
//   - If the bg family is gray/slate/zinc/neutral/stone : NO CHANGE
//     (gray-on-gray is not the impeccable anti-pattern)
//   - If the element has no bg-{saturated-family}-* : NO CHANGE

import { test } from "node:test";
import assert from "node:assert/strict";
import { transformGrayOnColor } from "../codemod-gray-on-color.mjs";

test("light bg wash : text-gray-700 on bg-blue-50 → text-blue-900", () => {
  const src = `<span className="text-gray-700 bg-blue-50 p-2">x</span>`;
  const { source } = transformGrayOnColor(src);
  assert.match(source, /className="text-blue-900 bg-blue-50 p-2"/);
});

test("light bg wash : text-slate-500 on bg-purple-100 → text-purple-900", () => {
  const src = `<div className="text-slate-500 bg-purple-100">x</div>`;
  const { source } = transformGrayOnColor(src);
  assert.match(source, /className="text-purple-900 bg-purple-100"/);
});

test("bold bg : text-gray-600 on bg-blue-500 → text-white", () => {
  const src = `<button className="text-gray-600 bg-blue-500">x</button>`;
  const { source } = transformGrayOnColor(src);
  assert.match(source, /className="text-white bg-blue-500"/);
});

test("bold bg : text-gray-500 on bg-red-700 → text-white", () => {
  const src = `<div className="bg-red-700 text-gray-500">x</div>`;
  const { source } = transformGrayOnColor(src);
  assert.match(source, /className="bg-red-700 text-white"/);
});

test("text-gray on bg-gray : NO CHANGE (gray-on-gray not anti-pattern)", () => {
  const src = `<div className="text-gray-500 bg-gray-200">x</div>`;
  const { source, count } = transformGrayOnColor(src);
  assert.equal(source, src);
  assert.equal(count, 0);
});

test("text-gray on no bg : NO CHANGE", () => {
  const src = `<div className="text-gray-500 p-2 rounded">x</div>`;
  const { source, count } = transformGrayOnColor(src);
  assert.equal(source, src);
  assert.equal(count, 0);
});

test("text-blue (non-gray) : NO CHANGE even with bg-X", () => {
  const src = `<div className="text-blue-500 bg-red-500">x</div>`;
  const { source, count } = transformGrayOnColor(src);
  assert.equal(source, src);
  assert.equal(count, 0);
});

test("text-gray-100 (below 300) : NO CHANGE", () => {
  const src = `<div className="text-gray-100 bg-blue-500">x</div>`;
  const { source, count } = transformGrayOnColor(src);
  assert.equal(source, src);
  assert.equal(count, 0);
});

test("text-gray-700 outside threshold range : 700 is in 300..700 → transform", () => {
  const src = `<div className="text-gray-700 bg-blue-50">x</div>`;
  const { source, count } = transformGrayOnColor(src);
  assert.match(source, /text-blue-900/);
  assert.equal(count, 1);
});

test("cn(...) split sources : context.allClassNames sees both", () => {
  const src = `<div className={cn("text-gray-500", "bg-blue-50 p-4")}/>`;
  const { source } = transformGrayOnColor(src);
  // gray token is in a different string source than the bg, but allClassNames merges them
  assert.match(source, /cn\("text-blue-900", "bg-blue-50 p-4"\)/);
});

test("variant prefix : text-slate-400 + hover:bg-red-50 → text-red-900", () => {
  const src = `<button className="text-slate-400 hover:text-red-500 hover:bg-red-50">x</button>`;
  const { source } = transformGrayOnColor(src);
  assert.match(source, /text-red-900/);
  assert.doesNotMatch(source, /text-slate-400/);
});

test("widened threshold : text-gray-900 on bg-yellow-200 → text-yellow-900", () => {
  const src = `<div className="text-gray-900 bg-yellow-200">x</div>`;
  const { source } = transformGrayOnColor(src);
  assert.match(source, /text-yellow-900/);
});

test("widened threshold : text-slate-800 on bg-blue-50 → text-blue-900", () => {
  const src = `<div className="text-slate-800 bg-blue-50">x</div>`;
  const { source } = transformGrayOnColor(src);
  assert.match(source, /text-blue-900/);
});

test("multiple elements on same file are all processed", () => {
  const src = `
    <>
      <div className="text-gray-500 bg-blue-500" />
      <span className="text-slate-600 bg-red-100" />
    </>
  `;
  const { source, count } = transformGrayOnColor(src);
  assert.match(source, /text-white bg-blue-500/);
  assert.match(source, /text-red-900 bg-red-100/);
  assert.equal(count, 2);
});
