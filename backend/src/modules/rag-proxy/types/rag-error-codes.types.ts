/**
 * RAG Pipeline Error Codes — 3 dimensions.
 *
 * 1. Error Code: specific failure identifier
 * 2. Error Family: category grouping
 * 3. Retry Class: how/whether to retry
 */

// ── Error Codes ───────────────────────────────────────────────

export const RAG_ERROR_CODES = {
  // Source errors
  SOURCE_NOT_FOUND: 'SOURCE_NOT_FOUND',
  SOURCE_INVALID_URL: 'SOURCE_INVALID_URL',
  SOURCE_UNREACHABLE: 'SOURCE_UNREACHABLE',

  // HTTP fetch errors
  HTTP_FETCH_FAILED: 'HTTP_FETCH_FAILED',
  HTTP_RATE_LIMITED: 'HTTP_RATE_LIMITED',
  HTTP_SERVER_ERROR: 'HTTP_SERVER_ERROR',
  HTTP_TIMEOUT: 'HTTP_TIMEOUT',

  // Extraction errors
  PDF_PARSE_FAILED: 'PDF_PARSE_FAILED',
  PDF_CORRUPTED: 'PDF_CORRUPTED',
  EXTRACTION_EMPTY: 'EXTRACTION_EMPTY',
  EXTRACTION_TOO_SHORT: 'EXTRACTION_TOO_SHORT',

  // Classification errors
  CLASSIFICATION_FAILED: 'CLASSIFICATION_FAILED',
  CLASSIFICATION_AMBIGUOUS: 'CLASSIFICATION_AMBIGUOUS',

  // Validation errors
  FRONTMATTER_INVALID: 'FRONTMATTER_INVALID',
  FRONTMATTER_MISSING: 'FRONTMATTER_MISSING',
  CONTENT_EMPTY: 'CONTENT_EMPTY',
  LANGUAGE_UNSUPPORTED: 'LANGUAGE_UNSUPPORTED',
  CANONICAL_INVALID: 'CANONICAL_INVALID',
  QUALITY_BELOW_THRESHOLD: 'QUALITY_BELOW_THRESHOLD',

  // Dedup errors
  DEDUP_EXACT_MATCH: 'DEDUP_EXACT_MATCH',
  DEDUP_CANONICAL_COLLISION: 'DEDUP_CANONICAL_COLLISION',
  DEDUP_SEMANTIC_OVERLAP: 'DEDUP_SEMANTIC_OVERLAP',

  // Persistence errors
  PERSISTENCE_FAILED: 'PERSISTENCE_FAILED',
  PERSISTENCE_CONFLICT: 'PERSISTENCE_CONFLICT',
  WRITE_SAFETY_BLOCKED: 'WRITE_SAFETY_BLOCKED',

  // Publication errors
  PUBLICATION_GATE_FAILED: 'PUBLICATION_GATE_FAILED',

  // Dispatch errors
  WEBHOOK_TIMEOUT: 'WEBHOOK_TIMEOUT',
  REFRESH_QUEUE_FAILED: 'REFRESH_QUEUE_FAILED',
  EVENT_PUBLISH_FAILED: 'EVENT_PUBLISH_FAILED',
} as const;

export type RagErrorCode =
  (typeof RAG_ERROR_CODES)[keyof typeof RAG_ERROR_CODES];

// ── Error Families ────────────────────────────────────────────

export const RAG_ERROR_FAMILIES = {
  source_error: 'source_error',
  extraction_error: 'extraction_error',
  classification_error: 'classification_error',
  validation_error: 'validation_error',
  dedup_error: 'dedup_error',
  persistence_error: 'persistence_error',
  publication_error: 'publication_error',
  dispatch_error: 'dispatch_error',
} as const;

export type RagErrorFamily =
  (typeof RAG_ERROR_FAMILIES)[keyof typeof RAG_ERROR_FAMILIES];

// ── Retry Classes ─────────────────────────────────────────────

export const RAG_RETRY_CLASSES = {
  retryable: 'retryable',
  retryable_limited: 'retryable_limited',
  non_retryable: 'non_retryable',
  human_review: 'human_review',
} as const;

export type RagRetryClass =
  (typeof RAG_RETRY_CLASSES)[keyof typeof RAG_RETRY_CLASSES];

// ── Error Classification Map ──────────────────────────────────

export interface RagErrorClassification {
  code: RagErrorCode;
  family: RagErrorFamily;
  retryClass: RagRetryClass;
  maxRetries: number;
}

/** Maps every error code to its family + retry policy. */
export const ERROR_CLASSIFICATION: Record<
  RagErrorCode,
  RagErrorClassification
