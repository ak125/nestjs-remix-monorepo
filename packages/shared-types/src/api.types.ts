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

// ====================================
// 🚀 RÉPONSE API GÉNÉRIQUE
// ====================================

/**
 * Schema pour les métadonnées de performance
 */
export const PerformanceMetadataSchema = z.object({
  startTime: z.number().int().positive(),
  endTime: z.number().int().positive(),
  duration: z.string(),
  durationMs: z.number().nonnegative(),
  cacheHit: z.boolean().optional(),
  cacheKey: z.string().optional(),
  queries: z.number().int().nonnegative().optional(),
  memoryUsage: z.object({
    used: z.number().nonnegative(),
    total: z.number().nonnegative(),
    percentage: z.number().nonnegative(),
  }).optional(),
});

export type PerformanceMetadata = z.infer<typeof PerformanceMetadataSchema>;

/**
 * Schema pour les métadonnées de requête
 */
export const RequestMetadataSchema = z.object({
  requestId: z.string(),
  timestamp: z.string().datetime(),
  version: z.string().default('2.0.0'),
  source: z.enum(['web', 'mobile', 'api', 'cron', 'test']).default('web'),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  
  // Informations de contexte
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  
  // Métadonnées de performance
  performance: PerformanceMetadataSchema.optional(),
});

export type RequestMetadata = z.infer<typeof RequestMetadataSchema>;

/**
 * Schema pour les erreurs API
 */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.string().optional(),
  field: z.string().optional(), // Pour erreurs de validation
  stack: z.string().optional(), // En développement seulement
  timestamp: z.string().datetime().default(() => new Date().toISOString()),
  requestId: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Schema pour les informations de pagination
 */
export const PaginationInfoSchema = z.object({
  page: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive().default(20),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
  
  // Informations additionnelles
  startIndex: z.number().int().nonnegative(),
  endIndex: z.number().int().nonnegative(),
});

export type PaginationInfo = z.infer<typeof PaginationInfoSchema>;

/**
 * Schema générique pour les réponses d'API
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ApiErrorSchema.optional(),
    errors: z.array(ApiErrorSchema).optional(),
    message: z.string().optional(),
    
    // Métadonnées
    metadata: RequestMetadataSchema.optional(),
    
    // Pagination (pour les listes)
    pagination: PaginationInfoSchema.optional(),
    
    // Informations de cache
    cache: z.object({
      hit: z.boolean(),
      key: z.string().optional(),
      ttl: z.number().int().positive().optional(),
      generatedAt: z.string().datetime().optional(),
    }).optional(),
    
    // Warnings non-bloquants
    warnings: z.array(z.object({
      code: z.string(),
      message: z.string(),
      field: z.string().optional(),
    })).optional(),
  });

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

// ====================================
// 📋 RÉPONSES SPÉCIALISÉES
// ====================================

/**
 * Schema pour les réponses de liste paginée
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.boolean(),
    data: z.array(itemSchema).default([]),
    pagination: PaginationInfoSchema,
    metadata: RequestMetadataSchema.optional(),
    cache: z.object({
      hit: z.boolean(),
      key: z.string().optional(),
      ttl: z.number().int().positive().optional(),
    }).optional(),
    filters: z.record(z.any()).optional(), // Filtres appliqués
    sort: z.object({
      field: z.string(),
      order: z.enum(['asc', 'desc']),
    }).optional(),
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
  filters?: Record<string, any>;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
};

/**
 * Schema pour les réponses de recherche
 */
export const SearchResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.boolean(),
    data: z.array(itemSchema).default([]),
    query: z.string(),
    suggestions: z.array(z.string()).optional(),
    facets: z.record(z.array(z.object({
      value: z.string(),
      count: z.number().int().nonnegative(),
    }))).optional(),
    pagination: PaginationInfoSchema,
    metadata: RequestMetadataSchema.optional(),
    searchMetadata: z.object({
      totalHits: z.number().int().nonnegative(),
      maxScore: z.number().nonnegative().optional(),
      searchTime: z.number().nonnegative(),
      engine: z.string().optional(), // 'elasticsearch', 'supabase', etc.
    }).optional(),
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

/**
 * Schema pour les réponses de validation
 */
export const ValidationResponseSchema = z.object({
  success: z.boolean(),
  valid: z.boolean(),
  errors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    code: z.string(),
    value: z.any().optional(),
  })).default([]),
  warnings: z.array(z.object({
    field: z.string(),
    message: z.string(),
    code: z.string(),
  })).default([]),
  metadata: RequestMetadataSchema.optional(),
});

