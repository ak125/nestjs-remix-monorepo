import {
  VehicleContextPayloadSchema,
  type VehicleContextPayload,
} from '@repo/registry';

/**
 * Maps the analyze input's `vehicle_context` object into the canonical
 * VehicleContext cookie payload, or returns `null` if the input is missing
 * or lacks a usable identifier.
 *
 * Pure function — extracted so it can be unit-tested without booting the
 * controller's transitive imports. Source is always forced to `"diagnostic"`
 * (the entry route producing this signal), regardless of what the caller
 * passed.
 */
export function mapAnalyzeInputToVehicleContextPayload(
  body: unknown,
): VehicleContextPayload | null {
  const input = (body as { vehicle_context?: unknown } | null | undefined)
    ?.vehicle_context;
  if (input === undefined || input === null || typeof input !== 'object') {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const candidate: Record<string, unknown> = { source: 'diagnostic' };
  if (typeof raw.type_id === 'number') candidate.type_id = raw.type_id;
  if (typeof raw.brand === 'string') candidate.brand_slug = raw.brand;
  if (typeof raw.model === 'string') candidate.model_slug = raw.model;
  if (typeof raw.engine === 'string') candidate.engine_slug = raw.engine;
  if (typeof raw.year === 'number') candidate.year = raw.year;
  if (typeof raw.mileage_km === 'number') {
    candidate.mileage_km = raw.mileage_km;
  }

  const hasIdentifier =
    typeof candidate.type_id === 'number' ||
    (typeof candidate.brand_slug === 'string' &&
      typeof candidate.model_slug === 'string');
  if (!hasIdentifier) return null;

  const parsed = VehicleContextPayloadSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
