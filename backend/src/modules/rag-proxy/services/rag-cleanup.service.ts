import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type {
  RagDocInput,
  IngestDecision,
  CleanupReport,
} from '../types/rag-ingest.types';

/**
 * Compatibility matrix: source prefix → allowed categories + truth levels.
 * Documents failing this check are quarantined automatically.
 */
const COMPATIBILITY_MATRIX: Record<
  string,
  { categories: string[]; truthLevels: string[] }
> = {
  gammes: {
    categories: ['catalog/gamme', 'gamme'],
    truthLevels: ['L1', 'L2'],
  },
  guides: {
    categories: ['guide', 'knowledge/guide', 'guide/guide'],
    truthLevels: ['L1', 'L2'],
  },
  diagnostic: {
    categories: ['diagnostic/diagnostic', 'diagnostic'],
    truthLevels: ['L2'],
  },
  web: {
    categories: ['catalog/gamme', 'guide'],
    truthLevels: ['L2', 'L3'],
  },
  'web-catalog': {
    categories: ['catalog/gamme', 'catalog/vehicle'],
    truthLevels: ['L2', 'L3'],
  },
  faq: { categories: ['knowledge/faq'], truthLevels: ['L1', 'L2'] },
  canonical: { categories: ['knowledge/canonical'], truthLevels: ['L1'] },
  policies: { categories: ['knowledge/policy'], truthLevels: ['L1'] },
  vehicle: { categories: ['catalog/vehicle'], truthLevels: ['L2'] },
  vehicles: { categories: ['catalog/vehicle'], truthLevels: ['L2'] },
  reference: { categories: ['definition'], truthLevels: ['L1', 'L2'] },
  canon: {
    categories: ['definition', 'diagnostic'],
    truthLevels: ['L1'],
  },
};

/** Per-domain active document quotas. */
const DOMAIN_QUOTAS: Record<string, number> = {
  freinage: 40,
  accessoires: 35,
  moteur: 35,
  alimentation: 30,
  eclairage: 25,
  knowledge: 30,
  catalog: 20,
};
const DEFAULT_QUOTA = 20;

