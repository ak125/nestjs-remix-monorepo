/**
 * HumanEscalation — V1A.0 first-class citizen
 *
 * Doctrine : human escalation N'EST PAS optionnel/fallback.
 * `available: true` TOUJOURS dans le payload V1A.0.
 * `priority_boost` contrôle la visibilité visuelle PRIMAIRE (anti-cannibalisation).
 *
 * Moat futur V1.5+ : AI-assisted human diagnostic escalation
 * (intelligent dispatch routing, specialist matching, SLA tiering).
 */
import { z } from 'zod';
import { DiagnosticReasonCodeEnum } from './diagnostic-reason-code';

export const HumanEscalationSchema = z.object({
  /** V1A = true par défaut, toujours présent dans payload */
  available: z.boolean(),
  /**
   * Détermine si la HumanEscalationCard est rendue en position PRIMAIRE
   * (au-dessus de RecommendedActionList) ou SECONDAIRE.
   * `true` si intent ∈ {urgence, garage} OR `safety_rail = true`.
   */
  priority_boost: z.boolean(),
  /** Stable target (tel:+33... ou /devis-humain). Frontend résout */
  target: z.string().min(1),
  /** Enum codes — explicabilité du priority_boost */
  reason_codes: z.array(DiagnosticReasonCodeEnum).min(1),
});
export type HumanEscalation = z.infer<typeof HumanEscalationSchema>;
