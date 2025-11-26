"use strict";
/**
 * 🌐 TYPES API UNIFIÉS
 *
 * Types génériques pour les réponses d'API REST
 * Pattern unifié pour toutes les endpoints du monorepo
 *
 * @version 2.0.0
 * @package @monorepo/shared-types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorReportSchema = exports.PerformanceMetricsSchema = exports.AuthResponseSchema = exports.QueryOptionsSchema = exports.CacheOptionsSchema = exports.SortOptionsSchema = exports.PaginationOptionsSchema = exports.ValidationResponseSchema = exports.SearchResponseSchema = exports.PaginatedResponseSchema = exports.ApiResponseSchema = exports.PaginationInfoSchema = exports.ApiErrorSchema = exports.RequestMetadataSchema = exports.PerformanceMetadataSchema = void 0;
exports.createSuccessResponse = createSuccessResponse;
exports.createErrorResponse = createErrorResponse;
exports.normalizePaginationOptions = normalizePaginationOptions;
exports.generateRequestId = generateRequestId;
const zod_1 = require("zod");
// ====================================
// 🚀 RÉPONSE API GÉNÉRIQUE
// ====================================
/**
 * Schema pour les métadonnées de performance
 */
exports.PerformanceMetadataSchema = zod_1.z.object({
    startTime: zod_1.z.number().int().positive(),
    endTime: zod_1.z.number().int().positive(),
    duration: zod_1.z.string(),
    durationMs: zod_1.z.number().nonnegative(),
    cacheHit: zod_1.z.boolean().optional(),
    cacheKey: zod_1.z.string().optional(),
    queries: zod_1.z.number().int().nonnegative().optional(),
    memoryUsage: zod_1.z.object({
        used: zod_1.z.number().nonnegative(),
        total: zod_1.z.number().nonnegative(),
        percentage: zod_1.z.number().nonnegative(),
    }).optional(),
});
/**
 * Schema pour les métadonnées de requête
 */
exports.RequestMetadataSchema = zod_1.z.object({
    requestId: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    version: zod_1.z.string().default('2.0.0'),
    source: zod_1.z.enum(['web', 'mobile', 'api', 'cron', 'test']).default('web'),
    userAgent: zod_1.z.string().optional(),
    ipAddress: zod_1.z.string().optional(),
    // Informations de contexte
    userId: zod_1.z.string().optional(),
    sessionId: zod_1.z.string().optional(),
    // Métadonnées de performance
    performance: exports.PerformanceMetadataSchema.optional(),
});
/**
 * Schema pour les erreurs API
 */
exports.ApiErrorSchema = zod_1.z.object({
    code: zod_1.z.string(),
    message: zod_1.z.string(),
    details: zod_1.z.string().optional(),
    field: zod_1.z.string().optional(), // Pour erreurs de validation
    stack: zod_1.z.string().optional(), // En développement seulement
    timestamp: zod_1.z.string().datetime().default(() => new Date().toISOString()),
    requestId: zod_1.z.string().optional(),
});
/**
 * Schema pour les informations de pagination
 */
exports.PaginationInfoSchema = zod_1.z.object({
    page: zod_1.z.number().int().nonnegative().default(0),
    limit: zod_1.z.number().int().positive().default(20),
    total: zod_1.z.number().int().nonnegative(),
    totalPages: zod_1.z.number().int().nonnegative(),
    hasNext: zod_1.z.boolean(),
    hasPrev: zod_1.z.boolean(),
    // Informations additionnelles
    startIndex: zod_1.z.number().int().nonnegative(),
    endIndex: zod_1.z.number().int().nonnegative(),
});
/**
 * Schema générique pour les réponses d'API
 */
