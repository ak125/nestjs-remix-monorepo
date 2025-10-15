/**
 * 🌐 TYPES API UNIFIÉS
 *
 * Types génériques pour les réponses d'API REST
 * Pattern unifié pour toutes les endpoints du monorepo
 *
 * @version 2.0.0
 * @package @monorepo/shared-types
 */
import { z } from 'zod';
/**
 * Schema pour les métadonnées de performance
 */
export declare const PerformanceMetadataSchema: z.ZodObject<{
    startTime: z.ZodNumber;
    endTime: z.ZodNumber;
    duration: z.ZodString;
    durationMs: z.ZodNumber;
    cacheHit: z.ZodOptional<z.ZodBoolean>;
    cacheKey: z.ZodOptional<z.ZodString>;
    queries: z.ZodOptional<z.ZodNumber>;
    memoryUsage: z.ZodOptional<z.ZodObject<{
        used: z.ZodNumber;
        total: z.ZodNumber;
        percentage: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        used: number;
        total: number;
        percentage: number;
    }, {
        used: number;
        total: number;
        percentage: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    startTime: number;
    endTime: number;
    duration: string;
    durationMs: number;
    cacheHit?: boolean | undefined;
    cacheKey?: string | undefined;
    queries?: number | undefined;
    memoryUsage?: {
        used: number;
        total: number;
        percentage: number;
    } | undefined;
}, {
    startTime: number;
    endTime: number;
    duration: string;
    durationMs: number;
    cacheHit?: boolean | undefined;
    cacheKey?: string | undefined;
    queries?: number | undefined;
    memoryUsage?: {
        used: number;
        total: number;
        percentage: number;
    } | undefined;
}>;
export type PerformanceMetadata = z.infer<typeof PerformanceMetadataSchema>;
/**
 * Schema pour les métadonnées de requête
 */
export declare const RequestMetadataSchema: z.ZodObject<{
    requestId: z.ZodString;
    timestamp: z.ZodString;
    version: z.ZodDefault<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["web", "mobile", "api", "cron", "test"]>>;
    userAgent: z.ZodOptional<z.ZodString>;
    ipAddress: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    performance: z.ZodOptional<z.ZodObject<{
        startTime: z.ZodNumber;
        endTime: z.ZodNumber;
        duration: z.ZodString;
        durationMs: z.ZodNumber;
        cacheHit: z.ZodOptional<z.ZodBoolean>;
        cacheKey: z.ZodOptional<z.ZodString>;
        queries: z.ZodOptional<z.ZodNumber>;
        memoryUsage: z.ZodOptional<z.ZodObject<{
            used: z.ZodNumber;
            total: z.ZodNumber;
            percentage: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            used: number;
            total: number;
            percentage: number;
        }, {
            used: number;
            total: number;
            percentage: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        startTime: number;
        endTime: number;
        duration: string;
        durationMs: number;
        cacheHit?: boolean | undefined;
        cacheKey?: string | undefined;
        queries?: number | undefined;
        memoryUsage?: {
            used: number;
            total: number;
            percentage: number;
        } | undefined;
    }, {
        startTime: number;
        endTime: number;
        duration: string;
        durationMs: number;
        cacheHit?: boolean | undefined;
        cacheKey?: string | undefined;
        queries?: number | undefined;
        memoryUsage?: {
            used: number;
            total: number;
            percentage: number;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    requestId: string;
    timestamp: string;
    version: string;
    source: "web" | "mobile" | "api" | "cron" | "test";
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    userId?: string | undefined;
    sessionId?: string | undefined;
    performance?: {
        startTime: number;
        endTime: number;
        duration: string;
        durationMs: number;
        cacheHit?: boolean | undefined;
        cacheKey?: string | undefined;
        queries?: number | undefined;
        memoryUsage?: {
            used: number;
            total: number;
            percentage: number;
        } | undefined;
    } | undefined;
}, {
    requestId: string;
    timestamp: string;
    version?: string | undefined;
    source?: "web" | "mobile" | "api" | "cron" | "test" | undefined;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    userId?: string | undefined;
    sessionId?: string | undefined;
    performance?: {
        startTime: number;
        endTime: number;
        duration: string;
        durationMs: number;
        cacheHit?: boolean | undefined;
        cacheKey?: string | undefined;
        queries?: number | undefined;
        memoryUsage?: {
            used: number;
            total: number;
            percentage: number;
        } | undefined;
    } | undefined;
}>;
export type RequestMetadata = z.infer<typeof RequestMetadataSchema>;
/**
 * Schema pour les erreurs API
 */
export declare const ApiErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodString>;
    field: z.ZodOptional<z.ZodString>;
    stack: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDefault<z.ZodString>;
    requestId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    timestamp: string;
    requestId?: string | undefined;
    details?: string | undefined;
    field?: string | undefined;
    stack?: string | undefined;
}, {
    code: string;
    message: string;
    requestId?: string | undefined;
    timestamp?: string | undefined;
    details?: string | undefined;
    field?: string | undefined;
    stack?: string | undefined;
}>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
/**
 * Schema pour les informations de pagination
 */
export declare const PaginationInfoSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    total: z.ZodNumber;
    totalPages: z.ZodNumber;
    hasNext: z.ZodBoolean;
    hasPrev: z.ZodBoolean;
    startIndex: z.ZodNumber;
    endIndex: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    startIndex: number;
    endIndex: number;
}, {
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    startIndex: number;
    endIndex: number;
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type PaginationInfo = z.infer<typeof PaginationInfoSchema>;
/**
 * Schema générique pour les réponses d'API
 */
export declare const ApiResponseSchema: <T extends z.ZodTypeAny>(dataSchema: T) => z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodString>;
        field: z.ZodOptional<z.ZodString>;
        stack: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodDefault<z.ZodString>;
        requestId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        timestamp: string;
        requestId?: string | undefined;
        details?: string | undefined;
        field?: string | undefined;
        stack?: string | undefined;
    }, {
        code: string;
        message: string;
        requestId?: string | undefined;
        timestamp?: string | undefined;
        details?: string | undefined;
        field?: string | undefined;
        stack?: string | undefined;
    }>>;
    errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodString>;
        field: z.ZodOptional<z.ZodString>;
        stack: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodDefault<z.ZodString>;
        requestId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        timestamp: string;
        requestId?: string | undefined;
        details?: string | undefined;
        field?: string | undefined;
        stack?: string | undefined;
    }, {
        code: string;
        message: string;
        requestId?: string | undefined;
        timestamp?: string | undefined;
        details?: string | undefined;
        field?: string | undefined;
        stack?: string | undefined;
    }>, "many">>;
    message: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        timestamp: z.ZodString;
        version: z.ZodDefault<z.ZodString>;
        source: z.ZodDefault<z.ZodEnum<["web", "mobile", "api", "cron", "test"]>>;
        userAgent: z.ZodOptional<z.ZodString>;
        ipAddress: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        performance: z.ZodOptional<z.ZodObject<{
            startTime: z.ZodNumber;
            endTime: z.ZodNumber;
            duration: z.ZodString;
            durationMs: z.ZodNumber;
            cacheHit: z.ZodOptional<z.ZodBoolean>;
            cacheKey: z.ZodOptional<z.ZodString>;
            queries: z.ZodOptional<z.ZodNumber>;
            memoryUsage: z.ZodOptional<z.ZodObject<{
                used: z.ZodNumber;
                total: z.ZodNumber;
                percentage: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                used: number;
                total: number;
                percentage: number;
            }, {
                used: number;
                total: number;
                percentage: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        requestId: string;
        timestamp: string;
        version: string;
        source: "web" | "mobile" | "api" | "cron" | "test";
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }, {
        requestId: string;
        timestamp: string;
        version?: string | undefined;
        source?: "web" | "mobile" | "api" | "cron" | "test" | undefined;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }>>;
    pagination: z.ZodOptional<z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        total: z.ZodNumber;
        totalPages: z.ZodNumber;
        hasNext: z.ZodBoolean;
        hasPrev: z.ZodBoolean;
        startIndex: z.ZodNumber;
        endIndex: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
    }, {
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
        page?: number | undefined;
        limit?: number | undefined;
    }>>;
    cache: z.ZodOptional<z.ZodObject<{
        hit: z.ZodBoolean;
        key: z.ZodOptional<z.ZodString>;
        ttl: z.ZodOptional<z.ZodNumber>;
        generatedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        hit: boolean;
        ttl?: number | undefined;
        key?: string | undefined;
        generatedAt?: string | undefined;
    }, {
        hit: boolean;
        ttl?: number | undefined;
        key?: string | undefined;
        generatedAt?: string | undefined;
    }>>;
    warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        field: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        field?: string | undefined;
    }, {
        code: string;
        message: string;
        field?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodString>;
        field: z.ZodOptional<z.ZodString>;
        stack: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodDefault<z.ZodString>;
        requestId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        timestamp: string;
        requestId?: string | undefined;
        details?: string | undefined;
        field?: string | undefined;
        stack?: string | undefined;
    }, {
        code: string;
        message: string;
        requestId?: string | undefined;
        timestamp?: string | undefined;
        details?: string | undefined;
        field?: string | undefined;
        stack?: string | undefined;
    }>>;
    errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodString>;
        field: z.ZodOptional<z.ZodString>;
        stack: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodDefault<z.ZodString>;
        requestId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        timestamp: string;
        requestId?: string | undefined;
        details?: string | undefined;
        field?: string | undefined;
        stack?: string | undefined;
    }, {
        code: string;
        message: string;
        requestId?: string | undefined;
        timestamp?: string | undefined;
        details?: string | undefined;
        field?: string | undefined;
        stack?: string | undefined;
    }>, "many">>;
    message: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        timestamp: z.ZodString;
        version: z.ZodDefault<z.ZodString>;
        source: z.ZodDefault<z.ZodEnum<["web", "mobile", "api", "cron", "test"]>>;
        userAgent: z.ZodOptional<z.ZodString>;
        ipAddress: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        performance: z.ZodOptional<z.ZodObject<{
            startTime: z.ZodNumber;
            endTime: z.ZodNumber;
            duration: z.ZodString;
            durationMs: z.ZodNumber;
            cacheHit: z.ZodOptional<z.ZodBoolean>;
            cacheKey: z.ZodOptional<z.ZodString>;
            queries: z.ZodOptional<z.ZodNumber>;
            memoryUsage: z.ZodOptional<z.ZodObject<{
                used: z.ZodNumber;
                total: z.ZodNumber;
                percentage: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                used: number;
                total: number;
                percentage: number;
            }, {
                used: number;
                total: number;
                percentage: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        requestId: string;
        timestamp: string;
        version: string;
        source: "web" | "mobile" | "api" | "cron" | "test";
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }, {
        requestId: string;
        timestamp: string;
        version?: string | undefined;
        source?: "web" | "mobile" | "api" | "cron" | "test" | undefined;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }>>;
    pagination: z.ZodOptional<z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        total: z.ZodNumber;
        totalPages: z.ZodNumber;
        hasNext: z.ZodBoolean;
        hasPrev: z.ZodBoolean;
        startIndex: z.ZodNumber;
        endIndex: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
    }, {
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
        page?: number | undefined;
        limit?: number | undefined;
    }>>;
    cache: z.ZodOptional<z.ZodObject<{
        hit: z.ZodBoolean;
        key: z.ZodOptional<z.ZodString>;
        ttl: z.ZodOptional<z.ZodNumber>;
        generatedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        hit: boolean;
        ttl?: number | undefined;
        key?: string | undefined;
        generatedAt?: string | undefined;
    }, {
        hit: boolean;
        ttl?: number | undefined;
        key?: string | undefined;
        generatedAt?: string | undefined;
    }>>;
    warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        field: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        field?: string | undefined;
    }, {
        code: string;
        message: string;
        field?: string | undefined;
    }>, "many">>;
}>, any> extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.baseObjectInputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodString>;
        field: z.ZodOptional<z.ZodString>;
        stack: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodDefault<z.ZodString>;
        requestId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        timestamp: string;
        requestId?: string | undefined;
        details?: string | undefined;
        field?: string | undefined;
        stack?: string | undefined;
    }, {
        code: string;
        message: string;
        requestId?: string | undefined;
        timestamp?: string | undefined;
        details?: string | undefined;
        field?: string | undefined;
        stack?: string | undefined;
    }>>;
    errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodString>;
        field: z.ZodOptional<z.ZodString>;
        stack: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodDefault<z.ZodString>;
        requestId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        timestamp: string;
        requestId?: string | undefined;
        details?: string | undefined;
        field?: string | undefined;
        stack?: string | undefined;
    }, {
        code: string;
        message: string;
        requestId?: string | undefined;
        timestamp?: string | undefined;
        details?: string | undefined;
        field?: string | undefined;
        stack?: string | undefined;
    }>, "many">>;
    message: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        timestamp: z.ZodString;
        version: z.ZodDefault<z.ZodString>;
        source: z.ZodDefault<z.ZodEnum<["web", "mobile", "api", "cron", "test"]>>;
        userAgent: z.ZodOptional<z.ZodString>;
        ipAddress: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        performance: z.ZodOptional<z.ZodObject<{
            startTime: z.ZodNumber;
            endTime: z.ZodNumber;
            duration: z.ZodString;
            durationMs: z.ZodNumber;
            cacheHit: z.ZodOptional<z.ZodBoolean>;
            cacheKey: z.ZodOptional<z.ZodString>;
            queries: z.ZodOptional<z.ZodNumber>;
            memoryUsage: z.ZodOptional<z.ZodObject<{
                used: z.ZodNumber;
                total: z.ZodNumber;
                percentage: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                used: number;
                total: number;
                percentage: number;
            }, {
                used: number;
                total: number;
                percentage: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        requestId: string;
        timestamp: string;
        version: string;
        source: "web" | "mobile" | "api" | "cron" | "test";
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }, {
        requestId: string;
        timestamp: string;
        version?: string | undefined;
        source?: "web" | "mobile" | "api" | "cron" | "test" | undefined;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }>>;
    pagination: z.ZodOptional<z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        total: z.ZodNumber;
        totalPages: z.ZodNumber;
        hasNext: z.ZodBoolean;
        hasPrev: z.ZodBoolean;
        startIndex: z.ZodNumber;
        endIndex: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
    }, {
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
        page?: number | undefined;
        limit?: number | undefined;
    }>>;
    cache: z.ZodOptional<z.ZodObject<{
        hit: z.ZodBoolean;
        key: z.ZodOptional<z.ZodString>;
        ttl: z.ZodOptional<z.ZodNumber>;
        generatedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        hit: boolean;
        ttl?: number | undefined;
        key?: string | undefined;
        generatedAt?: string | undefined;
    }, {
        hit: boolean;
        ttl?: number | undefined;
        key?: string | undefined;
        generatedAt?: string | undefined;
    }>>;
    warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        field: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        field?: string | undefined;
    }, {
        code: string;
        message: string;
        field?: string | undefined;
    }>, "many">>;
}> extends infer T_2 ? { [k_1 in keyof T_2]: T_2[k_1]; } : never>;
/**
 * Type générique pour les réponses d'API
 */
