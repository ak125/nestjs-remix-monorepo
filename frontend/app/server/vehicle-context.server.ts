import {
  verifyVehicleContext,
  VEHICLE_CTX_COOKIE_NAME,
  type VehicleContext,
} from "@repo/registry";

/**
 * Remix SSR helper — reads & verifies the `vehicle_ctx` JWS cookie from a
 * loader / action `Request`. Returns `null` if the cookie is absent or
 * fails verification (silent fallback — anonymous browsing must work).
 *
 * Canon : `feedback_vehicle_context_option_a_locked.md`. The Remix process
 * MUST share the same `JWT_SECRET` env var as the NestJS backend so signed
 * cookies round-trip across both runtimes.
 *
 * Usage in a loader :
 *   export const loader: LoaderFunction = async ({ request }) => {
 *     const ctx = await getVehicleContext(request);
 *     return json({ vehicle: ctx });
 *   };
 *
 * Note : this file is `.server.ts` so the Remix Vite plugin tree-shakes
 * it out of the client bundle (jose / Node `crypto` would not work in the
 * browser anyway).
 */
export async function getVehicleContext(
  request: Request,
): Promise<VehicleContext | null> {
  const token = readCookie(
    request.headers.get("Cookie") ?? undefined,
    VEHICLE_CTX_COOKIE_NAME,
  );
  if (!token) return null;

  const secret = getSecret();
  if (!secret) return null;

  return verifyVehicleContext({ token, secret });
}

/**
 * Lazily resolves the JWT_SECRET to a Uint8Array. Called from each loader
 * invocation (cheap : TextEncoder + slice). Centralised so that future
 * dual-read of a v:2 cookie can swap algorithms here without touching
 * call sites.
 */
function getSecret(): Uint8Array | null {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 32) {
    return null; // misconfigured env → behave as if cookie absent
  }
  return new TextEncoder().encode(raw);
}

/**
 * Same 6-line RFC-6265 reader used by the NestJS middleware (PR-B.2).
 * Kept inline rather than packaged — single use site, dependency-free.
 */
function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  const needle = `${name}=`;
  for (const pair of header.split(";")) {
    const trimmed = pair.trim();
    if (trimmed.startsWith(needle)) {
      return decodeURIComponent(trimmed.slice(needle.length));
    }
  }
  return undefined;
}
