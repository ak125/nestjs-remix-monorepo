import { remixRoutesOptionAdapter } from "@react-router/remix-routes-option-adapter";
import { flatRoutes } from "remix-flat-routes";
import { type RouteConfig } from "@react-router/dev/routes";

/**
 * Configuration des routes (React Router v7 framework mode, PR-9h Phase C).
 *
 * Routing SAFE-FIRST : `@react-router/remix-routes-option-adapter` enveloppe
 * `remix-flat-routes` (l'option `routes` de Remix v2 migrée 1:1). Parité URL prouvée
 * 139/139 vs Remix v2 ; `@react-router/fs-routes` casse 7 URLs (/aide /catalogue /home
 * /login /marques /register + index mangle) → NO-GO. Les `ignoredRouteFiles` sont
 * préservés à l'identique de l'ancien `vite.config.ts` (exclusion admin/ui-kit/design-system
 * en production uniquement).
 */
const isProduction = process.env.NODE_ENV === "production";

export default remixRoutesOptionAdapter((defineRoutes) =>
  flatRoutes("routes", defineRoutes, {
    ignoredRouteFiles: [
      ".*",
      "**/*.css",
      "**/*.test.{js,jsx,ts,tsx}",
      "**/__*.*",
      // Exclure admin, ui-kit et design-system en production
      ...(isProduction
        ? ["**/admin.!(video-hub)*", "**/ui-kit.*", "**/ui-kit/**", "**/design-system.*"]
        : []),
    ],
  }),
) satisfies RouteConfig;
