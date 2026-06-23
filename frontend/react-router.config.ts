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
 * Préparation RR8 (Temps A — adoption incrémentale des `future.v8_*` sous RR7.18,
 * un flag par PR pour isoler les régressions ; ces flags deviennent le comportement
 * par défaut en RR8 et seront retirés au bump) :
 * - A1 `v8_viteEnvironmentApi` : active la Vite Environment API (requiert Vite 7 ✅).
 * - A2 `v8_passThroughRequests` : passe la requête HTTP brute aux loaders/actions
 *   (la `Request.url`/host est désormais reconstruite côté serveur — à valider
 *   derrière Caddy : X-Forwarded-Host → contrôle d'origine CSRF des actions).
 * - A3 `v8_trailingSlashAwareDataRequests` : préserve le trailing-slash dans les
 *   URLs de requête `.data` (fetch single-fetch interne). N'affecte PAS les URLs
 *   de page canoniques → gate `url-immutability` (147/147) préservé.
 */
export default {
  ssr: true,
  serverModuleFormat: "esm",
  future: {
    v8_viteEnvironmentApi: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config;
