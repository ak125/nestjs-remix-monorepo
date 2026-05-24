/**
 * RecommendedAction — V1A.0 Intent Resolution
 *
 * Action atomique ordonnée par le backend (single source of truth).
 * Frontend = renderer pur, n'altère JAMAIS l'ordre ni la composition.
 *
 * `target` = STABLE IDs only (route params `:gamme_id`, `tel:+...`, `mailto:...`,
 * `/devis-humain`). JAMAIS de slug literal hardcodé backend.
 */
import { z } from 'zod';
import { DiagnosticReasonCodeEnum } from './diagnostic-reason-code';

export const ActionTypeEnum = z.enum([
  'piece',
  'devis',
  'appel',
  'garage',
  'guide',
  'entretien_pack',
  'faq',
  'assistant_diagnostic',
  'human_resolution',
]);
export type ActionType = z.infer<typeof ActionTypeEnum>;

/**
 * TargetRole — discriminator analytics pour canonical event `action_clicked`.
 * Permet de dériver `to_commerce` (R1/R2) / `to_human` au runtime sans event séparé.
 */
export const TargetRoleEnum = z.enum([
  'R1', // famille pièce — page gamme
  'R2', // transactionnel pièce — page produit
  'R3', // conseil / guide
  'human', // appel / devis humain
  'garage', // garage local
  'devis', // formulaire devis
]);
export type TargetRole = z.infer<typeof TargetRoleEnum>;

export const RecommendedActionSchema = z.object({
  type: ActionTypeEnum,
  /** 1 = primary, strictly ascending across array */
  priority: z.number().int().min(1),
  /** Stable ID-based route or scheme (tel:/mailto:/path). NEVER raw slug. */
  target: z.string().min(1),
  /** i18n key — JAMAIS texte hardcodé */
  label_key: z.string().min(1),
  /** [0,1] policy-bound */
  confidence: z.number().min(0).max(1),
  /** Canonical enum codes — explicabilité requise */
  rationale_codes: z.array(DiagnosticReasonCodeEnum).min(1),
  /** Discriminator pour analytics — permet to_commerce / to_human dérivés */
  target_role: TargetRoleEnum,
});
export type RecommendedAction = z.infer<typeof RecommendedActionSchema>;
