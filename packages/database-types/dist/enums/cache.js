import { z } from 'zod';
export const CacheTypeSchema = z.enum([
    'memory',
    'redis',
    'file',
    'database',
    'cdn',
    'none',
]);
export const CACHE_TYPE_LABELS = {
    memory: 'Memoire locale',
    redis: 'Redis',
    file: 'Fichier',
    database: 'Base de donnees',
    cdn: 'CDN',
    none: 'Aucun cache',
};
export const CacheTTLPresetSchema = z.enum([
    'short',
    'medium',
    'long',
    'day',
    'week',
    'month',
    'permanent',
]);
export const CACHE_TTL_SECONDS = {
    short: 60,
    medium: 300,
    long: 3600,
    day: 86400,
    week: 604800,
    month: 2592000,
    permanent: 0,
};
export const CACHE_TTL_LABELS = {
    short: '1 minute',
    medium: '5 minutes',
    long: '1 heure',
    day: '24 heures',
    week: '7 jours',
    month: '30 jours',
    permanent: 'Permanent',
};
export const CacheStrategySchema = z.enum([
    'cache-first',
    'network-first',
    'stale-while-revalidate',
    'cache-only',
    'network-only',
]);
export const CACHE_STRATEGY_LABELS = {
    'cache-first': 'Cache First',
    'network-first': 'Network First',
    'stale-while-revalidate': 'Stale While Revalidate',
    'cache-only': 'Cache Only',
    'network-only': 'Network Only',
};
export const CacheInvalidationReasonSchema = z.enum([
    'expired',
    'manual',
    'data_change',
    'full_purge',
    'tag_purge',
    'memory_pressure',
]);
//# sourceMappingURL=cache.js.map