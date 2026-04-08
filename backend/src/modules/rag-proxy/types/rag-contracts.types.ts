/**
 * RAG Pipeline Contracts — Zod schemas for all inter-layer payloads.
 *
 * Rule: no free payload between modules. Every crossing point is typed + validated.
 */
import { z } from 'zod';

// ── Ingestion Request ─────────────────────────────────────────

export const RagIngestRequestSchema = z.object({
  sourceType: z.enum(['pdf', 'web_url', 'markdown']),
  mode: z.enum(['single', 'batch', 'sitemap', 'recrawl', 'dry_run']),
  source: z.string().min(1),
  triggerRefresh: z.boolean().default(false),
  priority: z
    .enum(['critical', 'high', 'normal', 'low', 'background'])
    .default('normal'),
  truthLevel: z.enum(['L1', 'L2', 'L3', 'L4']).default('L2'),
  force: z.boolean().default(false),
});

export type RagIngestRequest = z.infer<typeof RagIngestRequestSchema>;

// ── Extraction Result (handler output) ────────────────────────

export const RagExtractionResultSchema = z.object({
  sourceType: z.enum(['pdf', 'web_url', 'markdown']),
  normalizedSourceKey: z.string().min(1),
  canonicalSourceKey: z.string().optional(),
  rawHash: z.string().min(1),
  contentHash: z.string().min(1),
  extractedText: z.string(),
  detectedLanguage: z.string().optional(),
  metadata: z.record(z.unknown()),
  warnings: z.array(z.string()),
  extractionQualityScore: z.number().min(0).max(1),
});

export type RagExtractionResult = z.infer<typeof RagExtractionResultSchema>;

// ── Provenance (G4 — minimum metadata) ────────────────────────

export const RagProvenanceSchema = z.object({
  sourceUrl: z.string().min(1),
  truthLevel: z.enum(['L1', 'L2', 'L3', 'L4']),
  sourceType: z.string().min(1),
  gammeAliases: z.array(z.string()).default([]),
  ingestedAt: z.string(),
  jobOrigin: z.string(),
  validationStatus: z.enum(['valid', 'quarantined', 'pending_review']),
});

export type RagProvenance = z.infer<typeof RagProvenanceSchema>;

// ── Quality Gate Result ───────────────────────────────────────

export const QualityGateResultSchema = z.object({
  passed: z.boolean(),
  level: z.enum(['blocking', 'degrading', 'alert']),
  gateName: z.string(),
  message: z.string(),
  score: z.number().optional(),
});

export type QualityGateResult = z.infer<typeof QualityGateResultSchema>;

export const ValidationReportSchema = z.object({
  overallPassed: z.boolean(),
  canPublish: z.boolean(),
  blockingGates: z.array(QualityGateResultSchema),
  degradingGates: z.array(QualityGateResultSchema),
  alertGates: z.array(QualityGateResultSchema),
  qualityScore: z.number().min(0).max(1),
});

export type ValidationReport = z.infer<typeof ValidationReportSchema>;

// ── Document Published Event ──────────────────────────────────

export const RagDocumentEventSchema = z.object({
  eventName: z.enum([
    'rag.document.staged',
    'rag.document.published',
    'rag.document.updated',
    'rag.document.unchanged',
    'rag.document.rejected',
    'rag.document.archived',
  ]),
  eventVersion: z.literal('1'),
  occurredAt: z.string(),
  jobId: z.string(),
  documentId: z.string(),
  canonicalSourceKey: z.string(),
  publicationHash: z.string().optional(),
  tier: z.enum(['A', 'B', 'C', 'D']).optional(),
  qualityScore: z.number().optional(),
  trustLevel: z.enum(['high', 'medium', 'low']).optional(),
});

export type RagDocumentEvent = z.infer<typeof RagDocumentEventSchema>;

// ── Fingerprint Pack ──────────────────────────────────────────

export const FingerprintPackSchema = z.object({
  normalizedSourceKey: z.string(),
  canonicalSourceKey: z.string().optional(),
  rawHash: z.string(),
  contentHash: z.string(),
  publicationHash: z.string().optional(),
});

export type FingerprintPack = z.infer<typeof FingerprintPackSchema>;

// ── Ingestion Receipt (R1 + R2 — Phase 1 proof-of-ingestion) ─

export const IngestionReceiptSchema = z.object({
  // Core identifiers
  jobId: z.string(),
  sourceType: z.string(),
  sourceLocator: z.string(),
  storagePath: z.string(),
  dbRecordId: z.string().nullable(),

  // R2: 4 sub-statuses (received / stored / reconciled / accepted)
  receptionSuccess: z.boolean(),
  storageSuccess: z.boolean(),
  reconciliationSuccess: z.boolean(),
  acceptanceDecision: z.enum([
    'accepted',
    'quarantined',
    'rejected',
    'skipped',
  ]),

  // Aggregate statuses
  provenanceStatus: z.enum(['valid', 'incomplete', 'missing']),
  writeSafetyStatus: z.enum(['safe', 'blocked', 'skipped']),
  finalStatus: z.enum([
    'accepted',
    'quarantined',
    'rejected',
    'skipped',
    'failed',
  ]),
  phase1Status: z.enum(['passed', 'failed', 'quarantined']),
  ingestedAt: z.string(),

  // Optional detail
  reasons: z.array(z.string()).default([]),
  fingerprintPack: FingerprintPackSchema.optional(),
});

