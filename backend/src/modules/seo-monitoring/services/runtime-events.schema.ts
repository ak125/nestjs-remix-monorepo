/**
 * Runtime Events Schema — Zod validation for POST /api/seo/runtime-event.
 *
 * Réutilise enums @repo/cwv-taxonomy (Surface/RouteGroup/PriorityTier/DeviceType/
 * UserAgentClass) pour alignement strict avec __seo_cwv_raw + classifyRoute().
 */
import { z } from 'zod';
import {
  DEVICE_TYPE_VALUES,
  ROUTE_GROUP_VALUES,
  SURFACE_VALUES,
  PRIORITY_TIER_VALUES,
  USER_AGENT_CLASS_VALUES,
} from '@repo/cwv-taxonomy';

export const RUNTIME_EVENT_TYPE_VALUES = [
  'seo.runtime.hydration_error',
  'seo.runtime.long_task',
  'seo.runtime.navigation_abort',
  'seo.runtime.chunk_load_error',
] as const;

export type RuntimeEventType = (typeof RUNTIME_EVENT_TYPE_VALUES)[number];

export const RuntimeEventInputSchema = z
  .object({
    event_type: z.enum(RUNTIME_EVENT_TYPE_VALUES),
    surface: z.enum(SURFACE_VALUES),
    route_group: z.enum(ROUTE_GROUP_VALUES),
    priority_tier: z.enum(PRIORITY_TIER_VALUES),
    device: z.enum(DEVICE_TYPE_VALUES),
    ua_class: z.enum(USER_AGENT_CLASS_VALUES),
    url: z.string().url().max(2000),
    session_id: z.string().min(8).max(64).optional(),
    message: z.string().max(500).optional(),
    // Métadonnées spécifiques par event_type (longtask.duration, chunk.asset, ...)
    // — borné JSON ~2KB. Free-form intentionnel (champs varient par event).
    meta: z.record(z.unknown()).optional(),
  })
  .strict();

export type RuntimeEventInput = z.infer<typeof RuntimeEventInputSchema>;