export type ApiResponse<T> = {
    success: boolean;
    data?: T;
    error?: ApiError;
    errors?: ApiError[];
    message?: string;
    metadata?: RequestMetadata;
    pagination?: PaginationInfo;
    cache?: {
        hit: boolean;
        key?: string;
        ttl?: number;
        generatedAt?: string;
    };
    warnings?: Array<{
        code: string;
        message: string;
        field?: string;
    }>;
};
/**
 * Schema pour les réponses de liste paginée
 */
export declare const PaginatedResponseSchema: <T extends z.ZodTypeAny>(itemSchema: T) => z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodDefault<z.ZodArray<T, "many">>;
    pagination: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        total: z.ZodNumber;
        totalPages: z.ZodNumber;
        hasNext: z.ZodBoolean;
        hasPrev: z.ZodBoolean;
        startIndex: z.ZodNumber;
        endIndex: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
    }, {
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
        page?: number | undefined;
        limit?: number | undefined;
    }>;
    metadata: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        timestamp: z.ZodString;
        version: z.ZodDefault<z.ZodString>;
        source: z.ZodDefault<z.ZodEnum<["web", "mobile", "api", "cron", "test"]>>;
        userAgent: z.ZodOptional<z.ZodString>;
        ipAddress: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        performance: z.ZodOptional<z.ZodObject<{
            startTime: z.ZodNumber;
            endTime: z.ZodNumber;
            duration: z.ZodString;
            durationMs: z.ZodNumber;
            cacheHit: z.ZodOptional<z.ZodBoolean>;
            cacheKey: z.ZodOptional<z.ZodString>;
            queries: z.ZodOptional<z.ZodNumber>;
            memoryUsage: z.ZodOptional<z.ZodObject<{
                used: z.ZodNumber;
                total: z.ZodNumber;
                percentage: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                used: number;
                total: number;
                percentage: number;
            }, {
                used: number;
                total: number;
                percentage: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        requestId: string;
        timestamp: string;
        version: string;
        source: "web" | "mobile" | "api" | "cron" | "test";
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }, {
        requestId: string;
        timestamp: string;
        version?: string | undefined;
        source?: "web" | "mobile" | "api" | "cron" | "test" | undefined;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }>>;
    cache: z.ZodOptional<z.ZodObject<{
        hit: z.ZodBoolean;
        key: z.ZodOptional<z.ZodString>;
        ttl: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        hit: boolean;
        ttl?: number | undefined;
        key?: string | undefined;
    }, {
        hit: boolean;
        ttl?: number | undefined;
        key?: string | undefined;
    }>>;
    filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    sort: z.ZodOptional<z.ZodObject<{
        field: z.ZodString;
        order: z.ZodEnum<["asc", "desc"]>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        order: "asc" | "desc";
    }, {
        field: string;
        order: "asc" | "desc";
    }>>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
    };
    data: T["_output"][];
    sort?: {
        field: string;
        order: "asc" | "desc";
    } | undefined;
    metadata?: {
        requestId: string;
        timestamp: string;
        version: string;
        source: "web" | "mobile" | "api" | "cron" | "test";
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    } | undefined;
    cache?: {
        hit: boolean;
        ttl?: number | undefined;
        key?: string | undefined;
    } | undefined;
    filters?: Record<string, any> | undefined;
}, {
    success: boolean;
    pagination: {
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
        page?: number | undefined;
        limit?: number | undefined;
    };
    sort?: {
        field: string;
        order: "asc" | "desc";
    } | undefined;
    metadata?: {
        requestId: string;
        timestamp: string;
        version?: string | undefined;
        source?: "web" | "mobile" | "api" | "cron" | "test" | undefined;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    } | undefined;
    cache?: {
        hit: boolean;
        ttl?: number | undefined;
        key?: string | undefined;
    } | undefined;
    filters?: Record<string, any> | undefined;
    data?: T["_input"][] | undefined;
}>;
export type PaginatedResponse<T> = {
    success: boolean;
    data: T[];
    pagination: PaginationInfo;
    metadata?: RequestMetadata;
    cache?: {
        hit: boolean;
        key?: string;
        ttl?: number;
    };
    filters?: Record<string, any>;
    sort?: {
        field: string;
        order: 'asc' | 'desc';
    };
};
/**
 * Schema pour les réponses de recherche
 */
