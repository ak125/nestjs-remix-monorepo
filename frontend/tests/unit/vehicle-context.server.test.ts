// @vitest-environment node
// Server helper exercises jose / Node crypto ; jsdom's Uint8Array realm
// trips jose's `instanceof Uint8Array` runtime guard.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  signVehicleContext,
  VEHICLE_CTX_COOKIE_NAME,
} from "@repo/registry";
import { getVehicleContext } from "~/server/vehicle-context.server";

const SECRET_RAW = "test-secret-must-be-at-least-32-chars-long-xyz";
const SECRET = new TextEncoder().encode(SECRET_RAW);

const requestWithCookie = (header?: string): Request => {
  const headers = new Headers();
  if (header !== undefined) headers.set("Cookie", header);
  return new Request("http://localhost/", { headers });
};

describe("getVehicleContext (Remix SSR helper)", () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = SECRET_RAW;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it("returns null when no Cookie header is present", async () => {
    const ctx = await getVehicleContext(requestWithCookie());
    expect(ctx).toBeNull();
  });

  it("returns null when the vehicle_ctx cookie is absent from a non-empty Cookie header", async () => {
    const ctx = await getVehicleContext(requestWithCookie("__session=foo; other=bar"));
    expect(ctx).toBeNull();
  });

  it("returns null on a malformed JWS token", async () => {
    const ctx = await getVehicleContext(
      requestWithCookie(`${VEHICLE_CTX_COOKIE_NAME}=not.a.real.jwt`),
    );
    expect(ctx).toBeNull();
  });

  it("returns the parsed context for a valid cookie", async () => {
    const token = await signVehicleContext({
      payload: { source: "diagnostic", brand_slug: "audi", type_id: 12345 },
      secret: SECRET,
    });
    const ctx = await getVehicleContext(
      requestWithCookie(`${VEHICLE_CTX_COOKIE_NAME}=${token}`),
    );
    expect(ctx).not.toBeNull();
    expect(ctx).toMatchObject({
      v: 1,
      source: "diagnostic",
      brand_slug: "audi",
      type_id: 12345,
    });
  });

  it("returns null when JWT_SECRET is missing (misconfigured env, no crash)", async () => {
    delete process.env.JWT_SECRET;
    const token = await signVehicleContext({
      payload: { source: "manual" },
      secret: SECRET,
    });
    const ctx = await getVehicleContext(
      requestWithCookie(`${VEHICLE_CTX_COOKIE_NAME}=${token}`),
    );
    expect(ctx).toBeNull();
  });

  it("returns null when JWT_SECRET is too short (< 32 chars)", async () => {
    process.env.JWT_SECRET = "short";
    const token = await signVehicleContext({
      payload: { source: "gsc" },
      secret: SECRET,
    });
    const ctx = await getVehicleContext(
      requestWithCookie(`${VEHICLE_CTX_COOKIE_NAME}=${token}`),
    );
    expect(ctx).toBeNull();
  });

  it("returns null when cookie was signed with a different secret", async () => {
    const otherSecret = new TextEncoder().encode(
      "different-secret-also-32-chars-or-more-abcd",
    );
    const token = await signVehicleContext({
      payload: { source: "diagnostic" },
      secret: otherSecret,
    });
    const ctx = await getVehicleContext(
      requestWithCookie(`${VEHICLE_CTX_COOKIE_NAME}=${token}`),
    );
    expect(ctx).toBeNull();
  });

  it("handles multiple cookies and selects vehicle_ctx", async () => {
    const token = await signVehicleContext({
      payload: { source: "manual", year: 2018 },
      secret: SECRET,
    });
    const header = `_ga=GA1.1.123; ${VEHICLE_CTX_COOKIE_NAME}=${token}; __session=ses_abc`;
    const ctx = await getVehicleContext(requestWithCookie(header));
    expect(ctx?.year).toBe(2018);
  });
});
