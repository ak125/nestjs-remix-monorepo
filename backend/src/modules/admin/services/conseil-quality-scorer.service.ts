/**
 * ConseilQualityScorerService — Scores individual conseil sections and pack coverage.
 * Populates sgc_quality_score for existing rows (backfill) and new content.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import {
  PageRoleValidatorService,
  type PageValidationResult,
} from '../../seo/validation/page-role-validator.service';
import {
  KeywordPlanGatesService,
  type ConseilSectionRow,
} from './keyword-plan-gates.service';
import { PLANNABLE_SECTIONS } from '../../../config/keyword-plan.constants';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { hasDeclaredSourceReferences } from '../../blog/utils/source-provenance.util';
import { deduplicateWords } from '../../blog/utils/html-normalize.utils';
import {
  type PackLevel,
  PACK_DEFINITIONS,
  SECTION_QUALITY_CRITERIA,
  GENERIC_PHRASES,
  FORMAT_DETECTION,
} from '../../../config/conseil-pack.constants';

// ── Result types ─────────────────────────────────────────

export interface SectionScoreResult {
  score: number;
  penalties: Array<{ flag: string; points: number }>;
}

export interface PackCoverageResult {
  packLevel: PackLevel;
  requiredSections: string[];
  presentSections: string[];
  missingSections: string[];
  coverage: number;
  /** Average of exactly one valid score per required section, otherwise null. */
  avgQuality: number | null;
  /** Structural presence only; does not imply score qualification. */
  packComplete: boolean;
  /** Existing score thresholds only, not a factual or SEO ranking verdict. */
  qualityStatus: 'not_evaluable' | 'below_threshold' | 'meets_thresholds';
  unscoredSections: string[];
  invalidScoreSections: string[];
  duplicateSections: string[];
  lowQualitySections: string[];
}

export interface GammeCoverageResult {
  pgId: string;
  pgAlias: string;
  standard: PackCoverageResult;
  pro: PackCoverageResult;
  eeat: PackCoverageResult;
}

export interface BackfillResult {
  updated: number;
  failed: number;
  /** Rows no longer matching the conditional update; not successful writes. */
  skipped: number;
}

// Resource bounds for one explicit audit GET; these are not quality thresholds.
const RENDERED_HTML_MAX_BYTES = 2 * 1024 * 1024;
const RENDERED_HTML_TIMEOUT_MS = 15_000;

export interface RenderedR3Audit {
  scope: 'served_html';
  sourceVersionMatch: 'not_evaluated';
  requestedUrl: string | null;
  checkedAt: string;
  status: 'evaluated' | 'unavailable' | 'redirected';
  requiredAction:
    | 'none'
    | 'review_rendered_page'
    | 'review_redirect'
    | 'retry_rendered_audit'
    | 'configure_audit_target';
  reason?: string;
  httpStatus?: number;
  location?: string | null;
  htmlSha256?: string;
  bodyBytes?: number;
  roleValidation?: PageValidationResult;
}

// Validate the DB boundary before scoring; malformed rows cannot disappear from an audit.
const AuditSectionSchema = z.object({
  sgc_id: z.union([z.string(), z.number()]),
  sgc_section_type: z.string().nullable(),
  sgc_title: z.string().nullable(),
  sgc_content: z.string().nullable(),
  sgc_sources: z.string().nullable(),
  sgc_quality_score: z.number().nullable(),
});

@Injectable()
export class ConseilQualityScorerService extends SupabaseBaseService {
  private readonly log = new Logger(ConseilQualityScorerService.name);

  constructor(
    private readonly auditConfig: ConfigService,
    private readonly auditGates: KeywordPlanGatesService,
    private readonly roleValidator: PageRoleValidatorService,
  ) {
    super(auditConfig);
  }

