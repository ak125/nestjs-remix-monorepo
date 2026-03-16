import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { FrontmatterValidatorService } from './frontmatter-validator.service';
import { RagFingerprintService } from './rag-fingerprint.service';
import { RagNormalizationService } from './rag-normalization.service';
import { RagAdmissibilityGateService } from './rag-admissibility-gate.service';
import type {
  RagDocInput,
  IngestDecision,
  CleanupReport,
} from '../types/rag-ingest.types';
import type { TruthLevel } from '../types/rag-ingest.types';
import type { IngestionReceipt } from '../types/rag-contracts.types';
import type { Phase1Status } from '../types/rag-state.types';

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
    categories: [
      'catalog/gamme',
      'guide',
      'knowledge',
      'knowledge/guide',
      'catalog/vehicle',
    ],
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

  /** Public accessor for the Supabase client (used by RagKnowledgeService). */
  get client() {
    return this.supabase;
  }

  constructor(
    configService: ConfigService,
    @Inject(forwardRef(() => FrontmatterValidatorService))
    private readonly frontmatterValidator: FrontmatterValidatorService,
    @Inject(forwardRef(() => RagFingerprintService))
    private readonly ragFingerprintService: RagFingerprintService,
    @Inject(forwardRef(() => RagNormalizationService))
    private readonly ragNormalizationService: RagNormalizationService,
    @Inject(forwardRef(() => RagAdmissibilityGateService))
    private readonly ragAdmissibilityGateService: RagAdmissibilityGateService,
  ) {
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
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
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
      updated_at: now,
    };

    // Phase 1: persist fingerprint pack + provenance if available
    if (decision.fingerprintPack) {
      payload.normalized_source_key =
        decision.fingerprintPack.normalizedSourceKey;
      payload.canonical_source_key =
        decision.fingerprintPack.canonicalSourceKey;
      payload.raw_hash = decision.fingerprintPack.rawHash;
      payload.content_hash = decision.fingerprintPack.contentHash;
      payload.publication_hash = decision.fingerprintPack.publicationHash;
    }
    if (doc.source_url) payload.source_url = doc.source_url;
    if (doc.gamme_aliases) payload.gamme_aliases = doc.gamme_aliases;
    if (doc.job_origin) payload.job_origin = doc.job_origin;
    payload.pipeline_version = '2.0';

    // Phase 1 R4: set phase barrier status
    const phase1Status: Phase1Status =
      decision.decision === 'REJECT_QUARANTINE'
        ? 'quarantined'
        : decision.decision === 'ACCEPT_UPSERT'
          ? 'passed'
          : 'failed';
    payload.phase1_status = phase1Status;
    payload.foundation_gate_passed = phase1Status === 'passed';

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

  // ── File → DB sync ───────────────────────────────────────────

  /** Default fallback maps when frontmatter fields are missing. */
  private static readonly PREFIX_DEFAULTS: Record<
    string,
    { category: string; domain: string }
  > = {
    web: { category: 'guide', domain: 'knowledge' },
    'web-catalog': { category: 'catalog/gamme', domain: 'catalog' },
    gammes: { category: 'catalog/gamme', domain: 'catalog' },
    guides: { category: 'guide', domain: 'knowledge' },
    diagnostic: { category: 'diagnostic', domain: 'knowledge' },
    faq: { category: 'knowledge/faq', domain: 'knowledge' },
    canonical: { category: 'knowledge/canonical', domain: 'knowledge' },
    reference: { category: 'definition', domain: 'knowledge' },
    policies: { category: 'knowledge/policy', domain: 'knowledge' },
    vehicle: { category: 'catalog/vehicle', domain: 'catalog' },
    vehicles: { category: 'catalog/vehicle', domain: 'catalog' },
    canon: { category: 'definition', domain: 'knowledge' },
  };

  /**
   * Read validated .md files from disk and upsert them into __rag_knowledge.
   * Each file goes through decideIngest() → applyIngest().
   *
   * @param filePaths  Absolute or relative paths to .md files
   * @param knowledgeBasePath  Root of the knowledge directory (used to compute relative source key)
   */
  async syncFilesToDb(
    filePaths: string[],
    knowledgeBasePath: string,
  ): Promise<{
    synced: number;
    skipped: number;
    errors: string[];
    receipts: IngestionReceipt[];
  }> {
    const result = {
      synced: 0,
      skipped: 0,
      errors: [] as string[],
      receipts: [] as IngestionReceipt[],
    };
    const now = new Date().toISOString();

    for (const fp of filePaths) {
      // R1: build receipt progressively with R2 sub-statuses
      const receipt: IngestionReceipt = {
        jobId: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sourceType: 'markdown',
        sourceLocator: fp,
        storagePath: fp,
        dbRecordId: null,
        receptionSuccess: false,
        storageSuccess: false,
        reconciliationSuccess: false,
        acceptanceDecision: 'skipped',
        provenanceStatus: 'missing',
        writeSafetyStatus: 'skipped',
        finalStatus: 'failed',
        phase1Status: 'failed',
        ingestedAt: now,
        reasons: [],
      };

      try {
        const absPath = path.isAbsolute(fp)
          ? fp
          : path.join(knowledgeBasePath, fp);
        const content = readFileSync(absPath, 'utf-8');
        receipt.receptionSuccess = true;

        // Parse frontmatter
        const fm = this.frontmatterValidator.parseFrontmatter(content);
        receipt.storageSuccess = true;

        // Strip frontmatter to get body
        const body = content
          .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
          .trim();
        if (!body) {
          result.skipped++;
          receipt.acceptanceDecision = 'skipped';
          receipt.finalStatus = 'skipped';
          receipt.reasons.push('EMPTY_BODY');
          this.logger.warn(`syncFilesToDb: empty body, skipping ${fp}`);
          result.receipts.push(receipt);
          continue;
        }

        // Compute relative source key (e.g. "web/2d8006fe60a7-s001")
        const relPath = path.isAbsolute(fp)
          ? path.relative(knowledgeBasePath, fp)
          : fp;
        const source = relPath.replace(/\.md$/, '');

        // Infer defaults from path prefix
        const prefix = this.getSourcePrefix(source);
        const defaults = RagCleanupService.PREFIX_DEFAULTS[prefix] ?? {
          category: 'guide',
          domain: 'knowledge',
        };

        // Use frontmatter category only if it's in the compatibility matrix
        const matrix = COMPATIBILITY_MATRIX[prefix];
        const fmCategoryValid =
          fm.category && matrix?.categories.includes(fm.category);

        const doc: RagDocInput = {
          title: fm.title || path.basename(source),
          content: body,
          source,
          truth_level: (fm.truth_level as TruthLevel) || 'L2',
          domain: fm.domain || defaults.domain,
          category: fmCategoryValid ? fm.category! : defaults.category,
        };

        // Provenance check
        receipt.provenanceStatus =
          fm.title && fm.truth_level && fm.domain
            ? 'valid'
            : fm.title || fm.truth_level
              ? 'incomplete'
              : 'missing';

        // Phase 1: Build fingerprint pack for traceability
        const fingerprintPack = this.ragFingerprintService.buildFingerprintPack(
          source,
          content,
          body,
          { pgAlias: fm.pg_alias, slug: fm.slug },
        );
        receipt.fingerprintPack = fingerprintPack;

        // Phase 1 G5: Write safety check — never overwrite L1 with lower trust
        const writeSafety = await this.ragFingerprintService.checkWriteSafety(
          fingerprintPack.canonicalSourceKey ?? source,
          doc.truth_level,
        );
        receipt.writeSafetyStatus = writeSafety.safe ? 'safe' : 'blocked';
        if (!writeSafety.safe) {
          result.skipped++;
          receipt.acceptanceDecision = 'rejected';
          receipt.finalStatus = 'rejected';
          receipt.phase1Status = 'failed';
          receipt.reasons.push(writeSafety.reason ?? 'WRITE_SAFETY_BLOCKED');
          this.logger.warn(
            `syncFilesToDb: WRITE_SAFETY blocked ${source} — ${writeSafety.reason}`,
          );
          result.receipts.push(receipt);
          continue;
        }

        const decision = await this.decideIngest(doc);

        // Attach Phase 1 metadata to decision
        decision.fingerprintPack = fingerprintPack;
        decision.writeSafety = writeSafety;

        if (decision.decision === 'ACCEPT_UPSERT') {
          const { id } = await this.applyIngest(doc, decision);
          receipt.dbRecordId = id;
          receipt.reconciliationSuccess = true;
          receipt.acceptanceDecision = 'accepted';
          receipt.finalStatus = 'accepted';
          receipt.phase1Status = 'passed';
          result.synced++;
          this.logger.log(`syncFilesToDb: upserted ${source}`);

          // Phase 1.5: normalize after successful Phase 1 ingestion
          try {
            await this.ragNormalizationService.normalize(source);
          } catch (normErr) {
            const normMsg =
              normErr instanceof Error ? normErr.message : String(normErr);
            this.logger.warn(
              `syncFilesToDb: Phase 1.5 normalization failed for ${source}: ${normMsg}`,
            );
          }

          // Phase 1.6: evaluate business admissibility after normalization
          try {
            await this.ragAdmissibilityGateService.evaluate(source);
          } catch (admErr) {
            const admMsg =
              admErr instanceof Error ? admErr.message : String(admErr);
            this.logger.warn(
              `syncFilesToDb: Phase 1.6 admissibility failed for ${source}: ${admMsg}`,
            );
          }
        } else if (decision.decision === 'REJECT_QUARANTINE') {
          await this.applyIngest(doc, decision);
          receipt.reconciliationSuccess = true;
          receipt.acceptanceDecision = 'quarantined';
          receipt.finalStatus = 'quarantined';
          receipt.phase1Status = 'quarantined';
          result.skipped++;
          receipt.reasons.push(...decision.reasons);
        } else {
          receipt.acceptanceDecision = 'skipped';
          receipt.finalStatus = 'skipped';
          receipt.phase1Status = 'failed';
          receipt.reasons.push(...decision.reasons);
          result.skipped++;
          this.logger.log(
            `syncFilesToDb: ${decision.decision} ${source} — ${decision.reasons.join(', ')}`,
          );
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null
              ? JSON.stringify(err)
              : String(err);
        result.errors.push(`${fp}: ${msg}`);
        receipt.finalStatus = 'failed';
        receipt.phase1Status = 'failed';
        receipt.reasons.push(msg);
        this.logger.error(`syncFilesToDb error on ${fp}: ${msg}`);
      }
      result.receipts.push(receipt);
    }

    this.logger.log(
      `syncFilesToDb complete: ${result.synced} synced, ${result.skipped} skipped, ${result.errors.length} errors, ${result.receipts.length} receipts`,
    );
    return result;
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
