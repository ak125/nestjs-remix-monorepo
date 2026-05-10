/**
 * @repo/seo-types
 *
 * Shared SEO types and Zod schemas for the SEO department modules.
 *
 * Five domains, one barrel each :
 *  - observability  : GSC, GA4, CWV, indexation, GSC links
 *  - onpage         : audit findings (schema, image, canonical, meta A/B, internal links)
 *  - intelligence   : event log, anomalies, alerts, ingestion runs, forecasts
 *  - geo-aeo        : E-E-A-T, Helpful Content, answer-engine format suggestions
 *  - content-ops    : editorial calendar, freshness rotation
 *
 * Designed to mirror the lean DB layout :
 *  - 4 time-series tables (gsc_daily, ga4_daily, cwv_daily, gsc_links_weekly)
 *  - 1 unified findings table (__seo_audit_findings, ENUM-typed payloads)
 *  - 1 unified event log (__seo_event_log, ENUM-typed payloads)
 *  - 1 editorial calendar (__seo_editorial_calendar, workflow state machine)
 *  - 4 JSONB columns ALTER TABLE on existing __seo_entity_health
 *
 * Use discriminated unions to type the JSONB payloads at the API boundary
 * (Zod schemas guarantee runtime safety in NestJS controllers and Remix loaders).
 *
 * @example Usage in NestJS controller
 *   import { AuditFindingSchema } from "@repo/seo-types/onpage";
 *   const finding = AuditFindingSchema.parse(rowFromDB);
 *
 * @example Usage in Remix loader
 *   import { GSCTimeseriesResponseSchema } from "@repo/seo-types/observability";
 *   return json(GSCTimeseriesResponseSchema.parse(apiResponse));
 */

export * from "./observability";
export * from "./onpage";
export * from "./intelligence";
export * from "./geo-aeo";
export * from "./content-ops";
