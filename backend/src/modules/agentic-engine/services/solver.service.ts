/**
 * SolverService — Phase SOLVING stub
 *
 * Executes steps within a branch to solve the goal.
 * Phase 2: will use AiContentService + RAG for LLM-based solving.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgenticDataService } from './agentic-data.service';
import { EvidenceLedgerService } from './evidence-ledger.service';
import type { AgenticBranch } from '../types/run-state.schema';

@Injectable()
export class SolverService {
  private readonly logger = new Logger(SolverService.name);

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
  ) {}

  /**
   * Execute solving steps for a branch.
   * Stub: creates a single "solve" step and marks it completed.
   */
  async solve(
    runId: string,
    branch: AgenticBranch,
  ): Promise<{ success: boolean; output?: Record<string, unknown> }> {
    this.logger.log(`Solving branch ${branch.id} (stub mode)`);

    // Create a step
    const step = await this.dataService.createStep({
      branch_id: branch.id,
      run_id: runId,
      step_name: 'solve-stub',
      step_type: 'computation',
      step_index: 0,
    });

    if (!step) {
      return { success: false };
    }

    // Stub output
    const output = { result: 'stub_solution', branch_id: branch.id };

    // Mark step completed
    await this.dataService.updateStep(step.id, {
      status: 'completed',
      output,
      duration_ms: 0,
    });

    // Record evidence
    await this.evidenceLedger.record({
      runId,
      branchId: branch.id,
      stepId: step.id,
      evidenceType: 'computation',
      content: { action: 'solve_completed', output },
      source: 'solver',
      truthLevel: 'L3',
    });

    // Mark branch completed
    await this.dataService.updateBranchStatus(branch.id, 'completed', {
      output,
    });

    return { success: true, output };
  }
}
