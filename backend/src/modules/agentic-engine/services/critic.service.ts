/**
 * CriticService — Phase CRITIQUING stub
 *
 * Evaluates branch outputs and scores them.
 * May trigger re-planning if score is below threshold.
 * Phase 2: will use LLM for quality evaluation.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgenticDataService } from './agentic-data.service';
import { EvidenceLedgerService } from './evidence-ledger.service';
import type { AgenticBranch } from '../types/run-state.schema';

@Injectable()
export class CriticService {
  private readonly logger = new Logger(CriticService.name);

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
  ) {}

  /**
   * Evaluate branches and produce scores.
   * Stub: assigns score 75 to all branches.
   */
  async critique(
    runId: string,
    branches: AgenticBranch[],
  ): Promise<{
    scores: Array<{ branchId: string; score: number; feedback: string }>;
    needsReplan: boolean;
  }> {
    this.logger.log(`Critiquing ${branches.length} branches (stub mode)`);

    const scores = branches.map((b) => ({
      branchId: b.id,
      score: 75,
      feedback: 'Stub critic: acceptable quality',
    }));

    // Update branch critic scores
    for (const s of scores) {
      await this.dataService.updateBranchStatus(s.branchId, 'completed', {
        critic_score: s.score,
        critic_feedback: s.feedback,
      });
    }

    // Record evidence
    await this.evidenceLedger.record({
      runId,
      evidenceType: 'computation',
      content: { action: 'critique_completed', scores },
      source: 'critic',
      truthLevel: 'L3',
    });

    return { scores, needsReplan: false };
  }
}
