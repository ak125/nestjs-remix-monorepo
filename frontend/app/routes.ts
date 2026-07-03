import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { remixRoutesOptionAdapter } from "@react-router/remix-routes-option-adapter";
import { flatRoutes } from "remix-flat-routes";
import { type RouteConfig } from "@react-router/dev/routes";

/**
 * Configuration des routes (React Router v7 framework mode, PR-9h Phase C).
 *
 * Routing SAFE-FIRST : `@react-router/remix-routes-option-adapter` enveloppe
 * `remix-flat-routes` (l'option `routes` de Remix v2 migrée 1:1). Parité URL prouvée
 * 147/147 vs Remix v2 ; `@react-router/fs-routes` casse 7 URLs (/aide /catalogue /home
 * /login /marques /register + index mangle) → NO-GO. Les `ignoredRouteFiles` sont
 * préservés à l'identique de l'ancien `vite.config.ts` (exclusion admin/ui-kit/design-system
 * en production uniquement).
 */
const isProduction = process.env.NODE_ENV === "production";

// `flatRoutes` résout son `appDir` (défaut "app") relativement à `process.cwd()`.
// Le build tourne depuis `frontend/` (cwd OK) mais le serveur dev NestJS démarre
// depuis la RACINE du monorepo → scandir 'app/routes' échoue (ENOENT, crash boot).
// Ancrer `appDir` sur l'emplacement de CE fichier (= `frontend/app`) rend la
// résolution déterministe quel que soit le cwd (build, dev, comparateur de parité).
const appDir = dirname(fileURLToPath(import.meta.url));

export default remixRoutesOptionAdapter((defineRoutes) =>
  flatRoutes("routes", defineRoutes, {
    appDir,
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
