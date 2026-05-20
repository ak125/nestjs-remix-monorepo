import { z } from "zod";

/**
 * VehicleContext schema — OPTION A locked.
 *
 * Canon : `feedback_vehicle_context_option_a_locked.md`. The cookie is a
 * lightweight runtime navigation hint, never a source of truth. Any field
 * extension beyond what is listed below requires a NEW stateful domain
 * (`UserVehicleProfileDomain` or `CarnetDomain`), NOT a new key here.
 *
 * Versioning : `v: 1` is the only accepted value in V1. A future bump
 * requires a dual-read transition (1 sprint) and an L4 ADR — never a
 * big-bang migration.
 *
 * @see backend/src/modules/diagnostic-engine/ports/vehicle-context.port.ts
 *      for the matching TypeScript interface (PR-A.1).
 */
export const VehicleContextSchema = z
  .object({
    v: z.literal(1),
    type_id: z.number().int().positive().optional(),
    brand_slug: z.string().min(1).max(64).optional(),
    model_slug: z.string().min(1).max(64).optional(),
    engine_slug: z.string().min(1).max(64).optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    mileage_km: z.number().int().min(0).max(2_000_000).optional(),
    source: z.enum(["diagnostic", "manual", "gsc"]),
    iat: z.number().int().positive(),
  })
  .strict();

export type VehicleContext = z.infer<typeof VehicleContextSchema>;

/**
 * Payload accepted by the signing helper — everything the caller controls,
 * minus the protocol fields (`v`, `iat`) which are always set by `signVehicleContext`.
 */
export const VehicleContextPayloadSchema = VehicleContextSchema.omit({
  v: true,
  iat: true,
});

export type VehicleContextPayload = z.infer<typeof VehicleContextPayloadSchema>;
