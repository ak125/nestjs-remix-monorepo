/**
 * CriticService — Phase CRITIQUING
 *
 * Evaluates branch outputs via LLM, scores them, and decides
 * whether a re-plan is needed (critic loop).
 * Uses Claude CLI for LLM calls (no external API key needed).
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgenticDataService } from './agentic-data.service';
import { EvidenceLedgerService } from './evidence-ledger.service';
import { ClaudeCliService } from './claude-cli.service';
import type { AgenticBranch, AgenticRun } from '../types/run-state.schema';
import { getErrorMessage } from '../../../common/utils/error.utils';

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
  tokensUsed: number;
}

interface LlmCritiqueEvaluation {
  branch_id: string;
  strategy_label: string;
  scores: {
    pertinence: number;
    qualite: number;
    completude: number;
    fiabilite_sources: number;
    actionabilite: number;
  };
  total_score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

interface LlmCritiqueResponse {
  evaluations: LlmCritiqueEvaluation[];
  recommendation: {
    needs_replan: boolean;
    replan_reason: string | null;
    best_branch_id: string;
  };
}

@Injectable()
export class CriticService {
  private readonly logger = new Logger(CriticService.name);

  /** Below this score, all branches trigger a re-plan */
  private static readonly REPLAN_THRESHOLD = 60;

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
    private readonly claudeCli: ClaudeCliService,
  ) {}

  /**
   * Evaluate branches and produce scores via LLM.
   */
  async critique(
    run: AgenticRun,
    branches: AgenticBranch[],
  ): Promise<CritiqueResult> {
    const startTime = performance.now();
    const completedBranches = branches.filter((b) => b.status === 'completed');

    this.logger.log(
      `Critiquing ${completedBranches.length} branches for run ${run.id.slice(0, 8)}`,
    );

    if (completedBranches.length === 0) {
      return {
        scores: [],
        needsReplan: false,
        replanReason: 'No completed branches',
        bestBranchId: null,
        tokensUsed: 0,
      };
    }

    let critiqueResult: LlmCritiqueResponse;
    let tokensUsed = 0;

    // Fetch RAG for cross-reference
    const ragContext = await this.fetchRagContext(run);

    try {
      const systemPrompt = `Tu es un critique expert pour un moteur agentique SEO automobile.
Evalue chaque branche sur 5 axes (0-20 chacun, total 0-100):
- pertinence (par rapport a l'objectif)
- qualite (redaction, structure)
- completude (couverture du sujet)
- fiabilite_sources (citations, preuves)
- actionabilite (utilisable en production)

Reponds UNIQUEMENT en JSON valide avec cette structure:
{
  "evaluations": [{
    "branch_id": "...",
    "strategy_label": "...",
    "scores": { "pertinence": 0, "qualite": 0, "completude": 0, "fiabilite_sources": 0, "actionabilite": 0 },
    "total_score": 0,
    "feedback": "...",
    "strengths": ["..."],
    "weaknesses": ["..."]
  }],
  "recommendation": {
    "needs_replan": false,
    "replan_reason": null,
    "best_branch_id": "..."
  }
}`;

      const branchSummaries = completedBranches.map((b) => ({
        id: b.id,
        strategy_label: b.strategy_label,
        output: b.output,
      }));

      const userPrompt = [
        `Objectif: ${run.goal}`,
        `Branches a evaluer:\n${JSON.stringify(branchSummaries, null, 2)}`,
        ragContext
          ? `Contexte RAG (reference):\n${ragContext.substring(0, 2000)}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await this.claudeCli.execute(userPrompt, {
        systemPrompt,
        timeoutMs: 90_000,
      });

      critiqueResult = this.parseCritiqueResponse(
        response.content,
        completedBranches,
      );
      tokensUsed = response.metadata.tokens ?? 0;

      // Record LLM evidence
      await this.evidenceLedger.record({
        runId: run.id,
        evidenceType: 'llm_output',
        content: {
          action: 'critique_completed',
          raw_response: response.content.substring(0, 5000),
          evaluations_count: critiqueResult.evaluations.length,
          provider: 'claude-cli',
          tokens: tokensUsed,
        },
        source: 'critic:claude-cli',
        truthLevel: 'L3',
      });
    } catch (error) {
      this.logger.error(
        `LLM critique failed for run ${run.id.slice(0, 8)}: ${getErrorMessage(error)}`,
      );

      // Fallback: equal scores
      critiqueResult = this.fallbackCritique(completedBranches);

      await this.evidenceLedger.record({
        runId: run.id,
        evidenceType: 'computation',
        content: {
          action: 'critique_fallback',
          error: getErrorMessage(error),
        },
        source: 'critic:fallback',
        truthLevel: 'L3',
      });
    }

    // Update branch scores in DB
    const scores: BranchScore[] = [];
    for (const evaluation of critiqueResult.evaluations) {
      const branch = completedBranches.find(
        (b) => b.id === evaluation.branch_id,
      );
      if (!branch) continue;

      const score = Math.max(0, Math.min(100, evaluation.total_score));

      await this.dataService.updateBranchStatus(branch.id, 'completed', {
        critic_score: score,
        critic_feedback: evaluation.feedback,
      } as Partial<AgenticBranch>);

      scores.push({
        branchId: branch.id,
        score,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths ?? [],
        weaknesses: evaluation.weaknesses ?? [],
      });
    }

    // Determine if re-plan is needed
    const allBelowThreshold = scores.every(
      (s) => s.score < CriticService.REPLAN_THRESHOLD,
    );
    const needsReplan =
      critiqueResult.recommendation.needs_replan || allBelowThreshold;

    const bestBranchId =
      critiqueResult.recommendation.best_branch_id ??
      scores.sort((a, b) => b.score - a.score)[0]?.branchId ??
      null;

    const elapsed = (performance.now() - startTime).toFixed(1);
    this.logger.log(
      `Critiqued run ${run.id.slice(0, 8)} — scores: [${scores.map((s) => s.score).join(', ')}], needsReplan: ${needsReplan}, best: ${bestBranchId?.slice(0, 8)} in ${elapsed}ms`,
    );

    return {
      scores,
      needsReplan,
      replanReason: needsReplan
        ? (critiqueResult.recommendation.replan_reason ??
          `All scores below ${CriticService.REPLAN_THRESHOLD}`)
        : null,
      bestBranchId,
      tokensUsed,
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

  // ── Private helpers ──

  private parseCritiqueResponse(
    raw: string,
    branches: AgenticBranch[],
  ): LlmCritiqueResponse {
    try {
      const cleaned = raw
        .replace(/^```json?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned) as LlmCritiqueResponse;

      if (!parsed.evaluations || !Array.isArray(parsed.evaluations)) {
        throw new Error('Missing evaluations array');
      }

      // Ensure branch IDs match actual branches
      for (const evaluation of parsed.evaluations) {
        const match = branches.find(
          (b) =>
            b.id === evaluation.branch_id ||
            b.strategy_label === evaluation.strategy_label,
        );
        if (match) {
          evaluation.branch_id = match.id;
        }
      }

      return parsed;
    } catch {
      this.logger.warn('Failed to parse LLM critique response, using fallback');
      return this.fallbackCritique(branches);
    }
  }

  private fallbackCritique(branches: AgenticBranch[]): LlmCritiqueResponse {
    const evaluations: LlmCritiqueEvaluation[] = branches.map((b, i) => ({
      branch_id: b.id,
      strategy_label: b.strategy_label,
      scores: {
        pertinence: 14,
        qualite: 14,
        completude: 14,
        fiabilite_sources: 14,
        actionabilite: 14,
      },
      total_score: 70 + i * 5,
      feedback: 'Fallback scoring — LLM critique unavailable',
      strengths: [],
      weaknesses: ['LLM critique failed, scores are estimates'],
    }));

    const bestIdx = evaluations.length - 1;

    return {
      evaluations,
      recommendation: {
        needs_replan: false,
        replan_reason: null,
        best_branch_id: evaluations[bestIdx]?.branch_id ?? '',
      },
    };
  }

  private async fetchRagContext(run: AgenticRun): Promise<string | null> {
    if (run.goal_type === 'seo_content_refresh') {
      try {
        const { readFileSync, existsSync } = await import('fs');
        const { join } = await import('path');

        const gammeMatch = run.goal.match(/gamme[:\s]+(\S+)/i);
        if (gammeMatch) {
          const ragPath = join(
            '/opt/automecanik/rag/knowledge/gammes',
            `${gammeMatch[1]}.md`,
          );
          if (existsSync(ragPath)) {
            return readFileSync(ragPath, 'utf-8').substring(0, 3000);
          }
        }
      } catch {
        // best-effort
      }
    }
    return null;
  }
}
