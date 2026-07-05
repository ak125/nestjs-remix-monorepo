import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, it, expect } from "vitest";

/**
 * Repo-wide mechanical guard against the WebKit < Safari 16.4 (iOS < 16.4)
 * regex-lookbehind crash — Sentry PROD "Invalid regular expression: invalid
 * group specifier name".
 *
 * Regex LOOKBEHIND `(?<=…)` / `(?<!…)` is unsupported by JavaScriptCore before
 * Safari 16.4 and cannot be transpiled by esbuild (regex syntax is emitted
 * as-is), so it MUST NOT appear in any browser-shipped source. This test scans
 * every `app/**` `.ts`/`.tsx` file and fails if a lookbehind is (re)introduced.
 *
 * Lookahead `(?=…)` / `(?!…)` is fine (supported since ES3) and is intentionally
 * NOT flagged. A 2026-07-05 sweep confirmed no `v` (unicodeSets) or `d`
 * (hasIndices) flag regexes exist in the frontend either; if that changes,
 * extend this guard.
 */

const APP_DIR = resolve(process.cwd(), "app"); // vitest cwd = frontend/
const LOOKBEHIND = /\(\?<[=!]/;

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("no iOS<16.4-incompatible regex in frontend app/", () => {
  it("contains no regex lookbehind anywhere in app/", () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(APP_DIR)) {
      const src = readFileSync(file, "utf8");
      if (LOOKBEHIND.test(src)) {
        const line = src.slice(0, src.search(LOOKBEHIND)).split("\n").length;
        offenders.push(`${file.replace(process.cwd() + "/", "")}:${line}`);
      }
    }
    expect(
      offenders,
      `Regex lookbehind (crashes iOS < 16.4) found in:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
