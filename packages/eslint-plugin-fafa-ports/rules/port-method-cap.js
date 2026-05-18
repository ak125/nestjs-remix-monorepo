/**
 * @fileoverview Port interface method cardinality cap (Diagnostic Control Plane V1).
 *
 * Replaces the previous ast-grep rule `domain-port-method-cap.yml` which silently
 * failed to fire (pattern-matching with N consecutive metavariables never matched
 * because tree-sitter normalises whitespace differently than ast-grep templates
 * expect). TypeScript-ESLint AST gives us true `TSMethodSignature` counting,
 * immune to whitespace / comments / decorators / generics / inheritance.
 *
 * Canon : `ddd-bounded-contexts-anti-god-engine`. A cross-domain Port must remain
 * minimal + intent-based. More than 5 methods = coupling déguisé.
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

module.exports = createRule({
  name: "port-method-cap",
  meta: {
    type: "problem",
    docs: {
      description:
        "Cross-domain Port interfaces must expose at most N methods (default 5). Forces splitting fat Ports into intent-specific shapes.",
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          max: { type: "integer", minimum: 1, maximum: 20 },
          suffix: { type: "string", minLength: 1 },
        },
      },
    ],
    messages: {
      tooMany:
        "Port interface '{{name}}' has {{count}} methods, max allowed is {{max}}. Split into multiple intent-based Ports OR open an ADR L4 to extend the limit. Canon: ddd-bounded-contexts-anti-god-engine.",
    },
  },
  defaultOptions: [{ max: 5, suffix: "Port" }],
  create(context, [options]) {
    const max = options.max ?? 5;
    const suffix = options.suffix ?? "Port";
    return {
      TSInterfaceDeclaration(node) {
        if (!node.id || !node.id.name.endsWith(suffix)) return;
        const methods = node.body.body.filter(
          (member) => member.type === "TSMethodSignature",
        );
        if (methods.length > max) {
          context.report({
            node: node.id,
            messageId: "tooMany",
            data: {
              name: node.id.name,
              count: methods.length,
              max,
            },
          });
        }
      },
    };
  },
});
