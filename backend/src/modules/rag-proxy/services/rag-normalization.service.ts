import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RagFingerprintService } from './rag-fingerprint.service';
import { RagFoundationGateService } from './rag-foundation-gate.service';
import { FrontmatterValidatorService } from './frontmatter-validator.service';
import { RagGammeDetectionService } from './rag-gamme-detection.service';
import type {
  NormalizationRecord,
  CollisionPack,
  CollisionDetail,
} from '../types/rag-contracts.types';
import type { Phase15Status } from '../types/rag-state.types';
import { KnowledgeDocType } from '../types/knowledge-doc.types';

/**
 * Surface routing map: KnowledgeDocType → canonical storage surface.
 * Determines WHERE a document should live after normalization.
 */
const KB_TYPE_TO_SURFACE: Record<string, string> = {
  [KnowledgeDocType.KB_GAMME]: 'gammes/',
  [KnowledgeDocType.KB_REFERENCE]: 'reference/',
  [KnowledgeDocType.KB_DIAGNOSTIC]: 'diagnostic/',
  [KnowledgeDocType.KB_SUPPORT]: 'faq/',
  [KnowledgeDocType.QUARANTINE]: '_quarantine/',
};

/**
 * Source type inference from file path prefix.
 */
const PREFIX_TO_SOURCE_TYPE: Record<string, string> = {
  gammes: 'markdown',
  web: 'web_url',
  'web-catalog': 'web_url',
  guides: 'markdown',
  diagnostic: 'markdown',
  faq: 'markdown',
  canonical: 'markdown',
  reference: 'markdown',
  vehicle: 'markdown',
  vehicles: 'markdown',
  canon: 'markdown',
  policies: 'markdown',
};

/**
 * Doc family inference from file path prefix.
 */
const PREFIX_TO_DOC_FAMILY: Record<string, string> = {
  gammes: 'gamme',
  web: 'catalog',
  'web-catalog': 'catalog',
  guides: 'maintenance',
  diagnostic: 'diagnostic',
  faq: 'seo_support',
  canonical: 'reference',
  reference: 'reference',
  vehicle: 'vehicle',
  vehicles: 'vehicle',
  canon: 'reference',
  policies: 'seo_support',
};

/**
 * INTAKE_ZONES — temporary staging areas, not canonical surfaces.
 * Docs in these zones must be routed to their proper surface.
 */
const INTAKE_ZONES = ['web', 'web-catalog'];

/**
 * RagNormalizationService — Phase 1.5 Canonical Normalization.
 *
 * Transforms a technically ingested document (Phase 1 passed) into a
 * canonical, non-ambiguous, correctly routed document without any
 * business/editorial transformation.
 *
 * 7 sub-steps:
 *   1. buildCanonicalIdentity()
 *   2. normalizeProvenance()
 *   3. classifyDocument()
 *   4. resolveRouting()
 *   5. scanCollisions()
 *   6. resolveConflicts()
 *   7. computePhase15Status()
 */
@Injectable()
export class RagNormalizationService extends SupabaseBaseService {
  protected override readonly logger = new Logger(RagNormalizationService.name);

  constructor(
    configService: ConfigService,
    @Inject(forwardRef(() => RagFingerprintService))
    private readonly fingerprintService: RagFingerprintService,
    @Inject(forwardRef(() => RagFoundationGateService))
    private readonly foundationGateService: RagFoundationGateService,
    @Inject(forwardRef(() => FrontmatterValidatorService))
    private readonly frontmatterValidator: FrontmatterValidatorService,
    @Inject(forwardRef(() => RagGammeDetectionService))
    private readonly gammeDetectionService: RagGammeDetectionService,
  ) {
    super(configService);
  }

