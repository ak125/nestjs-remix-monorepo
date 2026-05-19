import { SignJWT, jwtVerify } from "jose";
import {
  VehicleContextSchema,
  type VehicleContext,
  type VehicleContextPayload,
} from "./schema";

const ALG = "HS256";

/**
 * Sign a VehicleContext payload as a compact JWS (HS256).
 *
 * Canon : `vehicle-context-option-a-locked` line 37 — HS256 + canonical
 * `JWT_SECRET`. No JWKS rotation in V1; introducing ES256+JWKS would
 * require an L4 ADR.
 *
 * Protocol fields (`v`, `iat`) are set by this function — callers cannot
 * forge them. The returned token is the cookie value.
 */
export async function signVehicleContext(args: {
  payload: VehicleContextPayload;
  secret: Uint8Array;
  /** Optional override of issued-at; defaults to Math.floor(Date.now()/1000). */
  iat?: number;
}): Promise<string> {
  const fullContext: VehicleContext = {
    v: 1,
    ...args.payload,
    iat: args.iat ?? Math.floor(Date.now() / 1000),
  };

  VehicleContextSchema.parse(fullContext);

  return new SignJWT(fullContext as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG, typ: "JWT" })
    .sign(args.secret);
}

/**
 * Verify a JWS cookie value and return the parsed VehicleContext, or `null`
 * if the signature is invalid, the schema does not match (including unknown
 * `v`), or the payload is malformed.
 *
 * NEVER throws — callers tick a `vehicle_ctx_invalid_total` metric on null
 * and continue without context (silent fallback, not 401).
 */
export async function verifyVehicleContext(args: {
  token: string;
  secret: Uint8Array;
}): Promise<VehicleContext | null> {
  try {
    const { payload } = await jwtVerify(args.token, args.secret, {
      algorithms: [ALG],
    });
    const parsed = VehicleContextSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Canonical cookie attributes — frozen in V1.
 *
 * Canon `vehicle-context-option-a-locked` line 37 :
 * HttpOnly + SameSite=Lax + 90 days TTL. `Secure` is set conditionally by
 * the caller depending on `req.secure` so localhost dev keeps working.
 */
export const VEHICLE_CTX_COOKIE_NAME = "vehicle_ctx";
export const VEHICLE_CTX_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 7_776_000