@Injectable()
export class RagCleanupService extends SupabaseBaseService {
  protected override readonly logger = new Logger(RagCleanupService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  // ── Fingerprint ────────────────────────────────────────────────

  /**
   * Compute a stable SHA-256 fingerprint (hex[:16]) from normalized content.
   * Unicode-aware: keeps letters + numbers + spaces.
   */
  computeFingerprint(content: string): string {
    const normalized = content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .trim();
    return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  // ── Source helpers ─────────────────────────────────────────────

  private getSourcePrefix(source: string): string {
    const match = source.match(/^([a-z-]+)[./]/);
    return match?.[1] ?? 'unknown';
  }

  private extractSectionGroup(source: string): string | null {
    if (!/-s[0-9]{3}(\.md)?$/.test(source)) return null;
    return source.replace(/-s[0-9]{3}(\.md)?$/, '');
  }

  // ── Decision pipeline (gatekeeper) ────────────────────────────

  /**
   * 4-gate ingestion pipeline:
   *  1. Compatibility matrix validation
   *  2. Domain quota check
   *  3. Exact fingerprint dedup
   *  4. Retrievable computation
   */
  async decideIngest(doc: RagDocInput): Promise<IngestDecision> {
    const fingerprint = this.computeFingerprint(doc.content);
    const parentSource = this.extractSectionGroup(doc.source) ?? doc.source;

    // Gate 1: compatibility matrix
    const compat = this.validateCompatibility(doc);
    if (!compat.valid) {
      return {
        decision: 'REJECT_QUARANTINE',
        reasons: [compat.reason!],
        fingerprint,
        parent_source: parentSource,
        proposed: { status: 'quarantine', retrievable: false },
      };
    }

    // Gate 2: domain quota
    const quota = await this.checkDomainQuota(doc.domain);
    if (!quota.allowed) {
      return {
        decision: 'ARCHIVE_BY_QUOTA',
        reasons: [
          `DOMAIN_QUOTA_EXCEEDED: ${doc.domain} (${quota.current}/${quota.max})`,
        ],
        fingerprint,
        parent_source: parentSource,
        proposed: { status: 'archived', retrievable: false },
      };
    }

    // Gate 3: exact fingerprint dedup
    const dup = await this.findExactDuplicate(fingerprint);
    if (dup) {
      return {
        decision: 'ARCHIVE_AS_DUPLICATE',
        reasons: [`EXACT_FINGERPRINT_DUPLICATE: matches id=${dup.id}`],
        fingerprint,
        parent_source: parentSource,
        proposed: {
          status: 'archived',
          retrievable: false,
          duplicate_of_id: dup.id,
        },
      };
    }

    // Gate 4: retrievable?
    const retrievable = this.computeRetrievable(doc);
    const reasons: string[] = [];
    if (!retrievable) reasons.push('NON_RETRIEVABLE_DEFAULT');

    return {
      decision: 'ACCEPT_UPSERT',
      reasons,
      fingerprint,
      parent_source: parentSource,
      proposed: { status: 'active', retrievable },
    };
  }

  // ── Apply ─────────────────────────────────────────────────────

  /**
   * Upsert a document based on the decision. Uses onConflict('source')
   * which requires the UNIQUE index on __rag_knowledge(source).
   */
  async applyIngest(
    doc: RagDocInput,
    decision: IngestDecision,
  ): Promise<{ id: string }> {
    const payload = {
      title: doc.title,
      content: doc.content,
      source: decision.parent_source,
      truth_level: doc.truth_level,
      domain: doc.domain,
      category: doc.category,
      status: decision.proposed.status,
      retrievable: decision.proposed.retrievable,
      fingerprint: decision.fingerprint,
      quarantine_reason:
        decision.decision === 'REJECT_QUARANTINE'
          ? decision.reasons.join('; ')
          : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('__rag_knowledge')
      .upsert(payload, { onConflict: 'source' })
      .select('id')
      .single();

    if (error) throw error;
    return { id: data.id };
  }

  // ── Validation ────────────────────────────────────────────────

  /**
   * Check source prefix against the compatibility matrix.
   */
  validateCompatibility(doc: RagDocInput): {
    valid: boolean;
    reason?: string;
  } {
    const prefix = this.getSourcePrefix(doc.source);
    const matrix = COMPATIBILITY_MATRIX[prefix];
    if (!matrix)
      return { valid: false, reason: `UNKNOWN_SOURCE_PREFIX: ${prefix}` };
    if (!matrix.categories.includes(doc.category))
      return {
        valid: false,
        reason: `CATEGORY_MISMATCH: ${doc.category} not in [${matrix.categories}]`,
      };
    if (!matrix.truthLevels.includes(doc.truth_level))
      return {
        valid: false,
        reason: `TRUTH_LEVEL_MISMATCH: ${doc.truth_level} not in [${matrix.truthLevels}]`,
      };
    return { valid: true };
  }

  /**
   * Determine if a document should be retrievable by default.
   * L4 (draft) and policy docs are non-retrievable unless intent-opened.
   */
  computeRetrievable(doc: RagDocInput): boolean {
    if (doc.truth_level === 'L4') return false;
    if (doc.category === 'knowledge/policy') return false;
    return true;
  }

  /**
   * Find an active document with the same fingerprint (exact content match).
   */
  async findExactDuplicate(
    fingerprint: string,
  ): Promise<{ id: string } | null> {
    const { data } = await this.supabase
      .from('__rag_knowledge')
      .select('id')
      .eq('fingerprint', fingerprint)
      .eq('status', 'active')
      .limit(1);
    return data?.[0] ?? null;
  }

  /**
   * Check if a domain has room for more active documents.
   */
  async checkDomainQuota(
    domain: string,
  ): Promise<{ allowed: boolean; current: number; max: number }> {
    const max = DOMAIN_QUOTAS[domain] ?? DEFAULT_QUOTA;
    const { count } = await this.supabase
      .from('__rag_knowledge')
      .select('*', { count: 'exact', head: true })
      .eq('domain', domain)
      .eq('status', 'active');
    return { allowed: (count ?? 0) < max, current: count ?? 0, max };
  }

  // ── Batch cleanup (scan existing corpus) ──────────────────────

  /**
   * Scan all active documents for exact fingerprint duplicates.
   * mode='dry' returns a report without modifying data.
   * mode='commit' archives duplicates (keeping the earliest by source).
   */
  async runCleanupBatch(mode: 'dry' | 'commit'): Promise<CleanupReport> {
    const { data: docs } = await this.supabase
      .from('__rag_knowledge')
      .select('id, source, domain, category, content, fingerprint')
      .eq('status', 'active');

    const report: CleanupReport = {
      timestamp: new Date().toISOString(),
      dryRun: mode === 'dry',
      stats: {
        archived: 0,
        merged: 0,
        kept: 0,
        quarantined: 0,
        internal_only: 0,
      },
      actions: [],
    };

    // Build hash groups for exact dedup
    const hashMap = new Map<string, typeof docs>();
    for (const doc of docs ?? []) {
      const fp = doc.fingerprint ?? this.computeFingerprint(doc.content);
      const group = hashMap.get(fp) ?? [];
      group.push(doc);
      hashMap.set(fp, group);
    }

    for (const [, group] of hashMap) {
      if (group.length <= 1) {
        report.stats.kept++;
        continue;
      }
      // Keep earliest by source (lexicographic), archive the rest
      const sorted = group.sort((a, b) => a.source.localeCompare(b.source));
      report.stats.kept++;
      for (const dup of sorted.slice(1)) {
        report.actions.push({
          docId: dup.id,
          action: 'ARCHIVE',
          reason: `exact_dup_of_${sorted[0].source}`,
          source: dup.source,
        });
        report.stats.archived++;
        if (mode === 'commit') {
          await this.supabase
            .from('__rag_knowledge')
            .update({
              status: 'archived',
              retrievable: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', dup.id);
        }
      }
    }

    this.logger.log(`Cleanup batch ${mode}: ${JSON.stringify(report.stats)}`);
    return report;
  }

  // ── Backfill fingerprints ─────────────────────────────────────

  /**
   * Compute and store fingerprints for active documents that don't have one.
   * Processes in batches to avoid overloading the database.
   */
  async backfillFingerprints(batchSize = 50): Promise<number> {
    const { data: docs } = await this.supabase
      .from('__rag_knowledge')
      .select('id, content')
      .is('fingerprint', null)
      .eq('status', 'active')
      .limit(batchSize);

    let updated = 0;
    for (const doc of docs ?? []) {
      const fp = this.computeFingerprint(doc.content);
      await this.supabase
        .from('__rag_knowledge')
        .update({ fingerprint: fp })
        .eq('id', doc.id);
      updated++;
    }
    this.logger.log(`Backfilled ${updated} fingerprints`);
    return updated;
  }
}
