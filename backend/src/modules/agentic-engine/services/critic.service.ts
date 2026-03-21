/**
 * CriticService — Phase CRITIQUING (Agent-Native)
 *
 * Ce service ne fait PAS d'appels LLM. Le travail LLM est fait par
 * l'agent Claude Code `agentic-critic` qui ecrit directement en DB via MCP.
 *
 * Ce service fournit des helpers pour :
 * - Appliquer les scores produits par l'agent
 * - Determiner si un re-plan est necessaire
 * - Construire le feedback pour le critic loop
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgenticDataService } from './agentic-data.service';
import { EvidenceLedgerService } from './evidence-ledger.service';
import type { AgenticBranch, AgenticRun } from '../types/run-state.schema';

export interface BranchScore {
  branchId: string;
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

export interface CritiqueResult {
  scores: BranchScore[];
  needsReplan: boolean;
  replanReason: string | null;
  bestBranchId: string | null;
}

@Injectable()
export class CriticService {
  private readonly logger = new Logger(CriticService.name);

  /** Below this score, all branches trigger a re-plan */
  static readonly REPLAN_THRESHOLD = 60;

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
  ) {}

  /**
   * Apply critique scores produced by the agentic-critic agent.
   * Updates branch scores in DB and determines re-plan decision.
   */
  async applyCritique(
    run: AgenticRun,
    branchScores: BranchScore[],
  ): Promise<CritiqueResult> {
    const startTime = performance.now();
    this.logger.log(
      `Applying critique for run ${run.id.slice(0, 8)} — ${branchScores.length} branches`,
    );

    // Update branch scores in DB
    for (const bs of branchScores) {
      const score = Math.max(0, Math.min(100, bs.score));
      await this.dataService.updateBranchStatus(bs.branchId, 'completed', {
        critic_score: score,
        critic_feedback: bs.feedback,
      } as Partial<AgenticBranch>);
    }

    // Determine if re-plan is needed
    const allBelowThreshold = branchScores.every(
      (s) => s.score < CriticService.REPLAN_THRESHOLD,
    );

    const bestBranch = [...branchScores].sort((a, b) => b.score - a.score)[0];
    const needsReplan = allBelowThreshold && branchScores.length > 0;

    // Record evidence
    await this.evidenceLedger.record({
      runId: run.id,
      evidenceType: 'llm_output',
      content: {
        action: 'critique_completed',
        scores: branchScores.map((s) => ({
          branchId: s.branchId.slice(0, 8),
          score: s.score,
        })),
        best_branch_id: bestBranch?.branchId ?? null,
        needs_replan: needsReplan,
        provider: 'claude-agent',
      },
      source: 'critic:claude-agent',
      truthLevel: 'L3',
    });

    const elapsed = (performance.now() - startTime).toFixed(1);
    this.logger.log(
      `Critique applied for run ${run.id.slice(0, 8)} — scores: [${branchScores.map((s) => s.score).join(', ')}], needsReplan: ${needsReplan} in ${elapsed}ms`,
    );

    return {
      scores: branchScores,
      needsReplan,
      replanReason: needsReplan
        ? `All scores below ${CriticService.REPLAN_THRESHOLD}`
        : null,
      bestBranchId: bestBranch?.branchId ?? null,
    };
  }

  /**
   * Build a concise feedback string for the critic loop (passed to planner).
   */
  buildCriticFeedback(result: CritiqueResult): string {
    const lines: string[] = [];
    lines.push(
      `Critic loop: ${result.replanReason ?? 'quality below threshold'}`,
    );

    for (const s of result.scores) {
      lines.push(
        `- Branch ${s.branchId.slice(0, 8)} (${s.score}/100): ${s.feedback}`,
      );
      if (s.weaknesses.length > 0) {
        lines.push(`  Weaknesses: ${s.weaknesses.join('; ')}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Read critique results directly from DB (written by agentic-critic agent).
   * Returns formatted CritiqueResult from branch data.
   */
  async readCritiqueFromDb(runId: string): Promise<CritiqueResult> {
    const branches = await this.dataService.getBranchesByRun(runId);
    const scoredBranches = branches.filter(
      (b) => b.status === 'completed' && b.critic_score != null,
    );

    const scores: BranchScore[] = scoredBranches.map((b) => ({
      branchId: b.id,
      score: b.critic_score ?? 0,
      feedback: b.critic_feedback ?? '',
      strengths: [],
      weaknesses: [],
    }));

    const allBelowThreshold = scores.every(
      (s) => s.score < CriticService.REPLAN_THRESHOLD,
    );
    const bestBranch = [...scores].sort((a, b) => b.score - a.score)[0];

    return {
      scores,
      needsReplan: allBelowThreshold && scores.length > 0,
      replanReason: allBelowThreshold
        ? `All scores below ${CriticService.REPLAN_THRESHOLD}`
        : null,
      bestBranchId: bestBranch?.branchId ?? null,
    };
  }
}
