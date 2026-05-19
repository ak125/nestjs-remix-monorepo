import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  VehicleContextSchema,
  VehicleContextPayloadSchema,
  signVehicleContext,
  verifyVehicleContext,
  VEHICLE_CTX_COOKIE_NAME,
  VEHICLE_CTX_COOKIE_MAX_AGE_SECONDS,
} from "../vehicle-context";

const SECRET = new TextEncoder().encode(
  "test-secret-must-be-at-least-32-chars-long-xyz",
);
const OTHER_SECRET = new TextEncoder().encode(
  "different-secret-also-32-chars-or-more-abcd",
);

describe("VehicleContextSchema (OPTION A locked)", () => {
  test("accepts minimal valid context (source + iat + v)", () => {
    const parsed = VehicleContextSchema.parse({
      v: 1,
      source: "diagnostic",
      iat: 1_700_000_000,
    });
    assert.equal(parsed.v, 1);
    assert.equal(parsed.source, "diagnostic");
  });

  test("accepts full context with all optional fields", () => {
    const parsed = VehicleContextSchema.parse({
      v: 1,
      type_id: 12345,
      brand_slug: "audi",
      model_slug: "a3",
      engine_slug: "2-0-tdi-150",
      year: 2018,
      mileage_km: 87000,
      source: "manual",
      iat: 1_700_000_000,
    });
    assert.equal(parsed.brand_slug, "audi");
  });

  test("rejects unknown schema version (v: 2)", () => {
    assert.throws(() =>
      VehicleContextSchema.parse({
        v: 2,
        source: "diagnostic",
        iat: 1_700_000_000,
      }),
    );
  });

  test("rejects forbidden OPTION-A keys (ownership / preferences)", () => {
    assert.throws(() =>
      VehicleContextSchema.parse({
        v: 1,
        source: "diagnostic",
        iat: 1_700_000_000,
        ownership: "user_xyz",
      } as unknown),
    );
    assert.throws(() =>
      VehicleContextSchema.parse({
        v: 1,
        source: "diagnostic",
        iat: 1_700_000_000,
        preferences: { language: "fr" },
      } as unknown),
    );
  });

  test("rejects invalid source enum value", () => {
    assert.throws(() =>
      VehicleContextSchema.parse({
        v: 1,
        source: "invented",
        iat: 1_700_000_000,
      }),
    );
  });

  test("rejects mileage out of [0, 2_000_000]", () => {
    assert.throws(() =>
      VehicleContextSchema.parse({
        v: 1,
        source: "manual",
        iat: 1_700_000_000,
        mileage_km: -1,
      }),
    );
    assert.throws(() =>
      VehicleContextSchema.parse({
        v: 1,
        source: "manual",
        iat: 1_700_000_000,
        mileage_km: 3_000_000,
      }),
    );
  });

  test("rejects year out of [1900, 2100]", () => {
    assert.throws(() =>
      VehicleContextSchema.parse({
        v: 1,
        source: "manual",
        iat: 1_700_000_000,
        year: 1800,
      }),
    );
  });
});

describe("VehicleContextPayloadSchema (caller-supplied subset)", () => {
  test("omits v and iat (protocol fields)", () => {
    const keys = Object.keys(VehicleContextPayloadSchema.shape);
    assert.ok(!keys.includes("v"));
    assert.ok(!keys.includes("iat"));
    assert.ok(keys.includes("source"));
  });
});

describe("signVehicleContext / verifyVehicleContext round-trip", () => {
  test("signs and verifies a minimal payload", async () => {
    const token = await signVehicleContext({
      payload: { source: "diagnostic" },
      secret: SECRET,
    });
    assert.ok(typeof token === "string" && token.split(".").length === 3);

    const verified = await verifyVehicleContext({ token, secret: SECRET });
    assert.ok(verified !== null);
    assert.equal(verified!.source, "diagnostic");
    assert.equal(verified!.v, 1);
    assert.ok(typeof verified!.iat === "number");
  });

  test("signs and verifies a full payload (8 fields)", async () => {
    const token = await signVehicleContext({
      payload: {
        type_id: 12345,
        brand_slug: "audi",
        model_slug: "a3",
        engine_slug: "2-0-tdi-150",
        year: 2018,
        mileage_km: 87000,
        source: "manual",
      },
      secret: SECRET,
    });
    const verified = await verifyVehicleContext({ token, secret: SECRET });
    assert.equal(verified!.type_id, 12345);
    assert.equal(verified!.brand_slug, "audi");
    assert.equal(verified!.mileage_km, 87000);
  });

  test("returns null when signature is verified with a different secret", async () => {
    const token = await signVehicleContext({
      payload: { source: "gsc" },
      secret: SECRET,
    });
    const tampered = await verifyVehicleContext({
      token,
      secret: OTHER_SECRET,
    });
    assert.equal(tampered, null);
  });

  test("returns null on malformed token", async () => {
    const malformed = await verifyVehicleContext({
      token: "not.a.jwt",
      secret: SECRET,
    });
    assert.equal(malformed, null);
  });

  test("returns null on empty token string", async () => {
    const empty = await verifyVehicleContext({ token: "", secret: SECRET });
    assert.equal(empty, null);
  });

  test("sign sets explicit iat when provided", async () => {
    const token = await signVehicleContext({
      payload: { source: "diagnostic" },
      secret: SECRET,
      iat: 1_700_000_000,
    });
    const verified = await verifyVehicleContext({ token, secret: SECRET });
    assert.equal(verified!.iat, 1_700_000_000);
  });
});

describe("Cookie name + TTL constants (frozen V1)", () => {
  test("cookie name is 'vehicle_ctx'", () => {
    assert.equal(VEHICLE_CTX_COOKIE_NAME, "vehicle_ctx");
  });

  test("TTL is exactly 90 days in seconds", () => {
    assert.equal(VEHICLE_CTX_COOKIE_MAX_AGE_SECONDS, 90 * 24 * 60 * 60);
    assert.equal(VEHICLE_CTX_COOKIE_MAX_AGE_SECONDS, 7_776_000);
  });
});
