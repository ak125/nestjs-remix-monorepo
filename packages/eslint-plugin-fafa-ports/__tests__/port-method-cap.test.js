/**
 * @fileoverview Unit tests for port-method-cap rule.
 * Uses @typescript-eslint/rule-tester (official gold-standard rule tester).
 */

"use strict";

const { describe, it, after } = require("node:test");
const { RuleTester } = require("@typescript-eslint/rule-tester");
const rule = require("../rules/port-method-cap");

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.afterAll = after;

const ruleTester = new RuleTester({
  parser: require.resolve("@typescript-eslint/parser"),
});

ruleTester.run("port-method-cap", rule, {
  valid: [
    {
      name: "interface not ending with Port is ignored",
      code: `
        export interface BigDto {
          a(): void; b(): void; c(): void;
          d(): void; e(): void; f(): void;
          g(): void; h(): void;
        }
      `,
    },
    {
      name: "Port interface with 5 methods passes",
      code: `
        export interface CommercePort {
          a(): void; b(): void; c(): void;
          d(): void; e(): void;
        }
      `,
    },
    {
      name: "Port interface with 1 method passes",
      code: `
        export interface CommercePort {
          suggestParts(causes: readonly string[]): Promise<readonly string[]>;
        }
      `,
    },
    {
      name: "Port interface with properties only is ignored (no methods)",
      code: `
        export interface ConfigPort {
          readonly a: string;
          readonly b: string;
          readonly c: string;
          readonly d: string;
          readonly e: string;
          readonly f: string;
        }
      `,
    },
  ],
  invalid: [
    {
      name: "Port interface with 6 methods fails",
      code: `
        export interface CommercePort {
          a(): void; b(): void; c(): void;
          d(): void; e(): void; f(): void;
        }
      `,
      errors: [{ messageId: "tooMany", data: { name: "CommercePort", count: 6, max: 5 } }],
    },
    {
      name: "Port interface with method signatures spread across multi-line",
      code: `
        export interface CommercePort {
          suggestParts(
            causes: readonly string[],
            ctx: { brand: string }
          ): Promise<readonly string[]>;
          listAll(): Promise<unknown[]>;
          getOne(id: string): Promise<unknown>;
          getMany(ids: readonly string[]): Promise<readonly unknown[]>;
          getFiltered(predicate: (x: unknown) => boolean): Promise<readonly unknown[]>;
          getGrouped(key: string): Promise<Record<string, unknown[]>>;
        }
      `,
      errors: [{ messageId: "tooMany", data: { name: "CommercePort", count: 6, max: 5 } }],
    },
    {
      name: "Port with trailing comments still triggers (regression: ast-grep buggy)",
      code: `
        export interface CommercePort {
          a(): void; // method 1
          b(): void; // method 2
          c(): void; // method 3
          d(): void; // method 4
          e(): void; // method 5
          f(): void; // method 6 — should fire
        }
      `,
      errors: [{ messageId: "tooMany", data: { name: "CommercePort", count: 6, max: 5 } }],
    },
    {
      name: "custom max option respected",
      options: [{ max: 2 }],
      code: `
        export interface CommercePort {
          a(): void; b(): void; c(): void;
        }
      `,
      errors: [{ messageId: "tooMany", data: { name: "CommercePort", count: 3, max: 2 } }],
    },
  ],
});

console.log("✓ port-method-cap: all tests passed");
