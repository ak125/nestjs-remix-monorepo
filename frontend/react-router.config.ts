import { type Config } from "@react-router/dev/config";

/**
 * Config React Router v7 framework mode (PR-9h Phase C).
 * Le plugin Vite `reactRouter()` n'accepte plus d'options : tout passe ici.
 *
 * App SSR servie par NestJS (Phase D : handler `virtual:react-router/server-build`).
 * Les anciens flags Remix v2 `future.v3_*` (fetcherPersist, lazyRouteDiscovery,
 * throwAbortReason, relativeSplatPath, singleFetch) sont le COMPORTEMENT PAR DÉFAUT
 * en RR7 — aucun flag à reporter.
 */
export default {
  ssr: true,
  serverModuleFormat: "esm",
} satisfies Config;
