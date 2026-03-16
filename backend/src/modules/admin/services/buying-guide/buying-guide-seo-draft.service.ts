import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { FeatureFlagsService } from '../../../../config/feature-flags.service';
import { AiContentService } from '../../../ai-content/ai-content.service';
import { PageBriefService } from '../page-brief.service';
import { EnricherTextUtils } from '../enricher-text-utils.service';
import type { SectionValidationResult } from './buying-guide.types';

/**
 * SEO content draft generation for buying guide enrichment.
 * Composes narrative HTML from enriched sections and optionally polishes via LLM.
 */
@Injectable()
export class BuyingGuideSeoDraftService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    BuyingGuideSeoDraftService.name,
  );

  constructor(
    configService: ConfigService,
    private readonly textUtils: EnricherTextUtils,
    private readonly flags: FeatureFlagsService,
    @Optional() private readonly aiContentService?: AiContentService,
    @Optional() private readonly pageBriefService?: PageBriefService,
  ) {
    super(configService);
  }

  composeSeoContent(
    gammeName: string,
    sections: Record<string, SectionValidationResult>,
  ): string | null {
    let html = '';
    const displayName = gammeName.toLowerCase();

    // Selection criteria → "Comment choisir"
    const criteria = sections['selection_criteria'];
    if (
      criteria?.ok &&
      Array.isArray(criteria.content) &&
      criteria.content.length >= 2
    ) {
      const items = (
        criteria.content as Array<{ label: string; guidance: string }>
      )
        .filter((c) => !c.guidance.trimEnd().endsWith(':')) // Exclude intro phrases
        .slice(0, 4);
      if (items.length >= 2) {
        html += `<h2>Comment choisir vos ${displayName} ?</h2><ul>`;
        html += items
          .map((c) => {
            const cleanLabel = this.textUtils.restoreAccents(
              c.label.replace(/\*\*/g, '').trim(),
            );
            const cleanGuidance = this.textUtils.restoreAccents(
              c.guidance.replace(/\*\*/g, '').trim(),
            );
            // Skip duplication: if guidance starts with label, show only guidance
            if (
              cleanGuidance.toLowerCase().startsWith(cleanLabel.toLowerCase())
            ) {
              return `<li>${cleanGuidance}</li>`;
            }
            return `<li><b>${cleanLabel}</b> — ${cleanGuidance}</li>`;
          })
          .join('');
        html += '</ul>';
      }
    }

    // Anti-mistakes → "Erreurs à éviter"
    const mistakes = sections['anti_mistakes'];
    if (
      mistakes?.ok &&
      Array.isArray(mistakes.content) &&
      mistakes.content.length >= 2
    ) {
      const items = (mistakes.content as string[])
        .slice(0, 5)
        .map((m) =>
          this.textUtils.restoreAccents(
            m
              .replace(/^❌\s*/, '') // Strip leading ❌ emoji
              .replace(/^[""\u201C]|[""\u201D]$/g, '') // Strip surrounding quotes
              .replace(/\*\*/g, '') // Strip markdown bold
              .trim(),
          ),
        )
        .filter((m) => m.length > 5 && !m.endsWith(':')) // Exclude intro phrases
        .slice(0, 4);
      if (items.length >= 2) {
        html += `<h2>Erreurs à éviter</h2><ul>`;
        html += items.map((m) => `<li>${m}</li>`).join('');
        html += '</ul>';
      }
    }

    // Use cases → "Selon votre usage"
    const useCases = sections['use_cases'];
    if (
      useCases?.ok &&
      Array.isArray(useCases.content) &&
      useCases.content.length >= 2
    ) {
      const items = (
        useCases.content as Array<{ label: string; recommendation: string }>
      ).slice(0, 3);
      html += `<h2>Selon votre usage</h2><ul>`;
      html += items
        .map(
          (uc) =>
            `<li><b>${this.textUtils.restoreAccents(uc.label)}</b> — ${this.textUtils.restoreAccents(uc.recommendation)}</li>`,
        )
        .join('');
      html += '</ul>';
    }

    return html.length >= 100 ? html : null;
  }

  /**
   * Write sg_content_draft to __seo_gamme if meaningful content can be composed.
   */
  async writeSeoContentDraft(
    pgId: string,
    gammeName: string,
    sections: Record<string, SectionValidationResult>,
    conservativeMode = false,
  ): Promise<void> {
    const templateContent = this.composeSeoContent(gammeName, sections);
    if (!templateContent) return;

    let finalContent = templateContent;
    let draftSource = conservativeMode ? 'pipeline:conservative' : 'pipeline';
    let llmModel: string | null = null;

    if (this.aiContentService && !conservativeMode) {
      try {
        // Brief-aware template selection (Phase 2)
        const brief = this.flags.briefAwareEnabled
          ? await this.pageBriefService?.getActiveBrief(parseInt(pgId), 'R1')
          : null;

        const result = await this.aiContentService.generateContent({
          type: brief ? 'seo_content_R1' : 'seo_content_polish',
          prompt: `Polish SEO content for ${gammeName}`,
          tone: 'professional',
          language: 'fr',
          maxLength: 2000,
          temperature: 0.4,
          context: brief
            ? { draft: templateContent, gammeName, brief }
            : { draft: templateContent, gammeName },
          useCache: true,
        });
        const polished = result.content.trim();
        if (
          polished.length >= 100 &&
          polished.includes('<h2>') &&
          polished.length <= templateContent.length * 1.3
        ) {
          finalContent = polished;
          draftSource = brief ? 'pipeline+llm+brief' : 'pipeline+llm';
          llmModel = result.metadata.model;
          this.logger.log(
            `LLM polished sg_content for pgId=${pgId} (${polished.length} chars, model=${llmModel}, brief=${brief ? 'R1' : 'none'})`,
          );
        } else {
          this.logger.warn(
            `LLM polish rejected for pgId=${pgId}: length=${polished.length}, hasH2=${polished.includes('<h2>')}, using template`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `LLM polish failed for pgId=${pgId}, using template: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Read current state to avoid overwriting a better draft_source
    const { data: current } = await this.client
      .from('__seo_gamme')
      .select('sg_draft_source, sg_draft_llm_model, sg_descrip_draft')
      .eq('sg_pg_id', pgId)
      .single();

    // Don't regress from pipeline+llm (or +brief) to pipeline
    const mergedDraftSource =
      current?.sg_draft_source?.includes('pipeline+llm') &&
      draftSource === 'pipeline'
        ? current.sg_draft_source
        : draftSource;

    // Architecture: BuyingGuideEnricher (R6) must NOT write to __seo_gamme (R1).
    // R1 content is exclusively managed by R1ContentPipelineService.
    // sg_content_draft write REMOVED to prevent dual-write conflicts.
    this.logger.log(
      `sg_content_draft SKIPPED for pgId=${pgId} — R1 content managed by R1ContentPipelineService (${finalContent.length} chars generated but not written)`,
    );

    void mergedDraftSource;
    void llmModel;

    // Fallback: generate sg_descrip_draft if ConseilEnricher didn't run
    if (!current?.sg_descrip_draft) {
      await this.writeSeoDescripDraftFallback(
        pgId,
        gammeName,
        conservativeMode,
      );
    }
  }

  /**
   * Fallback: generate sg_descrip_draft when ConseilEnricher (R3_conseils) was skipped.
   * Uses a simple template from the gamme name + optional LLM polish.
   */
  private async writeSeoDescripDraftFallback(
    pgId: string,
    gammeName: string,
    conservativeMode = false,
  ): Promise<void> {
    const label = gammeName.replace(/-/g, ' ');
    const templateDescrip = `${label.charAt(0).toUpperCase() + label.slice(1)} : sélectionnez votre véhicule pour les références compatibles. Livraison 24-48h.`;

    let finalDescrip = templateDescrip;
    let draftSource = conservativeMode ? 'pipeline:conservative' : 'pipeline';

    if (this.aiContentService && !conservativeMode) {
      try {
        // Brief-aware template selection (Phase 2)
        const brief = this.flags.briefAwareEnabled
          ? await this.pageBriefService?.getActiveBrief(parseInt(pgId), 'R1')
          : null;

        const result = await this.aiContentService.generateContent({
          type: brief ? 'seo_descrip_R1' : 'seo_descrip_polish',
          prompt: `Polish meta description for ${gammeName}`,
          tone: 'professional',
          language: 'fr',
          maxLength: 200,
          temperature: 0.3,
          context: brief
            ? { draft: templateDescrip, gammeName: label, brief }
            : { draft: templateDescrip, gammeName: label },
          useCache: true,
        });
        const polished = result.content.trim();
        if (polished.length > 0 && polished.length <= 160) {
          finalDescrip = polished;
          draftSource = brief ? 'pipeline+llm+brief' : 'pipeline+llm';
          this.logger.log(
            `LLM polished sg_descrip (fallback) for pgId=${pgId} (${polished.length} chars, brief=${brief ? 'R1' : 'none'})`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `LLM descrip fallback failed for pgId=${pgId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Architecture: BuyingGuideEnricher (R6) must NOT write sg_descrip to __seo_gamme (R1).
    // R1 meta description is exclusively managed by R1ContentPipelineService.
    // sg_descrip_draft write REMOVED to prevent dual-write conflicts.
    this.logger.log(
      `sg_descrip_draft SKIPPED for pgId=${pgId} — R1 meta managed by R1ContentPipelineService (${finalDescrip.length} chars, source=${draftSource})`,
    );
  }
}
