/**
 * PlannerService — Phase PLANNING
 *
 * Decomposes a goal into N parallel strategies (branches) via LLM.
 * Uses Claude CLI for LLM calls (no external API key needed).
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgenticDataService } from './agentic-data.service';
import { EvidenceLedgerService } from './evidence-ledger.service';
import { ClaudeCliService } from './claude-cli.service';
import { AGENTIC_DEFAULTS } from '../constants/agentic.constants';
import type { AgenticRun, AgenticBranch } from '../types/run-state.schema';
import { getErrorMessage } from '../../../common/utils/error.utils';

interface PlanStrategy {
  label: string;
  description: string;
  steps: string[];
  expected_outcome: string;
}

interface PlanResult {
  strategies: PlanStrategy[];
  reasoning: string;
}

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
    private readonly claudeCli: ClaudeCliService,
  ) {}

  /**
   * Generate branches (strategies) for a run via LLM.
   */
  async plan(
    run: AgenticRun,
    criticFeedback?: string,
    maxBranches?: number,
  ): Promise<AgenticBranch[]> {
    const startTime = performance.now();
    const branchCount = Math.min(
      maxBranches ?? AGENTIC_DEFAULTS.MAX_BRANCHES,
      AGENTIC_DEFAULTS.MAX_BRANCHES_CAP,
    );

    this.logger.log(
      `Planning run ${run.id} — requesting ${branchCount} strategies${criticFeedback ? ' (critic loop)' : ''}`,
    );

    // Fetch RAG context if available
    const ragContext = await this.fetchRagContext(run);

    let planResult: PlanResult;

    try {
      const systemPrompt = `Tu es un planificateur strategique pour un moteur agentique SEO automobile.
Decompose l'objectif en ${branchCount} strategies paralleles.
Reponds UNIQUEMENT en JSON valide avec cette structure:
{
  "strategies": [{ "label": "snake_case_name", "description": "...", "steps": ["..."], "expected_outcome": "..." }],
  "reasoning": "..."
}`;

      const userPrompt = [
        `Objectif: ${run.goal}`,
        `Type: ${run.goal_type}`,
        criticFeedback
          ? `Feedback critique precedent: ${criticFeedback}`
          : null,
        ragContext ? `Contexte RAG:\n${ragContext.substring(0, 3000)}` : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await this.claudeCli.execute(userPrompt, {
        systemPrompt,
        timeoutMs: 90_000,
      });

      planResult = this.parsePlanResponse(response.content);

      // Record LLM evidence
      await this.evidenceLedger.record({
        runId: run.id,
        evidenceType: 'llm_output',
        content: {
          action: 'plan_generated',
          raw_response: response.content.substring(0, 5000),
          strategies_count: planResult.strategies.length,
          provider: response.metadata.provider,
          tokens: response.metadata.tokens,
        },
        source: `planner:${response.metadata.provider}`,
        truthLevel: 'L3',
      });
    } catch (error) {
      this.logger.error(
        `LLM planning failed for run ${run.id}: ${getErrorMessage(error)}`,
      );

      // Fallback: create generic strategies
      planResult = this.fallbackPlan(run, branchCount);

      await this.evidenceLedger.record({
        runId: run.id,
        evidenceType: 'computation',
        content: {
          action: 'plan_fallback',
          error: getErrorMessage(error),
          strategies_count: planResult.strategies.length,
        },
        source: 'planner:fallback',
        truthLevel: 'L3',
      });
    }

    // Cap to maxBranches
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

    // Store plan metadata on the run
    const _planMeta = {
      strategies: strategies.map((s) => ({
        label: s.label,
        description: s.description,
        steps: s.steps,
        expected_outcome: s.expected_outcome,
      })),
      reasoning: planResult.reasoning,
      critic_feedback: criticFeedback ?? null,
      llm_generated: true,
    };

    const elapsed = (performance.now() - startTime).toFixed(1);
    this.logger.log(
      `Planned run ${run.id} — ${branches.length} branches created in ${elapsed}ms`,
    );

    return branches;
  }

  /**
   * Get the plan metadata (strategies) for passing to solver.
   */
  getStrategyForBranch(
    plan: Record<string, unknown>,
    strategyLabel: string,
  ): PlanStrategy | null {
    const strategies = (plan as { strategies?: PlanStrategy[] }).strategies;
    if (!strategies) return null;
    return strategies.find((s) => s.label === strategyLabel) ?? null;
  }

  // ── Private helpers ──

  private parsePlanResponse(raw: string): PlanResult {
    try {
      // Strip markdown code fences if present
      const cleaned = raw
        .replace(/^```json?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      if (!parsed.strategies || !Array.isArray(parsed.strategies)) {
        throw new Error('Missing strategies array');
      }

      // Validate each strategy
      const strategies: PlanStrategy[] = parsed.strategies.map(
        (s: Record<string, unknown>) => ({
          label: String(s.label || 'unnamed')
            .replace(/\s+/g, '_')
            .toLowerCase(),
          description: String(s.description || ''),
          steps: Array.isArray(s.steps) ? s.steps.map(String) : [],
          expected_outcome: String(s.expected_outcome || ''),
        }),
      );

      return {
        strategies,
        reasoning: String(parsed.reasoning || ''),
      };
    } catch {
      this.logger.warn('Failed to parse LLM plan response, using fallback');
      return {
        strategies: [
          {
            label: 'default_strategy',
            description: 'Default strategy from unparseable LLM response',
            steps: ['Execute based on available context'],
            expected_outcome: 'Best-effort result',
          },
        ],
        reasoning: 'Fallback due to parse error',
      };
    }
  }

  private fallbackPlan(run: AgenticRun, count: number): PlanResult {
    const strategies: PlanStrategy[] = [];
    const labels = [
      'comprehensive_analysis',
      'focused_optimization',
      'creative_alternative',
    ];

    for (let i = 0; i < count; i++) {
      strategies.push({
        label: labels[i] || `strategy_${i + 1}`,
        description: `Fallback strategy ${i + 1} for: ${run.goal.substring(0, 100)}`,
        steps: ['Analyze context', 'Generate solution', 'Validate output'],
        expected_outcome: `Solution via approach ${i + 1}`,
      });
    }

    return { strategies, reasoning: 'Fallback plan (LLM unavailable)' };
  }

  private async fetchRagContext(run: AgenticRun): Promise<string | null> {
    // For seo_content_refresh goals, try to extract gamme name and fetch RAG
    if (run.goal_type === 'seo_content_refresh') {
      try {
        const { readFileSync, existsSync } = await import('fs');
        const { join } = await import('path');

        // Extract gamme alias from goal if present
        const gammeMatch = run.goal.match(/gamme[:\s]+(\S+)/i);
        if (gammeMatch) {
          const ragPath = join(
            '/opt/automecanik/rag/knowledge/gammes',
            `${gammeMatch[1]}.md`,
          );
          if (existsSync(ragPath)) {
            return readFileSync(ragPath, 'utf-8').substring(0, 4000);
          }
        }
      } catch {
        // RAG fetch is best-effort
      }
    }
    return null;
  }
}
