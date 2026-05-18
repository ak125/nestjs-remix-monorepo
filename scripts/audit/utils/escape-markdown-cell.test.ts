// scripts/audit/utils/escape-markdown-cell.test.ts
//
// PR-9a — Unit tests for GFM markdown table cell escape. Pattern mirrors
// scripts/audit/__tests__/dependency-modernization.schema.test.ts (node:test
// via `tsx --test`).
import { test } from "node:test";
import * as assert from "node:assert";
import { escapeMarkdownCell } from "./escape-markdown-cell";

test("escapeMarkdownCell — plain ASCII passes through", () => {
  assert.strictEqual(escapeMarkdownCell("hello world"), "hello world");
});

test("escapeMarkdownCell — escapes lone backslash", () => {
  assert.strictEqual(escapeMarkdownCell("a\\b"), "a\\\\b");
});

test("escapeMarkdownCell — escapes pipe", () => {
  assert.strictEqual(escapeMarkdownCell("a|b"), "a\\|b");
});

test("escapeMarkdownCell — replaces LF with <br/>", () => {
  assert.strictEqual(escapeMarkdownCell("a\nb"), "a<br/>b");
});

test("escapeMarkdownCell — replaces CRLF with <br/>", () => {
  assert.strictEqual(escapeMarkdownCell("a\r\nb"), "a<br/>b");
});

test("escapeMarkdownCell — escapes backtick (inline-code break-out)", () => {
  assert.strictEqual(escapeMarkdownCell("a`b`c"), "a\\`b\\`c");
});

test("escapeMarkdownCell — backslash escaped BEFORE pipe (order guarantee)", () => {
  // Input `a\|b`: literal backslash + literal pipe.
  // Expected: backslash becomes `\\`, then pipe becomes `\|` → `a\\\|b`.
  assert.strictEqual(escapeMarkdownCell("a\\|b"), "a\\\\\\|b");
});

test("escapeMarkdownCell — combined backslash + newline + pipe + backtick", () => {
  assert.strictEqual(
    escapeMarkdownCell("path\\to|item\n`code`"),
    "path\\\\to\\|item<br/>\\`code\\`",
  );
});

test("escapeMarkdownCell — empty string returns empty", () => {
  assert.strictEqual(escapeMarkdownCell(""), "");
});
