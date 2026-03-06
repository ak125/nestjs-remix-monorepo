import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import {
  KEYWORD_PLAN_VALIDATED,
  type KeywordPlanValidatedEvent,
} from '../events/keyword-plan.events';

/**
 * Polls __pipeline_chain_queue for pending entries and emits
 * KEYWORD_PLAN_VALIDATED events to trigger conseil section regeneration.
 *
 * Uses a BullMQ repeatable job as the polling timer (since @nestjs/schedule
 * is disabled in this project). The actual poll logic runs in the
 * ContentRefreshProcessor via @Process({ name: 'chain-poll' }).
 */
@Injectable()
export class PipelineChainPollerService
  extends SupabaseBaseService
  implements OnModuleInit
{
  protected override readonly logger = new Logger(
    PipelineChainPollerService.name,
  );

  constructor(
    configService: ConfigService,
    @InjectQueue('content-refresh') private readonly queue: Queue,
    private readonly eventEmitter: EventEmitter2,
    private readonly flags: FeatureFlagsService,
  ) {
    super(configService);
  }

  async onModuleInit(): Promise<void> {
    // Remove any stale repeatable jobs first (idempotent)
    const existingRepeatables = await this.queue.getRepeatableJobs();

    // ── Chain-poll repeatable job ──
    for (const r of existingRepeatables) {
      if (r.name === 'chain-poll') {
        await this.queue.removeRepeatableByKey(r.key);
      }
    }

    if (this.flags.pipelineChainEnabled) {
      const intervalMs = this.flags.pipelineChainPollIntervalMs;
      await this.queue.add(
        'chain-poll',
        {},
        {
          repeat: { every: intervalMs },
          jobId: 'chain-poll-repeatable',
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
      this.logger.log(
        `Pipeline chain poller registered (interval=${intervalMs}ms)`,
      );
    } else {
      this.logger.log('Pipeline chain DISABLED (PIPELINE_CHAIN_ENABLED=false)');
    }

    // ── Draft auto-publish repeatable job ──
    for (const r of existingRepeatables) {
      if (r.name === 'draft-auto-publish') {
        await this.queue.removeRepeatableByKey(r.key);
      }
    }

    if (this.flags.draftAutoPublishEnabled) {
      const publishIntervalMs = this.flags.draftAutoPublishIntervalMs;
      await this.queue.add(
        'draft-auto-publish',
        {},
        {
          repeat: { every: publishIntervalMs },
          jobId: 'draft-auto-publish-repeatable',
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
      this.logger.log(
        `Draft auto-publish registered (interval=${publishIntervalMs}ms)`,
      );
    } else {
      this.logger.log(
        'Draft auto-publish DISABLED (DRAFT_AUTO_PUBLISH_ENABLED=false)',
      );
    }
  }

  /**
   * Called by ContentRefreshProcessor when the 'chain-poll' job fires.
   * Claims pending rows from __pipeline_chain_queue and emits events.
   */
  async pollAndDispatch(): Promise<number> {
    if (!this.flags.pipelineChainEnabled) return 0;

    // 1. Fetch pending entries (oldest first, max 5 per poll)
    const { data: pendingRows, error: fetchErr } = await this.client
      .from('__pipeline_chain_queue')
      .select('*')
      .eq('pcq_status', 'pending')
      .order('pcq_created_at', { ascending: true })
      .limit(5);

    if (fetchErr || !pendingRows?.length) return 0;

    let dispatched = 0;

    for (const row of pendingRows) {
      const pcqId = row.pcq_id as number;
      const pgId = row.pcq_pg_id as number;
      const pgAlias = row.pcq_pg_alias as string;
      const sections = (row.pcq_sections as string[]) || [];
      const kpId = row.pcq_kp_id as number;

      // 2. Atomic claim: only one poller instance can process this row
      const { data: claimed, error: claimErr } = await this.client
        .from('__pipeline_chain_queue')
        .update({ pcq_status: 'processing' })
        .eq('pcq_id', pcqId)
        .eq('pcq_status', 'pending') // atomic guard
        .select('pcq_id')
        .maybeSingle();

      if (claimErr || !claimed) {
        this.logger.debug(
          `Row ${pcqId} already claimed by another poller instance`,
        );
        continue;
      }

      try {
        // 3. Load keyword plan section_terms for this kpId
        const { data: kpRow } = await this.client
          .from('__seo_r3_keyword_plan')
          .select('skp_section_terms')
          .eq('skp_id', kpId)
          .single();

        const sectionTerms =
          (kpRow?.skp_section_terms as Record<string, unknown>) || {};

        // 4. Emit event for ContentRefreshService to pick up
        const event: KeywordPlanValidatedEvent = {
          pcqId,
          pgId,
          pgAlias,
          sectionsToImprove: sections,
          kpId,
          sectionTerms:
            sectionTerms as KeywordPlanValidatedEvent['sectionTerms'],
        };

        this.eventEmitter.emit(KEYWORD_PLAN_VALIDATED, event);
        dispatched++;

        this.logger.log(
          `Dispatched KEYWORD_PLAN_VALIDATED for ${pgAlias} (kpId=${kpId}, sections=[${sections.join(', ')}])`,
        );

        // 5. Mark as done
        await this.client
          .from('__pipeline_chain_queue')
          .update({
            pcq_status: 'done',
            pcq_processed_at: new Date().toISOString(),
          })
          .eq('pcq_id', pcqId);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to dispatch chain event for ${pgAlias}: ${errMsg}`,
        );

        // Mark as failed with error message
        await this.client
          .from('__pipeline_chain_queue')
          .update({
            pcq_status: 'failed',
            pcq_processed_at: new Date().toISOString(),
            pcq_error: errMsg.substring(0, 500),
          })
          .eq('pcq_id', pcqId);
      }
    }

    return dispatched;
  }
}
