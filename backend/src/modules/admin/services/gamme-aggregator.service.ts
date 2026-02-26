import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  SCORING_VERSION,
  GAMME_PAGE_WEIGHTS,
  REQUIRED_PAGE_TYPES,
  OPTIONAL_PAGE_TYPES,
  COVERAGE_PENALTY_MAX,
  BUSINESS_VALUE_WEIGHTS,
  COMPOSITE_BLEND,
  PRIORITY_THRESHOLDS,
  type PageType,
  type Priority,
} from '../../../config/scoring-profiles.config';

interface PageScoreRow {
  pg_id: number;
  page_type: string;
  quality_score: number;
  confidence_score: number;
  status: string;
  priority: string;
  reasons: string[];
  next_actions: string[];
}

interface GammeBaseRow {
  pg_id: number;
  pg_alias: string;
}

interface BusinessDataRow {
  pg_id: number;
  pg_top: string | null;
  pg_relfollow: string | null;
  product_count: number;
  family_name: string | null;
}

@Injectable()
export class GammeAggregatorService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammeAggregatorService.name);

  /**
   * Aggregate page-level scores into gamme-level scores.
   * Reads from __quality_page_scores, writes to __quality_gamme_scores.
   */
  async aggregateAll(): Promise<number> {
    // 1. Get all active gammes
    const { data: gammes, error: gError } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias')
      .eq('pg_display', '1')
      .in('pg_level', ['1', '2']);

    if (gError || !gammes) {
      this.logger.error(`Failed to fetch gammes: ${gError?.message}`);
      return 0;
    }

    // 2. Get all page scores
    const { data: pageScores, error: psError } = await this.client
      .from('__quality_page_scores')
      .select(
        'pg_id, page_type, quality_score, confidence_score, status, priority, reasons, next_actions',
      );

    if (psError || !pageScores) {
      this.logger.error(`Failed to fetch page scores: ${psError?.message}`);
      return 0;
    }

    // Group page scores by pg_id
    const scoresByGamme = new Map<number, PageScoreRow[]>();
    for (const ps of pageScores as PageScoreRow[]) {
      const arr = scoresByGamme.get(ps.pg_id) || [];
      arr.push(ps);
      scoresByGamme.set(ps.pg_id, arr);
    }

    // 3. Fetch business data (product counts, pg_top, family, indexability)
    const businessMap = await this.fetchBusinessData(
      (gammes as GammeBaseRow[]).map((g) => g.pg_id),
    );

    // 4. Compute gamme scores
    let count = 0;
    for (const gamme of gammes as GammeBaseRow[]) {
      const pages = scoresByGamme.get(gamme.pg_id) || [];
      const biz = businessMap.get(gamme.pg_id);
      const result = this.computeGammeScore(gamme, pages, biz);
      await this.upsertGammeScore(result);
      count++;
    }

    this.logger.log(`Aggregated ${count} gamme scores`);
    return count;
  }

  /**
   * Aggregate scores for a single gamme.
   */
  async aggregateForGamme(pgId: number): Promise<void> {
    const { data: gamme } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias')
      .eq('pg_id', pgId)
      .single();

    if (!gamme) return;

    const { data: pageScores } = await this.client
      .from('__quality_page_scores')
      .select(
        'pg_id, page_type, quality_score, confidence_score, status, priority, reasons, next_actions',
      )
      .eq('pg_id', pgId);

    const businessMap = await this.fetchBusinessData([pgId]);
    const biz = businessMap.get(pgId);
    const result = this.computeGammeScore(
      gamme as GammeBaseRow,
      (pageScores || []) as PageScoreRow[],
      biz,
    );
    await this.upsertGammeScore(result);
  }

  // ── Core Aggregation Logic ──

  private computeGammeScore(
    gamme: GammeBaseRow,
    pages: PageScoreRow[],
    biz?: BusinessDataRow,
  ) {
    const presentTypes = new Set(pages.map((p) => p.page_type));
    const allExpected = [...REQUIRED_PAGE_TYPES, ...OPTIONAL_PAGE_TYPES];

    // Detect missing page types
    const missingTypes = REQUIRED_PAGE_TYPES.filter(
      (pt) => !presentTypes.has(pt),
    );
    const pagesExpected = allExpected.length;
    const pagesScored = pages.length;

    // Weighted average of page scores (v2: decimal precision)
    let weightedSum = 0;
    let weightTotal = 0;

    for (const page of pages) {
      const weight = GAMME_PAGE_WEIGHTS[page.page_type as PageType] || 10;
      weightedSum += page.quality_score * weight;
      weightTotal += weight;
    }

    const baseScore = weightTotal > 0 ? weightedSum / weightTotal : 0;

    // v2: Proportional coverage penalty (instead of flat -5 per missing)
    const totalRequiredWeight = REQUIRED_PAGE_TYPES.reduce(
      (sum, pt) => sum + (GAMME_PAGE_WEIGHTS[pt] || 10),
      0,
    );
    const missingWeight = missingTypes.reduce(
      (sum, pt) => sum + (GAMME_PAGE_WEIGHTS[pt] || 10),
      0,
    );
    const coveragePenalty =
      totalRequiredWeight > 0
        ? parseFloat(
            (
              (missingWeight / totalRequiredWeight) *
              COVERAGE_PENALTY_MAX
            ).toFixed(1),
          )
        : 0;
    const gammeScore = parseFloat(
      Math.max(0, baseScore - coveragePenalty).toFixed(1),
    );

    // v2: Business value (0-100)
    const productCount = biz?.product_count ?? 0;
    const isTop = biz?.pg_top === '1';
    const isIndexed = biz?.pg_relfollow === 'index,follow';

    // product_count: log-scale 0-50pts (max ~20000 products)
    const productPts =
      productCount > 0
        ? parseFloat(
            (
              (Math.log10(productCount) / Math.log10(20000)) *
              BUSINESS_VALUE_WEIGHTS.product_count
            ).toFixed(1),
          )
        : 0;
    const topPts = isTop ? BUSINESS_VALUE_WEIGHTS.pg_top : 0;
    const indexedPts = isIndexed ? BUSINESS_VALUE_WEIGHTS.indexed : 0;
    const businessValue = parseFloat(
      Math.min(100, productPts + topPts + indexedPts).toFixed(1),
    );

    // v2: Composite score
    const compositeScore = parseFloat(
      (
        gammeScore * COMPOSITE_BLEND.quality +
        businessValue * COMPOSITE_BLEND.business
      ).toFixed(1),
    );

    // Confidence: average of page confidences, penalized if few pages scored (v2: decimal)
    const avgConfidence =
      pages.length > 0
        ? pages.reduce((sum, p) => sum + p.confidence_score, 0) / pages.length
        : 0;
    const coverageFactor = pagesExpected > 0 ? pagesScored / pagesExpected : 0;
    const confidenceScore = parseFloat(
      (avgConfidence * Math.min(1, coverageFactor + 0.3)).toFixed(1),
    );

    // Page scores summary
    const pageScoresSummary: Record<string, { score: number; status: string }> =
      {};
    for (const page of pages) {
      pageScoresSummary[page.page_type] = {
        score: page.quality_score,
        status: page.status,
      };
    }

    // Top reasons and actions (merge from all pages, sorted by priority)
    const allReasons = pages
      .sort(
        (a, b) =>
          this.priorityOrder(a.priority) - this.priorityOrder(b.priority),
      )
      .flatMap((p) =>
        (p.reasons || []).map((r: string) => `[${p.page_type}] ${r}`),
      );
    const topReasons = [...new Set(allReasons)].slice(0, 5);

    const allActions = pages
      .sort(
        (a, b) =>
          this.priorityOrder(a.priority) - this.priorityOrder(b.priority),
      )
      .flatMap((p) =>
        (p.next_actions || []).map((a: string) => `[${p.page_type}] ${a}`),
      );
    for (const mt of missingTypes) {
      allActions.unshift(`Creer la page ${mt}`);
    }
    const topActions = [...new Set(allActions)].slice(0, 5);

    // Priority & status
    const hasBlocked = pages.some((p) => p.status === 'BLOCKED');
    const priority = hasBlocked
      ? ('CRITICAL' as Priority)
      : this.derivePriority(gammeScore);
    const status = hasBlocked
      ? 'BLOCKED'
      : gammeScore >= 80 && confidenceScore >= 60
        ? 'HEALTHY'
        : gammeScore >= 60
          ? 'REVIEW'
          : 'DEGRADED';

    return {
      pg_id: gamme.pg_id,
      pg_alias: gamme.pg_alias,
      gamme_score: gammeScore,
      confidence_score: confidenceScore,
      business_value: businessValue,
      composite_score: compositeScore,
      family_name: biz?.family_name ?? null,
      product_count: productCount,
      pages_expected: pagesExpected,
      pages_scored: pagesScored,
      missing_page_types: missingTypes,
      coverage_penalty: coveragePenalty,
      page_scores_summary: pageScoresSummary,
      top_reasons: topReasons,
      top_actions: topActions,
      priority,
      status,
      score_version: SCORING_VERSION,
    };
  }

  private derivePriority(score: number): Priority {
    for (const t of PRIORITY_THRESHOLDS) {
      if (score >= t.min) return t.priority;
    }
    return 'CRITICAL';
  }

  private priorityOrder(p: string): number {
    switch (p) {
      case 'CRITICAL':
        return 0;
      case 'HIGH':
        return 1;
      case 'MEDIUM':
        return 2;
      case 'LOW':
        return 3;
      default:
        return 4;
    }
  }

  // ── Business Data ──

  private async fetchBusinessData(
    pgIds: number[],
  ): Promise<Map<number, BusinessDataRow>> {
    const map = new Map<number, BusinessDataRow>();
    if (pgIds.length === 0) return map;

    // 1. Fetch pg_top and pg_relfollow from pieces_gamme
    const { data: gammeData } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_top, pg_relfollow')
      .in('pg_id', pgIds);

    for (const g of (gammeData || []) as Array<{
      pg_id: number;
      pg_top: string;
      pg_relfollow: string;
    }>) {
      map.set(g.pg_id, {
        pg_id: g.pg_id,
        pg_top: g.pg_top,
        pg_relfollow: g.pg_relfollow,
        product_count: 0,
        family_name: null,
      });
    }

    // 2. Fetch product counts per gamme (single aggregation query via RPC)
    const { data: countData } = await this.callRpc<
      Array<{ pg_id: number; product_count: number }>
    >('get_gamme_product_counts', {});
    if (countData) {
      for (const row of countData) {
        const entry = map.get(row.pg_id);
        if (entry) entry.product_count = row.product_count;
      }
    }

    // 3. Fetch family names via RPC (FK not declared in PostgREST)
    const { data: familyData } = await this.callRpc<
      Array<{ pg_id: number; family_name: string }>
    >('get_gamme_families', {});
    if (familyData) {
      for (const row of familyData) {
        const entry = map.get(row.pg_id);
        if (entry) entry.family_name = row.family_name;
      }
    }

    return map;
  }

  // ── Persistence ──

  private async upsertGammeScore(
    result: ReturnType<typeof this.computeGammeScore>,
  ): Promise<void> {
    const { error } = await this.client.from('__quality_gamme_scores').upsert(
      {
        pg_id: result.pg_id,
        pg_alias: result.pg_alias,
        gamme_score: result.gamme_score,
        confidence_score: result.confidence_score,
        business_value: result.business_value,
        composite_score: result.composite_score,
        family_name: result.family_name,
        product_count: result.product_count,
        pages_expected: result.pages_expected,
        pages_scored: result.pages_scored,
        missing_page_types: result.missing_page_types,
        coverage_penalty: result.coverage_penalty,
        page_scores_summary: result.page_scores_summary,
        top_reasons: result.top_reasons,
        top_actions: result.top_actions,
        priority: result.priority,
        status: result.status,
        score_version: result.score_version,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'pg_id' },
    );

    if (error) {
      this.logger.error(
        `Upsert gamme score failed pg_id=${result.pg_id}: ${error.message}`,
      );
    }
  }
}