  /** Read-only stored-content diagnosis plus a bounded GET of the configured served page. */
  async auditGamme(pgId: string, packLevel: PackLevel = 'standard') {
    const { data: gamme, error: gammeError } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias')
      .eq('pg_id', Number(pgId))
      .maybeSingle();
    if (gammeError)
      throw new ServiceUnavailableException('R3 gamme lookup failed');
    if (!gamme) throw new NotFoundException('R3 gamme not found');

    const { data, error, count } = await this.client
      .from('__seo_gamme_conseil')
      .select(
        'sgc_id, sgc_section_type, sgc_title, sgc_content, sgc_sources, sgc_quality_score',
        { count: 'exact' },
      )
      .eq('sgc_pg_id', pgId)
      .order('sgc_id', { ascending: true });
    // PostgREST may cap returned rows. A partial read must never look like a complete audit.
    if (error || !data || count === null || data.length !== count) {
      throw new ServiceUnavailableException(
        'R3 section read failed or incomplete',
      );
    }
    const parsed = z.array(AuditSectionSchema).safeParse(data);
    if (!parsed.success)
      throw new ServiceUnavailableException(
        'R3 section data outside audit contract',
      );

    const auditRows: ConseilSectionRow[] = [];
    const unmappedSectionIds: string[] = [];
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    const sections = parsed.data.map((row) => {
      const section = row.sgc_section_type;
      const isKnown =
        section !== null &&
        (PLANNABLE_SECTIONS as readonly string[]).includes(section);
      if (!isKnown) {
        unmappedSectionIds.push(String(row.sgc_id));
        return {
          rowId: String(row.sgc_id),
          sectionType: section,
          title: row.sgc_title,
          storedScore: row.sgc_quality_score,
          score: null,
          penalties: [],
        };
      }
      if (seen.has(section)) duplicates.add(section);
      seen.add(section);
      const content = row.sgc_content ?? '';
      const result = this.scoreSection(section, content, row.sgc_sources);
      auditRows.push({
        section_type: section,
        title: row.sgc_title,
        quality_score: result.score,
        content_len: this.stripHtml(content).length,
        content,
        sources: row.sgc_sources,
      });
      return {
        rowId: String(row.sgc_id),
        sectionType: section,
        title: row.sgc_title,
        storedScore: row.sgc_quality_score,
        ...result,
      };
    });
    const audit = this.auditGates.auditFromSections(auditRows, packLevel);
    const roleValidation = this.roleValidator.validateR3Sections(
      `/blog-pieces-auto/conseils/${gamme.pg_alias}`,
      auditRows.map((row) => ({
        sectionType: row.section_type,
        title: row.title,
        content: row.content ?? '',
      })),
    );
    const roleSectionsToReview = new Set<string>();
    for (const violation of roleValidation.violations) {
      if (violation.severity !== 'error') continue;
      const sectionType = violation.details?.sectionType;
      if (typeof sectionType === 'string') {
        roleSectionsToReview.add(sectionType);
      } else {
        // A page-level R3 finding cannot attribute blame to one section.
        // Keep the ordinary sections for review instead of guessing a winner.
        for (const row of auditRows) {
          if (row.section_type !== 'S2_DIAG')
            roleSectionsToReview.add(row.section_type);
        }
      }
    }
    for (const section of roleSectionsToReview) {
      audit.priority_fixes.push({
        section,
        issue: 'role_violation',
        current_score: audit.section_scores[section] ?? null,
        fix_type: 'improve',
      });
      if (!audit.sections_to_improve.includes(section))
        audit.sections_to_improve.push(section);
    }
    if (roleSectionsToReview.size > 0)
      audit.audit_summary += `, role_review=${roleSectionsToReview.size}`;
    const storedCanSkip =
      unmappedSectionIds.length === 0 &&
      duplicates.size === 0 &&
      roleValidation.isValid &&
      this.auditGates.shouldSkipGamme(audit, packLevel);
    const renderedPage = await this.auditRenderedPage(
      gamme.pg_alias,
      auditRows.map((row) => row.section_type),
    );
    return {
      pgId,
      pgAlias: gamme.pg_alias,
      pack: packLevel,
      renderedPage,
      storedCanSkip,
      pageReviewRequired: renderedPage.requiredAction !== 'none',
      scoreBasis: 'recomputed_heuristic' as const,
      roleValidation: { ...roleValidation, scope: 'stored_sections' as const },
      sections,
      unmappedSectionIds,
      duplicateSections: [...duplicates].sort(),
      audit,
      // A clean heuristic audit is not factual qualification or publication approval.
      canSkip:
        storedCanSkip &&
        renderedPage.status === 'evaluated' &&
        renderedPage.roleValidation?.isValid === true,
    };
  }

