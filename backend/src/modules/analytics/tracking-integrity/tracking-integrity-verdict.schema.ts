/**
 * `tracking-integrity-verdict.v1` — contrat du relais Data → Ventes
 * (`department_handoffs[data-to-sales-tracking-integrity]`,
 * `.spec/00-canon/ai-registry/agent-operating-map.yaml`).
 *
 * Producteur : département Data (`TrackingIntegrityService`, ce module).
 * Consommateur : département Ventes, via la file d'actions du Command Center,
 * qui valide le verdict par `safeParse` avant de l'interpréter.
 *
 * Le verdict dit si la mesure « commande passée » (`r2_order_placed` dans
 * `__seo_event_log`) est assez fiable pour fonder une décision commerciale.
 * CERTIFIED n'est jamais accordé sur une absence de données : il faut que
 * chaque contrôle soit PASS.
 */
import { z } from 'zod';

export const TRACKING_INTEGRITY_CONTRACT = 'tracking-integrity-verdict.v1';

export const TrackingIntegrityCheckIdSchema = z.enum([
  /** L'identifiant porté par l'événement désigne-t-il une commande existante ? */
  'order_event_key',
  /** Chaque commande au paiement confirmé a-t-elle son événement ? */
  'order_event_coverage',
]);
export type TrackingIntegrityCheckId = z.infer<
  typeof TrackingIntegrityCheckIdSchema
>;

export const TrackingIntegrityCheckSchema = z
  .object({
    id: TrackingIntegrityCheckIdSchema,
    /** NO_DATA = dénominateur nul : ni réussite ni échec. */
    status: z.enum(['PASS', 'FAIL', 'NO_DATA']),
    observed: z.number().int().min(0),
    expected: z.number().int().min(0),
    detail: z.string(),
    /** Références à consulter (id de ligne d'événement ou `ord_id`), 5 au plus. */
    samples: z.array(z.string()).max(5),
  })
  .strict()
  .refine((c) => c.observed <= c.expected, {
    message: 'observed > expected',
  })
  .refine((c) => (c.status === 'NO_DATA') === (c.expected === 0), {
    message: 'NO_DATA ⇔ expected = 0',
  })
  .refine((c) => c.status !== 'PASS' || c.observed === c.expected, {
    message: 'PASS exige observed = expected',
  });
export type TrackingIntegrityCheck = z.infer<
  typeof TrackingIntegrityCheckSchema
>;

export const TrackingIntegrityVerdictV1Schema = z
  .object({
    contract: z.literal(TRACKING_INTEGRITY_CONTRACT),
    producer: z.literal('data'),
    consumer: z.literal('sales'),
    status: z.enum(['CERTIFIED', 'NOT_CERTIFIED', 'UNKNOWN']),
    window: z
      .object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        days: z.number().int().positive(),
      })
      .strict(),
    checks: z.array(TrackingIntegrityCheckSchema),
    /** Obligatoire quand le statut est UNKNOWN : pourquoi on ne sait pas. */
    reason: z.string().nullable(),
  })
  .strict()
  .refine(
    (v) =>
      v.status !== 'CERTIFIED' ||
      (v.checks.length > 0 && v.checks.every((c) => c.status === 'PASS')),
    { message: 'CERTIFIED exige au moins un contrôle, tous PASS' },
  )
  .refine(
    (v) =>
      (v.status === 'NOT_CERTIFIED') ===
      v.checks.some((c) => c.status === 'FAIL'),
    { message: 'NOT_CERTIFIED ⇔ au moins un contrôle FAIL' },
  )
  .refine((v) => v.status !== 'UNKNOWN' || !!v.reason, {
    message: 'UNKNOWN exige une raison',
  });
export type TrackingIntegrityVerdictV1 = z.infer<
  typeof TrackingIntegrityVerdictV1Schema
>;