  /**
   * Main entry point — normalize a document that has passed Phase 1.
   * Pre-condition: phase1_status = 'passed' (checked via F1-GATE).
   */
  async normalize(source: string): Promise<NormalizationRecord> {
    const now = new Date().toISOString();

    // Pre-condition: Phase 1 must be passed
    const gate = await this.foundationGateService.checkGate(source);
    if (!gate.foundationGatePassed) {
      this.logger.warn(
        `normalize: skipping "${source}" — Phase 1 not passed (${gate.foundationGateReason})`,
      );
      return this.buildBlockedRecord(source, now, [
        `PHASE1_NOT_PASSED: ${gate.foundationGateReason}`,
      ]);
    }

    // Load document from DB
    const { data: doc } = await this.supabase
      .from('__rag_knowledge')
      .select(
        'id, source, title, content, truth_level, domain, category, source_url, fingerprint, content_hash, canonical_source_key, gamme_aliases',
      )
      .eq('source', source)
      .eq('status', 'active')
      .maybeSingle();

    if (!doc) {
      return this.buildBlockedRecord(source, now, [
        'DOCUMENT_NOT_FOUND_OR_INACTIVE',
      ]);
    }

    const blockReasons: string[] = [];
    const warnings: string[] = [];

    // 1.5.1 — Canonical Identity
    const canonicalDocId = randomUUID();
    const canonicalSourceKey =
      doc.canonical_source_key ??
      this.fingerprintService.computeCanonicalKey(
        this.fingerprintService.normalizeSourceKey(source),
        {
          pgAlias: doc.gamme_aliases?.[0],
          slug: source.split('/').pop(),
        },
      );

    // 1.5.2 — Provenance Normalization
    const normalizedSourceUrl = doc.source_url
      ? this.normalizeUrl(doc.source_url)
      : undefined;

    if (!doc.truth_level) {
      blockReasons.push('MISSING_TRUTH_LEVEL');
    }

    // 1.5.3 — Documentary Classification
    const { sourceType, docFamily, confidence, strategy } =
      this.classifyDocument(source, doc);

    if (confidence < 0.5) {
      blockReasons.push(
        `LOW_CLASSIFICATION_CONFIDENCE: ${confidence} (strategy=${strategy})`,
      );
    }

    // 1.5.4 — Routing
    const { targetSurface, gammeAliases, routingDecision, routingConfidence } =
      await this.resolveRouting(source, doc, docFamily);

    if (routingDecision === 'quarantined') {
      blockReasons.push('ROUTING_QUARANTINED: no valid target surface');
    }

    // 1.5.5 — Collision Scan
    const collisionPack = await this.scanCollisions(
      source,
      doc,
      canonicalSourceKey,
      normalizedSourceUrl,
      gammeAliases,
    );

    if (collisionPack.hasBlockingCollision) {
      for (const detail of collisionPack.collisionDetails) {
        if (
          detail.resolution === 'alias_conflict_blocked' ||
          detail.resolution === 'manual_review_required' ||
          detail.resolution === 'rejected_invalid_identity'
        ) {
          blockReasons.push(
            `COLLISION_BLOCKED: ${detail.type} with ${detail.existingSource} (${detail.resolution})`,
          );
        }
      }
    }

    // 1.5.6 + 1.5.7 — Conflict Resolution + Phase 1.5 Status
    const phase15Status = this.computePhase15Status(
      blockReasons,
      warnings,
      collisionPack,
    );

    // B: Canonical status (documentary, distinct from phase status)
    const canonicalStatus = this.computeCanonicalStatus(phase15Status);

    // D: Collision confidence (max detection confidence across all collisions)
    const collisionConfidence =
      collisionPack.collisionDetails.length > 0
        ? Math.max(
            ...collisionPack.collisionDetails.map((d) => d.detectionConfidence),
          )
        : 1.0; // No collision = 100% certain there's no conflict

    const record: NormalizationRecord = {
      canonicalDocId,
      canonicalSourceKey,
      normalizedSourceUrl,
      sourceType: sourceType as NormalizationRecord['sourceType'],
      docFamily: docFamily as NormalizationRecord['docFamily'],
      classificationConfidence: confidence,
      classificationStrategy: strategy,
      targetSurface,
      gammeAliases,
      routingDecision,
      routingConfidence,
      collisionPack,
      collisionConfidence,
      canonicalStatus,
      publicationTargetReady: false, // A: always false until Phase 1.6
      phase15Status,
      blockReasons,
      normalizedAt: now,
    };

    // Persist to DB
    await this.persistNormalizationRecord(source, record);

    this.logger.log(
      `normalize: "${source}" → ${phase15Status} (family=${docFamily}, surface=${targetSurface}, collisions=${collisionPack.collisionDetails.length})`,
    );

    return record;
  }

