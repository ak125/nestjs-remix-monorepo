/**
 * R6GuideService — Page engine for R6 Guide d'Achat pages.
 * Dual-mode: V1 legacy from flat columns, V2 from new JSONB columns.
 * Reads sgpg_role_version to decide which payload shape to build.
 *
 * INTERDIT R6 : tout contenu procedural (HowTo) + diagnostic complet.
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
  R6QualityTier,
  R6CompatibilityAxis,
  R6WhenProCase,
  R6PriceGuideSection,
  R6BrandsGuideSection,
  R6HeroDecision,
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

    const roleVersion =
      (row.sgpg_role_version as string) === 'v2' ? 'v2' : 'v1';

    this.logger.log(
      `R6 Guide [${roleVersion}]: ${pg_alias} → pg_id=${gamme.pg_id}`,
    );

    // Step 3 — Build page metadata (shared V1/V2)
    const title = row.sgpg_h1_override || gamme.pg_name;
    const page = await this.buildPage(pg_alias, gamme, row, title);

    // Step 4 — Build payload based on version
    if (roleVersion === 'v2') {
      return this.buildV2Payload(page, row, pg_alias);
    }
    return this.buildV1Payload(page, row, pg_alias);
  }

  // ══════════════════════════════════════════════════════════
  // V2 payload builder
  // ══════════════════════════════════════════════════════════

  private async buildV2Payload(
    page: R6GuidePage,
    row: Record<string, unknown>,
    pg_alias: string,
  ): Promise<R6GuidePayload> {
    // Hero decision from intro_role + hero_subtitle
    const heroDecision: R6HeroDecision = {
      promise: (row.sgpg_intro_role as string) || '',
      bullets:
        (row.sgpg_interest_nuggets as Array<{ hook: string }>)
          ?.map((n) => n.hook)
          ?.slice(0, 5) ?? [],
    };

    // Summary pick fast = decision tree
    const summaryPickFast: R6DecisionNode[] =
      (row.sgpg_decision_tree as R6DecisionNode[]) || [];

    // Quality tiers from selection_criteria → mapped to tier format
    const rawCriteria =
      (row.sgpg_selection_criteria as R6SelectionCriterion[]) || [];
    const qualityTiers: R6QualityTier[] = rawCriteria.map((c, i) => ({
      tier_id: c.key || `tier_${i}`,
      label: c.label,
      description: c.guidance,
      available: true,
    }));

    // Compatibility axes from new JSONB column
    const compatibilityAxes: R6CompatibilityAxis[] =
      (row.sgpg_compatibility_axes as R6CompatibilityAxis[]) || [];

    // Price guide — build from micro_seo_block or default
    const priceGuide: R6PriceGuideSection = {
      mode: 'factors',
      variation_factors: [
        'Marque et gamme de qualité',
        'Véhicule (citadine vs SUV vs utilitaire)',
        "Canal d'achat (en ligne vs magasin)",
      ],
      disclaimer:
        'Les prix indiqués sont des fourchettes indicatives et peuvent varier selon le véhicule et le fournisseur.',
    };

    // Brands guide from new JSONB column
    const brandsGuide: R6BrandsGuideSection | undefined = row.sgpg_brands_guide
      ? (row.sgpg_brands_guide as R6BrandsGuideSection)
      : undefined;

    // Pitfalls from anti_mistakes
    const pitfalls: string[] = (row.sgpg_anti_mistakes as string[]) || [];

    // When pro from new JSONB column
    const whenPro: R6WhenProCase[] =
      (row.sgpg_when_pro as R6WhenProCase[]) || [];

    // FAQ
    const faq: R6FaqItem[] = (row.sgpg_faq as R6FaqItem[]) || [];

    return {
      intentType: 'R6',
      pageRole: 'R6_BUYING_GUIDE',
      canonicalRoleUrl: `/blog-pieces-auto/guide-achat/${pg_alias}`,
      roleVersion: 'v2',
      page,
      heroDecision,
      summaryPickFast,
      qualityTiers,
      compatibilityAxes,
      priceGuide,
      brandsGuide,
      pitfalls,
      whenPro,
      faq,
      sourceType: (row.sgpg_source_type as string) || null,
      sourceVerified: (row.sgpg_source_verified as boolean) ?? false,
    };
  }

  // ══════════════════════════════════════════════════════════
  // V1 legacy payload builder
  // ══════════════════════════════════════════════════════════

  private async buildV1Payload(
    page: R6GuidePage,
    row: Record<string, unknown>,
    pg_alias: string,
  ): Promise<R6GuidePayload> {
    // Process HTML fields (link injection + dedup)
    const [
      riskExplanation,
      riskConclusion,
      howToChoose,
      timingNote,
      ...argContents
    ] = await Promise.all([
      this.processHtml(row.sgpg_risk_explanation as string),
      this.processHtml(row.sgpg_risk_conclusion as string),
      this.processHtml(row.sgpg_how_to_choose as string),
      this.processHtml(row.sgpg_timing_note as string),
      this.processHtml(row.sgpg_arg1_content as string),
      this.processHtml(row.sgpg_arg2_content as string),
      this.processHtml(row.sgpg_arg3_content as string),
      this.processHtml(row.sgpg_arg4_content as string),
    ]);

    const risk: R6RiskSection = {
      title: (row.sgpg_risk_title as string) || 'Risques et conséquences',
      explanation: riskExplanation,
      consequences: (row.sgpg_risk_consequences as string[]) || [],
      costRange: (row.sgpg_risk_cost_range as string) || null,
      conclusion: riskConclusion,
    };

    const timing: R6TimingSection = {
      title: (row.sgpg_timing_title as string) || 'Quand remplacer',
      years: (row.sgpg_timing_years as string) || null,
      km: (row.sgpg_timing_km as string) || null,
      note: timingNote,
    };

    const args = this.buildArguments(row, argContents);
    const faq: R6FaqItem[] = (row.sgpg_faq as R6FaqItem[]) || [];
    const selectionCriteria: R6SelectionCriterion[] =
      (row.sgpg_selection_criteria as R6SelectionCriterion[]) || [];
    const decisionTree: R6DecisionNode[] =
      (row.sgpg_decision_tree as R6DecisionNode[]) || [];
    const useCases: R6UseCase[] = (row.sgpg_use_cases as R6UseCase[]) || [];
    const interestNuggets: R6InterestNugget[] =
      (row.sgpg_interest_nuggets as R6InterestNugget[]) || [];

    return {
      intentType: 'R6',
      pageRole: 'R6_BUYING_GUIDE',
      canonicalRoleUrl: `/blog-pieces-auto/guide-achat/${pg_alias}`,
      roleVersion: 'v1',
      page,
      // V1 legacy fields
      risk,
      timing,
      arguments: args,
      howToChoose,
      symptoms: (row.sgpg_symptoms as string[]) || [],
      selectionCriteria,
      decisionTree,
      faq,
      useCases,
      antiMistakes: (row.sgpg_anti_mistakes as string[]) || [],
      interestNuggets,
      selectorMicrocopy: (row.sgpg_selector_microcopy as string[]) || [],
      compatibilitiesIntro: (row.sgpg_compatibilities_intro as string) || null,
      equipementiersLine: (row.sgpg_equipementiers_line as string) || null,
      familyCrossSellIntro:
        (row.sgpg_family_cross_sell_intro as string) || null,
      microSeoBlock: (row.sgpg_micro_seo_block as string) || null,
      sourceType: (row.sgpg_source_type as string) || null,
      sourceVerified: (row.sgpg_source_verified as boolean) ?? false,
    };
  }

  // ══════════════════════════════════════════════════════════
  // Private helpers
  // ══════════════════════════════════════════════════════════

  private async buildPage(
    pg_alias: string,
    gamme: { pg_id: number; pg_name: string; pg_pic: string | null },
    row: Record<string, unknown>,
    title: string,
  ): Promise<R6GuidePage> {
    // Collect HTML parts for reading time
    const htmlFields = [
      row.sgpg_risk_explanation,
      row.sgpg_risk_conclusion,
      row.sgpg_how_to_choose,
      row.sgpg_timing_note,
      row.sgpg_arg1_content,
      row.sgpg_arg2_content,
      row.sgpg_arg3_content,
      row.sgpg_arg4_content,
    ].filter(Boolean) as string[];

    const faqAnswers = ((row.sgpg_faq as R6FaqItem[]) || []).map(
      (f) => f.answer,
    );

    const readingTime = this.calcReadingTime([...htmlFields, ...faqAnswers]);

    return {
      pg_alias,
      pg_id: gamme.pg_id,
      title,
      heroSubtitle: (row.sgpg_hero_subtitle as string) || null,
      metaTitle: `${title} — Guide d'achat | AutoMecanik`,
      metaDescription: this.stripPricing(
        (row.sgpg_intro_role as string) ||
          `Comment bien choisir ${title.toLowerCase()} pour votre véhicule.`,
      ),
      featuredImage: this.transformService.buildImageUrl(
        gamme.pg_pic || `${pg_alias}.webp`,
        'articles/gammes-produits/catalogue',
      ),
      updatedAt:
        (row.sgpg_updated_at as string) ||
        (row.sgpg_created_at as string) ||
        new Date().toISOString(),
      readingTime,
    };
  }

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