> = {
  // Source errors
  SOURCE_NOT_FOUND: {
    code: 'SOURCE_NOT_FOUND',
    family: 'source_error',
    retryClass: 'non_retryable',
    maxRetries: 0,
  },
  SOURCE_INVALID_URL: {
    code: 'SOURCE_INVALID_URL',
    family: 'source_error',
    retryClass: 'non_retryable',
    maxRetries: 0,
  },
  SOURCE_UNREACHABLE: {
    code: 'SOURCE_UNREACHABLE',
    family: 'source_error',
    retryClass: 'retryable_limited',
    maxRetries: 3,
  },

  // HTTP errors
  HTTP_FETCH_FAILED: {
    code: 'HTTP_FETCH_FAILED',
    family: 'source_error',
    retryClass: 'retryable_limited',
    maxRetries: 3,
  },
  HTTP_RATE_LIMITED: {
    code: 'HTTP_RATE_LIMITED',
    family: 'source_error',
    retryClass: 'retryable',
    maxRetries: 5,
  },
  HTTP_SERVER_ERROR: {
    code: 'HTTP_SERVER_ERROR',
    family: 'source_error',
    retryClass: 'retryable',
    maxRetries: 3,
  },
  HTTP_TIMEOUT: {
    code: 'HTTP_TIMEOUT',
    family: 'source_error',
    retryClass: 'retryable_limited',
    maxRetries: 2,
  },

  // Extraction errors
  PDF_PARSE_FAILED: {
    code: 'PDF_PARSE_FAILED',
    family: 'extraction_error',
    retryClass: 'non_retryable',
    maxRetries: 0,
  },
  PDF_CORRUPTED: {
    code: 'PDF_CORRUPTED',
    family: 'extraction_error',
    retryClass: 'non_retryable',
    maxRetries: 0,
  },
  EXTRACTION_EMPTY: {
    code: 'EXTRACTION_EMPTY',
    family: 'extraction_error',
    retryClass: 'non_retryable',
    maxRetries: 0,
  },
  EXTRACTION_TOO_SHORT: {
    code: 'EXTRACTION_TOO_SHORT',
    family: 'extraction_error',
    retryClass: 'human_review',
    maxRetries: 0,
  },

  // Classification errors
  CLASSIFICATION_FAILED: {
    code: 'CLASSIFICATION_FAILED',
    family: 'classification_error',
    retryClass: 'retryable_limited',
    maxRetries: 2,
  },
  CLASSIFICATION_AMBIGUOUS: {
    code: 'CLASSIFICATION_AMBIGUOUS',
    family: 'classification_error',
    retryClass: 'human_review',
    maxRetries: 0,
  },

  // Validation errors
  FRONTMATTER_INVALID: {
    code: 'FRONTMATTER_INVALID',
    family: 'validation_error',
    retryClass: 'non_retryable',
    maxRetries: 0,
  },
  FRONTMATTER_MISSING: {
    code: 'FRONTMATTER_MISSING',
    family: 'validation_error',
    retryClass: 'non_retryable',
    maxRetries: 0,
  },
  CONTENT_EMPTY: {
    code: 'CONTENT_EMPTY',
    family: 'validation_error',
    retryClass: 'non_retryable',
    maxRetries: 0,
  },
  LANGUAGE_UNSUPPORTED: {
    code: 'LANGUAGE_UNSUPPORTED',
    family: 'validation_error',
    retryClass: 'non_retryable',
    maxRetries: 0,
  },
  CANONICAL_INVALID: {
    code: 'CANONICAL_INVALID',
    family: 'validation_error',
    retryClass: 'non_retryable',
    maxRetries: 0,
  },
  QUALITY_BELOW_THRESHOLD: {
    code: 'QUALITY_BELOW_THRESHOLD',
    family: 'validation_error',
    retryClass: 'human_review',
    maxRetries: 0,
  },

  // Dedup errors
  DEDUP_EXACT_MATCH: {
    code: 'DEDUP_EXACT_MATCH',
    family: 'dedup_error',
    retryClass: 'non_retryable',
    maxRetries: 0,
  },
  DEDUP_CANONICAL_COLLISION: {
    code: 'DEDUP_CANONICAL_COLLISION',
    family: 'dedup_error',
    retryClass: 'human_review',
    maxRetries: 0,
  },
  DEDUP_SEMANTIC_OVERLAP: {
    code: 'DEDUP_SEMANTIC_OVERLAP',
    family: 'dedup_error',
    retryClass: 'human_review',
    maxRetries: 0,
  },

  // Persistence errors
  PERSISTENCE_FAILED: {
    code: 'PERSISTENCE_FAILED',
    family: 'persistence_error',
    retryClass: 'retryable',
    maxRetries: 3,
  },
  PERSISTENCE_CONFLICT: {
    code: 'PERSISTENCE_CONFLICT',
    family: 'persistence_error',
    retryClass: 'retryable_limited',
    maxRetries: 1,
  },
  WRITE_SAFETY_BLOCKED: {
    code: 'WRITE_SAFETY_BLOCKED',
    family: 'persistence_error',
    retryClass: 'non_retryable',
    maxRetries: 0,
  },

  // Publication errors
  PUBLICATION_GATE_FAILED: {
    code: 'PUBLICATION_GATE_FAILED',
    family: 'publication_error',
    retryClass: 'human_review',
    maxRetries: 0,
  },

  // Dispatch errors
  WEBHOOK_TIMEOUT: {
    code: 'WEBHOOK_TIMEOUT',
    family: 'dispatch_error',
    retryClass: 'retryable_limited',
    maxRetries: 2,
  },
  REFRESH_QUEUE_FAILED: {
    code: 'REFRESH_QUEUE_FAILED',
    family: 'dispatch_error',
    retryClass: 'retryable',
    maxRetries: 3,
  },
  EVENT_PUBLISH_FAILED: {
    code: 'EVENT_PUBLISH_FAILED',
    family: 'dispatch_error',
    retryClass: 'retryable',
    maxRetries: 3,
  },
};

// ── Structured Error ──────────────────────────────────────────

export interface RagPipelineError {
  code: RagErrorCode;
  family: RagErrorFamily;
  retryClass: RagRetryClass;
  message: string;
  step?: string;
  jobId?: string;
  documentId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/** Create a structured error from an error code + message. */
export function createRagError(
  code: RagErrorCode,
  message: string,
  opts?: {
    step?: string;
    jobId?: string;
    documentId?: string;
    metadata?: Record<string, unknown>;
  },
): RagPipelineError {
  const classification = ERROR_CLASSIFICATION[code];
  return {
    code,
    family: classification.family,
    retryClass: classification.retryClass,
    message,
    step: opts?.step,
    jobId: opts?.jobId,
    documentId: opts?.documentId,
    timestamp: new Date().toISOString(),
    metadata: opts?.metadata,
  };
}
