// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { productionCssSources } from "../../vite.production-css";

const dirs: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "production-css-"));
  dirs.push(dir);
  const files = [
    "admin.old.tsx",
    "admin.command-center.tsx",
    "admin.video-hub.tsx",
    "admin.video-hub.$id.tsx",
    "pieces.$id.tsx",
    "ui-kit.buttons.tsx",
    "ui-kit/button.tsx",
    "design-system.colors.tsx",
    "admin.tsx",
  ];
  for (const file of files) {
    const path = join(dir, "routes", file);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, "export default null;");
  }
  mkdirSync(join(dir, "components", "expert"), { recursive: true });
  writeFileSync(
    join(dir, "components", "expert", "Unused.tsx"),
    "export default null;",
  );
  const plugin = productionCssSources(dir);
  const invoke = (
    name: "buildStart" | "transform" | "generateBundle",
    args: unknown[],
  ) => {
    const hook = plugin[name];
    if (typeof hook !== "function") throw new Error(`Missing hook ${name}`);
    return Reflect.apply(
      hook,
      {
        error: (message: string) => {
          throw new Error(message);
        },
      },
      args,
    );
  };
  invoke("buildStart", []);
  return { dir, plugin, invoke };
}

describe("production CSS route sources", () => {
  it("leaves DEV and non-production builds untouched", () => {
    const { plugin } = fixture();
    if (typeof plugin.apply !== "function")
      throw new Error("Missing apply predicate");
    vi.stubEnv("NODE_ENV", "development");
    expect(plugin.apply({}, { command: "build", mode: "development" })).toBe(
      false,
    );
    vi.stubEnv("NODE_ENV", "production");
    expect(plugin.apply({}, { command: "serve", mode: "production" })).toBe(
      false,
    );
    expect(plugin.apply({}, { command: "build", mode: "production" })).toBe(
      true,
    );
  });

  it("excludes omitted sources, preserving the two production admin exceptions", () => {
    const { dir, invoke } = fixture();
    const result = invoke("transform", [
      '@import "tailwindcss";',
      join(dir, "global.css") + "?transform-only",
    ]);
    expect(result.code).toContain('@source not "./routes/admin.old.tsx";');
    expect(result.code).toContain('@source not "./routes/ui-kit.buttons.tsx";');
    expect(result.code).toContain('@source not "./routes/ui-kit/button.tsx";');
    expect(result.code).toContain(
      '@source not "./routes/design-system.colors.tsx";',
    );
    expect(result.code).toContain('@source not "./routes/admin.tsx";');
    expect(result.code).toContain(
      '@source not "./components/expert/Unused.tsx";',
    );
    expect(result.code).not.toMatch(/command-center|video-hub|pieces/);
    expect(result.code).toContain('@import "tailwindcss";');
    expect(
      invoke("transform", ["body {}", join(dir, "styles", "other.css")]),
    ).toBeUndefined();
    expect(
      invoke("transform", [
        'export default "/assets/global.css"',
        join(dir, "global.css") + "?url",
      ]),
    ).toBeUndefined();
  });

  it("rejects an excluded route imported into an emitted chunk", () => {
    const { dir, invoke } = fixture();
    expect(() =>
      invoke("generateBundle", [
        {},
        {
          "public.js": {
            type: "chunk",
            modules: { [join(dir, "routes", "admin.old.tsx") + "?v=1"]: {} },
          },
        },
      ]),
    ).toThrow(/still bundled/);
  });

  it("rejects a newly imported component from an excluded family", () => {
    const { dir, invoke } = fixture();
    expect(() =>
      invoke("generateBundle", [
        {},
        {
          "lazy.js": {
            type: "chunk",
            modules: {
              [join(dir, "components", "expert", "Unused.tsx")]: {},
            },
          },
        },
      ]),
    ).toThrow(/still bundled/);
  });

  it("accepts public, retained admin and shared component modules", () => {
    const { dir, invoke } = fixture();
    expect(() =>
      invoke("generateBundle", [
        {},
        {
          "public.js": {
            type: "chunk",
            modules: {
              [join(dir, "routes", "pieces.$id.tsx")]: {},
              [join(dir, "routes", "admin.command-center.tsx")]: {},
              [join(dir, "components", "admin", "OrderLineActions.tsx")]: {},
            },
          },
          "global.css": { type: "asset" },
        },
      ]),
    ).not.toThrow();
  });
});
