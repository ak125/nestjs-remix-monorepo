/**
 * SINGLE app-context token module (RR8 `v8_middleware`, A6).
 *
 * REALM INVARIANT: this module lives ONLY in the SSR/ESM server build realm.
 * `createContext()` returns IDENTITY-KEYED objects — they must be a single
 * instance per process. They reach NestJS (CJS) EXCLUSIVELY via the
 * `@fafa/frontend` façade FACTORY (`getCreateAppLoadContext` →
 * `build.entry.module.createAppLoadContext`), NEVER by NestJS importing this
 * file directly. A second key instance in the CJS realm would make `.set()` and
 * `.get()` operate on different identities → silent context loss (the dual-realm
 * class of PROD incident #1106 / getsentry#21696).
 *
 * Every key carries a NULLABLE / non-`undefined` default so `context.get(key)`
 * returns the default instead of throwing when a value was never set
 * (`RouterContextProvider.get` throws only when no `defaultValue` was provided).
 *
 * Ports are STRUCTURAL interfaces (no NestJS class is imported into frontend).
 */
import { createContext, RouterContextProvider } from "react-router";
import { type ServerObservability } from "~/utils/observability-contract";

/* ── Structural ports (no NestJS class import) ───────────────────────────── */

/** Raw user as deposited by Passport/NestJS session (shape validated downstream). */
export type ContextUser = unknown;

/** Integration surface (NestJS `RemixApiService`) — only the methods read here. */
export interface RemixIntegrationPort {
  getPaymentStatsForRemix?: (...args: unknown[]) => Promise<unknown>;
  createPaymentForRemix?: (...args: unknown[]) => Promise<unknown>;
  getPaymentStatusForRemix?: (...args: unknown[]) => Promise<unknown>;
  [key: string]: unknown;
}

/** NestJS `RemixService` — only `.integration` is read by consumers. */
export interface RemixServicePort {
  integration?: RemixIntegrationPort;
  [key: string]: unknown;
}

/* ── Context keys (identity-keyed; nullable defaults → .get never throws) ──── */

export const userContext = createContext<ContextUser>(null);
export const remixServiceContext = createContext<RemixServicePort | null>(null);
/** LIVE (kept). Injected by NestJS as `RemixApiService`. Nullable. */
export const remixIntegrationContext =
  createContext<RemixIntegrationPort | null>(null);
export const cspNonceContext = createContext<string>("");
export const serverObservabilityContext =
  createContext<ServerObservability | null>(null);

/* ── Factory: plain values → RouterContextProvider ───────────────────────── */

export interface AppLoadContextValues {
  user: ContextUser;
  remixService: RemixServicePort | null;
  remixIntegration: RemixIntegrationPort | null;
  cspNonce: string;
  serverObservability: ServerObservability | null;
}

/**
 * Build the per-request `RouterContextProvider`. Called inside the SSR realm via
 * the façade bridge. `parsedBody` is intentionally absent (DEAD — dropped in A6).
 *
 * `makeProvider` lets the CALLER supply the provider instance. This exists for the
 * dual-realm topology: RR8 `v8_middleware` checks `initialContext instanceof
 * RouterContextProvider` inside its server runtime, which runs in the realm of
 * `@react-router/express` — i.e. the NestJS CJS realm. In DEV the SSR build is
 * evaluated by Vite's `ssrLoadModule` (a SEPARATE module instance of react-router),
 * so a provider created HERE with the build-realm class FAILS that node-realm
 * `instanceof` → every DEV page 500s ("Invalid `context` value"). The consumer
 * therefore injects a provider built from ITS react-router (node realm); we only
 * `.set()` the identity-keyed context values onto it. The keys (`createContext`
 * results) are plain `{ defaultValue }` objects and `RouterContextProvider.get/set`
 * are pure Map-by-identity ops — so a node-realm provider holding build-realm keys
 * round-trips correctly. The #1106 invariant is untouched: only the provider CLASS
 * is unified across realms; the keys never leave this module. PROD is the unified
 * production bundle (single realm) → identical behaviour.
 */
export function createAppLoadContext(
  values: AppLoadContextValues,
  makeProvider: () => RouterContextProvider = () => new RouterContextProvider(),
): RouterContextProvider {
  const provider = makeProvider();
  provider.set(userContext, values.user);
  provider.set(remixServiceContext, values.remixService);
  provider.set(remixIntegrationContext, values.remixIntegration);
  provider.set(cspNonceContext, values.cspNonce);
  provider.set(serverObservabilityContext, values.serverObservability);
  return provider;
}
