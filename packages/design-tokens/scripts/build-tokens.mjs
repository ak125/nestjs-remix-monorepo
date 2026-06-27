/**
 * Design-tokens build — Style Dictionary 5 + DTCG source (`src/tokens.json`).
 *
 * Replaces the bespoke `build-tokens.js` (≈758 l, cause of 6 P0). Emits, from a
 * single validated DTCG source:
 *   • src/styles/tokens.css     — CSS custom properties (+ WCAG -contrast, shadcn, .dark)
 *   • src/tailwind-tokens.cjs   — flat legacy projection consumed by tailwind.config.cjs
 *   • src/tokens/generated.ts   — `designTokens` object + types (package main export)
 *
 * Determinism: NO value transforms (preserves verbatim hex casing / clamp() / rgba()).
 * Names are computed from token paths, not SD's name transform. This build is
 * VERIFIED to reproduce the pre-migration `tokens.css` to the byte (only the
 * header's Source: line changes — the source file moved to src/tokens.json).
 *
 * Usage:
 *   node scripts/build-tokens.mjs            # write the 3 artifacts
 *   node scripts/build-tokens.mjs --check    # build to a temp dir, byte-diff vs committed, exit 1 on drift
 */
import StyleDictionary from "style-dictionary";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getContrastColor } from "./color-utils.mjs";
import { validateTokens } from "./tokens-schema.mjs";

const PKG = dirname(dirname(fileURLToPath(import.meta.url)));
const CHECK = process.argv.includes("--check");

// ── token-tree helpers (operate on SD's resolved `dictionary.tokens`) ────────
const isLeaf = (n) => n && typeof n === "object" && "$value" in n;
/** Flat list of {path, val} leaves under a group, preserving JS key order. */
function leaves(node, base = []) {
  const out = [];
  for (const [k, v] of Object.entries(node)) {
    if (isLeaf(v)) out.push({ path: [...base, k], val: v.$value });
    else if (v && typeof v === "object") out.push(...leaves(v, [...base, k]));
  }
  return out;
}
/** Strip DTCG wrappers ($value/$type/meta) back to a bare nested value tree. */
function unwrap(node) {
  if (isLeaf(node)) return node.$value;
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = unwrap(v);
  return out;
}

/** Flat legacy projection (deep-equals the pre-migration design-tokens.json). */
function toProjection(t) {
  return {
    colors: unwrap(t.color),
    spacing: unwrap(t.spacing),
    spacingFluid: unwrap(t.spacingFluid),
    layout: unwrap(t.layout),
    typography: unwrap(t.typography),
    shadows: unwrap(t.shadows),
    borderRadius: unwrap(t.borderRadius),
    transitions: unwrap(t.transitions),
    zIndex: unwrap(t.zIndex),
    animations: unwrap(t.animations),
    states: unwrap(t.states),
    dark: unwrap(t.dark),
  };
}

