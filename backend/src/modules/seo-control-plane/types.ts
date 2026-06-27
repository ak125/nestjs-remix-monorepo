/**
 * SEO Production Control Plane — shared types.
 *
 * ADR-064 §Architecture 4-layer. PR-2A-1 Synthetic Crawler scope.
 *
 * Discipline : aucun type runtime ne dépend de L2/L3/L4. Types L1 ne sont
 * pas dérivés du Zod schema `@repo/registry` SeoCriticalitySchema (couplage
 * direct → import L4 OK car L4 = governance config read-only).
 */

import type { TierId } from '@repo/registry';

/** Origine du déclenchement du run (audit-trail). */
export type SyntheticRunTrigger = 'scheduler' | 'manual' | 'test';

/** Identifiant identifiable obligatoire — JAMAIS spoof Googlebot. */
export const SYNTHETIC_USER_AGENT =
  'AutoMecanikSyntheticBot/1.0 (+https://www.automecanik.com/bots/synthetic)';

// NOTE: the synthetic crawler no longer carries a rate-limit exemption. The
// former HMAC header (x-synthetic-probe) + egress-IP floor + isSyntheticExemptPath
// scope were retired (PR2): the CDN strips the custom header, an IP allowlist
// weakens a security control, and the crawler now self-paces (PR #1161,
// SEO_CP_MAX_RPM) to stay under the throttler — the structural fix at the source.

/**
 * Entrée de seed-list pour un crawl R8/R2 ciblé (D-0 baseline).
 *
 * Le crawl planifié (q15min) est échantillonné par tier : `pieces/*` et
 * `constructeurs/*` partagent le budget tier0 et `pieces/*` (~100×) affame
 * `constructeurs/*` (~3 URL/run). Pour produire une baseline R8 exploitable, un
 * run en mode seed-list crawle EXHAUSTIVEMENT la liste fournie (pas d'échantillon).
 * Les ids catalogue optionnels sont reportés tels quels dans le snapshot.
 */
export interface SyntheticSeedEntry {
  url: string;
  pgId?: number | null; // gamme id (R2)
  typeId?: number | null; // auto_type id (R8/R2)
  modeleId?: number | null; // auto_modele id (clé de regroupement sœurs)
}

/** Payload du job BullMQ `seo-cp-synthetic-crawl`. */
export interface SyntheticCrawlJobData {
  triggeredBy: SyntheticRunTrigger;
  sampleSize?: number; // override default
  seed?: number; // override default (= unix ms)
  /**
   * Mode seed-list (D-0) : si présent et non vide, le run crawle ces URLs
   * exhaustivement (bypass sitemap + stratification). Sinon, crawl échantillonné
   * habituel. Borné par l'appelant (taille de la liste).
   */
  seedEntries?: SyntheticSeedEntry[];
}

/** Observation HTTP+HTML d'une URL — 1 row par INSERT dans __seo_snapshot_synthetic. */
export interface SyntheticSnapshot {
  url: string;
  route_path: string;
  tier: TierId; // 'tier0' | 'tier1' | 'tier2'
  // Ids catalogue (D-0) — null hors mode seed-list (le crawl sitemap n'a que l'URL).
  pg_id: number | null;
  type_id: number | null;
  modele_id: number | null;
  http_code: number;
  ttfb_ms: number;
  content_length: number | null;
  cache_control: string | null;
  cf_cache_status: string | null;
  cf_ray: string | null;
  age_seconds: number | null;
  has_title: boolean | null;
  title_text: string | null;
  has_h1: boolean | null;
  h1_text: string | null;
  has_canonical: boolean | null;
  canonical_url: string | null;
  robots_meta: string | null;
  x_robots_tag: string | null;
  // Balises émises (D-0) — meta-description + Open Graph capturés du <head>.
  meta_description: string | null;
  has_meta_description: boolean | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  og_url: string | null;
  has_og: boolean | null;
  error_kind: 'timeout' | 'network' | 'parse' | null;
  error_message: string | null;
  run_id: string; // UUID v4
  seed: number;
  user_agent: string;
  created_at: string; // ISO timestamp
}

/** Résultat agrégé d'un run, retourné par le processor. */
export interface SyntheticRunResult {
  run_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  triggered_by: SyntheticRunTrigger;
  sample_size_requested: number;
  sample_size_effective: number;
  seed: number;
  totals: {
    http_2xx: number;
    http_3xx: number;
    http_4xx: number;
    http_5xx: number;
    error: number;
  };
  by_tier: Record<TierId, { probed: number; rate_5xx: number }>;
  skipped?: 'read_only' | 'disabled' | 'no_sitemap';
  errorMessage?: string;
}

export const SYNTHETIC_CRAWL_JOB_NAME = 'seo-cp-synthetic-crawl';
export const SYNTHETIC_CRAWL_JOB_ID = 'seo-cp-synthetic-crawl-q15min';
export const SYNTHETIC_QUEUE_NAME = 'seo-crawler-monitor';
