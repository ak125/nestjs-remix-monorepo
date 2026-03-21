/**
 * SolverService — Phase SOLVING (Agent-Native)
 *
 * Ce service ne fait PAS d'appels LLM. Le travail LLM est fait par
 * l'agent Claude Code `agentic-solver` qui ecrit directement en DB via MCP.
 *
 * Ce service fournit des helpers pour :
 * - Marquer une branch en cours / complete / failed
 * - Enregistrer les steps et l'evidence
 * - Appliquer un resultat soumis par l'agent
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgenticDataService } from './agentic-data.service';
import { EvidenceLedgerService } from './evidence-ledger.service';
import type { AgenticBranch, AgenticRun } from '../types/run-state.schema';
import { getErrorMessage } from '../../../common/utils/error.utils';

export interface SolveResult {
  success: boolean;
  output?: Record<string, unknown>;
  tokensUsed?: number;
  error?: string;
}

@Injectable()
export class SolverService {
  private readonly logger = new Logger(SolverService.name);

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
  ) {}

  /**
   * Apply a solve result produced by the agentic-solver agent.
   * Updates branch status and records evidence.
   */
  async applySolveResult(
    run: AgenticRun,
    branch: AgenticBranch,
    output: Record<string, unknown>,
  ): Promise<SolveResult> {
    const startTime = performance.now();
    this.logger.log(
      `Applying solve result for branch ${branch.id.slice(0, 8)} (${branch.strategy_label})`,
    );

    try {
      // Mark branch as completed with output
      const durationMs = Math.round(performance.now() - startTime);
      await this.dataService.updateBranchStatus(branch.id, 'completed', {
        output,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
      } as Partial<AgenticBranch>);

      // Record evidence
      await this.evidenceLedger.record({
        runId: run.id,
        branchId: branch.id,
        evidenceType: 'llm_output',
        content: {
          action: 'solve_completed',
          strategy_label: branch.strategy_label,
          confidence:
            (output as { result?: { confidence?: number } }).result
              ?.confidence ?? 0,
          provider: 'claude-agent',
        },
        source: 'solver:claude-agent',
        truthLevel: 'L3',
      });

      this.logger.log(
        `Solve result applied for branch ${branch.id.slice(0, 8)} in ${durationMs}ms`,
      );

      return { success: true, output };
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      this.logger.error(
        `Failed to apply solve result for branch ${branch.id.slice(0, 8)}: ${errorMsg}`,
      );
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Mark a branch as failed.
   */
  async failBranch(
    run: AgenticRun,
    branch: AgenticBranch,
    errorMessage: string,
  ): Promise<void> {
    await this.dataService.updateBranchStatus(branch.id, 'failed', {
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    } as Partial<AgenticBranch>);

    await this.evidenceLedger.record({
      runId: run.id,
      branchId: branch.id,
      evidenceType: 'computation',
      content: {
        action: 'solve_failed',
        strategy_label: branch.strategy_label,
        error: errorMessage,
      },
      source: 'solver:error',
      truthLevel: 'L1',
    });
  }

  /**
   * Start a branch (mark as running).
   */
  async startBranch(branch: AgenticBranch): Promise<void> {
    await this.dataService.updateBranchStatus(branch.id, 'running', {
      started_at: new Date().toISOString(),
    } as Partial<AgenticBranch>);
  }
}
