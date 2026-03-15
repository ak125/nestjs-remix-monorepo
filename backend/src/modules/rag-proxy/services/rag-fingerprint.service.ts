import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type {
  FingerprintPack,
  IdempotenceDecision,
} from '../types/rag-contracts.types';

/**
 * RagFingerprintService — Phase 1 Ingestion Foundation.
 *
 * Responsible for:
 * - Computing 5 distinct hashes (normalized_source_key, canonical_source_key,
 *   raw_hash, content_hash, publication_hash)
 * - Idempotence decisions (noop / new_version / semantic_duplicate / reject)
 * - Write-safety checks (L1 protection, trust hierarchy)
 */
@Injectable()
export class RagFingerprintService extends SupabaseBaseService {
  protected override readonly logger = new Logger(RagFingerprintService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  // ── Hash computation ────────────────────────────────────────

  /**
   * Normalize a source identifier (URL, file path) into a stable key.
   * Strips protocol, trailing slashes, query params, fragments.
   */
  normalizeSourceKey(source: string): string {
    let key = source
      .replace(/^https?:\/\//, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase()
      .trim();
    // Normalize file paths: collapse slashes, remove .md extension
    key = key.replace(/\/+/g, '/').replace(/\.md$/, '');
    return key;
  }

  /**
   * Compute canonical source key — the final business-level identity.
   * For gamme docs: pg_alias. For web: normalized URL. For PDFs: filename slug.
   */
  computeCanonicalKey(
    normalizedKey: string,
    metadata?: { pgAlias?: string; slug?: string },
  ): string {
    if (metadata?.pgAlias) return `gamme:${metadata.pgAlias}`;
    if (metadata?.slug) return `doc:${metadata.slug}`;
    return `src:${normalizedKey}`;
  }

  /** SHA-256 hash of raw input bytes (before any transformation). */
  computeRawHash(rawContent: string): string {
    return createHash('sha256').update(rawContent).digest('hex');
  }

  /**
   * SHA-256 hash of extracted + normalized text.
   * Unicode-aware: keeps letters, numbers, spaces.
   */
  computeContentHash(extractedText: string): string {
    const normalized = extractedText
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .trim();
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * SHA-256 hash of the final published content (after enrichment + frontmatter).
   */
  computePublicationHash(publishedContent: string): string {
    return createHash('sha256').update(publishedContent).digest('hex');
  }

  /** Build the full fingerprint pack for a document. */
  buildFingerprintPack(
    source: string,
    rawContent: string,
    extractedText: string,
    metadata?: { pgAlias?: string; slug?: string },
  ): FingerprintPack {
    const normalizedSourceKey = this.normalizeSourceKey(source);
    return {
      normalizedSourceKey,
      canonicalSourceKey: this.computeCanonicalKey(
        normalizedSourceKey,
        metadata,
      ),
      rawHash: this.computeRawHash(rawContent),
      contentHash: this.computeContentHash(extractedText),
    };
  }

  // ── Idempotence decision ────────────────────────────────────

  /**
   * Check if a document with the same canonical key already exists and decide:
   * - same canonical + same content_hash → noop_completed
   * - same canonical + different content_hash → new_version
   * - different source + same publication_hash → possible_semantic_duplicate
   * - source invalid → reject
   */
  async checkIdempotence(
    fingerprints: FingerprintPack,
  ): Promise<IdempotenceDecision> {
    if (!fingerprints.canonicalSourceKey) {
      return { action: 'reject', reason: 'No canonical source key' };
    }

    // Check by canonical key in rag_documents
    const { data: existing } = await this.supabase
      .from('rag_documents')
      .select('id, content_hash, lifecycle_status')
      .eq('canonical_source_key', fingerprints.canonicalSourceKey)
      .not('lifecycle_status', 'eq', 'tombstoned')
      .limit(1);

    if (existing && existing.length > 0) {
      const doc = existing[0];
      if (doc.content_hash === fingerprints.contentHash) {
        return {
          action: 'noop_completed',
          reason: `Same canonical key + same content hash (doc ${doc.id})`,
          existingDocumentId: doc.id,
        };
      }
      return {
        action: 'new_version',
        reason: `Same canonical key, content changed (doc ${doc.id})`,
        existingDocumentId: doc.id,
      };
    }

    // Check for semantic duplicates by publication hash
    if (fingerprints.publicationHash) {
      const { data: semDups } = await this.supabase
        .from('rag_documents')
        .select('id, canonical_source_key')
        .eq('publication_hash', fingerprints.publicationHash)
        .not('lifecycle_status', 'eq', 'tombstoned')
        .limit(1);

      if (semDups && semDups.length > 0) {
        return {
          action: 'possible_semantic_duplicate',
          reason: `Different source but same publication hash (doc ${semDups[0].id}, key=${semDups[0].canonical_source_key})`,
          existingDocumentId: semDups[0].id,
        };
      }
    }

    return { action: 'new_version', reason: 'New document' };
  }

  // ── Write Safety (G5) ──────────────────────────────────────

  /**
   * Check if writing to a document is safe.
   * Rules:
   * - Never overwrite L1 (canonical) with lower truth level
   * - Never overwrite a published doc with a less trustworthy source
   */
  async checkWriteSafety(
    canonicalKey: string,
    incomingTruthLevel: string,
  ): Promise<{ safe: boolean; reason?: string }> {
    const { data: existing } = await this.supabase
      .from('rag_documents')
      .select('id, truth_level, lifecycle_status')
      .eq('canonical_source_key', canonicalKey)
      .in('lifecycle_status', ['published', 'activated'])
      .limit(1);

    if (!existing || existing.length === 0) {
      return { safe: true };
    }

    const doc = existing[0];
    const trustOrder: Record<string, number> = {
      L1: 4,
      L2: 3,
      L3: 2,
      L4: 1,
    };
    const existingTrust = trustOrder[doc.truth_level] ?? 0;
    const incomingTrust = trustOrder[incomingTruthLevel] ?? 0;

    if (doc.truth_level === 'L1' && incomingTruthLevel !== 'L1') {
      return {
        safe: false,
        reason: `WRITE_SAFETY: Cannot overwrite L1 canonical document (doc ${doc.id}) with ${incomingTruthLevel}`,
      };
    }

    if (incomingTrust < existingTrust) {
      return {
        safe: false,
        reason: `WRITE_SAFETY: Cannot overwrite ${doc.truth_level} document (doc ${doc.id}) with lower trust ${incomingTruthLevel}`,
      };
    }

    return { safe: true };
  }
}
