import { Injectable, Logger } from '@nestjs/common';
import { MarketingDataService } from './marketing-data.service';
import {
  RoadmapFilters,
  MarketingContentRoadmap,
} from '../interfaces/marketing.interfaces';

export interface SyncChange {
  id: number;
  pg_id: number;
  from_status: string;
  to_status: string;
  reason: string;
}

@Injectable()
export class MarketingContentRoadmapService {
  private readonly logger = new Logger(MarketingContentRoadmapService.name);

  constructor(private readonly dataService: MarketingDataService) {}

  async getRoadmap(filters: RoadmapFilters) {
    return this.dataService.getContentRoadmap(filters);
  }

  async getCoverage() {
    return this.dataService.getContentCoverage();
  }

  async getPipelineStatus() {
    return this.dataService.getPipelineStatus();
  }

  async create(data: Partial<MarketingContentRoadmap>) {
    return this.dataService.createRoadmapItem(data);
  }

  async update(id: number, data: Partial<MarketingContentRoadmap>) {
    return this.dataService.updateRoadmapItem(id, data);
  }

  async delete(id: number) {
    return this.dataService.deleteRoadmapItem(id);
  }

  /**
   * Sync roadmap item statuses from pipeline reality.
   *
   * Rules:
   *   planned  → writing   : when pipeline_overall = in_progress
   *   planned/writing → published : when pipeline_overall = published
   *   planned/writing → review   : when pipeline_overall = failed
   *
   * Guards:
   *   - Never touch items already published/cancelled (no downgrade)
   *   - Dry-run by default (safety)
   */
  async syncWithPipeline(dryRun = true): Promise<{
    dry_run: boolean;
    processed: number;
    updated: number;
    skipped: number;
    changes: SyncChange[];
  }> {
    const pipelineResult = await this.dataService.getPipelineStatus();
    const pipelineMap = new Map(pipelineResult.gammes.map((g) => [g.pg_id, g]));

    // Get roadmap items that have a pg_id and are NOT terminal (published/cancelled)
    const allItems = await this.dataService.getContentRoadmap({
      page: 1,
      limit: 500,
    });

    const changes: SyncChange[] = [];
    let skipped = 0;

    for (const item of allItems.data) {
      // Guard: never downgrade terminal statuses
      if (
        !item.pg_id ||
        item.status === 'published' ||
        item.status === 'cancelled'
      ) {
        skipped++;
        continue;
      }

      const pipeline = pipelineMap.get(item.pg_id);
      if (!pipeline) {
        skipped++;
        continue;
      }

      let newStatus: string = item.status;
      let reason = '';

      if (
        item.status === 'planned' &&
        pipeline.pipeline_overall === 'in_progress'
      ) {
        newStatus = 'writing';
        reason = 'pipeline has draft content';
      } else if (
        (item.status === 'planned' || item.status === 'writing') &&
        pipeline.pipeline_overall === 'published'
      ) {
        newStatus = 'published';
        reason = 'pipeline has auto_published content';
      } else if (
        (item.status === 'planned' || item.status === 'writing') &&
        pipeline.pipeline_overall === 'failed'
      ) {
        newStatus = 'review';
        reason = 'pipeline failed — needs human attention';
      }

      if (newStatus !== item.status) {
        changes.push({
          id: item.id,
          pg_id: item.pg_id,
          from_status: item.status,
          to_status: newStatus,
          reason,
        });
      }
    }

    if (!dryRun && changes.length > 0) {
      for (const change of changes) {
        await this.dataService.updateRoadmapItem(change.id, {
          status: change.to_status as MarketingContentRoadmap['status'],
        });
      }
      this.logger.log(
        `syncWithPipeline: updated ${changes.length} roadmap items`,
      );
    }

    return {
      dry_run: dryRun,
      processed: allItems.data.length,
      updated: dryRun ? 0 : changes.length,
      skipped,
      changes,
    };
  }
}
