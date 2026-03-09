/**
 * PlannerService — Phase PLANNING stub
 *
 * Produces branches (strategies) from a goal.
 * Phase 2: will use AiContentService for LLM-based planning.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgenticDataService } from './agentic-data.service';
import { EvidenceLedgerService } from './evidence-ledger.service';
import type { AgenticRun, AgenticBranch } from '../types/run-state.schema';

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
  ) {}

  /**
   * Generate branches (strategies) for a run.
   * Stub: creates a single "default" branch.
   */
  async plan(run: AgenticRun, criticFeedback?: string): Promise<AgenticBranch[]> {
    this.logger.log(`Planning run ${run.id} (stub mode)`);

    const branch = await this.dataService.createBranch(
      run.id,
      criticFeedback ? 'revised-strategy' : 'default-strategy',
    );

    if (!branch) {
      this.logger.error(`Failed to create branch for run ${run.id}`);
      return [];
    }

    await this.evidenceLedger.record({
      runId: run.id,
      branchId: branch.id,
      evidenceType: 'computation',
      content: {
        action: 'plan_created',
        strategy: branch.strategy_label,
        critic_feedback: criticFeedback ?? null,
      },
      source: 'planner',
      truthLevel: 'L3',
    });

    return [branch];
  }
}