// ── format 1 : tokens.css (verified byte-identical to the v3 generator) ──────
function renderTokensCss(t) {
  const L = [];
  L.push("/**", " * 🎨 Design Tokens - Auto-généré", " * ⚠️  NE PAS MODIFIER MANUELLEMENT", " * Source: src/tokens.json", " */", "", ":root {", "");
  L.push("  /* Colors */");
  for (const { path, val } of leaves(t.color)) {
    const name = "am-color-" + path.join("-");
    L.push(`  --${name}: ${val};`);
    L.push(`  --${name}-contrast: ${getContrastColor(val)};`);
  }
  const flat = (node, prefix) => leaves(node).map(({ path, val }) => `  --${prefix}${path.join("-")}: ${val};`);
  L.push("", "  /* Spacing */", ...flat(t.spacing, "am-spacing-"));
  L.push("", "  /* Spacing Fluid (Responsive) */", ...flat(t.spacingFluid, "am-spacing-fluid-"));
  L.push("", "  /* Layout */", "", "  /* Container Max-Widths */", ...flat(t.layout.container, "am-container-"));
  L.push("", "  /* Grid System */", ...flat(t.layout.grid.columns, "grid-columns-"), ...flat(t.layout.grid.gutter, "grid-gutter-"));
  L.push("", "  /* Breakpoints */", ...flat(t.layout.breakpoints, "am-breakpoint-"));
  L.push("", "  /* Typography */",
    ...flat(t.typography.fontFamily, "am-font-"),
    ...flat(t.typography.fontSize, "am-font-size-"),
    ...flat(t.typography.fontSizeFluid, "am-font-size-fluid-"),
    ...flat(t.typography.lineHeight, "line-height-"),
    ...flat(t.typography.letterSpacing, "letter-spacing-"),
    ...flat(t.typography.maxWidth, "max-width-"));
  L.push("", "  /* Shadows */", ...flat(t.shadows, "am-shadow-"));
  L.push("", "  /* Border Radius */", ...flat(t.borderRadius, "am-radius-"));
  L.push("", "  /* Z-Index */", ...flat(t.zIndex, "z-"));
  L.push("", "  /* Transitions */", ...flat(t.transitions, "transition-"));
  L.push("}", "");

  const sc = (k) => t.shadcn[k].$value;
  L.push("/* ========================================", "   SHADCN/UI COMPATIBILITY", "   Auto-généré depuis design-tokens.json", "   primary.500 = #0F1E38 → HSL 218 58% 14%", "   ======================================== */", ":root {");
  L.push("  /* Layout */", `  --background: ${sc("background")};`, `  --foreground: ${sc("foreground")};`, "");
  L.push("  /* Card */", `  --card: ${sc("card")};`, `  --card-foreground: ${sc("card-foreground")};`, "");
  L.push("  /* Popover */", `  --popover: ${sc("popover")};`, `  --popover-foreground: ${sc("popover-foreground")};`, "");
  L.push("  /* Primary — auto-calculated from primary.500 */", `  --primary: ${sc("primary")};`, `  --primary-foreground: ${sc("primary-foreground")};`, "");
  L.push("  /* Secondary */", `  --secondary: ${sc("secondary")};`, `  --secondary-foreground: ${sc("secondary-foreground")};`, "");
  L.push("  /* Muted */", `  --muted: ${sc("muted")};`, `  --muted-foreground: ${sc("muted-foreground")};`, "");
  L.push("  /* Accent */", `  --accent: ${sc("accent")};`, `  --accent-foreground: ${sc("accent-foreground")};`, "");
  L.push("  /* Destructive */", `  --destructive: ${sc("destructive")};`, `  --destructive-foreground: ${sc("destructive-foreground")};`, "");
  L.push("  /* Border & Input */", `  --border: ${sc("border")};`, `  --input: ${sc("input")};`, `  --ring: ${sc("ring")};`, "");
  L.push("  /* Charts */", `  --chart-1: ${sc("chart-1")};`, `  --chart-2: ${sc("chart-2")};`, `  --chart-3: ${sc("chart-3")};`, `  --chart-4: ${sc("chart-4")};`, `  --chart-5: ${sc("chart-5")};`, "");
  L.push("  /* Radius */", `  --radius: ${sc("radius")};`, "}", "");

  const dk = (k) => t.shadcnDark[k].$value;
  L.push("/* ========================================", "   DARK MODE", "   ======================================== */", ".dark {");
  L.push(`  --background: ${dk("background")};`, `  --foreground: ${dk("foreground")};`, "");
  L.push(`  --card: ${dk("card")};`, `  --card-foreground: ${dk("card-foreground")};`, "");
  L.push(`  --popover: ${dk("popover")};`, `  --popover-foreground: ${dk("popover-foreground")};`, "");
  L.push("  /* Primary — light variant for dark backgrounds */", `  --primary: ${dk("primary")};`, `  --primary-foreground: ${dk("primary-foreground")};`, "");
  L.push(`  --secondary: ${dk("secondary")};`, `  --secondary-foreground: ${dk("secondary-foreground")};`, "");
  L.push(`  --muted: ${dk("muted")};`, `  --muted-foreground: ${dk("muted-foreground")};`, "");
  L.push(`  --accent: ${dk("accent")};`, `  --accent-foreground: ${dk("accent-foreground")};`, "");
  L.push(`  --destructive: ${dk("destructive")};`, `  --destructive-foreground: ${dk("destructive-foreground")};`, "");
  L.push(`  --border: ${dk("border")};`, `  --input: ${dk("input")};`, `  --ring: ${dk("ring")};`, "");
  L.push(`  --chart-1: ${dk("chart-1")};`, `  --chart-2: ${dk("chart-2")};`, `  --chart-3: ${dk("chart-3")};`, `  --chart-4: ${dk("chart-4")};`, `  --chart-5: ${dk("chart-5")};`, "}");
  return L.join("\n") + "\n";
}

