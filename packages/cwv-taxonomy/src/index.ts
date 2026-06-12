/**
 * @repo/cwv-taxonomy — Single source of truth for CWV runtime taxonomy.
 *
 * Mirror runtime de `.spec/00-canon/seo-runtime/cwv-taxonomy.yaml`. Consommé
 * par :
 *   - frontend/app/utils/web-vitals.client.ts (envoi beacon)
 *   - backend/src/modules/seo-monitoring/controllers/cwv-beacon.controller.ts
 *     (validation + classification + INSERT)
 *
 * Discipline V1A :
 *   - Enums fermés, CHECK IN au niveau DB
 *   - classifyRoute() = whitelist déterministe (jamais d'auto-discovery)
 *   - classifyUserAgent() = patterns case-insensitive (anti-pollution p75)
 *   - SoT humaine = YAML ; SoT runtime = ce package
 */

export {
  SURFACE_VALUES,
  SURFACE_DESCRIPTIONS,
  isSurface,
} from './surface';
export type { Surface } from './surface';

export {
  FUNNEL_STEP_VALUES,
  FUNNEL_STEP_ORDER,
  SURFACE_TO_FUNNEL_STEP,
  isFunnelStep,
  isValidFunnelTransition,
} from './funnel-step';
export type { FunnelStep } from './funnel-step';

export {
  PRIORITY_TIER_VALUES,
  SURFACE_TO_PRIORITY_TIER,
  isPriorityTier,
  priorityTierFromSurface,
} from './priority-tier';
export type { PriorityTier } from './priority-tier';

export {
  ROUTE_GROUP_VALUES,
  ROUTE_GROUP_TO_SURFACE,
  isRouteGroup,
  classifyRoute,
} from './route-group';
export type { RouteGroup, RouteClassification } from './route-group';

export {
  USER_AGENT_CLASS_VALUES,
  isUserAgentClass,
  classifyUserAgent,
  isBot,
} from './user-agent';
export type { UserAgentClass } from './user-agent';

export {
  METRIC_NAME_VALUES,
  DEVICE_TYPE_VALUES,
  NAV_TYPE_VALUES,
  METRIC_BOUNDS,
  isMetricName,
  isDeviceType,
  isNavType,
  rateMetric,
} from './metric';
export type { MetricName, DeviceType, NavType, MetricBounds, MetricRating } from './metric';

export {
  CwvAttributionSchema,
  CwvBeaconClientPayloadSchema,
  CwvBeaconServerInsertSchema,
} from './schema';
export type { CwvBeaconClientPayload, CwvBeaconServerInsert } from './schema';
