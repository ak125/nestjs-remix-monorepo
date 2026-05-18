/**
 * @fileoverview Port DTO shape cap (Diagnostic Control Plane V1).
 *
 * Replaces the previous ast-grep rule `domain-port-dto-shape.yml` which leaked
 * on interfaces with trailing inline comments (`field: type; // comment`).
 * TypeScript-ESLint AST counts `TSPropertySignature` nodes directly, immune to
 * whitespace, comments, readonly, optional, generics.
 *
 * Two invariants per DTO interface (skip when name ends with 'Port', those are
 * checked by `port-method-cap` instead) :
 *
 *   - max-fields    : top-level `TSPropertySignature` count ≤ 8
 *   - max-nesting   : nested `TSTypeLiteral` depth ≤ 3
 *
 * Canon : `ddd-bounded-contexts-anti-god-engine`. A wide DTO crossing a bounded
 * context boundary is a domain entity in disguise.
 *
 * Severity tier : L2 (PR-block + override `pr-toolkit:override-L2`) per
 * `.claude/governance/guard-hierarchy.yaml`.
 */

"use strict";

const { ESLintUtils } = require("@typescript-eslint/utils");

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ak125/nestjs-remix-monorepo/blob/main/packages/eslint-config/rules/${name}.js`,
);

/**
 * Returns the maximum nesting depth of inline object types reachable from
 * `typeNode`. A `TSTypeLiteral` adds 1 to the depth ; unions / intersections /
 * arrays / tuples descend into their components without adding depth.
 */
function nestingDepth(typeNode) {
  if (!typeNode) return 0;
  switch (typeNode.type) {
    case "TSTypeLiteral": {
      let max = 0;
      for (const member of typeNode.members || []) {
        if (member.type === "TSPropertySignature" && member.typeAnnotation) {
          max = Math.max(max, nestingDepth(member.typeAnnotation.typeAnnotation));
        }
      }
      return 1 + max;
    }
    case "TSUnionType":
    case "TSIntersectionType": {
      let max = 0;
      for (const t of typeNode.types || []) {
        max = Math.max(max, nestingDepth(t));
      }
      return max;
    }
    case "TSArrayType":
      return nestingDepth(typeNode.elementType);
    case "TSTupleType": {
      let max = 0;
      for (const t of typeNode.elementTypes || []) {
        max = Math.max(max, nestingDepth(t));
      }
      return max;
    }
    default:
      return 0;
  }
}

/**
 * Interface depth convention :
 *   1 → flat interface (no nested object literals)         `{ a: string }`
 *   2 → one level of nesting                                `{ a: { b: string } }`
 *   3 → two levels                                          `{ a: { b: { c: string } } }`
 * The interface body itself counts as the first level.
 */
function interfaceDepth(interfaceNode) {
  let max = 0;
  for (const member of interfaceNode.body.body) {
    if (member.type === "TSPropertySignature" && member.typeAnnotation) {
      max = Math.max(max, nestingDepth(member.typeAnnotation.typeAnnotation));
    }
  }
  return 1 + max;
}

module.exports = createRule({
  name: "port-dto-shape",
  meta: {
    type: "problem",
    docs: {
      description:
        "Cross-domain Port DTOs must stay narrow (≤ 8 top-level fields) and shallow (≤ 3 nesting levels). Forces splitting wide payloads into intent-specific DTOs.",
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          maxFields: { type: "integer", minimum: 1, maximum: 30 },
          maxNesting: { type: "integer", minimum: 1, maximum: 10 },
          portSuffix: { type: "string", minLength: 1 },
        },
      },
    ],
    messages: {
      tooManyFields:
        "Port DTO '{{name}}' has {{count}} top-level fields, max allowed is {{max}}. Split into intent-specific DTOs (e.g. {{name}}Pricing + {{name}}Identity) OR open an ADR L4 to extend. Canon: ddd-bounded-contexts-anti-god-engine.",
      tooDeep:
        "Port DTO '{{name}}' has nesting depth {{depth}}, max allowed is {{max}}. Flatten the structure OR move sub-objects to their owning domain. Canon: ddd-bounded-contexts-anti-god-engine.",
    },
  },
  defaultOptions: [
    { maxFields: 8, maxNesting: 3, portSuffix: "Port" },
  ],
  create(context, [options]) {
    const maxFields = options.maxFields ?? 8;
    const maxNesting = options.maxNesting ?? 3;
    const portSuffix = options.portSuffix ?? "Port";
    return {
      TSInterfaceDeclaration(node) {
        if (!node.id) return;
        if (node.id.name.endsWith(portSuffix)) return;
        const props = node.body.body.filter(
          (member) => member.type === "TSPropertySignature",
        );
        if (props.length > maxFields) {
          context.report({
            node: node.id,
            messageId: "tooManyFields",
            data: {
              name: node.id.name,
              count: props.length,
              max: maxFields,
            },
          });
        }
        const depth = interfaceDepth(node);
        if (depth > maxNesting) {
          context.report({
            node: node.id,
            messageId: "tooDeep",
            data: {
              name: node.id.name,
              depth,
              max: maxNesting,
            },
          });
        }
      },
    };
  },
});
