// scripts/audit/__tests__/jsx-classlist.test.mjs
//
// Tests for transformClassNames(source, transform) — JSX className AST walker
// used by all impeccable codemods that need context-aware Tailwind class
// transforms.
//
// Contract:
//   - Walks JSX `className` attributes ONLY (never matches non-className strings)
//   - Handles: string Literal, single-quasi TemplateLiteral, CallExpression
//     to cn/clsx/classNames/twMerge/cva, ConditionalExpression branches
//   - transformFn(tokens, context) returns new tokens array OR null to skip
//   - context.allClassNames = all tokens across ALL string sources on the same
//     element (cross-source context for the same JSX element)
//   - context.elementName = JSX opening element name (e.g. "div", "Button")

import { test } from "node:test";
import assert from "node:assert/strict";
import { transformClassNames } from "../lib/jsx-classlist.mjs";

test("no-op transform returns identical source", () => {
  const src = `export const X = () => <div className="a b c">x</div>;`;
  const { source, count } = transformClassNames(src, (tokens) => tokens);
  assert.equal(source, src);
  assert.equal(count, 0);
});

test("simple string Literal className gets transformed", () => {
  const src = `export const X = () => <div className="a b c">x</div>;`;
  const { source, count } = transformClassNames(src, (tokens) =>
    tokens.map((t) => t.toUpperCase()),
  );
  assert.match(source, /className="A B C"/);
  assert.equal(count, 1);
});

test("non-className string literals are untouched", () => {
  const src = `export const X = () => <a href="text-gray-500">x</a>;`;
  const { source, count } = transformClassNames(src, () => ["TRANSFORMED"]);
  assert.equal(source, src);
  assert.equal(count, 0);
});

test("cn(...) call expression visits each string argument", () => {
  const src = `import { cn } from "~/lib/utils";\nexport const X = () => <div className={cn("a b", "c")}>x</div>;`;
  const { source, count } = transformClassNames(src, (tokens) =>
    tokens.map((t) => t.toUpperCase()),
  );
  assert.match(source, /cn\("A B", "C"\)/);
  assert.equal(count, 2);
});

test("clsx(...) and classNames(...) and twMerge(...) are recognized", () => {
  const src = `
    const A = <div className={clsx("a")}/>;
    const B = <div className={classNames("b")}/>;
    const C = <div className={twMerge("c")}/>;
  `;
  let calls = 0;
  const { count } = transformClassNames(src, () => { calls++; return ["X"]; });
  assert.equal(count, 3);
  assert.equal(calls, 3);
});

test("context.allClassNames merges tokens across cn(...) string args", () => {
  const src = `<div className={cn("text-gray-500", "bg-blue-500")}>x</div>`;
  const seenContexts = [];
  transformClassNames(src, (tokens, ctx) => {
    seenContexts.push({ tokens: [...tokens], allClassNames: [...ctx.allClassNames] });
    return tokens;
  });
  assert.equal(seenContexts.length, 2);
  for (const c of seenContexts) {
    assert.deepEqual(
      c.allClassNames,
      ["text-gray-500", "bg-blue-500"],
      "allClassNames must be the union across the same JSX element",
    );
  }
});

test("context.elementName is the JSX element identifier", () => {
  const src = `<Button className="a">x</Button>`;
  let elementName = null;
  transformClassNames(src, (tokens, ctx) => {
    elementName = ctx.elementName;
    return tokens;
  });
  assert.equal(elementName, "Button");
});

test("template literal with single quasi (no expressions) is transformed", () => {
  const src = "<div className={`a b c`}>x</div>";
  const { source, count } = transformClassNames(src, (tokens) =>
    tokens.map((t) => t.toUpperCase()),
  );
  assert.match(source, /className=\{`A B C`\}/);
  assert.equal(count, 1);
});

test("template literal with expressions : static quasis are visited", () => {
  // `a ${dyn} b` — both static quasis ("a" and "b") are className contributors.
  const src = "<div className={`a ${dyn} b`}>x</div>";
  let calls = 0;
  const { count } = transformClassNames(src, (tokens) => { calls++; return tokens.map((t) => t.toUpperCase()); });
  assert.equal(calls, 2, "must visit each static quasi");
  assert.equal(count, 2);
});

test("template with conditional expression inside : both branches visited", () => {
  const src = "<div className={`prefix ${cond ? 'a b' : 'c d'} suffix`}/>";
  let visited = [];
  transformClassNames(src, (tokens) => { visited.push(tokens.join(" ")); return tokens; });
  // Visits: "prefix" quasi, "a b" consequent, "c d" alternate, " suffix" quasi
  assert.ok(visited.includes("prefix"));
  assert.ok(visited.includes("a b"));
  assert.ok(visited.includes("c d"));
  assert.ok(visited.includes("suffix"));
});

test("ConditionalExpression branches each get visited", () => {
  const src = `<div className={isFoo ? "a b" : "c"}>x</div>`;
  let calls = 0;
  const { count } = transformClassNames(src, () => { calls++; return ["X"]; });
  assert.equal(count, 2);
  assert.equal(calls, 2);
});

test("returning null from transform leaves the source unchanged", () => {
  const src = `<div className="a b c">x</div>`;
  const { source, count } = transformClassNames(src, () => null);
  assert.equal(source, src);
  assert.equal(count, 0);
});

test("returning empty array removes all classes (className becomes empty)", () => {
  const src = `<div className="a b c">x</div>`;
  const { source, count } = transformClassNames(src, () => []);
  assert.match(source, /className=""/);
  assert.equal(count, 1);
});

test("multiple edits in same file apply in correct order (no offset drift)", () => {
  const src = `
    <div className="early">
      <span className="middle">x</span>
      <p className="late">y</p>
    </div>
  `;
  const { source, count } = transformClassNames(src, (tokens) =>
    tokens.map((t) => t.toUpperCase()),
  );
  assert.match(source, /className="EARLY"/);
  assert.match(source, /className="MIDDLE"/);
  assert.match(source, /className="LATE"/);
  assert.equal(count, 3);
});

test("does not visit className inside non-JSX string keys", () => {
  // A regular object with className key is NOT a JSX attribute.
  const src = `const x = { className: "should-not-transform" };`;
  const { source, count } = transformClassNames(src, () => ["X"]);
  assert.equal(source, src);
  assert.equal(count, 0);
});
