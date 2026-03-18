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
  R6CtaFinal,
  R6MediaSlotFrontend,
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

    // Step 2 — Fetch purchase guide row (R6 + R1 via LEFT JOIN RPC)
    // Uses get_buying_guide_with_r1_slots() which COALESCE R1 slots > sgpg fallback
    const pgIdStr = gamme.pg_id.toString();
    let row: Record<string, unknown> | null = null;

    const { data: rpcData, error: rpcError } =
      await this.supabaseService.client.rpc('get_buying_guide_with_r1_slots', {
        p_pg_id: pgIdStr,
      });

    if (!rpcError && rpcData) {
      row = rpcData as Record<string, unknown>;
    } else {
      // Fallback: direct query if RPC not available
      const { data: fallbackData, error: fallbackError } =
        await this.supabaseService.client
          .from('__seo_gamme_purchase_guide')
          .select('*')
          .eq('sgpg_pg_id', pgIdStr)
          .eq('sgpg_is_draft', false)
          .single();
      if (!fallbackError && fallbackData) {
        row = fallbackData as Record<string, unknown>;
      }
    }

    if (!row) {
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
    // Hero decision: promise from intro_role (plain string in V2)
    const heroDecision: R6HeroDecision = {
      promise: (row.sgpg_intro_role as string) || '',
      bullets: [], // V2 uses interest_nuggets for ctaFinal links, not hero bullets
    };

    // Summary pick fast = decision tree
    // V2 agent format: [{question, options:string[], outcome_map:{option→outcome}}]
    // Map to R6DecisionNode[]: [{id, question, options:[{label, outcome}]}]
    const rawTree =
      (row.sgpg_decision_tree as Array<{
        question: string;
        options: Array<string | { label?: string; outcome?: string }>;
        outcome_map: Record<string, string>;
      }>) || [];
    const summaryPickFast: R6DecisionNode[] = rawTree
      .filter((node) => {
        // Reject generic diagnostic nodes (R3 content leaked into R6)
        const q = (node.question || '').toLowerCase();
        return (
          !q.includes('diagnostic') && !q.includes('procédure de diagnostic')
        );
      })
      .map((node, i) => ({
        id: `dt-${i}`,
        question: this.sanitizeRagLeaks(node.question),
        options: (node.options || []).map(
          (opt: string | { label?: string; outcome?: string }) => {
            const label = typeof opt === 'string' ? opt : opt?.label || '';
            const outcome =
              typeof opt === 'string'
                ? node.outcome_map?.[opt] || ''
                : opt?.outcome || node.outcome_map?.[label] || '';
            return {
              label: this.sanitizeRagLeaks(label),
              outcome,
            };
          },
        ),
      }));

    // Quality tiers from selection_criteria
    // V2 agent format: {tiers:[{tier_id, label, description, available, ...}], block_type, intro_text}
    const rawCriteria = row.sgpg_selection_criteria as
      | { tiers: R6QualityTier[]; intro_text?: string }
      | R6QualityTier[]
      | null;
    const rawTiers: R6QualityTier[] = Array.isArray(rawCriteria)
      ? rawCriteria
      : rawCriteria?.tiers || [];
    // Sanitize: filter out RAG chunks and clean markdown artifacts from labels
    const qualityTiers: R6QualityTier[] = rawTiers
      .filter((t) => {
        const label = t.label || '';
        const guidance =
          ((t as unknown as Record<string, unknown>).guidance as string) || '';
        return !this.isRagChunk(label) && !this.isRagChunk(guidance);
      })
      .map((t) => {
        const cleaned = { ...t };
        if (cleaned.label) cleaned.label = this.sanitizeRagLeaks(cleaned.label);
        const rec = cleaned as unknown as Record<string, unknown>;
        if (rec.guidance) {
          rec.guidance = this.sanitizeRagLeaks(rec.guidance as string);
        }
        if (cleaned.description)
          cleaned.description = this.sanitizeRagLeaks(cleaned.description);
        return cleaned;
      });

    // Compatibility axes from new JSONB column — sanitize RAG leaks
    const rawAxesField = row.sgpg_compatibility_axes as
      | R6CompatibilityAxis[]
      | { axes: R6CompatibilityAxis[] }
      | null;
    const rawAxes: R6CompatibilityAxis[] = Array.isArray(rawAxesField)
      ? rawAxesField
      : rawAxesField?.axes || [];
    const compatibilityAxes: R6CompatibilityAxis[] = rawAxes.map((ax) => ({
      ...ax,
      axis: this.sanitizeRagLeaks(ax.axis || ''),
      where_to_find: this.sanitizeRagLeaks(ax.where_to_find || ''),
      risk_if_wrong: this.sanitizeRagLeaks(ax.risk_if_wrong || ''),
    }));

    // Price guide — try parsing sgpg_micro_seo_block as JSON, fallback to generic factors
    let priceGuide: R6PriceGuideSection;
    const rawMicroSeo = row.sgpg_micro_seo_block as string | null;
    try {
      const parsed = rawMicroSeo ? JSON.parse(rawMicroSeo) : null;
      if (parsed?.mode === 'ranges' && Array.isArray(parsed.tiers)) {
        priceGuide = parsed as R6PriceGuideSection;
      } else {
        throw new Error('not a valid price guide JSON');
      }
    } catch {
      priceGuide = {
        mode: 'factors',
        variation_factors: [
          'Marque et gamme de qualité',
          'Véhicule (citadine vs SUV vs utilitaire)',
          "Canal d'achat (en ligne vs magasin)",
        ],
        disclaimer:
          'Les prix indiqués sont des fourchettes indicatives et peuvent varier selon le véhicule et le fournisseur.',
      };
    }

    // Brands guide from new JSONB column
    const brandsGuide: R6BrandsGuideSection | undefined = row.sgpg_brands_guide
      ? (row.sgpg_brands_guide as R6BrandsGuideSection)
      : undefined;

    // Pitfalls from anti_mistakes
    const pitfalls: string[] = (row.sgpg_anti_mistakes as string[]) || [];

    // When pro from new JSONB column
    const rawWhenPro = row.sgpg_when_pro as
      | R6WhenProCase[]
      | { cases: R6WhenProCase[] }
      | null;
    const whenPro: R6WhenProCase[] = Array.isArray(rawWhenPro)
      ? rawWhenPro
      : rawWhenPro?.cases || [];

    // FAQ
    const faq: R6FaqItem[] = (row.sgpg_faq as R6FaqItem[]) || [];

    // Media slots — extract from sgpg_page_contract if present
    let mediaSlots: Record<string, R6MediaSlotFrontend[]> | undefined;
    if (row.sgpg_page_contract) {
      try {
        const contract =
          typeof row.sgpg_page_contract === 'string'
            ? JSON.parse(row.sgpg_page_contract)
            : row.sgpg_page_contract;
        if (contract?.sections) {
          const extracted: Record<string, R6MediaSlotFrontend[]> = {};
          for (const [sectionId, section] of Object.entries(
            contract.sections,
          )) {
            const slots = (section as Record<string, unknown>)
              ?.media_slots as R6MediaSlotFrontend[];
            if (Array.isArray(slots) && slots.length > 0) {
              extracted[sectionId] = slots;
            }
          }
          if (Object.keys(extracted).length > 0) {
            mediaSlots = extracted;
          }
        }
        if (contract?.hero?.media_slots?.length) {
          mediaSlots = mediaSlots || {};
          mediaSlots['_hero'] = contract.hero.media_slots;
        }
      } catch {
        /* ignore malformed page_contract */
      }
    }

    // CTA final — further reading + internal links
    // V2 agent format: interest_nuggets = [{href, label, reason, relation}]
    const rawNuggets = row.sgpg_interest_nuggets as Array<{
      href?: string;
      label?: string;
      reason?: string;
      relation?: string;
    }> | null;
    const ctaFinal: R6CtaFinal | undefined =
      rawNuggets?.length || row.sgpg_family_cross_sell_intro
        ? {
            links: (rawNuggets || [])
              .filter((n) => n.href && n.label)
              .map((n) => ({
                label: n.label!,
                href: n.href!,
                target_role: 'R6',
              })),
            internal_links: (row.sgpg_family_cross_sell_intro as string)
              ? [
                  {
                    anchor_text:
                      (row.sgpg_family_cross_sell_intro as string) || '',
                    href: `/pieces/${pg_alias}.html`,
                    target_role: 'R1',
                  },
                ]
              : undefined,
          }
        : undefined;

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
      ctaFinal,
      mediaSlots,
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
        gamme.pg_pic && gamme.pg_pic !== 'no'
          ? gamme.pg_pic
          : `${pg_alias}.webp`,
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

  /**
   * Sanitize a text field by stripping RAG source references and markdown artifacts.
   * Removes patterns like "(Source: web-catalog/xxx.md, ...)" and stray "**" bold markers.
   */
  private sanitizeRagLeaks(text: string): string {
    if (!text || typeof text !== 'string') return text ? String(text) : '';
    return text
      .replace(/\s*\(Source:[^)]*\)/g, '')
      .replace(/\*\*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Detect if a text string is a raw RAG chunk (not authored content).
   * RAG chunks typically contain source references or start with markdown headers.
   */
  private isRagChunk(text: string): boolean {
    if (!text) return false;
    const t = text.trim();
    return /\(Source:\s*\w/.test(t) || /^#{1,3}\s/.test(t);
  }
}
