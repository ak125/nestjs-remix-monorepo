/**
 * R6GuideService — Page engine for R6 Guide d'Achat pages.
 * Reads structured data from __seo_gamme_purchase_guide and returns
 * a typed R6GuidePayload. Single endpoint replaces legacy guide-achat.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogArticleTransformService } from './blog-article-transform.service';
import { InternalLinkingService } from '../../seo/internal-linking.service';
import { PRIX_PAS_CHER } from '../../seo/seo-v4.types';
import { deduplicateWords } from '../utils/html-normalize.utils';
import type {
  R6GuidePayload,
  R6GuidePage,
  R6RiskSection,
  R6TimingSection,
  R6Argument,
  R6FaqItem,
  R6SelectionCriterion,
  R6DecisionNode,
  R6UseCase,
  R6InterestNugget,
} from '../interfaces/r6-guide.interfaces';

@Injectable()
export class R6GuideService {
  private readonly logger = new Logger(R6GuideService.name);

  private static readonly PRICING_RE = new RegExp(
    PRIX_PAS_CHER.join('|'),
    'gi',
  );

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    private readonly transformService: BlogArticleTransformService,
    private readonly internalLinkingService: InternalLinkingService,
  ) {}

  async getR6GuidePayload(pg_alias: string): Promise<R6GuidePayload | null> {
    // Step 1 — Resolve pg_id from pieces_gamme
    const { data: gamme } = await this.supabaseService.client
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_pic')
      .eq('pg_alias', pg_alias)
      .single();

    if (!gamme) {
      this.logger.warn(`No gamme found for pg_alias="${pg_alias}"`);
      return null;
    }

    // Step 2 — Fetch purchase guide row (published only)
    const { data: row, error } = await this.supabaseService.client
      .from('__seo_gamme_purchase_guide')
      .select('*')
      .eq('sgpg_pg_id', gamme.pg_id.toString())
      .eq('sgpg_is_draft', false)
      .single();

    if (error || !row) {
      this.logger.warn(
        `No published R6 guide for pg_alias="${pg_alias}" (pg_id=${gamme.pg_id})`,
      );
      return null;
    }

    this.logger.log(
      `R6 Guide: ${pg_alias} → pg_id=${gamme.pg_id}, title="${row.sgpg_h1_override || gamme.pg_name}"`,
    );

    // Step 3 — Process HTML fields (link injection + dedup)
    const [
      riskExplanation,
      riskConclusion,
      howToChoose,
      timingNote,
      ...argContents
    ] = await Promise.all([
      this.processHtml(row.sgpg_risk_explanation),
      this.processHtml(row.sgpg_risk_conclusion),
      this.processHtml(row.sgpg_how_to_choose),
      this.processHtml(row.sgpg_timing_note),
      this.processHtml(row.sgpg_arg1_content),
      this.processHtml(row.sgpg_arg2_content),
      this.processHtml(row.sgpg_arg3_content),
      this.processHtml(row.sgpg_arg4_content),
    ]);

    // Step 4 — Build typed sections
    const title = row.sgpg_h1_override || gamme.pg_name;

    const risk: R6RiskSection = {
      title: row.sgpg_risk_title || 'Risques et conséquences',
      explanation: riskExplanation,
      consequences: row.sgpg_risk_consequences || [],
      costRange: row.sgpg_risk_cost_range || null,
      conclusion: riskConclusion,
    };

    const timing: R6TimingSection = {
      title: row.sgpg_timing_title || 'Quand remplacer',
      years: row.sgpg_timing_years || null,
      km: row.sgpg_timing_km || null,
      note: timingNote,
    };

    const args = this.buildArguments(row, argContents);
    const faq: R6FaqItem[] = row.sgpg_faq || [];
    const selectionCriteria: R6SelectionCriterion[] =
      row.sgpg_selection_criteria || [];
    const decisionTree: R6DecisionNode[] = row.sgpg_decision_tree || [];
    const useCases: R6UseCase[] = row.sgpg_use_cases || [];
    const interestNuggets: R6InterestNugget[] = row.sgpg_interest_nuggets || [];

    // Step 5 — Page metadata
    const allHtml = [
      riskExplanation,
      riskConclusion,
      howToChoose,
      timingNote,
      ...argContents,
      ...faq.map((f) => f.answer),
    ].filter(Boolean);

    const readingTime = this.calcReadingTime(allHtml);

    const page: R6GuidePage = {
      pg_alias,
      pg_id: gamme.pg_id,
      title,
      heroSubtitle: row.sgpg_hero_subtitle || null,
      metaTitle: `${title} — Guide d'achat | AutoMecanik`,
      metaDescription: this.stripPricing(
        row.sgpg_intro_role ||
          `Comment bien choisir ${title.toLowerCase()} pour votre véhicule.`,
      ),
      featuredImage: this.transformService.buildImageUrl(
        gamme.pg_pic || `${pg_alias}.webp`,
        'articles/gammes-produits/catalogue',
      ),
      updatedAt:
        row.sgpg_updated_at || row.sgpg_created_at || new Date().toISOString(),
      readingTime,
    };

    return {
      page,
      risk,
      timing,
      arguments: args,
      howToChoose,
      symptoms: row.sgpg_symptoms || [],
      selectionCriteria,
      decisionTree,
      faq,
      useCases,
      antiMistakes: row.sgpg_anti_mistakes || [],
      interestNuggets,
      selectorMicrocopy: row.sgpg_selector_microcopy || [],
      compatibilitiesIntro: row.sgpg_compatibilities_intro || null,
      equipementiersLine: row.sgpg_equipementiers_line || null,
      familyCrossSellIntro: row.sgpg_family_cross_sell_intro || null,
      microSeoBlock: row.sgpg_micro_seo_block || null,
      sourceType: row.sgpg_source_type || null,
      sourceVerified: row.sgpg_source_verified ?? false,
    };
  }

  // ── Private helpers ──────────────────────────────────────────

  private async processHtml(raw: string | null | undefined): Promise<string> {
    if (!raw) return '';
    let html = await this.internalLinkingService.processLinkGamme(raw);
    html = deduplicateWords(html);
    return html;
  }

  private buildArguments(
    row: Record<string, unknown>,
    processedContents: string[],
  ): R6Argument[] {
    const args: R6Argument[] = [];
    const keys = [
      { title: 'sgpg_arg1_title', icon: 'sgpg_arg1_icon', idx: 0 },
      { title: 'sgpg_arg2_title', icon: 'sgpg_arg2_icon', idx: 1 },
      { title: 'sgpg_arg3_title', icon: 'sgpg_arg3_icon', idx: 2 },
      { title: 'sgpg_arg4_title', icon: 'sgpg_arg4_icon', idx: 3 },
    ];
    for (const k of keys) {
      const title = row[k.title] as string | null;
      const content = processedContents[k.idx];
      if (title && content) {
        args.push({
          title,
          content,
          icon: (row[k.icon] as string) || null,
        });
      }
    }
    return args;
  }

  private calcReadingTime(htmlParts: string[]): number {
    const totalText = htmlParts.join(' ').replace(/<[^>]+>/g, '');
    const words = totalText.split(/\s+/).filter((w) => w.length > 0).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  private stripPricing(text: string): string {
    return text
      .replace(R6GuideService.PRICING_RE, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}
