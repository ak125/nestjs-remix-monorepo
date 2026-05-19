// scripts/audit/lib/jsx-classlist.mjs
//
// AST-grade JSX `className` walker for impeccable codemods.
//
// `transformClassNames(source, transformFn)` parses TSX source via
// @typescript-eslint/parser, locates every JSX `className` attribute, and
// asks `transformFn(tokens, context)` how to rewrite each string source
// contributing to the className value.
//
// Why AST-grade :
//   - Never matches `className` keys in plain objects, comments, or strings
//     in unrelated positions (a problem for regex-based codemods).
//   - Handles 5 common className value shapes :
//       1. <div className="a b c"/>
//       2. <div className={`a b c`}/>                  (static TemplateLiteral)
//       3. <div className={cn("a", "b")}/>            (also clsx/classNames/twMerge/cva)
//       4. <div className={isFoo ? "a" : "b"}/>       (ConditionalExpression)
//       5. <div className={isFoo && "a"}/>            (LogicalExpression - right operand)
//   - `context.allClassNames` is the union of tokens across ALL string sources
//     on the same JSX element, enabling context-aware transforms (e.g. "is
//     there a bg-X on this element?" for gray-on-color codemod).
//   - Surgical text edits via range[] preserve formatting / whitespace /
//     comments outside the className value strings.
//
// transformFn signature :
//   (tokens: string[], context: { elementName: string, allClassNames: string[] })
//     => string[] | null
//   - return new tokens array → string is rewritten
//   - return same array / unchanged tokens → no edit emitted
//   - return null → skip this source

import { parse } from "@typescript-eslint/parser";

const PARSE_OPTIONS = {
  jsx: true,
  range: true,
  loc: false,
  sourceType: "module",
  ecmaVersion: "latest",
  comment: false,
  tokens: false,
};

const CN_FUNCTIONS = new Set(["cn", "clsx", "classNames", "twMerge", "cva"]);

export function transformClassNames(source, transformFn) {
  const ast = parse(source, PARSE_OPTIONS);
  const edits = [];

  function visit(node, parent) {
    if (!node || typeof node !== "object" || typeof node.type !== "string") return;

    if (node.type === "JSXAttribute" && getAttrName(node) === "className" && node.value) {
      processClassNameAttr(node, parent, source, transformFn, edits);
      // Don't descend into children of a className attribute — its strings
      // are already harvested by processClassNameAttr.
      return;
    }

    for (const key of Object.keys(node)) {
      if (key === "parent" || key === "loc" || key === "range") continue;
      const v = node[key];
      if (Array.isArray(v)) {
        for (const child of v) visit(child, node);
      } else if (v && typeof v === "object" && typeof v.type === "string") {
        visit(v, node);
      }
    }
  }

  visit(ast, null);

  if (edits.length === 0) return { source, count: 0 };

  // Apply edits right-to-left so earlier ranges remain valid.
  edits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const e of edits) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  return { source: out, count: edits.length };
}

function getAttrName(attr) {
  if (!attr.name) return null;
  if (attr.name.type === "JSXIdentifier") return attr.name.name;
  return null;
}

function processClassNameAttr(attr, parent, source, transformFn, edits) {
  const elementName = getJsxElementName(parent);
  const sources = collectStringSources(attr.value);
  if (sources.length === 0) return;

  const allClassNames = sources.flatMap((s) => splitClassTokens(s.value));

  for (const src of sources) {
    const tokens = splitClassTokens(src.value);
    const ctx = { elementName, allClassNames };
    const newTokens = transformFn(tokens, ctx);
    if (newTokens == null) continue;
    if (sameTokens(newTokens, tokens)) continue;
    const newValue = newTokens.join(" ").replace(/\s+/g, " ").trim();
    edits.push({
      start: src.start,
      end: src.end,
      replacement: newValue,
    });
  }
}

function getJsxElementName(parent) {
  // parent is the JSXOpeningElement node
  if (!parent || parent.type !== "JSXOpeningElement") return "<unknown>";
  const name = parent.name;
  if (!name) return "<unknown>";
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") {
    return `${getJsxMemberName(name.object)}.${name.property?.name ?? "?"}`;
  }
  return name.type;
}

function getJsxMemberName(obj) {
  if (!obj) return "?";
  if (obj.type === "JSXIdentifier") return obj.name;
  if (obj.type === "JSXMemberExpression") return `${getJsxMemberName(obj.object)}.${obj.property?.name ?? "?"}`;
  return obj.type;
}

// Each "string source" is one Literal / TemplateElement / CallExpression
// argument that contributes runtime class tokens. We track the inner range
// (excluding the surrounding quote/backtick characters) so the edit replaces
// only the value text.
function collectStringSources(valueNode) {
  const sources = [];
  walkClassValue(valueNode, sources);
  return sources;
}

function walkClassValue(node, sources) {
  if (!node) return;
  // <div className="..."> → JSXAttribute.value is the Literal directly
  if (node.type === "Literal" && typeof node.value === "string") {
    // String literal range includes the surrounding quotes
    sources.push({ value: node.value, start: node.range[0] + 1, end: node.range[1] - 1 });
    return;
  }
  // <div className={...}> → JSXExpressionContainer wraps the expression
  if (node.type === "JSXExpressionContainer") {
    walkClassValue(node.expression, sources);
    return;
  }
  if (node.type === "TemplateLiteral") {
    // Static quasis contribute their text (delimited by backtick / ${ / })
    // even when interleaved with expressions — they participate in the
    // runtime className. We extract just the inner text of each quasi.
    for (let i = 0; i < node.quasis.length; i++) {
      const q = node.quasis[i];
      // Quasi range covers the surrounding delimiters: ` for the first/last
      // quasi, ${ and } for interior ones. Strip them via the raw text.
      const text = q.value.cooked;
      if (!text || !text.trim()) continue;
      // Compute inner span by finding the cooked text inside the source slice.
      // Conservative approach : strip 1 char on each side when the quasi
      // is the first/last (backtick); strip 2 left when not first (the `}`
      // belongs to the prior expression, hmm) — actually parser ranges for
      // TemplateElement always include 1 char on each side (backtick or
      // ${ / }). Empirical: q.range[0]+1 .. q.range[1]-1 is correct.
      sources.push({ value: text, start: q.range[0] + 1, end: q.range[1] - 1 });
    }
    // Walk into expressions to handle the common
    //   `prefix ${cond ? "a b" : "c d"} suffix` pattern.
    for (const expr of node.expressions) walkClassValue(expr, sources);
    return;
  }
  if (node.type === "ConditionalExpression") {
    walkClassValue(node.consequent, sources);
    walkClassValue(node.alternate, sources);
    return;
  }
  if (node.type === "LogicalExpression") {
    walkClassValue(node.right, sources);
    return;
  }
  if (node.type === "CallExpression" && isClassNameUtility(node.callee)) {
    for (const arg of node.arguments) walkClassValue(arg, sources);
    return;
  }
  // ArrayExpression elements (some patterns use [..., conditional && "..."])
  if (node.type === "ArrayExpression") {
    for (const el of node.elements) walkClassValue(el, sources);
    return;
  }
}

function isClassNameUtility(callee) {
  if (!callee) return false;
  if (callee.type === "Identifier") return CN_FUNCTIONS.has(callee.name);
  // MemberExpression like utils.cn(...)
  if (callee.type === "MemberExpression" && callee.property?.type === "Identifier") {
    return CN_FUNCTIONS.has(callee.property.name);
  }
  return false;
}

function splitClassTokens(value) {
  return value.split(/\s+/).filter(Boolean);
}

function sameTokens(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