  /**
   * RR streams directly to Express, so the Nest return-value interceptor does
   * not see that HTML. The explicit audit reads the served document instead.
   * Never forward the audit caller's credentials, follow a redirect, or turn a
   * rendering finding into a stored-section rewrite without revision evidence.
   */
  private async auditRenderedPage(
    pgAlias: string,
    expectedSections: readonly string[],
  ): Promise<RenderedR3Audit> {
    const evidence: RenderedR3Audit = {
      scope: 'served_html',
      sourceVersionMatch: 'not_evaluated',
      requestedUrl: null,
      checkedAt: new Date().toISOString(),
      status: 'unavailable',
      requiredAction: 'configure_audit_target',
    };
    let target: URL;
    try {
      // BASE_URL already configures SEO consumers. No implicit production fallback.
      const base = new URL(this.auditConfig.get<string>('BASE_URL') ?? '');
      if (
        !['http:', 'https:'].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.pathname !== '/' ||
        base.search ||
        base.hash
      )
        return { ...evidence, reason: 'invalid_base_url' };
      if (typeof pgAlias !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(pgAlias))
        return { ...evidence, reason: 'invalid_gamme_alias' };
      target = new URL(`/blog-pieces-auto/conseils/${pgAlias}`, base);
    } catch {
      return { ...evidence, reason: 'invalid_base_url' };
    }
    evidence.requestedUrl = target.href;
    evidence.requiredAction = 'retry_rendered_audit';
    try {
      const response = await fetch(target, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(RENDERED_HTML_TIMEOUT_MS),
        headers: {
          Accept: 'text/html',
          'User-Agent': 'automecanik-r3-audit/1.0 (read-only)',
        },
      });
      evidence.httpStatus = response.status;
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        return {
          ...evidence,
          status: 'redirected',
          requiredAction: 'review_redirect',
          location: response.headers.get('location'),
        };
      }
      if (response.status !== 200) {
        await response.body?.cancel();
        return { ...evidence, reason: 'http_status' };
      }
      if (
        response.headers
          .get('content-type')
          ?.split(';')[0]
          .trim()
          .toLowerCase() !== 'text/html'
      ) {
        await response.body?.cancel();
        return { ...evidence, reason: 'non_html_response' };
      }
      if (
        Number(response.headers.get('content-length')) > RENDERED_HTML_MAX_BYTES
      ) {
        await response.body?.cancel();
        return { ...evidence, reason: 'html_size_limit' };
      }
      if (!response.body) return { ...evidence, reason: 'empty_response' };
      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > RENDERED_HTML_MAX_BYTES) {
            await reader.cancel();
            return { ...evidence, reason: 'html_size_limit' };
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
      const body = Buffer.concat(chunks);
      const roleValidation = this.roleValidator.validatePageWithHtml(
        target.pathname,
        '',
        body.toString('utf8'),
        undefined,
        expectedSections,
      );
      return {
        ...evidence,
        status: 'evaluated',
        requiredAction: roleValidation.isValid
          ? 'none'
          : 'review_rendered_page',
        htmlSha256: createHash('sha256').update(body).digest('hex'),
        bodyBytes: size,
        roleValidation,
      };
    } catch (error) {
      const name =
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        typeof error.name === 'string'
          ? error.name
          : '';
      return {
        ...evidence,
        reason: ['TimeoutError', 'AbortError'].includes(name)
          ? 'request_timeout'
          : 'fetch_failed',
      };
    }
  }

  // ── Public API ───────────────────────────────────────────

  /**
   * Heuristic section score (0-100), not a verdict on factual truth or ranking.
   */
  scoreSection(
    sectionType: string,
    content: string,
    sources: string | null,
  ): SectionScoreResult {
    const criteria =
      SECTION_QUALITY_CRITERIA[sectionType] || SECTION_QUALITY_CRITERIA['S1'];

    let score = 100;
    const penalties: Array<{ flag: string; points: number }> = [];

    // Measure text, not markup or accidental consecutive word padding. Reuse
    // the existing normalizer to its fixed point without rewriting the content.
    let stripped = this.stripHtml(content);
    let deduplicated = deduplicateWords(stripped);
    while (deduplicated !== stripped) {
      stripped = deduplicated;
      deduplicated = deduplicateWords(stripped);
    }
    const wordCount = stripped.split(/\s+/).filter(Boolean).length;

    // Content length
    if (stripped.length < criteria.minContentLength) {
      const p = 20;
      score -= p;
      penalties.push({ flag: 'CONTENT_TOO_SHORT', points: p });
    }

    // Word count
    if (wordCount < criteria.minWordCount) {
      const p = 15;
      score -= p;
      penalties.push({ flag: 'WORD_COUNT_LOW', points: p });
    }

    // Numbers required (S2 needs km/years)
    if (criteria.requiresNumbers && !this.hasNumbers(stripped)) {
      const p = 10;
      score -= p;
      penalties.push({ flag: 'MISSING_NUMBERS', points: p });
    }

    // List items required (S4, S5, etc.)
    if (criteria.requiresListItems) {
      const listItemCount = this.countListItems(content);
      if (listItemCount < criteria.minListItems) {
        const p = 15;
        score -= p;
        penalties.push({ flag: 'INSUFFICIENT_LIST_ITEMS', points: p });
      }
    }

    // Generic phrases
    const genericRatio = this.computeGenericRatio(stripped, wordCount);
    if (genericRatio > criteria.maxGenericRatio) {
      const p = criteria.genericPhrasesPenalty;
      score -= p;
      penalties.push({ flag: 'GENERIC_PHRASES', points: p });
    }

    // Required format (table, steps, checklist, faq, callout)
    if (criteria.requiredFormat && criteria.formatPenalty > 0) {
      const pattern = FORMAT_DETECTION[criteria.requiredFormat];
      if (pattern && !pattern.test(content)) {
        const p = criteria.formatPenalty;
        score -= p;
        penalties.push({ flag: 'MISSING_FORMAT', points: p });
      }
    }

    // Unresolved placeholders (#LinkGamme_301#, etc.)
    if (content.match(/#Link\w+_\d+#/g)) {
      const p = 25;
      score -= p;
      penalties.push({ flag: 'UNRESOLVED_PLACEHOLDER', points: p });
    }

    // FAQ substance check for S8 (min FAQ count from pack definition)
    if (sectionType === 'S8') {
      const faqCount = (content.match(/<details>/gi) || []).length;
      if (faqCount < PACK_DEFINITIONS.standard.minFaqCount) {
        const p = 20;
        score -= p;
        penalties.push({ flag: 'INSUFFICIENT_FAQ', points: p });
      }
    }

    // Stub list items detection (avg item < 30 chars = placeholder content)
    if (criteria.requiresListItems) {
      const listItems: string[] = content.match(/<li>[^<]+<\/li>/gi) || [];
      if (listItems.length >= criteria.minListItems) {
        let totalLen = 0;
        for (const li of listItems) {
          totalLen += li.replace(/<\/?li>/gi, '').length;
        }
        if (totalLen / listItems.length < 30) {
          const p = 15;
          score -= p;
          penalties.push({ flag: 'STUB_LIST_ITEMS', points: p });
        }
      }
    }

    // Declared references only; evidence qualification belongs to WIKI gates.
    if (!hasDeclaredSourceReferences(sources)) {
      const p = 15;
      score -= p;
      penalties.push({ flag: 'NO_SOURCES', points: p });
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      penalties,
    };
  }

  /**
   * Compute pack coverage for a single gamme.
   */
  async computeGammeCoverage(pgId: string): Promise<GammeCoverageResult> {
    const { data, error } = await this.client
      .from('__seo_gamme_conseil')
      .select('sgc_section_type, sgc_quality_score')
      .eq('sgc_pg_id', pgId)
      .not('sgc_section_type', 'is', null);

    if (error) {
      this.log.error(
        `Error loading sections for pg_id=${pgId}: ${error.message}`,
      );
      throw error;
    }

    const sections = (data || []) as Array<{
      sgc_section_type: string;
      sgc_quality_score: number | null;
    }>;

    // Get pg_alias from pieces_gamme
    const { data: gammeData } = await this.client
      .from('pieces_gamme')
      .select('pg_alias')
      .eq('pg_id', parseInt(pgId, 10))
      .single();

    const buildCoverage = (packLevel: PackLevel): PackCoverageResult => {
      const pack = PACK_DEFINITIONS[packLevel];
      const presentTypes = new Set(sections.map((s) => s.sgc_section_type));
      const presentSections = pack.requiredSections.filter((t) =>
        presentTypes.has(t),
      );
      const missingSections = pack.requiredSections.filter(
        (t) => !presentTypes.has(t),
      );

      const unscoredSections: string[] = [];
      const invalidScoreSections: string[] = [];
      const duplicateSections: string[] = [];
      const lowQualitySections: string[] = [];
      const scores: number[] = [];

      for (const sectionType of pack.requiredSections) {
        const rows = sections.filter((s) => s.sgc_section_type === sectionType);
        if (rows.length === 0) continue;
        if (rows.length > 1) duplicateSections.push(sectionType);
        if (rows.some((s) => s.sgc_quality_score === null)) {
          unscoredSections.push(sectionType);
        }
        if (
          rows.some(
            (s) =>
              s.sgc_quality_score !== null &&
              (!Number.isFinite(s.sgc_quality_score) ||
                s.sgc_quality_score < 0 ||
                s.sgc_quality_score > 100),
          )
        ) {
          invalidScoreSections.push(sectionType);
        }
        // No arbitrary selection/weighting when several rows claim the same section.
        if (rows.length !== 1) continue;
        const score = rows[0].sgc_quality_score;
        if (
          score === null ||
          !Number.isFinite(score) ||
          score < 0 ||
          score > 100
        ) {
          continue;
        }
        scores.push(score);
        if (score < pack.minSectionScore) lowQualitySections.push(sectionType);
      }

      const evaluable = scores.length === pack.requiredSections.length;
      const average = evaluable
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : null;

      return {
        packLevel,
        requiredSections: pack.requiredSections,
        presentSections,
        missingSections,
        coverage: presentSections.length / pack.requiredSections.length,
        avgQuality: average === null ? null : Math.round(average),
        packComplete: missingSections.length === 0,
        qualityStatus:
          average === null
            ? 'not_evaluable'
            : lowQualitySections.length === 0 && average >= pack.minPackScore
              ? 'meets_thresholds'
              : 'below_threshold',
        unscoredSections,
        invalidScoreSections,
        duplicateSections,
        lowQualitySections,
      };
    };

    return {
      pgId,
      pgAlias: gammeData?.pg_alias || pgId,
      standard: buildCoverage('standard'),
      pro: buildCoverage('pro'),
      eeat: buildCoverage('eeat'),
    };
  }

  /**
   * Backfill quality scores for all rows with sgc_quality_score IS NULL.
   * Processes in batches of 100.
   */
  async backfillQualityScores(): Promise<BackfillResult> {
    this.log.log('Starting quality score backfill...');

    let updated = 0;
    let failed = 0;
    let skipped = 0;
    let lastId: string | null = null;
    const batchSize = 100;

    while (true) {
      // Successful updates remove rows from this selection. A positional offset
      // would skip the next batch; traverse stable IDs instead, including failures.
      let query = this.client
        .from('__seo_gamme_conseil')
        .select('sgc_id, sgc_section_type, sgc_content, sgc_sources')
        .is('sgc_quality_score', null)
        .order('sgc_id', { ascending: true })
        .limit(batchSize);
      if (lastId !== null) query = query.gt('sgc_id', lastId);
      const { data, error } = await query;

      if (error) {
        this.log.error(`Backfill query error: ${error.message}`);
        // The unread row count is unknown; do not fabricate per-row failures.
        throw error;
      }

      if (!data || data.length === 0) break;

      for (const row of data) {
        try {
          const { score } = this.scoreSection(
            row.sgc_section_type || 'S1',
            row.sgc_content || '',
            row.sgc_sources,
          );

          const { data: written, error: updateError } = await this.client
            .from('__seo_gamme_conseil')
            .update({ sgc_quality_score: score })
            .eq('sgc_id', row.sgc_id)
            .is('sgc_quality_score', null)
            .select('sgc_id');

          if (updateError) {
            failed++;
          } else if (written?.length === 1) {
            updated++;
          } else {
            skipped++;
          }
        } catch {
          failed++;
        }
      }

      lastId = data[data.length - 1].sgc_id;
      this.log.log(
        `Backfill progress: ${updated} updated, ${failed} failed, ${skipped} skipped (after ${lastId})`,
      );

      if (data.length < batchSize) break;
    }

    this.log.log(
      `Backfill complete: ${updated} updated, ${failed} failed, ${skipped} skipped`,
    );
    return { updated, failed, skipped };
  }

  // ── Private helpers ──────────────────────────────────────

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#?\w+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hasNumbers(text: string): boolean {
    return /\d+\s*(km|000|ans?|mois|heures?|litres?|nm|bar)/i.test(text);
  }

  private countListItems(html: string): number {
    return (html.match(/<li>/gi) || []).length;
  }

  private computeGenericRatio(stripped: string, wordCount: number): number {
    if (wordCount === 0) return 0;

    let genericWordCount = 0;
    for (const pattern of GENERIC_PHRASES) {
      const matches = stripped.match(pattern) || [];
      for (const m of matches) {
        genericWordCount += m.split(/\s+/).length;
      }
    }

    return genericWordCount / wordCount;
  }
}
