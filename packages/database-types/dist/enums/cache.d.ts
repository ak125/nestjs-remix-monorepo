import { z } from 'zod';
export declare const CacheTypeSchema: z.ZodEnum<["memory", "redis", "file", "database", "cdn", "none"]>;
export type CacheType = z.infer<typeof CacheTypeSchema>;
export declare const CACHE_TYPE_LABELS: {
    readonly memory: "Memoire locale";
    readonly redis: "Redis";
    readonly file: "Fichier";
    readonly database: "Base de donnees";
    readonly cdn: "CDN";
    readonly none: "Aucun cache";
};
export declare const CacheTTLPresetSchema: z.ZodEnum<["short", "medium", "long", "day", "week", "month", "permanent"]>;
export type CacheTTLPreset = z.infer<typeof CacheTTLPresetSchema>;
export declare const CACHE_TTL_SECONDS: {
    readonly short: 60;
    readonly medium: 300;
    readonly long: 3600;
    readonly day: 86400;
    readonly week: 604800;
    readonly month: 2592000;
    readonly permanent: 0;
};
export declare const CACHE_TTL_LABELS: {
    readonly short: "1 minute";
    readonly medium: "5 minutes";
    readonly long: "1 heure";
    readonly day: "24 heures";
    readonly week: "7 jours";
    readonly month: "30 jours";
    readonly permanent: "Permanent";
};
export declare const CacheStrategySchema: z.ZodEnum<["cache-first", "network-first", "stale-while-revalidate", "cache-only", "network-only"]>;
export type CacheStrategy = z.infer<typeof CacheStrategySchema>;
export declare const CACHE_STRATEGY_LABELS: {
    readonly 'cache-first': "Cache First";
    readonly 'network-first': "Network First";
    readonly 'stale-while-revalidate': "Stale While Revalidate";
    readonly 'cache-only': "Cache Only";
    readonly 'network-only': "Network Only";
};
export declare const CacheInvalidationReasonSchema: z.ZodEnum<["expired", "manual", "data_change", "full_purge", "tag_purge", "memory_pressure"]>;
export type CacheInvalidationReason = z.infer<typeof CacheInvalidationReasonSchema>;
//# sourceMappingURL=cache.d.ts.map