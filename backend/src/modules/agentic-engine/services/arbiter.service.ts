/**
 * ArbiterService — Phase ARBITRATING stub
 *
 * Deterministic selection of the winning branch.
 * Phase 3: will implement weighted scoring + evidence-based selection.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgenticDataService } from './agentic-data.service';
import { EvidenceLedgerService } from './evidence-ledger.service';
import type { AgenticBranch } from '../types/run-state.schema';

@Injectable()
export class ArbiterService {
  private readonly logger = new Logger(ArbiterService.name);

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
  ) {}

  /**
   * Select the winning branch from completed branches.
   * Stub: picks the branch with highest critic_score.
   */
  async arbitrate(runId: string): Promise<{
    winningBranchId: string | null;
    reason: string;
  }> {
    this.logger.log(`Arbitrating run ${runId} (stub mode)`);

    const branches = await this.dataService.getBranchesByRun(runId);
    const completed = branches.filter((b) => b.status === 'completed');

    if (completed.length === 0) {
      return { winningBranchId: null, reason: 'No completed branches' };
    }

    // Sort by critic_score descending, pick highest
    completed.sort(
      (a, b) => (b.critic_score ?? 0) - (a.critic_score ?? 0),
    );
    const winner = completed[0];

    await this.evidenceLedger.record({
      runId,
      branchId: winner.id,
      evidenceType: 'computation',
      content: {
        action: 'arbitration_completed',
        winning_branch_id: winner.id,
        winning_score: winner.critic_score,
        candidates: completed.map((b) => ({
          id: b.id,
          score: b.critic_score,
          strategy: b.strategy_label,
        })),
      },
      source: 'arbiter',
      truthLevel: 'L1',
    });

    return {
      winningBranchId: winner.id,
      reason: `Selected branch ${winner.strategy_label} (score: ${winner.critic_score ?? 'N/A'})`,
    };
  }
}
