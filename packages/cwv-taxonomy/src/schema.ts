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
import { DEVICE_TYPE_VALUES, METRIC_BOUNDS, METRIC_NAME_VALUES, NAV_TYPE_VALUES } from './metric';
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

// Bornes des clés d'enrichissement — chacune dérive d'une borne déjà en place.
//
// Totaux LoAF et script le plus long : web-vitals additionne des frames longues
// qui recoupent l'interaction (le style/layout d'une frame y compte en entier),
// ils peuvent donc dépasser la valeur de l'INP. Aucune borne ne se déduit de
// cette valeur : même plafond de plausibilité que la métrique INP et que les
// phases existantes. Un dépassement fait refuser le beacon, compté schema_invalid.
const INP_SUBPART_MAX_MS = METRIC_BOUNDS.INP.max;
// `interactionTime` et le mark d'hydratation sont des horodatages relatifs au
// début de la navigation, pas des durées : le plafond de 60 s des phases
// rejetterait toute interaction faite après une minute de vie de la page. Seule
// borne : rester un entier exactement représentable en JSON.
const TIMESTAMP_MAX_MS = Number.MAX_SAFE_INTEGER;
// Même borne que `url` (CHECK DB `char_length(url) <= 2000`).
const URL_MAX_LENGTH = 2000;
// Même borne que les autres valeurs énumérées par le navigateur et transmises
// telles quelles (`attr_interaction_type`, `attr_load_state`) : une valeur
// nouvelle d'une version de navigateur ne fait pas rejeter tout le beacon.
const BROWSER_ENUM_MAX_LENGTH = 40;
// Forme des valeurs d'enum de la plateforme web (`visibilityState`,
// `PerformanceScriptTiming.invokerType`) et de web-vitals (`navigationType`,
// `subpart`) : minuscules séparées par des tirets. Une valeur nouvelle garde
// cette forme et reste acceptée.
const BROWSER_ENUM_TOKEN = /^[a-z]+(?:-[a-z]+)*$/;
// Schéma d'URL seul (RFC 3986 §3.1, mis en minuscules par le parseur WHATWG) :
// forme réduite d'une source de script hors web (extension, blob…).
const URL_SCHEME_ONLY = /^[a-z][a-z0-9+.-]*:$/;
// Même borne que `session_id` (CHECK DB 8..64) ; `metric.id` web-vitals = 30 car.
const CLIENT_ID_MAX_LENGTH = 64;

/** Réduction origine + chemin : jamais de query string ni de fragment. */
const hasNoQueryOrFragment = (value: string): boolean => !/[?#]/.test(value);

// URL WHATWG : global de chaque runtime qui exécute ce package (Node, navigateurs),
// absent de la lib ES à laquelle le package se limite (`lib` ES, `types: []`).
// Déclaration locale au module, réduite aux champs lus ici ; rien n'est émis.
declare const URL: new (input: string) => { readonly username: string; readonly password: string };

/** Aucun identifiant dans l'URL. Une valeur non analysable est refusée, sans lever. */
const hasNoCredentials = (value: string): boolean => {
  try {
    const u = new URL(value);
    return u.username === '' && u.password === '';
  } catch {
    return false;
  }
};

/** Valeur énumérée par le navigateur, transmise telle quelle. */
const browserEnum = z.string().max(BROWSER_ENUM_MAX_LENGTH).regex(BROWSER_ENUM_TOKEN);

/**
 * URL http(s) réduite à origine + chemin (`attr_start_url`, source de script).
 * L'hôte n'est pas contraint ici : une page hors origine canonique est comptée
 * `foreign_host` par le contrôleur, pas `schema_invalid`.
 */
const httpOriginAndPath = z
  .string()
  .url({ protocol: z.regexes.httpProtocol })
  .max(URL_MAX_LENGTH)
  .refine(hasNoQueryOrFragment)
  .refine(hasNoCredentials);

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
    // INP — Long Animation Frames (web-vitals `INPAttribution`)
    attr_total_script_duration: z.number().int().min(0).max(INP_SUBPART_MAX_MS).optional(),
    attr_total_style_layout_duration: z.number().int().min(0).max(INP_SUBPART_MAX_MS).optional(),
    attr_total_paint_duration: z.number().int().min(0).max(INP_SUBPART_MAX_MS).optional(),
    attr_total_unattributed_duration: z.number().int().min(0).max(INP_SUBPART_MAX_MS).optional(),
    attr_longest_script_src: z
      .union([z.string().max(BROWSER_ENUM_MAX_LENGTH).regex(URL_SCHEME_ONLY), httpOriginAndPath])
      .optional(),
    attr_longest_script_invoker_type: browserEnum.optional(),
    attr_longest_script_subpart: browserEnum.optional(),
    attr_longest_script_intersecting_duration: z
      .number()
      .int()
      .min(0)
      .max(INP_SUBPART_MAX_MS)
      .optional(),
    // INP — situer le tap dans la vie de la page (avant / après hydratation)
    attr_interaction_time: z.number().int().min(0).max(TIMESTAMP_MAX_MS).optional(),
    attr_hydrated_at: z.number().int().min(0).max(TIMESTAMP_MAX_MS).optional(),
    // Contexte du report — toutes métriques
    attr_metric_id: z.string().min(1).max(CLIENT_ID_MAX_LENGTH).optional(),
    attr_visibility_state: browserEnum.optional(),
    // Valeur web-vitals brute : garde `back-forward-cache`, que `nav_type` range en `unknown`.
    attr_navigation_type: browserEnum.optional(),
    attr_start_url: httpOriginAndPath.optional(),
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
