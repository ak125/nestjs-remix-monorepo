import { globSync } from "node:fs";
import { resolve } from "node:path";

import { normalizePath, type Plugin } from "vite";

import { productionIgnoredRouteFiles } from "./route-files";

/** Keep Tailwind's sources aligned with pages omitted from production routing.
 * Shared components and other automatic sources stay scanned. If a served module
 * imports an omitted page, fail the build rather than silently drop its styles.
 */
export function productionCssSources(appDir: string): Plugin {
  const globalCss = normalizePath(resolve(appDir, "global.css"));
  let excluded = new Set<string>();
  let directives = "";

  return {
    name: "production-css-route-sources",
    enforce: "pre",
    apply: (_, { command }) =>
      command === "build" && process.env.NODE_ENV === "production",
    buildStart() {
      const routeDir = resolve(appDir, "routes");
      const files = globSync(productionIgnoredRouteFiles, { cwd: routeDir })
        .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
        .sort();
      excluded = new Set(
        files.map((file) => normalizePath(resolve(routeDir, file))),
      );
      directives = files
        .map(
          (file) =>
            `@source not ${JSON.stringify(`./routes/${normalizePath(file)}`)};`,
        )
        .join("\n");
    },
    transform(code, id) {
      // ?url is a JS facade; Vite compiles its CSS via ?transform-only.
      const [filename, query] = id.split("?");
      if (
        normalizePath(filename) !== globalCss ||
        new URLSearchParams(query).has("url")
      )
        return;
      return { code: `${code}\n${directives}`, map: null };
    },
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        for (const id of Object.keys(chunk.modules)) {
          if (excluded.has(normalizePath(id.split("?")[0]))) {
            this.error(
              `Production CSS excluded a routed-out file that is still bundled: ${id}. ` +
                "Move its shared UI into a scanned component before excluding it.",
            );
          }
        }
      }
    },
  };
}
