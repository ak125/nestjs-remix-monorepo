import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { type RouteConfig } from "@react-router/dev/routes";
import { remixRoutesOptionAdapter } from "@react-router/remix-routes-option-adapter";
import { flatRoutes } from "remix-flat-routes";

/**
 * Configuration des routes (React Router v7 framework mode, PR-9h Phase C).
 *
 * Routing SAFE-FIRST : `@react-router/remix-routes-option-adapter` enveloppe
 * `remix-flat-routes` (l'option `routes` de Remix v2 migrée 1:1). Parité URL prouvée
 * 147/147 vs Remix v2 ; `@react-router/fs-routes` casse 7 URLs (/aide /catalogue /home
 * /login /marques /register + index mangle) → NO-GO. Les `ignoredRouteFiles` sont
 * préservent les exclusions admin/ui-kit/design-system en production, avec les
 * exceptions Video Hub et Command Center (toutes deux protégées côté serveur).
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
      // Garder uniquement Video Hub et le cockpit Command Center parmi admin.*.
      // Le mode runtime du Command Center et requireAdmin restent appliqués.
      ...(isProduction
        ? [
            "**/admin.!(video-hub*|command-center.tsx)",
            "**/ui-kit.*",
            "**/ui-kit/**",
            "**/design-system.*",
          ]
        : []),
    ],
  }),
) satisfies RouteConfig;
