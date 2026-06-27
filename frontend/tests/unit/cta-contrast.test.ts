/**
 * DT-1 — CTA foreground accessibility guard (frontend consumer side).
 *
 * The `cta` color block is HARDCODED in `frontend/tailwind.config.cjs` (it is NOT
 * token-driven — the design-tokens projection only feeds `colors.semantic.*`). The
 * filled-CTA buttons render `bg-cta` / `bg-cta-hover` / `bg-cta-light`; DT-1 flips
 * their glyph from `text-white` (≈2.8:1, WCAG fail) to `text-black`.
 *
 * This test reads the SHADES STRAIGHT FROM the config (no duplicated literals) and
 * asserts the recolor is sound: black passes AA on every filled shade, white did not,
 * and — the negative guard — black would FAIL on the darker `cta.dark` shade, so the
 * recolor must never be applied blindly to that shade.
 *
 * The package-side WCAG math lives in `packages/design-tokens/tests/tokens.test.mjs`
 * (the `action`/`actionContrast` semantic pair). This file covers the hardcoded
 * Tailwind `cta` block the token pipeline does not own.
 */
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

// Load the real Tailwind config via Node's native require (a .cjs file that itself
// requires the @fafa/design-tokens projection — bypass Vite's transform).
const require = createRequire(import.meta.url);
const tailwindConfig = require("../../tailwind.config.cjs") as {
  theme: { extend: { colors: { cta: Record<string, string> } } };
};
const cta = tailwindConfig.theme.extend.colors.cta;

const BLACK = "#000000";
const WHITE = "#FFFFFF";
const AA_NORMAL = 4.5;

/** sRGB channel → linear (WCAG 2.x relative-luminance step). */
function channelLuminance(srgb: number): number {
  const c = srgb / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance of a #rrggbb hex. */
function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`expected #rrggbb, got ${hex}`);
  const n = parseInt(m[1], 16);
  const r = channelLuminance((n >> 16) & 0xff);
  const g = channelLuminance((n >> 8) & 0xff);
  const b = channelLuminance(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two #rrggbb hexes (1..21). */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe("DT-1 — CTA filled-shade foreground contrast (config-sourced)", () => {
  // The shades actually used as a button FILL background (bg-cta / -hover / -light).
  const FILLED_SHADES = [
    ["cta.DEFAULT", cta.DEFAULT],
    ["cta.hover", cta.hover],
    ["cta.light", cta.light],
  ] as const;

  it.each(FILLED_SHADES)(
    "black text on %s passes WCAG AA (≥4.5)",
    (_name, shade) => {
      expect(contrastRatio(shade, BLACK)).toBeGreaterThanOrEqual(AA_NORMAL);
    },
  );

  it("white text on cta.DEFAULT would FAIL AA — the defect DT-1 fixes", () => {
    expect(contrastRatio(cta.DEFAULT, WHITE)).toBeLessThan(AA_NORMAL);
  });

  it.each(FILLED_SHADES)(
    "black beats white on %s (recolor strictly improves contrast)",
    (_name, shade) => {
      expect(contrastRatio(shade, BLACK)).toBeGreaterThan(
        contrastRatio(shade, WHITE),
      );
    },
  );

  it("NEGATIVE GUARD: black on the darker cta.dark shade FAILS AA (<4.5)", () => {
    // cta.dark (#C2410C) is too dark for a black glyph (~4.06:1). DT-1 must never
    // recolor a bg-cta-dark surface to text-black; that shade keeps a light glyph.
    expect(contrastRatio(cta.dark, BLACK)).toBeLessThan(AA_NORMAL);
    expect(contrastRatio(cta.dark, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("config exposes the shades this guard depends on", () => {
    for (const key of ["DEFAULT", "hover", "light", "dark"]) {
      expect(cta[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