  // ── 1.5.1 — URL Normalization ────────────────────────────────

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Strip tracking params
      const stripParams = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'fbclid',
        'gclid',
        'ref',
      ];
      for (const p of stripParams) {
        parsed.searchParams.delete(p);
      }
      // Normalize: lowercase host, remove trailing slash
      return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
    } catch {
      // Not a valid URL, return as-is
      return url;
    }
  }

  // ── 1.5.3 — Documentary Classification ────────────────────────

  private classifyDocument(
    source: string,
    doc: { category?: string; domain?: string },
  ): {
    sourceType: string;
    docFamily: string;
    confidence: number;
    strategy: string;
  } {
    const prefix = source.match(/^([a-z-]+)[./]/)?.[1] ?? 'unknown';

    // Strategy 1: explicit prefix mapping (high confidence)
    const mappedSourceType = PREFIX_TO_SOURCE_TYPE[prefix];
    const mappedDocFamily = PREFIX_TO_DOC_FAMILY[prefix];

    if (mappedSourceType && mappedDocFamily) {
      return {
        sourceType: mappedSourceType,
        docFamily: mappedDocFamily,
        confidence: 0.95,
        strategy: `prefix_map:${prefix}`,
      };
    }

    // Strategy 2: infer from DB category/domain fields
    if (doc.category) {
      const categoryToFamily: Record<string, string> = {
        'catalog/gamme': 'gamme',
        'catalog/vehicle': 'vehicle',
        guide: 'maintenance',
        'guide/guide': 'maintenance',
        diagnostic: 'diagnostic',
        'diagnostic/diagnostic': 'diagnostic',
        definition: 'reference',
        'knowledge/faq': 'seo_support',
        'knowledge/policy': 'seo_support',
        'knowledge/canonical': 'reference',
      };
      const inferred = categoryToFamily[doc.category];
      if (inferred) {
        return {
          sourceType: mappedSourceType ?? 'markdown',
          docFamily: inferred,
          confidence: 0.8,
          strategy: `category_infer:${doc.category}`,
        };
      }
    }

    // Strategy 3: fallback — low confidence
    return {
      sourceType: 'markdown',
      docFamily: 'raw_capture',
      confidence: 0.3,
      strategy: 'fallback_unknown',
    };
  }

  // ── 1.5.4 — Routing ──────────────────────────────────────────

  private async resolveRouting(
    source: string,
    doc: { gamme_aliases?: string[]; title?: string },
    docFamily: string,
  ): Promise<{
    targetSurface: string;
    gammeAliases: string[];
    routingDecision: 'routed' | 'intake_pending' | 'quarantined';
    routingConfidence: number;
  }> {
    const prefix = source.match(/^([a-z-]+)[./]/)?.[1] ?? 'unknown';

    // If already in a canonical surface (not intake zone), keep it
    if (!INTAKE_ZONES.includes(prefix)) {
      const kbType = this.inferKbTypeFromFamily(docFamily);
      const surface = KB_TYPE_TO_SURFACE[kbType] ?? `${prefix}/`;
      const gammeAliases = doc.gamme_aliases ?? [];
      return {
        targetSurface: surface,
        gammeAliases,
        routingDecision: 'routed',
        routingConfidence: 0.95, // Already in canonical surface
      };
    }

    // Intake zone — need to detect gamme and route
    const gammeAliases = doc.gamme_aliases ?? [];

    // Use gamme detection if no aliases yet
    if (gammeAliases.length === 0) {
      try {
        const knowledgePath =
          this.configService.get<string>('RAG_KNOWLEDGE_PATH') ||
          '/opt/automecanik/rag/knowledge';
        const fullPath = `${knowledgePath}/${source}${source.endsWith('.md') ? '' : '.md'}`;
        const detected =
          await this.gammeDetectionService.resolveGammesFromFiles([fullPath]);
        // Extract aliases from the Map<alias, filePath[]>
        for (const [alias] of detected) {
          gammeAliases.push(alias);
        }
      } catch (err) {
        this.logger.warn(
          `resolveRouting: gamme detection failed for "${source}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Determine target surface from doc family
    const kbType = this.inferKbTypeFromFamily(docFamily);
    const surface = KB_TYPE_TO_SURFACE[kbType] ?? '_quarantine/';

    if (surface === '_quarantine/') {
      return {
        targetSurface: surface,
        gammeAliases,
        routingDecision: 'quarantined',
        routingConfidence: 0.3, // Quarantined = low confidence
      };
    }

    return {
      targetSurface: surface,
      gammeAliases,
      routingDecision: gammeAliases.length > 0 ? 'routed' : 'intake_pending',
      routingConfidence: gammeAliases.length > 0 ? 0.8 : 0.4,
    };
  }

  private inferKbTypeFromFamily(docFamily: string): string {
    const familyToKb: Record<string, string> = {
      gamme: KnowledgeDocType.KB_GAMME,
      catalog: KnowledgeDocType.KB_GAMME,
      vehicle: KnowledgeDocType.KB_GAMME,
      brand: KnowledgeDocType.KB_GAMME,
      reference: KnowledgeDocType.KB_REFERENCE,
      maintenance: KnowledgeDocType.KB_REFERENCE,
      diagnostic: KnowledgeDocType.KB_DIAGNOSTIC,
      seo_support: KnowledgeDocType.KB_SUPPORT,
      raw_capture: KnowledgeDocType.QUARANTINE,
      media_prompt: KnowledgeDocType.KB_SUPPORT,
    };
    return familyToKb[docFamily] ?? KnowledgeDocType.QUARANTINE;
  }

  // ── 1.5.5 — Collision Scan ────────────────────────────────────

  private async scanCollisions(
    source: string,
    doc: {
      id: string;
      content_hash?: string;
      fingerprint?: string;
      truth_level?: string;
    },
    canonicalSourceKey: string,
    normalizedSourceUrl?: string,
    gammeAliases?: string[],
  ): Promise<CollisionPack> {
    const details: CollisionDetail[] = [];

    // a. Source URL collision
    if (normalizedSourceUrl) {
      const { data: urlMatches } = await this.supabase
        .from('__rag_knowledge')
        .select('id, source, source_url')
        .neq('source', source)
        .eq('status', 'active')
        .ilike('source_url', normalizedSourceUrl)
        .limit(5);

      if (urlMatches && urlMatches.length > 0) {
        for (const match of urlMatches) {
          details.push({
            type: 'source_url',
            existingDocId: match.id,
            existingSource: match.source,
            detected: true,
            detectionConfidence: 0.8,
            resolved: true,
            resolution: 'secondary_duplicate',
            reason: `Same normalized source_url: ${normalizedSourceUrl}`,
          });
        }
      }
    }

    // b. Content collision (exact fingerprint match)
    if (doc.fingerprint) {
      const { data: fpMatches } = await this.supabase
        .from('__rag_knowledge')
        .select('id, source')
        .neq('source', source)
        .eq('fingerprint', doc.fingerprint)
        .eq('status', 'active')
        .limit(5);

      if (fpMatches && fpMatches.length > 0) {
        for (const match of fpMatches) {
          details.push({
            type: 'content',
            existingDocId: match.id,
            existingSource: match.source,
            detected: true,
            detectionConfidence: 1.0, // Exact hash match = certain
            resolved: true,
            resolution: 'secondary_duplicate',
            reason: `Exact fingerprint match`,
          });
        }
      }
    }

    // c. Target collision (same gamme alias, different source)
    if (gammeAliases && gammeAliases.length > 0) {
      for (const alias of gammeAliases) {
        const { data: targetMatches } = await this.supabase
          .from('__rag_knowledge')
          .select('id, source, truth_level')
          .neq('source', source)
          .contains('gamme_aliases', [alias])
          .eq('status', 'active')
          .limit(10);

        if (targetMatches && targetMatches.length > 0) {
          // Multiple docs targeting same gamme = not a collision, it's expected
          // Only flag if same canonical key AND different trust levels
          for (const match of targetMatches) {
            if (
              match.truth_level &&
              doc.truth_level &&
              match.truth_level !== doc.truth_level
            ) {
              details.push({
                type: 'trust',
                existingDocId: match.id,
                existingSource: match.source,
                detected: true,
                detectionConfidence: 0.9,
                resolved: true,
                resolution: 'canonical_primary',
                reason: `Trust level mismatch: existing=${match.truth_level}, incoming=${doc.truth_level}`,
              });
            }
          }
        }
      }
    }

    // d. Canonical key collision
    const { data: keyMatches } = await this.supabase
      .from('__rag_knowledge')
      .select('id, source')
      .neq('source', source)
      .eq('canonical_source_key', canonicalSourceKey)
      .eq('status', 'active')
      .limit(5);

    if (keyMatches && keyMatches.length > 0) {
      for (const match of keyMatches) {
        details.push({
          type: 'routing',
          existingDocId: match.id,
          existingSource: match.source,
          detected: true,
          detectionConfidence: 0.95,
          resolved: false,
          resolution: 'manual_review_required',
          reason: `Canonical key collision: both map to ${canonicalSourceKey}`,
        });
      }
    }

    const hasBlocking = details.some(
      (d) =>
        d.resolution === 'alias_conflict_blocked' ||
        d.resolution === 'manual_review_required' ||
        d.resolution === 'rejected_invalid_identity',
    );

    return {
      sourceUrlCollision: details.some((d) => d.type === 'source_url'),
      contentCollision: details.some((d) => d.type === 'content'),
      targetCollision: details.some((d) => d.type === 'target'),
      trustCollision: details.some((d) => d.type === 'trust'),
      routingCollision: details.some((d) => d.type === 'routing'),
      versionCollision: false,
      collisionDetails: details,
      hasBlockingCollision: hasBlocking,
    };
  }

  // ── B — Canonical Status ───────────────────────────────────────

  private computeCanonicalStatus(
    phase15Status: Phase15Status,
  ): 'canonical' | 'provisional' | 'ambiguous' | 'blocked' {
    switch (phase15Status) {
      case 'normalized':
        return 'canonical';
      case 'normalized_with_warnings':
        return 'provisional';
      case 'review_required':
        return 'ambiguous';
      case 'blocked':
      case 'quarantined':
        return 'blocked';
      default:
        return 'blocked';
    }
  }

  // ── 1.5.7 — Phase 1.5 Status Gate ────────────────────────────

  private computePhase15Status(
    blockReasons: string[],
    warnings: string[],
    collisionPack: CollisionPack,
  ): Phase15Status {
    if (blockReasons.length > 0) {
      // Check if any reason warrants quarantine vs review
      const hasQuarantine = blockReasons.some(
        (r) =>
          r.includes('PHASE1_NOT_PASSED') || r.includes('ROUTING_QUARANTINED'),
      );
      if (hasQuarantine) return 'quarantined';

      const hasReview = blockReasons.some(
        (r) =>
          r.includes('COLLISION_BLOCKED') ||
          r.includes('LOW_CLASSIFICATION_CONFIDENCE'),
      );
      if (hasReview) return 'review_required';

      return 'blocked';
    }

    if (
      warnings.length > 0 ||
      collisionPack.collisionDetails.some(
        (d) => d.resolution === 'secondary_duplicate',
      )
    ) {
      return 'normalized_with_warnings';
    }

    return 'normalized';
  }

  // ── Persistence ───────────────────────────────────────────────

  private async persistNormalizationRecord(
    source: string,
    record: NormalizationRecord,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('__rag_knowledge')
      .update({
        phase15_status: record.phase15Status,
        canonical_doc_id: record.canonicalDocId,
        canonical_status: record.canonicalStatus,
        doc_family: record.docFamily,
        target_surface: record.targetSurface,
        normalization_record: record,
        collision_pack: record.collisionPack ?? null,
        gamme_aliases: record.gammeAliases,
      })
      .eq('source', source);

    if (error) {
      this.logger.error(
        `persistNormalizationRecord: failed for "${source}": ${error.message}`,
      );
      throw error;
    }
  }

  // ── Blocked record helper ─────────────────────────────────────

  private buildBlockedRecord(
    source: string,
    now: string,
    reasons: string[],
  ): NormalizationRecord {
    return {
      canonicalDocId: randomUUID(),
      canonicalSourceKey: `blocked:${source}`,
      sourceType: 'markdown',
      docFamily: 'raw_capture',
      classificationConfidence: 0,
      classificationStrategy: 'blocked',
      targetSurface: '_quarantine/',
      gammeAliases: [],
      routingDecision: 'quarantined',
      routingConfidence: 0,
      collisionConfidence: 1.0,
      canonicalStatus: 'blocked',
      publicationTargetReady: false,
      phase15Status: 'blocked',
      blockReasons: reasons,
      normalizedAt: now,
    };
  }
}