export declare const SearchResponseSchema: <T extends z.ZodTypeAny>(itemSchema: T) => z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodDefault<z.ZodArray<T, "many">>;
    query: z.ZodString;
    suggestions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    facets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: string;
        count: number;
    }, {
        value: string;
        count: number;
    }>, "many">>>;
    pagination: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        total: z.ZodNumber;
        totalPages: z.ZodNumber;
        hasNext: z.ZodBoolean;
        hasPrev: z.ZodBoolean;
        startIndex: z.ZodNumber;
        endIndex: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
    }, {
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
        page?: number | undefined;
        limit?: number | undefined;
    }>;
    metadata: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        timestamp: z.ZodString;
        version: z.ZodDefault<z.ZodString>;
        source: z.ZodDefault<z.ZodEnum<["web", "mobile", "api", "cron", "test"]>>;
        userAgent: z.ZodOptional<z.ZodString>;
        ipAddress: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        performance: z.ZodOptional<z.ZodObject<{
            startTime: z.ZodNumber;
            endTime: z.ZodNumber;
            duration: z.ZodString;
            durationMs: z.ZodNumber;
            cacheHit: z.ZodOptional<z.ZodBoolean>;
            cacheKey: z.ZodOptional<z.ZodString>;
            queries: z.ZodOptional<z.ZodNumber>;
            memoryUsage: z.ZodOptional<z.ZodObject<{
                used: z.ZodNumber;
                total: z.ZodNumber;
                percentage: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                used: number;
                total: number;
                percentage: number;
            }, {
                used: number;
                total: number;
                percentage: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        requestId: string;
        timestamp: string;
        version: string;
        source: "web" | "mobile" | "api" | "cron" | "test";
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }, {
        requestId: string;
        timestamp: string;
        version?: string | undefined;
        source?: "web" | "mobile" | "api" | "cron" | "test" | undefined;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }>>;
    searchMetadata: z.ZodOptional<z.ZodObject<{
        totalHits: z.ZodNumber;
        maxScore: z.ZodOptional<z.ZodNumber>;
        searchTime: z.ZodNumber;
        engine: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        totalHits: number;
        searchTime: number;
        maxScore?: number | undefined;
        engine?: string | undefined;
    }, {
        totalHits: number;
        searchTime: number;
        maxScore?: number | undefined;
        engine?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
    };
    data: T["_output"][];
    query: string;
    metadata?: {
        requestId: string;
        timestamp: string;
        version: string;
        source: "web" | "mobile" | "api" | "cron" | "test";
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    } | undefined;
    suggestions?: string[] | undefined;
    facets?: Record<string, {
        value: string;
        count: number;
    }[]> | undefined;
    searchMetadata?: {
        totalHits: number;
        searchTime: number;
        maxScore?: number | undefined;
        engine?: string | undefined;
    } | undefined;
}, {
    success: boolean;
    pagination: {
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
        page?: number | undefined;
        limit?: number | undefined;
    };
    query: string;
    metadata?: {
        requestId: string;
        timestamp: string;
        version?: string | undefined;
        source?: "web" | "mobile" | "api" | "cron" | "test" | undefined;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    } | undefined;
    data?: T["_input"][] | undefined;
    suggestions?: string[] | undefined;
    facets?: Record<string, {
        value: string;
        count: number;
    }[]> | undefined;
    searchMetadata?: {
        totalHits: number;
        searchTime: number;
        maxScore?: number | undefined;
        engine?: string | undefined;
    } | undefined;
}>;
export type SearchResponse<T> = {
    success: boolean;
    data: T[];
    query: string;
    suggestions?: string[];
    facets?: Record<string, Array<{
        value: string;
        count: number;
    }>>;
    pagination: PaginationInfo;
    metadata?: RequestMetadata;
    searchMetadata?: {
        totalHits: number;
        maxScore?: number;
        searchTime: number;
        engine?: string;
    };
};
/**
 * Schema pour les réponses de validation
 */
