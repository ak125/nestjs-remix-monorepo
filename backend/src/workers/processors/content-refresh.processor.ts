import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { BuyingGuideEnricherService } from '../../modules/admin/services/buying-guide-enricher.service';
import { ConseilEnricherService } from '../../modules/admin/services/conseil-enricher.service';
import { ReferenceService } from '../../modules/seo/services/reference.service';
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
    private readonly referenceService: ReferenceService,
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
      let qualityScore: number | null = 0;
      let qualityFlags: string[] = [];
      let errorMessage: string | undefined;
      // RAG-as-Optional-Overlay: track when RAG is absent (normal condition)
      let ragSkipped = false;
      let ragSkipReason: string | undefined;

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
            const avgConf = (result as { averageConfidence: number })
              .averageConfidence;
            const skipped =
              (result as { skippedSections?: string[] }).skippedSections || [];
            const updated = (result as { updated?: boolean }).updated;
            const sections =
              (result as { sections?: Record<string, unknown> }).sections || {};

            if (
              !updated &&
              avgConf === 0 &&
              skipped.length > 0 &&
              skipped.length >= Object.keys(sections).length
            ) {
              // All sections skipped = no RAG data (NORMAL)
              ragSkipped = true;
              ragSkipReason = 'NO_RAG_DATA_AVAILABLE';
              qualityFlags = skipped.map(
                (s: string) => `SKIPPED_${s.toUpperCase()}`,
              );
            } else {
              qualityScore = avgConf >= 0.8 ? 85 : 60;
              qualityFlags = skipped.map(
                (s: string) => `SKIPPED_${s.toUpperCase()}`,
              );
            }
          } else if (result && 'qualityScore' in result) {
            qualityScore = (result as { qualityScore: number }).qualityScore;
            qualityFlags = (result as { qualityFlags: string[] }).qualityFlags;
          }
          break;
        }

        case 'R4_reference': {
          // Delegate to ReferenceService.refreshSingleGamme() for RAG-based enrichment
          const refResult =
            await this.referenceService.refreshSingleGamme(pgAlias);

          if (refResult.created) {
            qualityScore = 80;
            qualityFlags = ['NEW_ENTRY_CREATED'];
          } else if (refResult.updated) {
            qualityScore = 85;
            qualityFlags = ['EXISTING_ENTRY_UPDATED'];
          } else if (refResult.skipped) {
            // No RAG file = normal condition, not an error
            ragSkipped = true;
            ragSkipReason = 'NO_RAG_DATA_AVAILABLE';
            qualityFlags = ['NO_RAG_DATA_AVAILABLE'];
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
            if (
              conseilResult.reason === 'NO_RAG_DOC' ||
              conseilResult.reason === 'NO_PAGE_CONTRACT'
            ) {
              // No RAG doc or unparseable = normal, not an error
              ragSkipped = true;
              ragSkipReason = conseilResult.reason;
            } else if (conseilResult.reason === 'NO_ENRICHMENT_NEEDED') {
              // Already fully enriched, nothing to do
              ragSkipped = true;
              ragSkipReason = conseilResult.reason;
              qualityScore = 100;
            }
          }
          break;
        }

        default:
          errorMessage = `Unknown page type: ${pageType}`;
          qualityFlags = ['UNKNOWN_PAGE_TYPE'];
      }

      // Inject internal link markers post-enrichment (Gap 3)
      // Skip when RAG is absent — no enriched content to scan
      if (
        !ragSkipped &&
        (qualityScore ?? 0) >= 70 &&
        pageType !== 'R4_reference'
      ) {
        try {
          const markersCount = await this.injectLinkMarkers(
            pgId,
            pgAlias,
            pageType,
          );
          if (markersCount > 0) {
            qualityFlags.push(`LINKS_INJECTED_${markersCount}`);
            this.logger.log(
              `Injected ${markersCount} link markers for ${pgAlias}/${pageType}`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Link marker injection failed for ${pgAlias}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      // Determine final status with auto-publish threshold
      const autoPublishThreshold = parseInt(
        this.configService.get('CONTENT_AUTO_PUBLISH_THRESHOLD', '101'),
        10,
      );
      let finalStatus: ContentRefreshResult['status'];

      if (ragSkipped) {
        // RAG absent = neutral condition, not an error
        finalStatus = 'skipped';
      } else if ((qualityScore ?? 0) >= autoPublishThreshold) {
        finalStatus = 'auto_published';
      } else if ((qualityScore ?? 0) >= 70) {
        finalStatus = 'draft';
      } else {
        finalStatus = 'failed';
      }

      // Update dependent tables — skip when RAG absent (no content changed)
      if (finalStatus !== 'skipped') {
        if (pageType === 'R1_pieces' || pageType === 'R3_guide_achat') {
          if (finalStatus === 'auto_published') {
            // Auto-publish: make content live immediately
            await this.client
              .from('__seo_gamme_purchase_guide')
              .update({ sgpg_is_draft: false })
              .eq('sgpg_pg_id', String(pgId));
          } else if (finalStatus === 'draft') {
            await this.client
              .from('__seo_gamme_purchase_guide')
              .update({ sgpg_is_draft: true })
              .eq('sgpg_pg_id', String(pgId));
          }
        }

        if (pageType === 'R4_reference' && finalStatus === 'auto_published') {
          await this.client
            .from('__seo_reference')
            .update({ is_published: true })
            .eq('slug', pgAlias);
        }
      }

      // Update tracking log
      const now = new Date().toISOString();
      await this.client
        .from('__rag_content_refresh_log')
        .update({
          status: finalStatus,
          quality_score: ragSkipped ? null : qualityScore,
          quality_flags: qualityFlags,
          completed_at: now,
          ...(finalStatus === 'auto_published'
            ? { published_at: now, published_by: 'auto' }
            : {}),
          error_message:
            finalStatus === 'failed'
              ? errorMessage || 'Quality score below threshold'
              : null,
        })
        .eq('id', refreshLogId);

      this.logger.log(
        `Content-refresh complete: ${pgAlias}/${pageType} → ${finalStatus}` +
          (ragSkipped
            ? ` (ragSkipped: ${ragSkipReason})`
            : ` (score=${qualityScore}, threshold=${autoPublishThreshold})`),
      );

      return {
        status: finalStatus,
        qualityScore: ragSkipped ? null : qualityScore,
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

  /**
   * Scan enriched content for mentions of other gamme names
   * and inject #LinkGamme_{pg_id}# markers for InternalLinkingService.
   */
  private async injectLinkMarkers(
    pgId: number,
    pgAlias: string,
    pageType: string,
  ): Promise<number> {
    const { data: gammes } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_display', '1')
      .neq('pg_alias', pgAlias)
      .neq('pg_alias', '')
      .limit(200);

    if (!gammes?.length) return 0;

    let markersInserted = 0;

    if (pageType === 'R1_pieces' || pageType === 'R3_guide_achat') {
      const { data: guide } = await this.client
        .from('__seo_gamme_purchase_guide')
        .select('sgpg_id, sgpg_how_to_choose, sgpg_symptoms, sgpg_faq')
        .eq('sgpg_pg_id', String(pgId))
        .single();

      if (guide) {
        const fields = [
          'sgpg_how_to_choose',
          'sgpg_symptoms',
          'sgpg_faq',
        ] as const;
        for (const field of fields) {
          const content = guide[field] as string | null;
          if (!content) continue;
          const updated = this.insertMarkers(content, gammes, 3);
          if (updated !== content) {
            await this.client
              .from('__seo_gamme_purchase_guide')
              .update({ [field]: updated })
              .eq('sgpg_id', guide.sgpg_id);
            markersInserted++;
          }
        }
      }
    }

    if (pageType === 'R3_conseils') {
      // Conseil uses row-per-section model (sgc_content + sgc_section_type)
      const { data: sections } = await this.client
        .from('__seo_gamme_conseil')
        .select('sgc_id, sgc_content, sgc_section_type')
        .eq('sgc_pg_id', String(pgId));

      if (sections?.length) {
        for (const section of sections) {
          const content = section.sgc_content as string | null;
          if (!content) continue;
          const updated = this.insertMarkers(content, gammes, 3);
          if (updated !== content) {
            await this.client
              .from('__seo_gamme_conseil')
              .update({ sgc_content: updated })
              .eq('sgc_id', section.sgc_id);
            markersInserted++;
          }
        }
      }
    }

    return markersInserted;
  }

  /**
   * Replace first occurrence of gamme names in text with link markers.
   * Max `maxMarkers` replacements per text block.
   */
  private insertMarkers(
    text: string,
    gammes: Array<{ pg_id: number; pg_alias: string; pg_name: string }>,
    maxMarkers: number,
  ): string {
    let result = text;
    let count = 0;

    for (const g of gammes) {
      if (count >= maxMarkers) break;
      const name = (g.pg_name || '').trim();
      if (name.length < 4) continue; // skip very short names
      const marker = `#LinkGamme_${g.pg_id}#`;
      if (result.includes(marker)) continue; // already has this marker
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b(${escaped})\\b`, 'i');
      if (regex.test(result)) {
        result = result.replace(regex, `$1 ${marker}`);
        count++;
      }
    }

    return result;
  }
}
