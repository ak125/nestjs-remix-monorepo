// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouteConfigEntry } from "@react-router/dev/routes";

function flatten(
  routes: RouteConfigEntry[],
  parentPath = "",
): (RouteConfigEntry & { resolvedPath: string })[] {
  return routes.flatMap((route) => {
    const resolvedPath = [parentPath, route.path].filter(Boolean).join("/");
    return [
      { ...route, resolvedPath },
      ...flatten(route.children ?? [], resolvedPath),
    ];
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Command Center build routing", () => {
  it.each(["production", "development"])(
    "registers the authenticated cockpit at its URL in %s",
    async (environment) => {
      vi.stubEnv("NODE_ENV", environment);
      const { default: config } = await import("../../app/routes");
      const routes = flatten(await config);
      expect(
        routes.find((route) => route.id === "routes/admin.command-center"),
      ).toMatchObject({
        resolvedPath: "admin/command-center",
        file: "routes/admin.command-center.tsx",
      });
    },
  );

  it("keeps the existing production exclusions and Video Hub route", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { default: config } = await import("../../app/routes");
    const routes = flatten(await config);
    expect(routes.some((route) => route.id === "routes/admin.video-hub")).toBe(
      true,
    );
    expect(
      routes.filter(
        (route) =>
          route.id?.startsWith("routes/admin.") &&
          !route.id.startsWith("routes/admin.video-hub") &&
          route.id !== "routes/admin.command-center",
      ),
    ).toEqual([]);
    expect(
      routes.filter(
        (route) =>
          route.id?.startsWith("routes/ui-kit") ||
          route.id?.startsWith("routes/design-system"),
      ),
    ).toEqual([]);
  });
});
