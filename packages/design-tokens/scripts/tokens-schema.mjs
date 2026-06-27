/**
 * Zod 4 contract for the DTCG token source (`src/tokens.json`).
 *
 * Runs at build time (`build-tokens.mjs`) and in tests. A failing contract
 * FAILS the build (no warn-and-continue — the original generator's silent
 * tolerance was a P0). Covers: structure, hex format, breakpoint ordering,
 * required shadcn roles, and the primary.500 -> shadcn HSL drift guard.
 */
import { z } from "zod";
import { hexToHSL } from "./color-utils.mjs";

const HEX = /^#[0-9a-fA-F]{6}$/;
// shadcn values are HSL-channel strings ("0 0% 100%") or a CSS var() ("var(--radius-lg)").
const HSL_CHANNEL = /^-?\d+(\.\d+)? -?\d+(\.\d+)?% -?\d+(\.\d+)?%$/;
const isHslOrVar = (v) => HSL_CHANNEL.test(v) || /^var\(.+\)$/.test(v);

const rec = (value) => z.record(z.string(), value);

const colorLeaf = z.object({ $value: z.string().regex(HEX, "must be 6-digit #rrggbb hex"), $type: z.literal("color") });
const hexLeaf = z.object({ $value: z.string().regex(HEX, "must be 6-digit #rrggbb hex"), $type: z.string().optional() });
const strLeaf = z.object({ $value: z.string().min(1), $type: z.string().optional() });
const shadcnLeaf = z.object({
  $value: z.string().refine(isHslOrVar, "must be an HSL-channel string or var()"),
  $type: z.string().optional(),
});

export const TokensSchema = z
  .object({
    color: rec(rec(colorLeaf)),
    spacing: rec(strLeaf),
    spacingFluid: rec(strLeaf),
    layout: z.object({
      container: rec(strLeaf),
      grid: z.object({ columns: rec(strLeaf), gutter: rec(strLeaf) }),
      breakpoints: rec(strLeaf),
    }),
    typography: z.object({
      fontFamily: rec(strLeaf),
      fontSize: rec(strLeaf),
      fontSizeFluid: rec(strLeaf),
      lineHeight: rec(strLeaf),
      letterSpacing: rec(strLeaf),
      fontWeight: rec(strLeaf),
      maxWidth: rec(strLeaf),
    }),
    shadows: rec(strLeaf),
    borderRadius: rec(strLeaf),
    zIndex: rec(strLeaf),
    transitions: rec(strLeaf),
    animations: z.object({ duration: rec(strLeaf), easing: rec(strLeaf), scale: rec(strLeaf) }),
    states: z.object({ opacity: rec(strLeaf), cursor: rec(strLeaf) }),
    dark: z.object({ semantic: rec(hexLeaf), background: rec(hexLeaf), text: rec(hexLeaf) }),
    shadcn: rec(shadcnLeaf),
    shadcnDark: rec(shadcnLeaf),
  })
  .strict();

const SHADCN_ROLES = [
  "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
  "primary", "primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground",
  "accent", "accent-foreground", "destructive", "destructive-foreground", "border", "input", "ring",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "radius",
];

/**
 * Validate the DTCG source. Returns { ok, errors[] }. Beyond the structural
 * schema, asserts invariants the schema cannot express.
 */
export function validateTokens(tokens) {
  const errors = [];

  const parsed = TokensSchema.safeParse(tokens);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`schema · ${issue.path.join(".")}: ${issue.message}`);
  }

  // Breakpoints must ascend (sm < md < lg < xl < 2xl) — px-comparable.
  const bp = tokens?.layout?.breakpoints ?? {};
  let prev = -Infinity;
  for (const k of ["sm", "md", "lg", "xl", "2xl"]) {
    const v = parseInt(bp[k]?.$value ?? "", 10);
    if (Number.isNaN(v)) errors.push(`breakpoints · missing/NaN: ${k}`);
    else { if (v <= prev) errors.push(`breakpoints · ${k} (${v}px) not strictly ascending`); prev = v; }
  }

  // Required shadcn roles present (light = all; dark = all but radius).
  for (const role of SHADCN_ROLES) if (!tokens?.shadcn?.[role]) errors.push(`shadcn · missing role: ${role}`);
  for (const role of SHADCN_ROLES.filter((r) => r !== "radius"))
    if (!tokens?.shadcnDark?.[role]) errors.push(`shadcnDark · missing role: ${role}`);

  // Drift guard: shadcn primary & ring are derived from color.primary.500.
  const p500 = tokens?.color?.primary?.["500"]?.$value;
  if (p500 && HEX.test(p500)) {
    const expected = hexToHSL(p500);
    for (const role of ["primary", "ring"]) {
      const got = tokens?.shadcn?.[role]?.$value;
      if (got !== expected)
        errors.push(`drift · shadcn.${role} = "${got}" but hexToHSL(primary.500) = "${expected}"`);
    }
  }

  return { ok: errors.length === 0, errors };
}
