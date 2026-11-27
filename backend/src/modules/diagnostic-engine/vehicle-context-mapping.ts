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

type KnownMotorisation = Pick<
  VehicleContextPayload,
  'type_id' | 'brand_slug' | 'model_slug' | 'engine_slug'
>;

const sameLabel = (a?: string, b?: string): boolean =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Keeps the motorisation of the context the visitor already carries when a
 * new analyze names the same brand and model without one. Without it, a
 * diagnostic run without motorisation rewrote a vehicle_ctx holding type_id
 * with brand + model only (mandat GE, constat DEV du 27 nov.).
 *
 * The motorisation is carried over only when brand and model are known on
 * both sides and equal, and when the new input names no other engine; any
 * doubt writes the new payload as sent.
 */
export function keepKnownMotorisation(
  existing: KnownMotorisation | null | undefined,
  next: VehicleContextPayload,
): VehicleContextPayload {
  if (
    !existing ||
    typeof existing.type_id !== 'number' ||
    typeof next.type_id === 'number' ||
    !sameLabel(existing.brand_slug, next.brand_slug) ||
    !sameLabel(existing.model_slug, next.model_slug) ||
    (next.engine_slug !== undefined &&
      !sameLabel(existing.engine_slug, next.engine_slug))
  ) {
    return next;
  }

  const parsed = VehicleContextPayloadSchema.safeParse({
    ...next,
    type_id: existing.type_id,
    ...(existing.engine_slug !== undefined && next.engine_slug === undefined
      ? { engine_slug: existing.engine_slug }
      : {}),
  });
  return parsed.success ? parsed.data : next;
}
