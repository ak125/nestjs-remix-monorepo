/**
 * API Response Types
 *
 * Types generiques pour les reponses d'API REST
 * Pattern unifie pour toutes les endpoints du monorepo
 *
 * @version 2.0.0
 * @package @repo/database-types
 */

import { z } from 'zod';

// ====================================
// PERFORMANCE METADATA
// ====================================

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

export type PerformanceMetadata = z.infer<typeof PerformanceMetadataSchema>;

// ====================================
// REQUEST METADATA
// ====================================

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

export type RequestMetadata = z.infer<typeof RequestMetadataSchema>;

// ====================================
// API ERROR
// ====================================

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

export type ApiError = z.infer<typeof ApiErrorSchema>;

// ====================================
// PAGINATION
// ====================================

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

export type PaginationInfo = z.infer<typeof PaginationInfoSchema>;

export const PaginationOptionsSchema = z.object({
  page: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().optional(),
});

export type PaginationOptions = z.infer<typeof PaginationOptionsSchema>;

// ====================================
// API RESPONSE GENERIC
// ====================================

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
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
      .array(
        z.object({
          code: z.string(),
          message: z.string(),
          field: z.string().optional(),
        }),
      )
      .optional(),
  });

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

// ====================================
// PAGINATED RESPONSE
// ====================================

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
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
  filters?: Record<string, unknown>;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
};

// ====================================
// SEARCH RESPONSE
// ====================================

export const SearchResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.boolean(),
    data: z.array(itemSchema).default([]),
    query: z.string(),
    suggestions: z.array(z.string()).optional(),
    facets: z
      .record(
        z.array(
          z.object({
            value: z.string(),
            count: z.number().int().nonnegative(),
          }),
        ),
      )
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

export type SearchResponse<T> = {
  success: boolean;
  data: T[];
  query: string;
  suggestions?: string[];
  facets?: Record<string, Array<{ value: string; count: number }>>;
  pagination: PaginationInfo;
  metadata?: RequestMetadata;
  searchMetadata?: {
    totalHits: number;
    maxScore?: number;
    searchTime: number;
    engine?: string;
  };
};

// ====================================
// VALIDATION RESPONSE
// ====================================

export const ValidationResponseSchema = z.object({
  success: z.boolean(),
  valid: z.boolean(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
        code: z.string(),
        value: z.any().optional(),
      }),
    )
    .default([]),
  warnings: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
        code: z.string(),
      }),
    )
    .default([]),
  metadata: RequestMetadataSchema.optional(),
});

export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;

// ====================================
// QUERY OPTIONS
// ====================================

export const SortOptionsSchema = z.object({
  field: z.string(),
  order: z.enum(['asc', 'desc']).default('asc'),
  nullsLast: z.boolean().default(true),
});

export type SortOptions = z.infer<typeof SortOptionsSchema>;

export const CacheOptionsSchema = z.object({
  ttl: z.number().int().positive().default(300),
  key: z.string().optional(),
  tags: z.array(z.string()).default([]),
  bypass: z.boolean().default(false),
  refresh: z.boolean().default(false),
});

export type CacheOptions = z.infer<typeof CacheOptionsSchema>;

export const QueryOptionsSchema = z.object({
  pagination: PaginationOptionsSchema.optional(),
  sort: z.array(SortOptionsSchema).optional(),
  cache: CacheOptionsSchema.optional(),
  include: z.array(z.string()).optional(),
  fields: z.array(z.string()).optional(),
  filters: z.record(z.any()).optional(),
  search: z.string().optional(),
});

export type QueryOptions = z.infer<typeof QueryOptionsSchema>;

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  metadata?: Partial<RequestMetadata>,
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    metadata: metadata as RequestMetadata,
  };
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string | ApiError,
  code?: string,
  metadata?: Partial<RequestMetadata>,
): ApiResponse<never> {
  const apiError: ApiError =
    typeof error === 'string'
      ? {
          code: code || 'UNKNOWN_ERROR',
          message: error,
          timestamp: new Date().toISOString(),
        }
      : error;

  return {
    success: false,
    error: apiError,
    metadata: metadata as RequestMetadata,
  };
}

/**
 * Validate and normalize pagination options
 */
export function normalizePaginationOptions(options: unknown): PaginationOptions {
  const validated = PaginationOptionsSchema.parse(options || {});

  if (validated.offset === undefined) {
    validated.offset = validated.page * validated.limit;
  }

  return validated;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
