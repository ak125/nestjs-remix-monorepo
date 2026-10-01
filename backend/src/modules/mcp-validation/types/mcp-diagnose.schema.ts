import { z } from 'zod';
import { MaintenanceRecordInputSchema } from '../../diagnostic-engine/types/diagnostic-input.schema';

const UuidSchema = z.string().uuid();
const MileageSchema = z.number().int().min(0).max(2147483647);
const HistoryRecordSchema = MaintenanceRecordInputSchema.refine(
  (record) =>
    record.last_service_km !== undefined ||
    record.last_service_date !== undefined,
  'Un historique déclaré exige un kilométrage ou une date de réalisation',
);

// Match the KG taxonomy, not the wizard's arrays or free-text descriptions.
// "any" is an unspecified context and must not earn SQL completeness points.
export const McpDiagnoseInputSchema = z
  .object({
    observable_ids: z
      .array(UuidSchema)
      .min(1)
      .refine(
        (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
        'Observables dupliqués',
      ),
    vehicle_context: z
      .object({
        ktypnr: z.number().int().positive().optional(),
        mileage_km: MileageSchema.optional(),
        vehicle_age_years: z.number().finite().min(0).optional(),
        vehicle_id: UuidSchema.optional(),
        engine_family_code: z.string().trim().min(1).optional(),
      })
      .optional(),
    last_maintenance_records: z.array(HistoryRecordSchema).optional(),
    ctx_phase: z
      .enum([
        'demarrage',
        'ralenti',
        'acceleration',
        'freinage',
        'virage',
        'vitesse_stable',
        'arret',
        'any',
      ])
      .nullish()
      .transform((value) => (value === 'any' ? null : value)),
    ctx_temp: z
      .enum(['froid', 'chaud', 'any'])
      .nullish()
      .transform((value) => (value === 'any' ? null : value)),
    ctx_speed: z
      .enum(['0_30', '30_70', '70_110', '110_plus', 'any'])
      .nullish()
      .transform((value) => (value === 'any' ? null : value)),
  })
  .superRefine((input, ctx) => {
    const seen = new Set<string>();
    input.last_maintenance_records?.forEach((record, index) => {
      if (seen.has(record.operation_slug)) {
        ctx.addIssue({
          code: 'custom',
          path: ['last_maintenance_records', index, 'operation_slug'],
          message: 'Historique dupliqué pour cette opération',
        });
      }
      seen.add(record.operation_slug);
      if (
        record.last_service_km !== undefined &&
        input.vehicle_context?.mileage_km !== undefined &&
        record.last_service_km > input.vehicle_context.mileage_km
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['last_maintenance_records', index, 'last_service_km'],
          message: 'Le kilométrage d’entretien dépasse le compteur actuel',
        });
      }
    });
  });

export type McpDiagnoseInput = z.input<typeof McpDiagnoseInputSchema>;

const ScoreSchema = z.number().int().min(0).max(100);
export const McpDiagnoseFaultsSchema = z
  .array(
    z.object({
      fault_id: UuidSchema,
      fault_label: z.string().trim().min(1),
      probability_score: ScoreSchema,
      confidence_score: ScoreSchema,
    }),
  )
  .refine(
    (faults) =>
      new Set(faults.map((fault) => fault.fault_id.toLowerCase())).size ===
      faults.length,
    'Défauts dupliqués',
  );
