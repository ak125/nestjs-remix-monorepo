/**
 * DiagnosticReasonCode — V1A.0 Intent Resolution
 *
 * Enum canonique fermé (14 codes V1A.0, cap strict). 5 catégories prefix-strict.
 *
 * ❌ Aucune string libre — uniquement valeurs enum.
 * ❌ Ajout = ADR amendment justifié empirique.
 * ❌ Deprecate = `@deprecated` marker, jamais delete (cf. governance V1B).
 *
 * Source de vérité : ADR vault "Diagnostic Reason Code Governance" (V1A.0).
 *
 * Catégories V1A.0 :
 * - DR_INTENT_*    (6) : triggers classification intent
 * - DR_SAFETY_*    (3) : safety rail triggers
 * - DR_OVERRIDE_*  (3) : action recommender overrides
 * - DR_HANDOFF_*   (2) : handoff types
 *
 * V1A.1 (déféré) : DR_REJECT_*, DR_RESOLVED_* (+ 16 codes)
 */
import { z } from 'zod';

export const DiagnosticReasonCodeEnum = z.enum([
  // ── DR_INTENT_* — triggers classification (6) ───────────────────────
  'DR_INTENT_SAFETY_URGENCY_CRITICAL',
  'DR_INTENT_SAFETY_URGENCY_IMMINENT',
  'DR_INTENT_REPAIR_DIFFICULTY_HIGH',
  'DR_INTENT_MAINTENANCE_FLAG_TRUE',
  'DR_INTENT_HIGH_CONFIDENCE_COMMERCE',
  'DR_INTENT_HYPOTHESIS_CONFIDENCE_LOW',

  // ── DR_SAFETY_* — safety rail triggers (3) ──────────────────────────
  'DR_SAFETY_VEHICLE_CONTEXT_MISSING',
  'DR_SAFETY_HYPOTHESIS_CONFIDENCE_INSUFFICIENT',
  'DR_SAFETY_CONTRADICTORY_SIGNALS',

  // ── DR_OVERRIDE_* — action recommender overrides (3) ────────────────
  'DR_OVERRIDE_VEHICLE_ABSENT_DEMOTE_PIECE',
  'DR_OVERRIDE_DIFFICULTY_HIGH_PROMOTE_GARAGE',
  'DR_OVERRIDE_URGENCY_PROMOTE_HUMAN',

  // ── DR_HANDOFF_* — handoff types (2) ────────────────────────────────
  'DR_HANDOFF_TO_COMMERCE',
  'DR_HANDOFF_TO_HUMAN',
]);
export type DiagnosticReasonCode = z.infer<typeof DiagnosticReasonCodeEnum>;

/**
 * Validation helper — utile pour InvariantAsserter et zod schemas.
 * Aucun runtime guess : tout code hors enum throw.
 */
export const ALL_DIAGNOSTIC_REASON_CODES: readonly DiagnosticReasonCode[] =
  DiagnosticReasonCodeEnum.options;
