import { describe, expect, it } from "vitest";
import { resolveVehiclePageError } from "~/utils/vehicle-page-status";

describe("resolveVehiclePageError", () => {
  it("returns null (render 200) when the backend served a usable vehicle payload", () => {
    expect(
      resolveVehiclePageError(true, 200, {
        success: true,
        data: { vehicle: { type_id: 19020 } },
      }),
    ).toBeNull();
  });

  it("maps a deterministic 'Vehicle not found' (200 + success:false) to 404 noindex, NOT 503", () => {
    const verdict = resolveVehiclePageError(true, 200, {
      success: false,
      error: "Vehicle not found",
    });
    expect(verdict).toEqual({
      status: 404,
      robots: "noindex, follow",
      code: "NOT_FOUND",
      isServerError: false,
    });
  });

  it("maps a success:true payload missing the vehicle to 503 (genuine anomaly, crawler retries)", () => {
    const verdict = resolveVehiclePageError(true, 200, {
      success: true,
      data: { vehicle: undefined },
    });
    expect(verdict?.status).toBe(503);
    expect(verdict?.code).toBe("INVALID_PAYLOAD");
    expect(verdict?.isServerError).toBe(true);
    expect(verdict?.robots).toBe("noindex");
  });

  it("passes a backend 404 through as a 404 noindex", () => {
    expect(resolveVehiclePageError(false, 404, null)).toEqual({
      status: 404,
      robots: "noindex, follow",
      code: "NOT_FOUND",
      isServerError: false,
    });
  });

  it("passes a backend 410 through as a 410 noindex", () => {
    expect(resolveVehiclePageError(false, 410, null)).toEqual({
      status: 410,
      robots: "noindex, follow",
      code: "GONE",
      isServerError: false,
    });
  });

  it("maps a genuine backend 5xx to 503 noindex (transient, crawler retries)", () => {
    const verdict = resolveVehiclePageError(false, 500, null);
    expect(verdict?.status).toBe(503);
    expect(verdict?.code).toBe("BACKEND_RPC_ERROR");
    expect(verdict?.isServerError).toBe(true);
    expect(verdict?.robots).toBe("noindex");
  });

  it("never returns an index,follow verdict for a non-200 status", () => {
    const cases = [
      resolveVehiclePageError(true, 200, { success: false }),
      resolveVehiclePageError(false, 404, null),
      resolveVehiclePageError(false, 410, null),
      resolveVehiclePageError(false, 503, null),
      resolveVehiclePageError(true, 200, { success: true, data: {} }),
    ];
    for (const verdict of cases) {
      expect(verdict).not.toBeNull();
      expect(verdict?.robots.includes("noindex")).toBe(true);
    }
  });
});
