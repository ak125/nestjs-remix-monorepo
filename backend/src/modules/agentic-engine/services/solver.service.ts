/**
 * SolverService — Phase SOLVING
 *
 * Executes a single branch: RAG fetch + LLM call + step recording.
 * Uses Claude CLI for LLM calls (no external API key needed).
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgenticDataService } from './agentic-data.service';
import { EvidenceLedgerService } from './evidence-ledger.service';
import { ClaudeCliService } from './claude-cli.service';
import type { AgenticBranch, AgenticRun } from '../types/run-state.schema';
import { getErrorMessage } from '../../../common/utils/error.utils';

interface SolveResult {
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
    private readonly claudeCli: ClaudeCliService,
  ) {}

  /**
   * Execute solving steps for a branch via LLM.
   */
  async solve(run: AgenticRun, branch: AgenticBranch): Promise<SolveResult> {
    const startTime = performance.now();
    this.logger.log(
      `Solving branch ${branch.id.slice(0, 8)} (${branch.strategy_label}) for run ${run.id.slice(0, 8)}`,
    );

    // Mark branch as running
    await this.dataService.updateBranchStatus(branch.id, 'running', {
      started_at: new Date().toISOString(),
    } as Partial<AgenticBranch>);

    // Get strategy details from run plan
    const strategy = this.getStrategy(run.plan, branch.strategy_label);

    // Step 1: RAG fetch
    const ragStep = await this.dataService.createStep({
      branch_id: branch.id,
      run_id: run.id,
      step_name: 'rag_fetch',
      step_type: 'rag_fetch',
      step_index: 0,
    });

    const ragContent = await this.fetchRagForBranch(run);

    if (ragStep) {
      await this.dataService.updateStep(ragStep.id, {
        status: 'completed',
        output: { has_rag: !!ragContent, length: ragContent?.length ?? 0 },
        duration_ms: Math.round(performance.now() - startTime),
      });

      if (ragContent) {
        await this.evidenceLedger.record({
          runId: run.id,
          branchId: branch.id,
          stepId: ragStep.id,
          evidenceType: 'rag_citation',
          content: {
            action: 'rag_fetched',
            content_length: ragContent.length,
            preview: ragContent.substring(0, 200),
          },
          source: 'solver:rag',
          truthLevel: 'L1',
        });
      }
    }

    // Step 2: LLM solve
    const llmStep = await this.dataService.createStep({
      branch_id: branch.id,
      run_id: run.id,
      step_name: 'llm_solve',
      step_type: 'llm_call',
      step_index: 1,
    });

    let solveOutput: Record<string, unknown>;
    let tokensUsed = 0;
    let provider = 'unknown';

    try {
      const llmStart = performance.now();

      const systemPrompt = `Tu es un solveur specialise pour un moteur agentique SEO automobile.
Execute la strategie demandee et produis un resultat structure.
Reponds UNIQUEMENT en JSON valide avec cette structure:
{
  "strategy_executed": "label",
  "result": { "content": "...", "confidence": 0-100, "sources_used": [], "limitations": [] },
  "steps_completed": ["..."]
}`;

      const userPrompt = [
        `Objectif: ${run.goal}`,
        `Strategie: ${branch.strategy_label}`,
        strategy?.description ? `Description: ${strategy.description}` : null,
        strategy?.steps?.length ? `Etapes: ${strategy.steps.join(', ')}` : null,
        ragContent ? `Contexte RAG:\n${ragContent.substring(0, 4000)}` : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await this.claudeCli.execute(userPrompt, {
        systemPrompt,
        timeoutMs: 180_000,
      });

      solveOutput = this.parseSolveResponse(response.content, branch);
      tokensUsed = response.metadata.tokens ?? 0;
      provider = response.metadata.provider ?? 'claude-cli';

      if (llmStep) {
        await this.dataService.updateStep(llmStep.id, {
          status: 'completed',
          output: solveOutput,
          provider_used: provider,
          tokens_used: tokensUsed,
          duration_ms: Math.round(performance.now() - llmStart),
        });
      }

      // Record LLM evidence
      await this.evidenceLedger.recordLlmOutput(
        run.id,
        branch.id,
        llmStep?.id ?? '',
        solveOutput,
        provider,
        tokensUsed,
      );
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      this.logger.error(
        `LLM solve failed for branch ${branch.id.slice(0, 8)}: ${errorMsg}`,
      );

      if (llmStep) {
        await this.dataService.updateStep(llmStep.id, {
          status: 'failed',
          error_message: errorMsg,
          duration_ms: Math.round(performance.now() - startTime),
        });
      }

      // Mark branch as failed
      await this.dataService.updateBranchStatus(branch.id, 'failed', {
        error_message: errorMsg,
        completed_at: new Date().toISOString(),
        duration_ms: Math.round(performance.now() - startTime),
      } as Partial<AgenticBranch>);

      return { success: false, error: errorMsg };
    }

    // Mark branch as completed
    const durationMs = Math.round(performance.now() - startTime);
    await this.dataService.updateBranchStatus(branch.id, 'completed', {
      output: solveOutput,
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
    } as Partial<AgenticBranch>);

    this.logger.log(
      `Solved branch ${branch.id.slice(0, 8)} in ${durationMs}ms (${tokensUsed} tokens, ${provider})`,
    );

    return { success: true, output: solveOutput, tokensUsed };
  }

  // ── Private helpers ──

  private parseSolveResponse(
    raw: string,
    branch: AgenticBranch,
  ): Record<string, unknown> {
    try {
      const cleaned = raw
        .replace(/^```json?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();
      return JSON.parse(cleaned);
    } catch {
      this.logger.warn(
        `Failed to parse solve response for branch ${branch.id.slice(0, 8)}, wrapping as text`,
      );
      return {
        strategy_executed: branch.strategy_label,
        result: {
          content: raw.substring(0, 5000),
          confidence: 50,
          sources_used: [],
          limitations: ['Response was not valid JSON'],
        },
        steps_completed: [],
        parse_error: true,
      };
    }
  }

  private getStrategy(
    plan: unknown,
    label: string,
  ): { description: string; steps: string[] } | null {
    if (!plan || typeof plan !== 'object') return null;
    const strategies = (plan as Record<string, unknown>).strategies;
    if (!Array.isArray(strategies)) return null;
    return (
      strategies.find((s: Record<string, unknown>) => s.label === label) ?? null
    );
  }

  private async fetchRagForBranch(run: AgenticRun): Promise<string | null> {
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
            return readFileSync(ragPath, 'utf-8').substring(0, 5000);
          }
        }
      } catch {
        // RAG is best-effort
      }
    }
    return null;
  }
}
