/**
 * DT-0 contract tests for the Style Dictionary + DTCG pipeline.
 *
 * Unit-level guards. The byte-identity gate (rebuilt artifacts == committed) is
 * `npm run build:check`; the visual gate is GATE-0 (Playwright). These cover the
 * source contract, the oracle-verified color math, and the flat projection that
 * `frontend/tailwind.config.cjs` consumes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { validateTokens } from "../scripts/tokens-schema.mjs";
import { getContrastColor, hexToHSL } from "../scripts/color-utils.mjs";

const PKG = dirname(dirname(fileURLToPath(import.meta.url)));
const source = JSON.parse(readFileSync(join(PKG, "src/tokens.json"), "utf8"));
const require = createRequire(import.meta.url);
const projection = require(join(PKG, "src/tailwind-tokens.cjs"));

describe("DTCG source contract", () => {
  it("committed src/tokens.json passes the contract", () => {
    const { ok, errors } = validateTokens(source);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it("rejects malformed hex", () => {
    const bad = structuredClone(source);
    bad.color.primary["500"].$value = "not-a-hex";
    expect(validateTokens(bad).ok).toBe(false);
  });

  it("rejects non-ascending breakpoints", () => {
    const bad = structuredClone(source);
    bad.layout.breakpoints.md.$value = "100px"; // < sm (640)
    expect(validateTokens(bad).ok).toBe(false);
  });

  it("rejects shadcn primary drifting from color.primary.500", () => {
    const bad = structuredClone(source);
    bad.shadcn.primary.$value = "999 99% 99%";
    const { ok, errors } = validateTokens(bad);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("drift"))).toBe(true);
  });

  it("rejects unknown top-level groups (strict)", () => {
    const bad = structuredClone(source);
    bad.bogus = { x: { $value: "1" } };
    expect(validateTokens(bad).ok).toBe(false);
  });

  it("rejects a missing required shadcn role", () => {
    const bad = structuredClone(source);
    delete bad.shadcn.ring;
    const { ok, errors } = validateTokens(bad);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("missing role: ring"))).toBe(true);
  });
});

describe("color math (v3-oracle verified)", () => {
  it("contrast threshold matches the committed oracle", () => {
    expect(getContrastColor("#4F74B3")).toBe("#ffffff"); // primary.400
    expect(getContrastColor("#708EC1")).toBe("#000000"); // primary.300
    expect(getContrastColor("#FFFFFF")).toBe("#000000");
    expect(getContrastColor("#000000")).toBe("#ffffff");
  });

  it("hexToHSL(primary.500) = 218 58% 14%", () => {
    expect(hexToHSL("#0F1E38")).toBe("218 58% 14%");
  });

  it("shadcn primary & ring are derived from primary.500", () => {
    const hsl = hexToHSL(source.color.primary["500"].$value);
    expect(source.shadcn.primary.$value).toBe(hsl);
    expect(source.shadcn.ring.$value).toBe(hsl);
  });
});

describe("flat projection (tailwind.config.cjs consumer)", () => {
  it("exposes the legacy shape the config reads", () => {
    expect(projection.colors.primary["500"]).toBe("#0F1E38");
    expect(projection.colors.secondary["500"]).toBe("#0F4C81");
    expect(projection.colors.accent.khmerCurry).toBe("#ED5555");
    expect(projection.colors.semantic.action).toBe("#F97316");
    expect(projection.spacing.md).toBe("16px");
    expect(projection.spacingFluid["section-md"]).toBe("clamp(3rem, 6vw, 4rem)");
    expect(projection.shadows.sm).toBe("0 1px 2px 0 rgba(0, 0, 0, 0.05)");
    expect(projection.borderRadius.lg).toBe("0.5rem");
    expect(projection.typography.fontSize.base).toBe("1rem");
  });

  it("fontFamily values are comma-joined strings (\".split(', ')\" safe)", () => {
    for (const k of ["data", "serif", "mono"]) {
      expect(typeof projection.typography.fontFamily[k]).toBe("string");
      expect(projection.typography.fontFamily[k].split(", ").length).toBeGreaterThan(1);
    }
  });

  it("does NOT leak shadcn role groups into the Tailwind projection", () => {
    expect(projection.shadcn).toBeUndefined();
    expect(projection.shadcnDark).toBeUndefined();
  });
});
