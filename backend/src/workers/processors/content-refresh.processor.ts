import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { BuyingGuideEnricherService } from '../../modules/admin/services/buying-guide-enricher.service';
import { ConseilEnricherService } from '../../modules/admin/services/conseil-enricher.service';
import type {
  ContentRefreshJobData,
  ContentRefreshResult,
} from '../types/content-refresh.types';

@Processor('seo-monitor')
export class ContentRefreshProcessor extends SupabaseBaseService {
  protected override readonly logger = new Logger(ContentRefreshProcessor.name);

  constructor(
    configService: ConfigService,
    private readonly buyingGuideEnricher: BuyingGuideEnricherService,
    private readonly conseilEnricher: ConseilEnricherService,
  ) {
    super(configService);
  }

  @Process('content-refresh')
  async handleContentRefresh(
    job: Job<ContentRefreshJobData>,
  ): Promise<ContentRefreshResult> {
    const { refreshLogId, pgId, pgAlias, pageType } = job.data;

    this.logger.log(
      `Processing content-refresh: pgAlias=${pgAlias}, pageType=${pageType}, logId=${refreshLogId}`,
    );

    // Mark as processing
    await this.client
      .from('__rag_content_refresh_log')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', refreshLogId);

    try {
      let qualityScore = 0;
      let qualityFlags: string[] = [];
      let errorMessage: string | undefined;

      switch (pageType) {
        case 'R1_pieces':
        case 'R3_guide_achat': {
          // Delegate to BuyingGuideEnricherService
          const enrichResults = await this.buyingGuideEnricher.enrich(
            [String(pgId)],
            false,
          );
          const result = enrichResults[0];
          if (result && 'averageConfidence' in result) {
            qualityScore = result.averageConfidence >= 0.8 ? 85 : 60;
            qualityFlags =
              result.skippedSections?.map(
                (s: string) => `SKIPPED_${s.toUpperCase()}`,
              ) || [];
          } else if (result && 'qualityScore' in result) {
            qualityScore = (result as { qualityScore: number }).qualityScore;
            qualityFlags = (result as { qualityFlags: string[] }).qualityFlags;
          }
          break;
        }

        case 'R4_reference': {
          // For R4, we generate a draft via ReferenceService
          // Since we might not have ReferenceService injected here,
          // we do a simple RAG-based SQL approach
          const { data: existingRef } = await this.client
            .from('__seo_reference')
            .select('id, is_published')
            .eq('slug', pgAlias)
            .single();

          if (existingRef) {
            // Entry exists, mark for review
            qualityScore = 75;
            qualityFlags = ['EXISTING_ENTRY_REVIEW'];
          } else {
            // No entry — flag for manual creation via /seo-content-architect
            qualityScore = 50;
            qualityFlags = ['NO_EXISTING_ENTRY', 'MANUAL_CREATION_NEEDED'];
          }
          break;
        }

        case 'R3_conseils': {
          // Delegate to ConseilEnricherService
          const conseilResult = await this.conseilEnricher.enrichSingle(
            String(pgId),
            pgAlias,
          );
          qualityScore = conseilResult.score;
          qualityFlags = conseilResult.flags;
          if (conseilResult.status === 'skipped') {
            errorMessage = conseilResult.reason;
          }
          break;
        }

        default:
          errorMessage = `Unknown page type: ${pageType}`;
          qualityFlags = ['UNKNOWN_PAGE_TYPE'];
      }

      // Determine final status
      const finalStatus = qualityScore >= 70 ? 'draft' : 'failed';

      // Only set is_draft=true on purchase guide if quality passed
      if (
        finalStatus === 'draft' &&
        (pageType === 'R1_pieces' || pageType === 'R3_guide_achat')
      ) {
        await this.client
          .from('__seo_gamme_purchase_guide')
          .update({ sgpg_is_draft: true })
          .eq('sgpg_pg_id', String(pgId));
      }

      // Update tracking log
      await this.client
        .from('__rag_content_refresh_log')
        .update({
          status: finalStatus,
          quality_score: qualityScore,
          quality_flags: qualityFlags,
          completed_at: new Date().toISOString(),
          error_message:
            finalStatus === 'failed'
              ? errorMessage || 'Quality score below threshold'
              : null,
        })
        .eq('id', refreshLogId);

      this.logger.log(
        `Content-refresh complete: ${pgAlias}/${pageType} → ${finalStatus} (score=${qualityScore})`,
      );

      return {
        status: finalStatus as 'draft' | 'failed',
        qualityScore,
        qualityFlags,
        errorMessage,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Content-refresh failed: ${pgAlias}/${pageType} — ${msg}`,
      );

      await this.client
        .from('__rag_content_refresh_log')
        .update({
          status: 'failed',
          error_message: msg,
          completed_at: new Date().toISOString(),
        })
        .eq('id', refreshLogId);

      return {
        status: 'failed',
        qualityScore: 0,
        qualityFlags: ['EXCEPTION'],
        errorMessage: msg,
      };
    }
  }
}
