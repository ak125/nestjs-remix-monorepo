// @vitest-environment node
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Load the real filesystem route config in Node, including ignoredRouteFiles.
// A static test-only path declaration would miss both catch-all and nesting bugs.
function matches(mode: string) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { pathToFileURL } from 'node:url';
         import { matchRoutes } from 'react-router';
         const routes = await (await import(pathToFileURL('./app/routes.ts').href)).default;
         console.log(JSON.stringify(['/admin/marketing/briefs',
           '/admin/marketing/briefs/b2db752b-dc8c-45ec-8851-394307c5806a'
         ].map(path => matchRoutes(routes, path)?.map(m => m.route.file))));`,
      ],
      {
        cwd: resolve(import.meta.dirname, "../.."),
        env: { ...process.env, NODE_ENV: mode },
        encoding: "utf8",
      },
    ),
  ) as string[][];
}

describe("native marketing brief routing", () => {
  it("serves detail under marketing, not inside the list without an Outlet", () => {
    const [list, detail] = matches("development");
    expect(list.at(-1)).toBe("routes/admin.marketing.briefs.tsx");
    expect(detail).toEqual([
      "routes/admin.tsx",
      "routes/admin.marketing.tsx",
      "routes/admin.marketing.briefs_.$id.tsx",
    ]);
  });

  it("preserves the existing production admin exclusion", () => {
    expect(matches("production")).toEqual([["routes/$.tsx"], ["routes/$.tsx"]]);
  });
});
