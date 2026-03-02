/**
 * ConseilQualityScorerService — Scores individual conseil sections and pack coverage.
 * Populates sgc_quality_score for existing rows (backfill) and new content.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
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
  avgQuality: number | null;
  packComplete: boolean;
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
}

@Injectable()
export class ConseilQualityScorerService extends SupabaseBaseService {
  private readonly log = new Logger(ConseilQualityScorerService.name);

  // ── Public API ───────────────────────────────────────────

  /**
   * Score a single section (0-100) based on content quality criteria.
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

    const stripped = this.stripHtml(content);
    const wordCount = stripped.split(/\s+/).filter(Boolean).length;

    // Content length
    if (content.length < criteria.minContentLength) {
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

    // Sources
    if (!sources || sources === '[]' || sources === 'null') {
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

      const scores = sections
        .filter(
          (s) =>
            pack.requiredSections.includes(s.sgc_section_type) &&
            s.sgc_quality_score !== null,
        )
        .map((s) => s.sgc_quality_score!);

      return {
        packLevel,
        requiredSections: pack.requiredSections,
        presentSections,
        missingSections,
        coverage: presentSections.length / pack.requiredSections.length,
        avgQuality:
          scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null,
        packComplete: missingSections.length === 0,
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
    let offset = 0;
    const batchSize = 100;

    while (true) {
      const { data, error } = await this.client
        .from('__seo_gamme_conseil')
        .select('sgc_id, sgc_section_type, sgc_content, sgc_sources')
        .is('sgc_quality_score', null)
        .range(offset, offset + batchSize - 1);

      if (error) {
        this.log.error(`Backfill query error: ${error.message}`);
        failed += batchSize;
        break;
      }

      if (!data || data.length === 0) break;

      for (const row of data) {
        try {
          const { score } = this.scoreSection(
            row.sgc_section_type || 'S1',
            row.sgc_content || '',
            row.sgc_sources,
          );

          const { error: updateError } = await this.client
            .from('__seo_gamme_conseil')
            .update({ sgc_quality_score: score })
            .eq('sgc_id', row.sgc_id);

          if (updateError) {
            failed++;
          } else {
            updated++;
          }
        } catch {
          failed++;
        }
      }

      this.log.log(
        `Backfill progress: ${updated} updated, ${failed} failed (batch at offset ${offset})`,
      );

      if (data.length < batchSize) break;
      offset += batchSize;
    }

    this.log.log(`Backfill complete: ${updated} updated, ${failed} failed`);
    return { updated, failed };
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