export declare const ValidationResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    valid: z.ZodBoolean;
    errors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        message: z.ZodString;
        code: z.ZodString;
        value: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        field: string;
        value?: any;
    }, {
        code: string;
        message: string;
        field: string;
        value?: any;
    }>, "many">>;
    warnings: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        message: z.ZodString;
        code: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        field: string;
    }, {
        code: string;
        message: string;
        field: string;
    }>, "many">>;
    metadata: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        timestamp: z.ZodString;
        version: z.ZodDefault<z.ZodString>;
        source: z.ZodDefault<z.ZodEnum<["web", "mobile", "api", "cron", "test"]>>;
        userAgent: z.ZodOptional<z.ZodString>;
        ipAddress: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        performance: z.ZodOptional<z.ZodObject<{
            startTime: z.ZodNumber;
            endTime: z.ZodNumber;
            duration: z.ZodString;
            durationMs: z.ZodNumber;
            cacheHit: z.ZodOptional<z.ZodBoolean>;
            cacheKey: z.ZodOptional<z.ZodString>;
            queries: z.ZodOptional<z.ZodNumber>;
            memoryUsage: z.ZodOptional<z.ZodObject<{
                used: z.ZodNumber;
                total: z.ZodNumber;
                percentage: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                used: number;
                total: number;
                percentage: number;
            }, {
                used: number;
                total: number;
                percentage: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        requestId: string;
        timestamp: string;
        version: string;
        source: "web" | "mobile" | "api" | "cron" | "test";
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }, {
        requestId: string;
        timestamp: string;
        version?: string | undefined;
        source?: "web" | "mobile" | "api" | "cron" | "test" | undefined;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    valid: boolean;
    success: boolean;
    errors: {
        code: string;
        message: string;
        field: string;
        value?: any;
    }[];
    warnings: {
        code: string;
        message: string;
        field: string;
    }[];
    metadata?: {
        requestId: string;
        timestamp: string;
        version: string;
        source: "web" | "mobile" | "api" | "cron" | "test";
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    } | undefined;
}, {
    valid: boolean;
    success: boolean;
    errors?: {
        code: string;
        message: string;
        field: string;
        value?: any;
    }[] | undefined;
    warnings?: {
        code: string;
        message: string;
        field: string;
    }[] | undefined;
    metadata?: {
        requestId: string;
        timestamp: string;
        version?: string | undefined;
        source?: "web" | "mobile" | "api" | "cron" | "test" | undefined;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    } | undefined;
}>;
export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;
/**
 * Schema pour les options de pagination
 */
export declare const PaginationOptionsSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    offset?: number | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export type PaginationOptions = z.infer<typeof PaginationOptionsSchema>;
/**
 * Schema pour les options de tri
 */
export declare const SortOptionsSchema: z.ZodObject<{
    field: z.ZodString;
    order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    nullsLast: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    field: string;
    order: "asc" | "desc";
    nullsLast: boolean;
}, {
    field: string;
    order?: "asc" | "desc" | undefined;
    nullsLast?: boolean | undefined;
}>;
export type SortOptions = z.infer<typeof SortOptionsSchema>;
/**
 * Schema pour les options de cache
 */
export declare const CacheOptionsSchema: z.ZodObject<{
    ttl: z.ZodDefault<z.ZodNumber>;
    key: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    bypass: z.ZodDefault<z.ZodBoolean>;
    refresh: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    ttl: number;
    tags: string[];
    bypass: boolean;
    refresh: boolean;
    key?: string | undefined;
}, {
    ttl?: number | undefined;
    key?: string | undefined;
    tags?: string[] | undefined;
    bypass?: boolean | undefined;
    refresh?: boolean | undefined;
}>;
export type CacheOptions = z.infer<typeof CacheOptionsSchema>;
/**
 * Schema pour les options génériques de requête
 */
export declare const QueryOptionsSchema: z.ZodObject<{
    pagination: z.ZodOptional<z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        offset?: number | undefined;
    }, {
        page?: number | undefined;
        limit?: number | undefined;
        offset?: number | undefined;
    }>>;
    sort: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
        nullsLast: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        order: "asc" | "desc";
        nullsLast: boolean;
    }, {
        field: string;
        order?: "asc" | "desc" | undefined;
        nullsLast?: boolean | undefined;
    }>, "many">>;
    cache: z.ZodOptional<z.ZodObject<{
        ttl: z.ZodDefault<z.ZodNumber>;
        key: z.ZodOptional<z.ZodString>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        bypass: z.ZodDefault<z.ZodBoolean>;
        refresh: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        ttl: number;
        tags: string[];
        bypass: boolean;
        refresh: boolean;
        key?: string | undefined;
    }, {
        ttl?: number | undefined;
        key?: string | undefined;
        tags?: string[] | undefined;
        bypass?: boolean | undefined;
        refresh?: boolean | undefined;
    }>>;
    include: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    fields: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    sort?: {
        field: string;
        order: "asc" | "desc";
        nullsLast: boolean;
    }[] | undefined;
    pagination?: {
        page: number;
        limit: number;
        offset?: number | undefined;
    } | undefined;
    cache?: {
        ttl: number;
        tags: string[];
        bypass: boolean;
        refresh: boolean;
        key?: string | undefined;
    } | undefined;
    include?: string[] | undefined;
    fields?: string[] | undefined;
    filters?: Record<string, any> | undefined;
    search?: string | undefined;
}, {
    sort?: {
        field: string;
        order?: "asc" | "desc" | undefined;
        nullsLast?: boolean | undefined;
    }[] | undefined;
    pagination?: {
        page?: number | undefined;
        limit?: number | undefined;
        offset?: number | undefined;
    } | undefined;
    cache?: {
        ttl?: number | undefined;
        key?: string | undefined;
        tags?: string[] | undefined;
        bypass?: boolean | undefined;
        refresh?: boolean | undefined;
    } | undefined;
    include?: string[] | undefined;
    fields?: string[] | undefined;
    filters?: Record<string, any> | undefined;
    search?: string | undefined;
}>;
export type QueryOptions = z.infer<typeof QueryOptionsSchema>;
/**
 * Schema pour les réponses d'authentification
 */