export type IngestionReceipt = z.infer<typeof IngestionReceiptSchema>;

// ── Foundation Gate (F1-GATE — Foundation Write Lock) ─────────

export const FoundationGateSchema = z.object({
  provenanceStatus: z.enum(['validated', 'incomplete', 'missing']),
  traceabilityStatus: z.enum(['validated', 'missing']),
  storageStatus: z.enum(['validated', 'failed']),
  dbSyncStatus: z.enum(['validated', 'failed']),
  collisionStatus: z.enum(['clear', 'conflict']),
  writeSafetyStatus: z.enum(['validated', 'blocked']),
  mutationMode: z.enum(['controlled', 'uncontrolled']),
  foundationGatePassed: z.boolean(),
  foundationGateCheckedAt: z.string(),
  foundationGateReason: z.string().optional(),
});

export type FoundationGateResult = z.infer<typeof FoundationGateSchema>;

// ── Collision Pack (Phase 1.5 — collision scan result) ───────

export const CollisionDetailSchema = z.object({
  type: z.enum([
    'source_url',
    'content',
    'target',
    'trust',
    'routing',
    'version',
  ]),
  existingDocId: z.string(),
  existingSource: z.string(),
  // Detection (C: separate detection from resolution)
  detected: z.boolean(),
  detectionConfidence: z.number().min(0).max(1),
  // Resolution (may be unresolved if pending review)
  resolved: z.boolean(),
  resolution: z
    .enum([
      'canonical_primary',
      'secondary_duplicate',
      'shadow_copy',
      'merge_candidate',
      'alias_conflict_blocked',
      'quarantine',
      'manual_review_required',
      'rejected_invalid_identity',
    ])
    .optional(),
  reason: z.string(),
});

export type CollisionDetail = z.infer<typeof CollisionDetailSchema>;

export const CollisionPackSchema = z.object({
  sourceUrlCollision: z.boolean().default(false),
  contentCollision: z.boolean().default(false),
  targetCollision: z.boolean().default(false),
  trustCollision: z.boolean().default(false),
  routingCollision: z.boolean().default(false),
  versionCollision: z.boolean().default(false),
  collisionDetails: z.array(CollisionDetailSchema).default([]),
  hasBlockingCollision: z.boolean(),
});

export type CollisionPack = z.infer<typeof CollisionPackSchema>;

// ── Normalization Record (Phase 1.5 — canonical proof) ───────

export const NormalizationRecordSchema = z.object({
  // Canonical identity
  canonicalDocId: z.string().uuid(),
  canonicalSourceKey: z.string(),
  normalizedSourceUrl: z.string().optional(),

  // Classification
  sourceType: z.enum([
    'pdf',
    'web_url',
    'markdown',
    'csv',
    'import',
    'generated',
    'merged',
  ]),
  docFamily: z.enum([
    'gamme',
    'vehicle',
    'brand',
    'reference',
    'diagnostic',
    'maintenance',
    'catalog',
    'raw_capture',
    'media_prompt',
    'seo_support',
  ]),
  classificationConfidence: z.number().min(0).max(1),
  classificationStrategy: z.string(),

  // Routing
  targetSurface: z.string(),
  gammeAliases: z.array(z.string()),
  routingDecision: z.enum(['routed', 'intake_pending', 'quarantined']),
  routingConfidence: z.number().min(0).max(1), // (D) routing confidence score

  // Collision
  collisionPack: CollisionPackSchema.optional(),
  collisionConfidence: z.number().min(0).max(1), // (D) collision confidence score

  // Documentary status (B: distinct from phase status)
  canonicalStatus: z.enum(['canonical', 'provisional', 'ambiguous', 'blocked']),

  // Publication readiness (A: separate from canonical identity)
  publicationTargetReady: z.boolean().default(false), // false until Phase 1.6

  // Phase 1.5 decision
  phase15Status: z.enum([
    'normalized',
    'normalized_with_warnings',
    'blocked',
    'quarantined',
    'review_required',
  ]),
  blockReasons: z.array(z.string()).default([]),
  normalizedAt: z.string(),
});

export type NormalizationRecord = z.infer<typeof NormalizationRecordSchema>;

// ── Idempotence Decision ──────────────────────────────────────

export const IdempotenceDecisionSchema = z.object({
  action: z.enum([
    'noop_completed',
    'new_version',
    'possible_semantic_duplicate',
    'reject',
  ]),
  reason: z.string(),
  existingDocumentId: z.string().optional(),
  existingVersionId: z.string().optional(),
});

export type IdempotenceDecision = z.infer<typeof IdempotenceDecisionSchema>;

// ── Webhook Completion Response ─────────────────────────────────

export const WebhookCompletionResponseSchema = z.object({
  gammes_detected: z.array(z.string()),
  diagnostics_detected: z.array(z.string()),
  event_emitted: z.boolean(),
});

export type WebhookCompletionResponse = z.infer<
  typeof WebhookCompletionResponseSchema
>;
