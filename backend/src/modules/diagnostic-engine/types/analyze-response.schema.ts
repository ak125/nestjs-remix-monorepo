/**
 * AnalyzeResponseV1A0 — Contract canon Backend → Frontend
 *
 * Source de vérité unique pour le payload `/api/diagnostic-engine/analyze`
 * lorsque feature flag `diagnostic_pipeline_v1_enabled = true`.
 *
 * Compose :
 * - EvidencePack existant (rétro-compat, champs hérités du orchestrator)
 * - + intent layer (NOUVEAU V1A.0)
 * - + recommended_actions[] ordonné par backend
 * - + human_escalation first-class
 *
 * Différé V1B    : resolution_payload (ResolutionBlock R3)
 * Différé V1A.1  : commerce_outcome_signal column (async tagging)
 * Différé V1.1   : snapshot_id, decision_lineage, conflict_arbitrated, temporal_context, triplet versions
 */
import { z } from 'zod';
import {
  DiagnosticIntentEnum,
  ConfidenceBucketEnum,
} from './diagnostic-intent';
import { DiagnosticReasonCodeEnum } from './diagnostic-reason-code';
import { RecommendedActionSchema } from './recommended-action';
import { HumanEscalationSchema } from './human-escalation';

/** Mode V1A.0 = reactive only. Predictive différé V1.1 */
export const DiagnosticModeEnum = z.enum(['reactive']);
export type DiagnosticMode = z.infer<typeof DiagnosticModeEnum>;

/** Single pipeline_version V1A.0. Triplet versions différé V1.1 */
export const VersionsV1A0Schema = z.object({
  pipeline_version: z.string().regex(/^v\d+\.\d+\.\d+$/),
});
export type VersionsV1A0 = z.infer<typeof VersionsV1A0Schema>;

/** Intent layer canonique */
export const IntentLayerSchema = z.object({
  value: DiagnosticIntentEnum,
  /** Confidence policy-bound [0,1] (cf. confidence-policy.ts) */
  confidence: z.number().min(0).max(1),
  /** Bucket dérivé déterministe via getConfidenceBucket() */
  confidence_bucket: ConfidenceBucketEnum,
  /** Enum codes — explicabilité, non-vide */
  reason_codes: z.array(DiagnosticReasonCodeEnum).min(1),
  /** Si true → actions[0].type ∈ {appel, assistant_diagnostic, human_resolution} */
  safety_rail: z.boolean(),
});
export type IntentLayer = z.infer<typeof IntentLayerSchema>;

/**
 * V1A.0 enriched fields — additifs au EvidencePack existant.
 * Front-end V1A.0 lit UNIQUEMENT ces champs (ignore evidence_pack.rag_facts per doctrine).
 */
export const AnalyzeResponseV1A0Schema = z.object({
  session_id: z.string().nullable(),
  /** V1A.0 = literal 'reactive' */
  mode: DiagnosticModeEnum,
  /** Versioning canonique */
  versions: VersionsV1A0Schema,
  /** Intent layer dérivé déterministe depuis EvidencePack */
  intent: IntentLayerSchema,
  /** Actions ordonnées par backend — source of truth unique */
  recommended_actions: z.array(RecommendedActionSchema).min(1),
  /** Human escalation first-class — toujours présent */
  human_escalation: HumanEscalationSchema,
});
export type AnalyzeResponseV1A0 = z.infer<typeof AnalyzeResponseV1A0Schema>;

/**
 * HandoffInput — POST /api/diagnostic-engine/handoff
 *
 * Reçu lorsque le user clique une action recommandée ou l'escalade humaine.
 * Émet canonical event `diagnostic_resolution_outcome` avec outcome_type='action_clicked'
 * tagué `target_role` (anti double-truth — pas de event séparé `to_commerce`).
 *
 * Le client désigne seulement l'élément cliqué. Intent, confidence, codes et
 * contexte véhicule sont re-dérivés côté serveur depuis la session stockée.
 * `surface` distingue la carte d'escalade de l'action `human_resolution`
 * (même type/rôle, codes différents).
 */
import { ActionTypeEnum, TargetRoleEnum } from './recommended-action';

export const HandoffInputSchema = z.discriminatedUnion('surface', [
  z.object({
    surface: z.literal('recommended_action'),
    session_id: z.string().uuid(),
    /** Identifie l'action dans la liste (priorités uniques 1..N) */
    priority: z.number().int().min(1),
    /** Contrôle de cohérence avec l'action re-dérivée */
    action_type: ActionTypeEnum,
    target_role: TargetRoleEnum,
  }),
  z.object({
    surface: z.literal('human_escalation'),
    session_id: z.string().uuid(),
  }),
]);
export type HandoffInput = z.infer<typeof HandoffInputSchema>;
