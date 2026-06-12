/**
 * Zod schemas for CWV beacon payload — runtime validation.
 *
 * Bornes alignées sur DB CHECK IN clauses (cf. canon
 * `feedback_param_pipe_bound_must_match_db_column_type`).
 *
 * Used by :
 *   - backend/src/modules/seo-monitoring/controllers/cwv-beacon.controller.ts
 *     (bloc 3) — POST /api/seo/cwv/beacon body validation
 */

import { z } from 'zod';
import { DEVICE_TYPE_VALUES, METRIC_NAME_VALUES, NAV_TYPE_VALUES } from './metric';
import { ROUTE_GROUP_VALUES } from './route-group';
import { SURFACE_VALUES } from './surface';
import { FUNNEL_STEP_VALUES } from './funnel-step';
import { PRIORITY_TIER_VALUES } from './priority-tier';
import { USER_AGENT_CLASS_VALUES } from './user-agent';

// z.enum() accepte directement un readonly tuple non-vide → préserve les
// littéraux côté inférence Zod (sinon `z.infer` collapse vers string).
const surfaceEnum = z.enum(SURFACE_VALUES);
const routeGroupEnum = z.enum(ROUTE_GROUP_VALUES);
const funnelStepEnum = z.enum(FUNNEL_STEP_VALUES);
const priorityTierEnum = z.enum(PRIORITY_TIER_VALUES);
const metricNameEnum = z.enum(METRIC_NAME_VALUES);
const deviceTypeEnum = z.enum(DEVICE_TYPE_VALUES);
const navTypeEnum = z.enum(NAV_TYPE_VALUES);
const userAgentClassEnum = z.enum(USER_AGENT_CLASS_VALUES);

/** Attribution payload — selector sanitized client-side before send. */
export const CwvAttributionSchema = z
  .object({
    // INP attribution (truncated 100c côté client)
    attr_target: z.string().max(120).optional(),
    attr_interaction_type: z.string().max(40).optional(),
    attr_load_state: z.string().max(40).optional(),
    attr_input_delay: z.number().int().min(0).max(60000).optional(),
    attr_processing_duration: z.number().int().min(0).max(60000).optional(),
    attr_presentation_delay: z.number().int().min(0).max(60000).optional(),
    // LCP attribution
    attr_element: z.string().max(120).optional(),
    attr_ttfb: z.number().int().min(0).max(60000).optional(),
    attr_resource_load_delay: z.number().int().min(0).max(60000).optional(),
    attr_resource_load_duration: z.number().int().min(0).max(60000).optional(),
    attr_element_render_delay: z.number().int().min(0).max(60000).optional(),
    // CLS attribution
    attr_largest_shift_target: z.string().max(120).optional(),
  })
  .strict()
  .optional();

/**
 * Beacon payload — POST /api/seo/cwv/beacon body.
 *
 * Discipline :
 *   - Tous les enums sont CHECK IN au niveau DB (bloc 3 migration)
 *   - `value` est borné par metric (vérif applicative supplémentaire, pas
 *     dans le schema Zod car bounds varient par metric)
 *   - `url` debug-only, jamais utilisé en agg (PII potential — sanitization
 *     applicative en aval)
 *   - `priority_tier` calculé applicatif (pas envoyé par client) — voir
 *     `CwvBeaconClientPayloadSchema` ci-dessous (subset client) vs
 *     `CwvBeaconServerInsertSchema` (record DB après enrichissement)
 */
export const CwvBeaconClientPayloadSchema = z
  .object({
    session_id: z.string().min(8).max(64),
    surface: surfaceEnum,
    route_group: routeGroupEnum,
    funnel_step: funnelStepEnum,
    previous_funnel_step: funnelStepEnum.nullable(),
    url: z.string().url().max(2000),
    metric: metricNameEnum,
    value: z.number().min(0).max(60000),
    device: deviceTypeEnum,
    attribution: CwvAttributionSchema,
    nav_type: navTypeEnum,
  })
  .strict();

export type CwvBeaconClientPayload = z.infer<typeof CwvBeaconClientPayloadSchema>;

/** Server-side enrichment after UA classification + priority_tier mapping. */
export const CwvBeaconServerInsertSchema = CwvBeaconClientPayloadSchema.extend({
  priority_tier: priorityTierEnum,
  ua_class: userAgentClassEnum,
});

export type CwvBeaconServerInsert = z.infer<typeof CwvBeaconServerInsertSchema>;
