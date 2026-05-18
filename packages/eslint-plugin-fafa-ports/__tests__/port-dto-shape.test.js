/**
 * @fileoverview Unit tests for port-dto-shape rule.
 * Uses @typescript-eslint/rule-tester.
 */

"use strict";

const { describe, it, after } = require("node:test");
const { RuleTester } = require("@typescript-eslint/rule-tester");
const rule = require("../rules/port-dto-shape");

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.afterAll = after;

const ruleTester = new RuleTester({
  parser: require.resolve("@typescript-eslint/parser"),
});

ruleTester.run("port-dto-shape", rule, {
  valid: [
    {
      name: "DTO with 8 fields passes",
      code: `
        export interface NarrowDto {
          a: string; b: string; c: string; d: string;
          e: string; f: string; g: string; h: string;
        }
      `,
    },
    {
      name: "Port interface (suffix Port) is skipped — covered by port-method-cap",
      code: `
        export interface CommercePort {
          a: string; b: string; c: string; d: string;
          e: string; f: string; g: string; h: string;
          i: string; j: string;
        }
      `,
    },
    {
      name: "DTO with 8 readonly + optional + comments passes",
      code: `
        export interface CommerceVehicleCtx {
          readonly type_id?: number; // optional numeric id
          readonly brand_slug?: string;
          readonly model_slug?: string;
          readonly engine_slug?: string;
          readonly year?: number;
          readonly mileage_km?: number;
          readonly source: 'diagnostic' | 'manual';
          readonly iat: number;
        }
      `,
    },
    {
      name: "DTO with 3-level nesting passes",
      code: `
        export interface OkDto {
          a: { b: { c: string } };
        }
      `,
    },
  ],
  invalid: [
    {
      name: "DTO with 9 fields fails (regression: VehicleContext was leaking)",
      code: `
        export interface VehicleContext {
          readonly v: 1;
          readonly type_id?: number;
          readonly brand_slug?: string;
          readonly model_slug?: string;
          readonly engine_slug?: string;
          readonly year?: number;
          readonly mileage_km?: number;
          readonly source: 'diagnostic' | 'manual' | 'gsc';
          readonly iat: number;
        }
      `,
      errors: [
        { messageId: "tooManyFields", data: { name: "VehicleContext", count: 9, max: 8 } },
      ],
    },
    {
      name: "DTO with 10 plain fields fails",
      code: `
        export interface FatDto {
          a: string; b: string; c: string; d: string; e: string;
          f: string; g: string; h: string; i: string; j: string;
        }
      `,
      errors: [
        { messageId: "tooManyFields", data: { name: "FatDto", count: 10, max: 8 } },
      ],
    },
    {
      name: "DTO with trailing inline comments still triggers (regression vs ast-grep brittle pattern)",
      code: `
        export interface FatDto {
          a: string; // 1
          b: string; // 2
          c: string; // 3
          d: string; // 4
          e: string; // 5
          f: string; // 6
          g: string; // 7
          h: string; // 8
          i: string; // 9 — over limit
        }
      `,
      errors: [
        { messageId: "tooManyFields", data: { name: "FatDto", count: 9, max: 8 } },
      ],
    },
    {
      name: "DTO with 4-level nesting fails",
      code: `
        export interface DeepDto {
          a: { b: { c: { d: string } } };
        }
      `,
      errors: [
        { messageId: "tooDeep", data: { name: "DeepDto", depth: 4, max: 3 } },
      ],
    },
    {
      name: "custom maxFields option respected",
      options: [{ maxFields: 2 }],
      code: `
        export interface ThinDto {
          a: string; b: string; c: string;
        }
      `,
      errors: [
        { messageId: "tooManyFields", data: { name: "ThinDto", count: 3, max: 2 } },
      ],
    },
  ],
});

console.log("✓ port-dto-shape: all tests passed");
