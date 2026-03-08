/**
 * Contrat d'entree — AnalyzeDiagnosticInput
 *
 * Fige des Phase 0 pour securiser le contrat d'entree API.
 * Tous les champs vehicule/usage sont optionnels — le moteur fonctionne en mode degrade.
 *
 * Aligne sur le RAG diagnostic reel :
 * - Questions complementaires (bruits-freinage.md : "a froid ou a chaud ?", "4 roues ou localise ?")
 * - Signaux vehicule (demarrage-batterie.md : "tension bornes", "voyant batterie")
 * - Modes d'entree : symptom_slugs (MVP), warning_light, dtc_code, free_text (normalise)
 */
import { z } from 'zod';
import {
  DiagnosticIntentEnum,
  SignalModeEnum,
} from './diagnostic-contract.schema';

// ── Vehicle Context ─────────────────────────────────────

export const FuelTypeEnum = z.enum([
  'essence',
  'diesel',
  'hybride',
  'electrique',
  'gpl',
]);

export const VehicleContextInputSchema = z.object({
  type_id: z.number().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  engine: z.string().optional(),
  fuel: FuelTypeEnum.optional(),
  year: z.number().min(1970).max(2030).optional(),
  mileage_km: z.number().min(0).optional(),
});
export type VehicleContextInput = z.infer<typeof VehicleContextInputSchema>;

// ── Usage Context ───────────────────────────────────────

export const UsageProfileEnum = z.enum([
  'urban_short_trips',
  'mixed',
  'highway',
  'professional',
  'occasional',
]);

export const UsageContextInputSchema = z.object({
  usage_profile: UsageProfileEnum.optional(),
  last_service_km: z.number().optional(),
  last_service_date: z.string().optional(),
  immobilized_days: z.number().optional(),
  recent_repairs: z.array(z.string()).optional(),
});
export type UsageContextInput = z.infer<typeof UsageContextInputSchema>;

// ── Signal Input ────────────────────────────────────────

export const SignalFrequencyEnum = z.enum([
  'constant',
  'intermittent',
  'progressive',
  'sudden',
]);

export const TemperatureContextEnum = z.enum(['cold', 'hot', 'any']);

export const SignalSinceEnum = z.enum(['recent', 'weeks', 'months', 'gradual']);

export const SignalContextSchema = z.object({
  appears_when: z.array(z.string()).optional(),
  frequency: SignalFrequencyEnum.optional(),
  temperature_context: z.array(TemperatureContextEnum).optional(),
  since_when: SignalSinceEnum.optional(),
});

export const SignalInputSchema = z.object({
  primary_signal: z.string().min(1),
  signal_mode: SignalModeEnum,
  secondary_signals: z.array(z.string()).optional(),
  context: SignalContextSchema.optional(),
});
export type SignalInput = z.infer<typeof SignalInputSchema>;

// ── Main Input ──────────────────────────────────────────

export const AnalyzeDiagnosticInputSchema = z.object({
  intent_type: DiagnosticIntentEnum,
  system_scope: z.string().min(1),
  vehicle_context: VehicleContextInputSchema,
  usage_context: UsageContextInputSchema.optional(),
  signal_input: SignalInputSchema,
  answers: z.record(z.string()).optional(),
  session_id: z.string().uuid().optional(),
});
export type AnalyzeDiagnosticInput = z.infer<
  typeof AnalyzeDiagnosticInputSchema
>;
