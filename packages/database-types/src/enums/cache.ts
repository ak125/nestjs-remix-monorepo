/**
 * Cache Enums
 *
 * Enums for cache-related configuration
 *
 * @version 2.0.0
 * @package @repo/database-types
 */

import { z } from 'zod';

// ====================================
// CACHE TYPE
// ====================================

export const CacheTypeSchema = z.enum([
  'memory',
  'redis',
  'file',
  'database',
  'cdn',
  'none',
]);

export type CacheType = z.infer<typeof CacheTypeSchema>;

export const CACHE_TYPE_LABELS = {
  memory: 'Memoire locale',
  redis: 'Redis',
  file: 'Fichier',
  database: 'Base de donnees',
  cdn: 'CDN',
  none: 'Aucun cache',
} as const;

// ====================================
// CACHE TTL PRESETS
// ====================================

export const CacheTTLPresetSchema = z.enum([
  'short',
  'medium',
  'long',
  'day',
  'week',
  'month',
  'permanent',
]);

export type CacheTTLPreset = z.infer<typeof CacheTTLPresetSchema>;

/**
 * Cache TTL values in seconds
 */
export const CACHE_TTL_SECONDS = {
  short: 60, // 1 minute
  medium: 300, // 5 minutes
  long: 3600, // 1 hour
  day: 86400, // 24 hours
  week: 604800, // 7 days
  month: 2592000, // 30 days
  permanent: 0, // No expiry
} as const;

export const CACHE_TTL_LABELS = {
  short: '1 minute',
  medium: '5 minutes',
  long: '1 heure',
  day: '24 heures',
  week: '7 jours',
  month: '30 jours',
  permanent: 'Permanent',
} as const;

// ====================================
// CACHE STRATEGY
// ====================================

export const CacheStrategySchema = z.enum([
  'cache-first',
  'network-first',
  'stale-while-revalidate',
  'cache-only',
  'network-only',
]);

export type CacheStrategy = z.infer<typeof CacheStrategySchema>;

export const CACHE_STRATEGY_LABELS = {
  'cache-first': 'Cache First',
  'network-first': 'Network First',
  'stale-while-revalidate': 'Stale While Revalidate',
  'cache-only': 'Cache Only',
  'network-only': 'Network Only',
} as const;

// ====================================
// CACHE INVALIDATION REASON
// ====================================

export const CacheInvalidationReasonSchema = z.enum([
  'expired',
  'manual',
  'data_change',
  'full_purge',
  'tag_purge',
  'memory_pressure',
]);

export type CacheInvalidationReason = z.infer<
  typeof CacheInvalidationReasonSchema
>;
