import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

import {
  extractSummaryPoints,
  type GammeConseil,
} from "~/components/blog/conseil/section-config";

/**
 * Regression guard for the Sentry PROD crash on WebKit before Safari 16.4
 * (iOS < 16.4): `SyntaxError: Invalid regular expression: invalid group
 * specifier name`.
 *
 * Root cause: `firstSentence()` split on `/(?<=[.!?])\s+/`. Regex **lookbehind**
 * `(?<=…)` / `(?<!…)` is unsupported in JavaScriptCore until Safari 16.4, so the
 * literal throws when evaluated. `firstSentence` is reached via
 * `extractSummaryPoints` during render of the blog "conseils" route (bundled in
 * the `TableOfContents-*.js` chunk), crashing the component on affected iOS.
 *
 * Node/V8 supports lookbehind, so this Node test cannot reproduce the *throw* —
 * it locks in (1) the lookbehind-free source and (2) behaviour preservation of
 * the sentence extraction, which is what the rewrite must not regress. Sibling
 * precedent: `array-at-polyfill.test.ts` (same Sentry / old-WebKit class).
 */

const conseil = (sectionType: string, content: string): GammeConseil => ({
  title: `Section ${sectionType}`,
  content,
  sectionType,
  order: 1,
  qualityScore: null,
  sources: [],
});

describe("section-config — iOS <16.4 lookbehind regex compat", () => {
  it("source uses no regex lookbehind (would crash WebKit < 16.4)", () => {
    // vitest runs with cwd = frontend/ (see vitest.config.ts include glob).
    const src = readFileSync(
      resolve(process.cwd(), "app/components/blog/conseil/section-config.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/\(\?<[=!]/);
  });

  it("extracts the first sentence of each section", () => {
    const points = extractSummaryPoints([
      conseil(
        "S1",
        "<p>Le support moteur amortit les vibrations du bloc. Il relie le moteur au châssis.</p>",
      ),
      conseil(
        "S2",
        "<p>Un support usé provoque des à-coups au démarrage. Changez-le vite.</p>",
      ),
      conseil(
        "S3",
        "<p>Le remplacement nécessite un cric et des chandelles. Comptez trente minutes.</p>",
      ),
    ]);

    expect(points).toHaveLength(3);
    expect(points[0].text).toBe(
      "Le support moteur amortit les vibrations du bloc.",
    );
    expect(points[1].text).toBe(
      "Un support usé provoque des à-coups au démarrage.",
    );
    expect(points[2].text).toBe(
      "Le remplacement nécessite un cric et des chandelles.",
    );
  });

  it("skips a short leading sentence and returns the next long one", () => {
    // Proves the split still happens (not returning the whole text): the first
    // sentence is < 30 chars, so the second (≥ 30) must be selected.
    const points = extractSummaryPoints([
      conseil(
        "S1",
        "<p>Bref. Le support en caoutchouc se dégrade avec la chaleur du moteur.</p>",
      ),
      conseil(
        "S2",
        "<p>Voilà ! Un support hydraulique fuit son huile en vieillissant sûrement.</p>",
      ),
      conseil(
        "S3",
        "<p>Attention. Serrez les vis au couple préconisé par le constructeur ici.</p>",
      ),
    ]);

    expect(points).toHaveLength(3);
    expect(points[0].text).toBe(
      "Le support en caoutchouc se dégrade avec la chaleur du moteur.",
    );
    expect(points[1].text).toBe(
      "Un support hydraulique fuit son huile en vieillissant sûrement.",
    );
  });
});
