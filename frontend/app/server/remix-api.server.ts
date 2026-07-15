/**
 * Server-side accessors for the Remix ↔ NestJS in-process boundary.
 * Imported ONLY from Remix loaders/actions.
 *
 * There is NO HTTP loopback here: NestJS `RemixController` injects the real
 * services into the RR8 load context per request, so these accessors just read
 * the typed context keys. A missing value fails LOUD (governed no-silent-fallback)
 * — it means the SSR boundary is mis-wired, NOT a reason to fetch `localhost`.
 */
import { type RouterContextProvider } from "react-router";
import {
  remixApplicationPortContext,
  remixIntegrationContext,
  remixServiceContext,
} from "~/utils/load-context";
import { type RemixApplicationPort } from "~/utils/remix-application-port";

/**
 * The per-request, actor-bound, FROZEN application port injected by NestJS
 * `RemixController`. Synchronous (the value is already resolved) and fail-loud —
 * mirrors the pure `context.get` idiom of `getOptionalUser`.
 */
export function getRemixApplicationPort(
  context: Readonly<RouterContextProvider>,
): RemixApplicationPort {
  const port = context.get(remixApplicationPortContext);
  if (!port) {
    throw new Error(
      "[getRemixApplicationPort] RemixApplicationPort missing from load context — " +
        "the SSR boundary is not wired (RemixController must inject it per request). " +
        "No HTTP loopback fallback (governed no-silent-fallback).",
    );
  }
  return port;
}

/**
 * @deprecated Legacy untyped integration accessor, superseded by
 * `getRemixApplicationPort`. The former inline HTTP-loopback fallback (fetch to
 * `localhost:3000` with `Internal-Call` / `X-User-*` header auth) has been
 * removed; it now only reads the injected integration and fails loud. Retained
 * until the remaining non-migrated callers are moved over.
 */
export async function getRemixApiService(
  context: Readonly<RouterContextProvider>,
): Promise<unknown> {
  const remixIntegration = context.get(remixIntegrationContext);
  if (remixIntegration) return remixIntegration;
  const remixService = context.get(remixServiceContext);
  if (remixService?.integration) return remixService.integration;
  throw new Error(
    "[getRemixApiService] integration not injected — no HTTP loopback fallback " +
      "(governed no-silent-fallback).",
  );
}