export declare const AuthResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    authenticated: z.ZodBoolean;
    user: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        permissions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        email: string;
        roles: string[];
        permissions: string[];
        name?: string | undefined;
    }, {
        id: string;
        email: string;
        name?: string | undefined;
        roles?: string[] | undefined;
        permissions?: string[] | undefined;
    }>>;
    token: z.ZodOptional<z.ZodString>;
    refreshToken: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        timestamp: z.ZodString;
        version: z.ZodDefault<z.ZodString>;
        source: z.ZodDefault<z.ZodEnum<["web", "mobile", "api", "cron", "test"]>>;
        userAgent: z.ZodOptional<z.ZodString>;
        ipAddress: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        performance: z.ZodOptional<z.ZodObject<{
            startTime: z.ZodNumber;
            endTime: z.ZodNumber;
            duration: z.ZodString;
            durationMs: z.ZodNumber;
            cacheHit: z.ZodOptional<z.ZodBoolean>;
            cacheKey: z.ZodOptional<z.ZodString>;
            queries: z.ZodOptional<z.ZodNumber>;
            memoryUsage: z.ZodOptional<z.ZodObject<{
                used: z.ZodNumber;
                total: z.ZodNumber;
                percentage: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                used: number;
                total: number;
                percentage: number;
            }, {
                used: number;
                total: number;
                percentage: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }, {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        requestId: string;
        timestamp: string;
        version: string;
        source: "web" | "mobile" | "api" | "cron" | "test";
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }, {
        requestId: string;
        timestamp: string;
        version?: string | undefined;
        source?: "web" | "mobile" | "api" | "cron" | "test" | undefined;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    authenticated: boolean;
    metadata?: {
        requestId: string;
        timestamp: string;
        version: string;
        source: "web" | "mobile" | "api" | "cron" | "test";
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    } | undefined;
    user?: {
        id: string;
        email: string;
        roles: string[];
        permissions: string[];
        name?: string | undefined;
    } | undefined;
    token?: string | undefined;
    refreshToken?: string | undefined;
    expiresAt?: string | undefined;
}, {
    success: boolean;
    authenticated: boolean;
    metadata?: {
        requestId: string;
        timestamp: string;
        version?: string | undefined;
        source?: "web" | "mobile" | "api" | "cron" | "test" | undefined;
        userAgent?: string | undefined;
        ipAddress?: string | undefined;
        userId?: string | undefined;
        sessionId?: string | undefined;
        performance?: {
            startTime: number;
            endTime: number;
            duration: string;
            durationMs: number;
            cacheHit?: boolean | undefined;
            cacheKey?: string | undefined;
            queries?: number | undefined;
            memoryUsage?: {
                used: number;
                total: number;
                percentage: number;
            } | undefined;
        } | undefined;
    } | undefined;
    user?: {
        id: string;
        email: string;
        name?: string | undefined;
        roles?: string[] | undefined;
        permissions?: string[] | undefined;
    } | undefined;
    token?: string | undefined;
    refreshToken?: string | undefined;
    expiresAt?: string | undefined;
}>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
/**
 * Schema pour les métriques de performance
 */
export declare const PerformanceMetricsSchema: z.ZodObject<{
    endpoint: z.ZodString;
    method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
    responseTime: z.ZodNumber;
    statusCode: z.ZodNumber;
    memoryUsage: z.ZodNumber;
    cpuUsage: z.ZodOptional<z.ZodNumber>;
    cacheHit: z.ZodOptional<z.ZodBoolean>;
    queriesCount: z.ZodOptional<z.ZodNumber>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    memoryUsage: number;
    timestamp: string;
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    responseTime: number;
    statusCode: number;
    cacheHit?: boolean | undefined;
    cpuUsage?: number | undefined;
    queriesCount?: number | undefined;
}, {
    memoryUsage: number;
    timestamp: string;
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    responseTime: number;
    statusCode: number;
    cacheHit?: boolean | undefined;
    cpuUsage?: number | undefined;
    queriesCount?: number | undefined;
}>;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
/**
 * Schema pour les rapports d'erreur
 */
export declare const ErrorReportSchema: z.ZodObject<{
    id: z.ZodString;
    message: z.ZodString;
    stack: z.ZodOptional<z.ZodString>;
    context: z.ZodObject<{
        endpoint: z.ZodString;
        method: z.ZodString;
        userId: z.ZodOptional<z.ZodString>;
        userAgent: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        endpoint: string;
        method: string;
        userAgent?: string | undefined;
        userId?: string | undefined;
    }, {
        timestamp: string;
        endpoint: string;
        method: string;
        userAgent?: string | undefined;
        userId?: string | undefined;
    }>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    resolved: z.ZodDefault<z.ZodBoolean>;
    resolvedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    id: string;
    context: {
        timestamp: string;
        endpoint: string;
        method: string;
        userAgent?: string | undefined;
        userId?: string | undefined;
    };
    resolved: boolean;
    stack?: string | undefined;
    metadata?: Record<string, any> | undefined;
    resolvedAt?: string | undefined;
}, {
    message: string;
    id: string;
    context: {
        timestamp: string;
        endpoint: string;
        method: string;
        userAgent?: string | undefined;
        userId?: string | undefined;
    };
    stack?: string | undefined;
    metadata?: Record<string, any> | undefined;
    resolved?: boolean | undefined;
    resolvedAt?: string | undefined;
}>;
export type ErrorReport = z.infer<typeof ErrorReportSchema>;
/**
 * Crée une réponse de succès standardisée
 */
export declare function createSuccessResponse<T>(data: T, message?: string, metadata?: Partial<RequestMetadata>): ApiResponse<T>;
/**
 * Crée une réponse d'erreur standardisée
 */
export declare function createErrorResponse(error: string | ApiError, code?: string, metadata?: Partial<RequestMetadata>): ApiResponse<never>;
/**
 * Valide et transforme les options de pagination
 */
export declare function normalizePaginationOptions(options: unknown): PaginationOptions;
/**
 * Génère un ID de requête unique
 */
export declare function generateRequestId(): string;
//# sourceMappingURL=api.types.d.ts.map