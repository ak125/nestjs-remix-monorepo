// scripts/seo/lib/canonical-surface-extractor.mjs
//
// R-SEO-09 Phase 2 — extract the **canonical surface** of a Remix route file.
//
// The "canonical surface" is the subset of a route module that can change a
// URL's discoverability or its canonical claim :
//   - filename (Remix flat-routes : filename = URL pattern)
//   - default export name (impacts Remix routing identity / sitemap entries)
//   - `export const meta` return shape (title, description, canonical link, robots)
//   - `export const links` return shape (rel="canonical"/"alternate")
//   - `export const handle` return shape (sitemap / breadcrumb / route id canon)
//   - `export const loader` return shape — KEYS only matching canonical-affecting
//     pattern (`/canonical|canonicalUrl|url|seo|meta/i`). Values are dynamic and
//     intentionally NOT compared.
//
// Anti-pattern surfaces ignored (codemod-safe) :
//   - JSX className strings (Tailwind class rewrites)
//   - Internal `<Link to>` JSX attributes (router-internal navigation)
//   - Hook calls (useState, useEffect, useLoaderData, …)
//   - Import statements
//   - Local helper / component declarations
//
// Two route files whose canonical surface deep-equal can be considered SAFE
// to diff under R-SEO-09 (className-only / JSX-restructure / formatting).
// A non-empty diff is HARD BLOCK unless `r-seo-09-override` label is present.

import { parse } from "@typescript-eslint/parser";

const PARSE_OPTIONS = {
  jsx: true,
  loc: false,
  range: false,
  comment: false,
  tokens: false,
  sourceType: "module",
  ecmaVersion: "latest",
};

const CANONICAL_LOADER_KEY_RE = /^(canonical|canonicalUrl|url|seo|meta)$/i;

export function extractCanonicalSurface(source, filename) {
  const ast = parse(source, PARSE_OPTIONS);
  const surface = {
    filename,
    defaultExportName: null,
    metaReturn: null,
    linksReturn: null,
    handleReturn: null,
    loaderCanonicalKeys: [],
  };

  for (const node of ast.body) {
    if (node.type === "ExportDefaultDeclaration") {
      surface.defaultExportName = readDefaultExportName(node.declaration);
      continue;
    }
    if (node.type !== "ExportNamedDeclaration" || !node.declaration) continue;

    const decl = node.declaration;
    if (decl.type === "VariableDeclaration") {
      for (const d of decl.declarations) {
        if (d.id?.type !== "Identifier" || !d.init) continue;
        applyExportInit(surface, d.id.name, d.init);
      }
    } else if (decl.type === "FunctionDeclaration") {
      const name = decl.id?.name;
      if (!name) continue;
      // Pass the full FunctionDeclaration so serializeReturn /
      // extractLoaderCanonicalKeys can walk the body uniformly with the
      // arrow/function-expression cases.
      applyExportInit(surface, name, decl);
    }
  }

  return surface;
}

function applyExportInit(surface, name, init) {
  if (!init) return;
  switch (name) {
    case "meta":
      surface.metaReturn = serializeReturn(init);
      break;
    case "links":
      surface.linksReturn = serializeReturn(init);
      break;
    case "handle":
      // handle is always a plain object literal (not a function) per Remix convention
      surface.handleReturn = serialize(init);
      break;
    case "loader":
    case "clientLoader":
      surface.loaderCanonicalKeys = extractLoaderCanonicalKeys(init);
      break;
  }
}

function readDefaultExportName(node) {
  if (!node) return null;
  if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") {
    return node.id?.name ?? "<anonymous>";
  }
  if (node.type === "Identifier") return node.name;
  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
    return "<anonymous-function>";
  }
  // CallExpression (HOC) / others : capture callee identity
  if (node.type === "CallExpression") {
    return `<call:${readCallee(node.callee)}>`;
  }
  return `<${node.type}>`;
}

function readCallee(callee) {
  if (!callee) return "?";
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression") {
    return `${readCallee(callee.object)}.${callee.property?.name ?? "?"}`;
  }
  return callee.type;
}

function serializeReturn(node) {
  // `meta` / `links` may be:
  //   - ArrowFunctionExpression with expression body
  //   - ArrowFunctionExpression with block body containing returns
  //   - FunctionExpression / FunctionDeclaration (block body)
  //   - direct object/array literal (rare but allowed)
  //   - TSAsExpression / TSTypeAssertion wrapping any of the above
  const unwrapped = unwrapTypeCast(node);
  if (isFunctionNode(unwrapped)) {
    if (unwrapped.body?.type === "BlockStatement") {
      return serialize(firstReturnExpression(unwrapped.body));
    }
    return serialize(unwrapped.body);
  }
  return serialize(unwrapped);
}

function isFunctionNode(node) {
  if (!node) return false;
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression" ||
    node.type === "FunctionDeclaration"
  );
}

function firstReturnExpression(blockNode) {
  if (!blockNode || blockNode.type !== "BlockStatement") return null;
  for (const stmt of blockNode.body) {
    if (stmt.type === "ReturnStatement") return stmt.argument ?? null;
  }
  return null;
}

function unwrapTypeCast(node) {
  if (!node) return node;
  if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion" || node.type === "TSSatisfiesExpression") {
    return unwrapTypeCast(node.expression);
  }
  return node;
}

function extractLoaderCanonicalKeys(init) {
  const unwrapped = unwrapTypeCast(init);
  if (!isFunctionNode(unwrapped)) return [];
  const ret = unwrapped.body?.type === "BlockStatement"
    ? firstReturnExpression(unwrapped.body)
    : unwrapped.body;
  return canonicalKeysOf(ret);
}

function canonicalKeysOf(expr) {
  if (!expr) return [];
  const node = unwrapTypeCast(expr);

  // `return json({ ... })` / `return defer({ ... })` — peel call expression
  if (node.type === "CallExpression" && node.arguments.length > 0) {
    return canonicalKeysOf(node.arguments[0]);
  }
  if (node.type !== "ObjectExpression") return [];

  const keys = [];
  for (const prop of node.properties) {
    if (prop.type !== "Property" || prop.key?.type !== "Identifier") continue;
    if (CANONICAL_LOADER_KEY_RE.test(prop.key.name)) {
      keys.push(prop.key.name);
    }
  }
  return keys.sort();
}

// ---- Generic AST serializer for canonical surface diff ----
//
// Produces a normalized JSON-safe representation of an expression node :
//   - Strips `loc`, `range`, `parent`, `start`, `end` (already off via parse opts)
//   - Preserves `type`, child node `type`+structure, and Literal `value` (so
//     canonical URL strings ARE compared).
//   - Identifier names ARE preserved (they encode export references).
//   - Functions are serialized via their body's first return expression.
function serialize(node) {
  if (node == null) return null;
  if (typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(serialize);

  const out = { type: node.type };
  for (const key of Object.keys(node)) {
    if (key === "type") continue;
    if (key === "loc" || key === "range" || key === "start" || key === "end" || key === "parent") continue;
    out[key] = serialize(node[key]);
  }
  return out;
}