const ApiResponseSchema = (dataSchema) => zod_1.z.object({
    success: zod_1.z.boolean(),
    data: dataSchema.optional(),
    error: exports.ApiErrorSchema.optional(),
    errors: zod_1.z.array(exports.ApiErrorSchema).optional(),
    message: zod_1.z.string().optional(),
    // Métadonnées
    metadata: exports.RequestMetadataSchema.optional(),
    // Pagination (pour les listes)
    pagination: exports.PaginationInfoSchema.optional(),
    // Informations de cache
    cache: zod_1.z.object({
        hit: zod_1.z.boolean(),
        key: zod_1.z.string().optional(),
        ttl: zod_1.z.number().int().positive().optional(),
        generatedAt: zod_1.z.string().datetime().optional(),
    }).optional(),
    // Warnings non-bloquants
    warnings: zod_1.z.array(zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
        field: zod_1.z.string().optional(),
    })).optional(),
});
exports.ApiResponseSchema = ApiResponseSchema;
// ====================================
// 📋 RÉPONSES SPÉCIALISÉES
// ====================================
/**
 * Schema pour les réponses de liste paginée
 */
const PaginatedResponseSchema = (itemSchema) => zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.array(itemSchema).default([]),
    pagination: exports.PaginationInfoSchema,
    metadata: exports.RequestMetadataSchema.optional(),
    cache: zod_1.z.object({
        hit: zod_1.z.boolean(),
        key: zod_1.z.string().optional(),
        ttl: zod_1.z.number().int().positive().optional(),
    }).optional(),
    filters: zod_1.z.record(zod_1.z.any()).optional(), // Filtres appliqués
    sort: zod_1.z.object({
        field: zod_1.z.string(),
        order: zod_1.z.enum(['asc', 'desc']),
    }).optional(),
});
exports.PaginatedResponseSchema = PaginatedResponseSchema;
/**
 * Schema pour les réponses de recherche
 */
const SearchResponseSchema = (itemSchema) => zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.array(itemSchema).default([]),
    query: zod_1.z.string(),
    suggestions: zod_1.z.array(zod_1.z.string()).optional(),
    facets: zod_1.z.record(zod_1.z.array(zod_1.z.object({
        value: zod_1.z.string(),
        count: zod_1.z.number().int().nonnegative(),
    }))).optional(),
    pagination: exports.PaginationInfoSchema,
    metadata: exports.RequestMetadataSchema.optional(),
    searchMetadata: zod_1.z.object({
        totalHits: zod_1.z.number().int().nonnegative(),
        maxScore: zod_1.z.number().nonnegative().optional(),
        searchTime: zod_1.z.number().nonnegative(),
        engine: zod_1.z.string().optional(), // 'elasticsearch', 'supabase', etc.
    }).optional(),
});
exports.SearchResponseSchema = SearchResponseSchema;
/**
 * Schema pour les réponses de validation
 */
exports.ValidationResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    valid: zod_1.z.boolean(),
    errors: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        message: zod_1.z.string(),
        code: zod_1.z.string(),
        value: zod_1.z.any().optional(),
    })).default([]),
    warnings: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        message: zod_1.z.string(),
        code: zod_1.z.string(),
    })).default([]),
    metadata: exports.RequestMetadataSchema.optional(),
});
// ====================================
// ⚙️ OPTIONS DE REQUÊTE
// ====================================
/**
 * Schema pour les options de pagination
 */
exports.PaginationOptionsSchema = zod_1.z.object({
    page: zod_1.z.number().int().nonnegative().default(0),
    limit: zod_1.z.number().int().positive().max(100).default(20),
    offset: zod_1.z.number().int().nonnegative().optional(), // Calculé automatiquement si non fourni
});
/**
 * Schema pour les options de tri
 */
exports.SortOptionsSchema = zod_1.z.object({
    field: zod_1.z.string(),
    order: zod_1.z.enum(['asc', 'desc']).default('asc'),
    nullsLast: zod_1.z.boolean().default(true),
});
/**
 * Schema pour les options de cache
 */
