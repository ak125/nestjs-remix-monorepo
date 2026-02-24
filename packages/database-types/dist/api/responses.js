import { z } from 'zod';
export const PerformanceMetadataSchema = z.object({
    startTime: z.number().int().positive(),
    endTime: z.number().int().positive(),
    duration: z.string(),
    durationMs: z.number().nonnegative(),
    cacheHit: z.boolean().optional(),
    cacheKey: z.string().optional(),
    queries: z.number().int().nonnegative().optional(),
    memoryUsage: z
        .object({
        used: z.number().nonnegative(),
        total: z.number().nonnegative(),
        percentage: z.number().nonnegative(),
    })
        .optional(),
});
export const RequestMetadataSchema = z.object({
    requestId: z.string(),
    timestamp: z.string().datetime(),
    version: z.string().default('2.0.0'),
    source: z.enum(['web', 'mobile', 'api', 'cron', 'test']).default('web'),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    performance: PerformanceMetadataSchema.optional(),
});
export const ApiErrorSchema = z.object({
    code: z.string(),
    message: z.string(),
    details: z.string().optional(),
    field: z.string().optional(),
    stack: z.string().optional(),
    timestamp: z
        .string()
        .datetime()
        .default(() => new Date().toISOString()),
    requestId: z.string().optional(),
});
export const PaginationInfoSchema = z.object({
    page: z.number().int().nonnegative().default(0),
    limit: z.number().int().positive().default(20),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    startIndex: z.number().int().nonnegative(),
    endIndex: z.number().int().nonnegative(),
});
export const PaginationOptionsSchema = z.object({
    page: z.number().int().nonnegative().default(0),
    limit: z.number().int().positive().max(100).default(20),
    offset: z.number().int().nonnegative().optional(),
});
export const ApiResponseSchema = (dataSchema) => z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ApiErrorSchema.optional(),
    errors: z.array(ApiErrorSchema).optional(),
    message: z.string().optional(),
    metadata: RequestMetadataSchema.optional(),
    pagination: PaginationInfoSchema.optional(),
    cache: z
        .object({
        hit: z.boolean(),
        key: z.string().optional(),
        ttl: z.number().int().positive().optional(),
        generatedAt: z.string().datetime().optional(),
    })
        .optional(),
    warnings: z
        .array(z.object({
        code: z.string(),
        message: z.string(),
        field: z.string().optional(),
    }))
        .optional(),
});
export const PaginatedResponseSchema = (itemSchema) => z.object({
    success: z.boolean(),
    data: z.array(itemSchema).default([]),
    pagination: PaginationInfoSchema,
    metadata: RequestMetadataSchema.optional(),
    cache: z
        .object({
        hit: z.boolean(),
        key: z.string().optional(),
        ttl: z.number().int().positive().optional(),
    })
        .optional(),
    filters: z.record(z.any()).optional(),
    sort: z
        .object({
        field: z.string(),
        order: z.enum(['asc', 'desc']),
    })
        .optional(),
});
export const SearchResponseSchema = (itemSchema) => z.object({
    success: z.boolean(),
    data: z.array(itemSchema).default([]),
    query: z.string(),
    suggestions: z.array(z.string()).optional(),
    facets: z
        .record(z.array(z.object({
        value: z.string(),
        count: z.number().int().nonnegative(),
    })))
        .optional(),
    pagination: PaginationInfoSchema,
    metadata: RequestMetadataSchema.optional(),
    searchMetadata: z
        .object({
        totalHits: z.number().int().nonnegative(),
        maxScore: z.number().nonnegative().optional(),
        searchTime: z.number().nonnegative(),
        engine: z.string().optional(),
    })
        .optional(),
});
export const ValidationResponseSchema = z.object({
    success: z.boolean(),
    valid: z.boolean(),
    errors: z
        .array(z.object({
        field: z.string(),
        message: z.string(),
        code: z.string(),
        value: z.any().optional(),
    }))
        .default([]),
    warnings: z
        .array(z.object({
        field: z.string(),
        message: z.string(),
        code: z.string(),
    }))
        .default([]),
    metadata: RequestMetadataSchema.optional(),
});
export const SortOptionsSchema = z.object({
    field: z.string(),
    order: z.enum(['asc', 'desc']).default('asc'),
    nullsLast: z.boolean().default(true),
});
export const CacheOptionsSchema = z.object({
    ttl: z.number().int().positive().default(300),
    key: z.string().optional(),
    tags: z.array(z.string()).default([]),
    bypass: z.boolean().default(false),
    refresh: z.boolean().default(false),
});
export const QueryOptionsSchema = z.object({
    pagination: PaginationOptionsSchema.optional(),
    sort: z.array(SortOptionsSchema).optional(),
    cache: CacheOptionsSchema.optional(),
    include: z.array(z.string()).optional(),
    fields: z.array(z.string()).optional(),
    filters: z.record(z.any()).optional(),
    search: z.string().optional(),
});
export function createSuccessResponse(data, message, metadata) {
    return {
        success: true,
        data,
        message,
        metadata: metadata,
    };
}
export function createErrorResponse(error, code, metadata) {
    const apiError = typeof error === 'string'
        ? {
            code: code || 'UNKNOWN_ERROR',
            message: error,
            timestamp: new Date().toISOString(),
        }
        : error;
    return {
        success: false,
        error: apiError,
        metadata: metadata,
    };
}
export function createAdminSuccessResponse(data, meta) {
    return {
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            freshness: 'live',
            ...meta,
        },
    };
}
export function createAdminErrorResponse(error, meta) {
    return {
        success: false,
        error,
        meta: {
            timestamp: new Date().toISOString(),
            ...meta,
        },
    };
}
export function normalizePaginationOptions(options) {
    const validated = PaginationOptionsSchema.parse(options || {});
    if (validated.offset === undefined) {
        validated.offset = validated.page * validated.limit;
    }
    return validated;
}
export function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
//# sourceMappingURL=responses.js.map