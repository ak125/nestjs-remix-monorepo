// scripts/seo/__tests__/r-seo-09-phase2.test.mjs
//
// Tests for R-SEO-09 Phase 2 canonical surface diff.
//
// Fixture layout:
//   fixtures/r-seo-09/positive/<scenario>/base.tsx + head.tsx
//     → canonical surface must be UNCHANGED (extracted structs deep-equal)
//   fixtures/r-seo-09/negative/<scenario>/base.tsx + head.tsx
//     → canonical surface must DIFFER
//
// Rename scenarios encode the filename in the fixture folder name. The driver
// passes a filename derived from the scenario:
//   - positive/* → same filename for base + head ("<scenario>.tsx")
//   - negative/rename-* → different filenames (suffix `-base.tsx` / `-head.tsx`)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractCanonicalSurface } from "../lib/canonical-surface-extractor.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures", "r-seo-09");

function readPair(dir) {
  return {
    base: readFileSync(join(dir, "base.tsx"), "utf8"),
    head: readFileSync(join(dir, "head.tsx"), "utf8"),
  };
}

function listScenarios(category) {
  return readdirSync(join(FIXTURES, category), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function filenamesFor(scenario) {
  if (scenario.includes("rename")) {
    return { base: `${scenario}-base.tsx`, head: `${scenario}-head.tsx` };
  }
  return { base: `${scenario}.tsx`, head: `${scenario}.tsx` };
}

for (const scenario of listScenarios("positive")) {
  test(`positive/${scenario}: canonical surface unchanged`, () => {
    const { base, head } = readPair(join(FIXTURES, "positive", scenario));
    const fn = filenamesFor(scenario);
    const baseSurface = extractCanonicalSurface(base, fn.base);
    const headSurface = extractCanonicalSurface(head, fn.head);
    assert.deepEqual(headSurface, baseSurface);
  });
}

for (const scenario of listScenarios("negative")) {
  test(`negative/${scenario}: canonical surface changed`, () => {
    const { base, head } = readPair(join(FIXTURES, "negative", scenario));
    const fn = filenamesFor(scenario);
    const baseSurface = extractCanonicalSurface(base, fn.base);
    const headSurface = extractCanonicalSurface(head, fn.head);
    assert.notDeepEqual(headSurface, baseSurface);
  });
}