exports.CacheOptionsSchema = zod_1.z.object({
    ttl: zod_1.z.number().int().positive().default(300), // 5 minutes
    key: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    bypass: zod_1.z.boolean().default(false),
    refresh: zod_1.z.boolean().default(false),
});
/**
 * Schema pour les options génériques de requête
 */
exports.QueryOptionsSchema = zod_1.z.object({
    pagination: exports.PaginationOptionsSchema.optional(),
    sort: zod_1.z.array(exports.SortOptionsSchema).optional(),
    cache: exports.CacheOptionsSchema.optional(),
    include: zod_1.z.array(zod_1.z.string()).optional(), // Relations à inclure
    fields: zod_1.z.array(zod_1.z.string()).optional(), // Champs à sélectionner
    filters: zod_1.z.record(zod_1.z.any()).optional(),
    search: zod_1.z.string().optional(),
});
// ====================================
// 🔐 TYPES D'AUTHENTIFICATION
// ====================================
/**
 * Schema pour les réponses d'authentification
 */
exports.AuthResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    authenticated: zod_1.z.boolean(),
    user: zod_1.z.object({
        id: zod_1.z.string(),
        email: zod_1.z.string(),
        name: zod_1.z.string().optional(),
        roles: zod_1.z.array(zod_1.z.string()).default([]),
        permissions: zod_1.z.array(zod_1.z.string()).default([]),
    }).optional(),
    token: zod_1.z.string().optional(),
    refreshToken: zod_1.z.string().optional(),
    expiresAt: zod_1.z.string().datetime().optional(),
    metadata: exports.RequestMetadataSchema.optional(),
});
// ====================================
// 📊 TYPES DE MONITORING
// ====================================
/**
 * Schema pour les métriques de performance
 */
exports.PerformanceMetricsSchema = zod_1.z.object({
    endpoint: zod_1.z.string(),
    method: zod_1.z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    responseTime: zod_1.z.number().nonnegative(),
    statusCode: zod_1.z.number().int().min(100).max(599),
    memoryUsage: zod_1.z.number().nonnegative(),
    cpuUsage: zod_1.z.number().nonnegative().optional(),
    cacheHit: zod_1.z.boolean().optional(),
    queriesCount: zod_1.z.number().int().nonnegative().optional(),
    timestamp: zod_1.z.string().datetime(),
});
/**
 * Schema pour les rapports d'erreur
 */
exports.ErrorReportSchema = zod_1.z.object({
    id: zod_1.z.string(),
    message: zod_1.z.string(),
    stack: zod_1.z.string().optional(),
    context: zod_1.z.object({
        endpoint: zod_1.z.string(),
        method: zod_1.z.string(),
        userId: zod_1.z.string().optional(),
        userAgent: zod_1.z.string().optional(),
        timestamp: zod_1.z.string().datetime(),
    }),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
    resolved: zod_1.z.boolean().default(false),
    resolvedAt: zod_1.z.string().datetime().optional(),
});
// ====================================
// 🧪 FONCTIONS UTILITAIRES
// ====================================
/**
 * Crée une réponse de succès standardisée
 */
function createSuccessResponse(data, message, metadata) {
    return {
        success: true,
        data,
        message,
        metadata: metadata,
    };
}
/**
 * Crée une réponse d'erreur standardisée
 */
function createErrorResponse(error, code, metadata) {
    const apiError = typeof error === 'string'
        ? { code: code || 'UNKNOWN_ERROR', message: error, timestamp: new Date().toISOString() }
        : error;
    return {
        success: false,
        error: apiError,
        metadata: metadata,
    };
}
/**
 * Valide et transforme les options de pagination
 */
function normalizePaginationOptions(options) {
    const validated = exports.PaginationOptionsSchema.parse(options || {});
    // Calcul automatique de l'offset si non fourni
    if (validated.offset === undefined) {
        validated.offset = validated.page * validated.limit;
    }
    return validated;
}
/**
 * Génère un ID de requête unique
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
//# sourceMappingURL=api.types.js.map