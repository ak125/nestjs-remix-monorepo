/**
 * PlannerService — Phase PLANNING (Agent-Native)
 *
 * Ce service ne fait PAS d'appels LLM. Le travail LLM est fait par
 * l'agent Claude Code `agentic-planner` qui ecrit directement en DB via MCP.
 *
 * Ce service fournit des helpers pour :
 * - Creer les branches en DB
 * - Enregistrer l'evidence
 * - Valider un plan soumis par l'agent
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgenticDataService } from './agentic-data.service';
import { EvidenceLedgerService } from './evidence-ledger.service';
import { AGENTIC_DEFAULTS } from '../constants/agentic.constants';
import type { AgenticRun, AgenticBranch } from '../types/run-state.schema';

export interface PlanStrategy {
  label: string;
  description: string;
  steps: string[];
  expected_outcome: string;
}

export interface PlanResult {
  strategies: PlanStrategy[];
  reasoning: string;
}

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
  ) {}

  /**
   * Apply a plan result produced by the agentic-planner agent.
   * Creates branches in DB and records evidence.
   */
  async applyPlan(
    run: AgenticRun,
    planResult: PlanResult,
    criticFeedback?: string,
  ): Promise<AgenticBranch[]> {
    const startTime = performance.now();
    const branchCount = Math.min(
      planResult.strategies.length,
      AGENTIC_DEFAULTS.MAX_BRANCHES_CAP,
    );

    this.logger.log(
      `Applying plan for run ${run.id} — ${branchCount} strategies${criticFeedback ? ' (critic loop)' : ''}`,
    );

    const strategies = planResult.strategies.slice(0, branchCount);

    // Create branches in DB
    const branches: AgenticBranch[] = [];
    for (const strategy of strategies) {
      const branch = await this.dataService.createBranch(
        run.id,
        strategy.label,
      );
      if (branch) {
        branches.push(branch);
      }
    }

    // Record evidence
    await this.evidenceLedger.record({
      runId: run.id,
      evidenceType: 'llm_output',
      content: {
        action: 'plan_generated',
        strategies_count: strategies.length,
        strategy_labels: strategies.map((s) => s.label),
        reasoning: planResult.reasoning.substring(0, 500),
        provider: 'claude-agent',
        critic_feedback: criticFeedback ?? null,
      },
      source: 'planner:claude-agent',
      truthLevel: 'L3',
    });

    const elapsed = (performance.now() - startTime).toFixed(1);
    this.logger.log(
      `Plan applied for run ${run.id} — ${branches.length} branches created in ${elapsed}ms`,
    );

    return branches;
  }

  /**
   * Get the strategy metadata for a specific branch label.
   */
  getStrategyForBranch(
    plan: Record<string, unknown>,
    strategyLabel: string,
  ): PlanStrategy | null {
    const strategies = (plan as { strategies?: PlanStrategy[] }).strategies;
    if (!strategies) return null;
    return strategies.find((s) => s.label === strategyLabel) ?? null;
  }

  /**
   * Fallback plan when the agent is unavailable.
   * Produces generic strategies for the run.
   */
  fallbackPlan(run: AgenticRun, count?: number): PlanResult {
    const branchCount = Math.min(
      count ?? AGENTIC_DEFAULTS.MAX_BRANCHES,
      AGENTIC_DEFAULTS.MAX_BRANCHES_CAP,
    );

    const strategies: PlanStrategy[] = [];
    const labels = [
      'comprehensive_analysis',
      'focused_optimization',
      'creative_alternative',
    ];

    for (let i = 0; i < branchCount; i++) {
      strategies.push({
        label: labels[i] || `strategy_${i + 1}`,
        description: `Fallback strategy ${i + 1} for: ${run.goal.substring(0, 100)}`,
        steps: ['Analyze context', 'Generate solution', 'Validate output'],
        expected_outcome: `Solution via approach ${i + 1}`,
      });
    }

    return { strategies, reasoning: 'Fallback plan (agent unavailable)' };
  }
}
