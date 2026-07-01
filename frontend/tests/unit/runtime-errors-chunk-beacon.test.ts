/**
 * Tests unitaires — `resolveChunkEventLabels`
 * (`frontend/app/utils/runtime-errors.client.ts`).
 *
 * Régression (review PR #1200) : `reportChunkResolvedInvalid` hardcodait
 * `reason: "resolved_undefined"` + message pour TOUS les appelants, y compris le
 * `stage: "rejected"` (rejet réel : stale chunk / réseau). → toute ventilation
 * dashboard sur `meta.reason` bucketait les rejets comme fulfill-with-undefined.
 * `reason`/`message` doivent DÉRIVER du `stage`.
 */

import { describe, expect, it } from "vitest";

import { resolveChunkEventLabels } from "~/utils/runtime-errors.client";

describe("resolveChunkEventLabels", () => {
  it("labels a genuine rejection as load_rejected (NOT resolved_undefined)", () => {
    const { reason, message } = resolveChunkEventLabels("rejected");
    expect(reason).toBe("load_rejected");
    expect(message).toMatch(/reject/i);
  });

  it("labels a fulfill-with-undefined as resolved_undefined", () => {
    const { reason, message } = resolveChunkEventLabels("resolved_undefined");
    expect(reason).toBe("resolved_undefined");
    expect(message).toMatch(/undefined/i);
  });

  it("labels a boundary-caught lazy-init error as resolved_undefined", () => {
    expect(resolveChunkEventLabels("boundary").reason).toBe("resolved_undefined");
  });

  it("defaults to resolved_undefined when stage is missing", () => {
    expect(resolveChunkEventLabels(undefined).reason).toBe("resolved_undefined");
  });
});
