import { type Config } from "@react-router/dev/config";

/**
 * Config React Router v7 framework mode (PR-9h Phase C).
 * Le plugin Vite `reactRouter()` n'accepte plus d'options : tout passe ici.
 *
 * App SSR servie par NestJS (Phase D : handler `virtual:react-router/server-build`).
 * Les anciens flags Remix v2 `future.v3_*` (fetcherPersist, lazyRouteDiscovery,
 * throwAbortReason, relativeSplatPath, singleFetch) sont le COMPORTEMENT PAR DÉFAUT
 * en RR7 — aucun flag à reporter.
 *
 * Migration RR8 (Temps B — flip de version après prépa Temps A complète).
 * Les cinq comportements `future.v8_*` adoptés un par un sous RR7.18
 * (viteEnvironmentApi, passThroughRequests, trailingSlashAwareDataRequests,
 * splitRouteModules, middleware) sont le **comportement par défaut en RR8** :
 *  - les quatre flags de comportement sont retirés (défaut, plus de clé `future`) ;
 *  - `splitRouteModules` devient une option racine.
 * Le pont CJS→ESM du middleware (NestJS → SSR via la fabrique
 * `createAppLoadContext` réexposée sur `build.entry.module`, façade `@fafa/frontend`,
 * clés `createContext` jamais importées côté NestJS — sécurité dual-realm #1106)
 * reste inchangé : middleware est désormais toujours actif.
 */
export default {
  ssr: true,
  serverModuleFormat: "esm",
  splitRouteModules: true,
} satisfies Config;