export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;

// ====================================
// ⚙️ OPTIONS DE REQUÊTE
// ====================================

/**
 * Schema pour les options de pagination
 */
export const PaginationOptionsSchema = z.object({
  page: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().optional(), // Calculé automatiquement si non fourni
});

export type PaginationOptions = z.infer<typeof PaginationOptionsSchema>;

/**
 * Schema pour les options de tri
 */
export const SortOptionsSchema = z.object({
  field: z.string(),
  order: z.enum(['asc', 'desc']).default('asc'),
  nullsLast: z.boolean().default(true),
});

export type SortOptions = z.infer<typeof SortOptionsSchema>;

/**
 * Schema pour les options de cache
 */
export const CacheOptionsSchema = z.object({
  ttl: z.number().int().positive().default(300), // 5 minutes
  key: z.string().optional(),
  tags: z.array(z.string()).default([]),
  bypass: z.boolean().default(false),
  refresh: z.boolean().default(false),
});

export type CacheOptions = z.infer<typeof CacheOptionsSchema>;

/**
 * Schema pour les options génériques de requête
 */
export const QueryOptionsSchema = z.object({
  pagination: PaginationOptionsSchema.optional(),
  sort: z.array(SortOptionsSchema).optional(),
  cache: CacheOptionsSchema.optional(),
  include: z.array(z.string()).optional(), // Relations à inclure
  fields: z.array(z.string()).optional(), // Champs à sélectionner
  filters: z.record(z.any()).optional(),
  search: z.string().optional(),
});

export type QueryOptions = z.infer<typeof QueryOptionsSchema>;

// ====================================
// 🔐 TYPES D'AUTHENTIFICATION
// ====================================

/**
 * Schema pour les réponses d'authentification
 */
export const AuthResponseSchema = z.object({
  success: z.boolean(),
  authenticated: z.boolean(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().optional(),
    roles: z.array(z.string()).default([]),
    permissions: z.array(z.string()).default([]),
  }).optional(),
  token: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: RequestMetadataSchema.optional(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ====================================
// 📊 TYPES DE MONITORING
// ====================================

/**
 * Schema pour les métriques de performance
 */
export const PerformanceMetricsSchema = z.object({
  endpoint: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  responseTime: z.number().nonnegative(),
  statusCode: z.number().int().min(100).max(599),
  memoryUsage: z.number().nonnegative(),
  cpuUsage: z.number().nonnegative().optional(),
  cacheHit: z.boolean().optional(),
  queriesCount: z.number().int().nonnegative().optional(),
  timestamp: z.string().datetime(),
});

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

/**
 * Schema pour les rapports d'erreur
 */
export const ErrorReportSchema = z.object({
  id: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  context: z.object({
    endpoint: z.string(),
    method: z.string(),
    userId: z.string().optional(),
    userAgent: z.string().optional(),
    timestamp: z.string().datetime(),
  }),
  metadata: z.record(z.any()).optional(),
  resolved: z.boolean().default(false),
  resolvedAt: z.string().datetime().optional(),
});

export type ErrorReport = z.infer<typeof ErrorReportSchema>;

// ====================================
// 🧪 FONCTIONS UTILITAIRES
// ====================================

/**
 * Crée une réponse de succès standardisée
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  metadata?: Partial<RequestMetadata>
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    metadata: metadata as RequestMetadata,
  };
}

/**
 * Crée une réponse d'erreur standardisée
 */
export function createErrorResponse(
  error: string | ApiError,
  code?: string,
  metadata?: Partial<RequestMetadata>
): ApiResponse<never> {
  const apiError: ApiError = typeof error === 'string' 
    ? { code: code || 'UNKNOWN_ERROR', message: error, timestamp: new Date().toISOString() }
    : error;

  return {
    success: false,
    error: apiError,
    metadata: metadata as RequestMetadata,
  };
}

/**
 * Valide et transforme les options de pagination
 */
export function normalizePaginationOptions(options: unknown): PaginationOptions {
  const validated = PaginationOptionsSchema.parse(options || {});
  
  // Calcul automatique de l'offset si non fourni
  if (validated.offset === undefined) {
    validated.offset = validated.page * validated.limit;
  }
  
  return validated;
}

/**
 * Génère un ID de requête unique
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}