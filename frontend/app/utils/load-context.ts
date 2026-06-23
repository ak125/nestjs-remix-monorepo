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
 */
export function createAppLoadContext(
  values: AppLoadContextValues,
): RouterContextProvider {
  const provider = new RouterContextProvider();
  provider.set(userContext, values.user);
  provider.set(remixServiceContext, values.remixService);
  provider.set(remixIntegrationContext, values.remixIntegration);
  provider.set(cspNonceContext, values.cspNonce);
  provider.set(serverObservabilityContext, values.serverObservability);
  return provider;
}