// ── format 2 : flat legacy projection for @config (tailwind.config.cjs) ───────
function renderProjectionCjs(t) {
  const header =
    "// 🎨 AUTO-GENERATED by scripts/build-tokens.mjs — DO NOT EDIT\n" +
    "// Source of truth: src/tokens.json (DTCG). Flat legacy projection consumed by\n" +
    "// frontend/tailwind.config.cjs (the @config bridge). Regenerate via `npm run build`.\n";
  return header + "module.exports = " + JSON.stringify(toProjection(t), null, 2) + ";\n";
}

// ── format 3 : generated.ts (package main export `designTokens`) ──────────────
function renderGeneratedTs(t) {
  const header =
    "/**\n * 🎨 Design Tokens - Auto-généré\n * ⚠️  NE PAS MODIFIER MANUELLEMENT\n * Source: src/tokens.json\n */\n\n";
  return (
    header +
    "export const designTokens = " + JSON.stringify(toProjection(t), null, 2) + " as const;\n\n" +
    "export type DesignTokens = typeof designTokens;\n\n" +
    "// Type helpers\n" +
    "export type ColorToken = keyof typeof designTokens.colors;\n" +
    "export type SpacingToken = keyof typeof designTokens.spacing;\n" +
    "export type TypographyToken = keyof typeof designTokens.typography;\n"
  );
}

const OUTPUTS = [
  { dest: "src/styles/tokens.css", format: "am/tokens-css", render: renderTokensCss },
  { dest: "src/tailwind-tokens.cjs", format: "am/tailwind-tokens-cjs", render: renderProjectionCjs },
  { dest: "src/tokens/generated.ts", format: "am/generated-ts", render: renderGeneratedTs },
];

for (const { format, render } of OUTPUTS) {
  StyleDictionary.registerFormat({ name: format, format: ({ dictionary }) => render(dictionary.tokens) });
}

/** Validate the source, then run SD (no transforms) writing OUTPUTS under buildPath. */
async function build(buildPath) {
  const source = JSON.parse(readFileSync(join(PKG, "src/tokens.json"), "utf8"));
  const { ok, errors } = validateTokens(source);
  if (!ok) {
    console.error("❌ Token contract failed:\n  - " + errors.join("\n  - "));
    process.exit(1);
  }
  const sd = new StyleDictionary({
    tokens: source,
    usesDtcg: true,
    log: { verbosity: "silent" },
    platforms: {
      out: { transforms: [], buildPath, files: OUTPUTS.map(({ dest, format }) => ({ destination: dest, format })) },
    },
  });
  await sd.buildAllPlatforms();
}

async function main() {
  if (CHECK) {
    const tmp = join(PKG, "node_modules/.tmp-dt-build-check");
    rmSync(tmp, { recursive: true, force: true });
    await build(tmp + "/");
    let drift = 0;
    for (const { dest } of OUTPUTS) {
      const built = readFileSync(join(tmp, dest), "utf8");
      const committed = existsSync(join(PKG, dest)) ? readFileSync(join(PKG, dest), "utf8") : "";
      if (built !== committed) { drift++; console.error(`❌ drift: ${dest} (committed ≠ rebuilt from src/tokens.json)`); }
      else console.log(`✓ ${dest}`);
    }
    rmSync(tmp, { recursive: true, force: true });
    if (drift) { console.error(`\n${drift} artifact(s) out of date — run \`npm run build\` and commit.`); process.exit(1); }
    console.log("✅ all artifacts match the DTCG source (--check)");
    return;
  }
  await build(PKG + "/");
  console.log("🎉 Design tokens built (Style Dictionary + DTCG).");
}

main().catch((e) => { console.error(e); process.exit(1); });
