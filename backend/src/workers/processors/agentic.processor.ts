/**
 * AgenticProcessor — BullMQ Processor for agentic-engine queue
 *
 * Agent-Native: les handlers plan/solve/critique ne font plus d'appels LLM.
 * Le travail LLM est fait par les agents Claude Code qui ecrivent en DB via MCP.
 *
 * Ce processor gere :
 * - Les transitions d'etat (state machine)
 * - Le fan-out/fan-in des branches
 * - Les stubs verify/arbitrate/apply
 *
 * Pattern: same as ContentRefreshProcessor (multi-job named handlers).
 * Stateless — safe duplicate in WorkerModule.
 */
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import {
  AGENTIC_QUEUE_NAME,
  AGENTIC_DEFAULTS,
  type GoalType,
} from '../../modules/agentic-engine/constants/agentic.constants';
import { AgenticDataService } from '../../modules/agentic-engine/services/agentic-data.service';
import { EvidenceLedgerService } from '../../modules/agentic-engine/services/evidence-ledger.service';
import { RunManagerService } from '../../modules/agentic-engine/services/run-manager.service';
import { CriticService } from '../../modules/agentic-engine/services/critic.service';
import type {
  AgenticPlanJobData,
  AgenticSolveJobData,
  AgenticCritiqueJobData,
  AgenticVerifyJobData,
  AgenticArbitrateJobData,
  AgenticAirlockCheckJobData,
  AgenticApplyJobData,
} from '../../modules/agentic-engine/types/job.types';

@Processor(AGENTIC_QUEUE_NAME)
export class AgenticProcessor {
  private readonly logger = new Logger(AgenticProcessor.name);

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
    private readonly runManager: RunManagerService,
    private readonly critic: CriticService,
  ) {}

  // ── PLAN (Agent-Native: no-op, agent writes directly to DB) ──

  @Process({ name: 'agentic-plan', concurrency: 1 })
  async handlePlan(job: Job<AgenticPlanJobData>): Promise<void> {
    const { runId } = job.data;
    this.logger.log(
      `[PLAN] Run ${runId.slice(0, 8)} — Agent-Native mode. ` +
        `Use Claude Code Agent "agentic-planner" with run_id=${runId}`,
    );

    // No LLM call — the agentic-planner agent reads the run from DB,
    // decomposes the goal, and writes branches + evidence directly via MCP.
    // This job only logs the intent for observability.
  }

  // ── SOLVE (Agent-Native: no-op, agent writes directly to DB) ──

  @Process({ name: 'agentic-solve', concurrency: 1 })
  async handleSolve(job: Job<AgenticSolveJobData>): Promise<void> {
    const { runId, branchId } = job.data;
    this.logger.log(
      `[SOLVE] Run ${runId.slice(0, 8)} / Branch ${branchId.slice(0, 8)} — Agent-Native mode. ` +
        `Use Claude Code Agent "agentic-solver" with run_id=${runId} branch_id=${branchId}`,
    );

    // No LLM call — the agentic-solver agent reads the branch from DB,
    // fetches RAG, executes the strategy, and writes output directly via MCP.
  }

  // ── CRITIQUE (Agent-Native: reads scores written by agent, handles transitions) ──

  @Process({ name: 'agentic-critique', concurrency: 1 })
  async handleCritique(job: Job<AgenticCritiqueJobData>): Promise<void> {
    const { runId } = job.data;
    this.logger.log(
      `[CRITIQUE] Run ${runId.slice(0, 8)} — Reading scores from DB...`,
    );

    const run = await this.dataService.getRun(runId);
    if (!run) {
      this.logger.error(`[CRITIQUE] Run ${runId.slice(0, 8)} not found`);
      return;
    }

    // Read critique results written by agentic-critic agent
    const result = await this.critic.readCritiqueFromDb(runId);

    if (result.scores.length === 0) {
      this.logger.error(
        `[CRITIQUE] Run ${runId.slice(0, 8)} — No scored branches found in DB`,
      );
      await this.runManager.failRun(
        runId,
        'No branches could be scored by critic agent',
      );
      return;
    }

    // Critic loop: if re-plan needed and loops remaining
    if (result.needsReplan && this.runManager.canCriticLoop(run)) {
      const criticFeedback = this.critic.buildCriticFeedback(result);
      this.logger.log(
        `[CRITIQUE] Run ${runId.slice(0, 8)} — Critic loop ${(run.critic_loops ?? 0) + 1}: ${result.replanReason}`,
      );

      await this.runManager.transitionPhase(runId, 'planning', {
        critic_loops: (run.critic_loops ?? 0) + 1,
      });

      await (job.queue as Queue).add(
        'agentic-plan',
        { runId, criticFeedback } as AgenticPlanJobData,
        {
          attempts: AGENTIC_DEFAULTS.RETRIES.plan.attempts + 1,
          backoff: {
            type: 'exponential',
            delay: AGENTIC_DEFAULTS.RETRIES.plan.delay,
          },
          removeOnComplete: 20,
          removeOnFail: 20,
        },
      );
      return;
    }

    // Advance to verifying
    await this.runManager.transitionPhase(runId, 'verifying');
    await (job.queue as Queue).add(
      'agentic-verify',
      { runId } satisfies AgenticVerifyJobData,
      {
        attempts: AGENTIC_DEFAULTS.RETRIES.verify.attempts + 1,
        backoff: {
          type: 'exponential',
          delay: AGENTIC_DEFAULTS.RETRIES.verify.delay,
        },
        removeOnComplete: 20,
        removeOnFail: 20,
      },
    );

    this.logger.log(
      `[CRITIQUE] Run ${runId.slice(0, 8)} — ${result.scores.length} branches scored, best: ${result.bestBranchId?.slice(0, 8)}`,
    );
  }

  // ── VERIFY (Phase 1 stub) ──

  @Process({ name: 'agentic-verify', concurrency: 1 })
  async handleVerify(job: Job<AgenticVerifyJobData>): Promise<void> {
    const { runId } = job.data;
    this.logger.log(`[VERIFY] Run ${runId.slice(0, 8)}...`);

    await this.dataService.insertGateResult({
      run_id: runId,
      gate_name: 'schema_valid',
      gate_type: 'hard',
      verdict: 'PASS',
      reason: 'Stub: schema validation passed',
    });

    await this.dataService.insertGateResult({
      run_id: runId,
      gate_name: 'evidence_coverage',
      gate_type: 'soft',
      verdict: 'PASS',
      reason: 'Stub: evidence coverage adequate',
    });

    await this.evidenceLedger.record({
      runId,
      evidenceType: 'gate_check',
      content: { phase: 'verify', stub: true, all_gates_pass: true },
      source: 'agentic-processor:verify',
      truthLevel: 'L1',
    });

    await this.runManager.transitionPhase(runId, 'arbitrating');
    await (job.queue as Queue).add(
      'agentic-arbitrate',
      { runId } satisfies AgenticArbitrateJobData,
      { attempts: 1, removeOnComplete: 20, removeOnFail: 20 },
    );

    this.logger.log(`[VERIFY] Run ${runId.slice(0, 8)} — All gates passed`);
  }

  // ── ARBITRATE ──

  @Process({ name: 'agentic-arbitrate', concurrency: 1 })
  async handleArbitrate(job: Job<AgenticArbitrateJobData>): Promise<void> {
    const { runId } = job.data;
    this.logger.log(`[ARBITRATE] Run ${runId.slice(0, 8)}...`);

    const branches = await this.dataService.getBranchesByRun(runId);
    const winner = branches
      .filter((b) => b.status === 'completed' && b.critic_score != null)
      .sort((a, b) => (b.critic_score || 0) - (a.critic_score || 0))[0];

    if (winner) {
      await this.runManager.transitionPhase(runId, 'applying', {
        winning_branch_id: winner.id,
      });

      await this.evidenceLedger.record({
        runId,
        branchId: winner.id,
        evidenceType: 'computation',
        content: {
          phase: 'arbitrate',
          winning_branch_id: winner.id,
          winning_score: winner.critic_score,
          winning_strategy: winner.strategy_label,
        },
        source: 'agentic-processor:arbitrate',
        truthLevel: 'L1',
      });

      await (job.queue as Queue).add(
        'agentic-apply',
        { runId } satisfies AgenticApplyJobData,
        {
          attempts: AGENTIC_DEFAULTS.RETRIES.apply.attempts + 1,
          backoff: {
            type: 'exponential',
            delay: AGENTIC_DEFAULTS.RETRIES.apply.delay,
          },
          removeOnComplete: 20,
          removeOnFail: 20,
        },
      );
    } else {
      this.logger.error(
        `[ARBITRATE] Run ${runId.slice(0, 8)} — No valid branches to select`,
      );
      await this.runManager.failRun(
        runId,
        'No valid branches after arbitration',
      );
    }

    this.logger.log(
      `[ARBITRATE] Run ${runId.slice(0, 8)} — Winner: ${winner?.id?.slice(0, 8) || 'none'} (${winner?.strategy_label || '-'})`,
    );
  }

  // ── AIRLOCK CHECK (stub) ──

  @Process({ name: 'agentic-airlock-check', concurrency: 1 })
  async handleAirlockCheck(
    job: Job<AgenticAirlockCheckJobData>,
  ): Promise<void> {
    const { runId } = job.data;
    this.logger.log(
      `[AIRLOCK] Run ${runId.slice(0, 8)} — Stub: airlock check bypassed`,
    );

    await this.runManager.transitionPhase(runId, 'applying');
    await (job.queue as Queue).add(
      'agentic-apply',
      { runId } satisfies AgenticApplyJobData,
      {
        attempts: AGENTIC_DEFAULTS.RETRIES.apply.attempts + 1,
        backoff: {
          type: 'exponential',
          delay: AGENTIC_DEFAULTS.RETRIES.apply.delay,
        },
        removeOnComplete: 20,
        removeOnFail: 20,
      },
    );
  }

  // ── APPLY (gate humaine obligatoire) ──

  @Process({ name: 'agentic-apply', concurrency: 1 })
  async handleApply(job: Job<AgenticApplyJobData>): Promise<void> {
    const { runId } = job.data;
    this.logger.log(`[APPLY] Run ${runId.slice(0, 8)}...`);

    const run = await this.dataService.getRun(runId);
    if (!run) {
      this.logger.error(`[APPLY] Run ${runId.slice(0, 8)} not found`);
      return;
    }

    const branches = await this.dataService.getBranchesByRun(runId);
    const winner = branches.find((b) => b.id === run.winning_branch_id);

    if (!winner || !winner.output) {
      await this.runManager.failRun(runId, 'No winning branch output to apply');
      return;
    }

    // Accumulate total tokens
    let totalTokens = 0;
    for (const branch of branches) {
      const steps = await this.dataService.getStepsByBranch(branch.id);
      for (const step of steps) {
        totalTokens += step.tokens_used ?? 0;
      }
    }

    // Prepare apply payload (what would be written, where)
    const { GOAL_REGISTRY } =
      await import('../../modules/agentic-engine/constants/agentic.constants');
    const goalEntry =
      GOAL_REGISTRY[run.goal_type as keyof typeof GOAL_REGISTRY];
    const targetTables = goalEntry?.targetTables ?? [];

    const applyPayload = {
      winning_branch_id: winner.id,
      strategy_label: winner.strategy_label,
      goal_type: run.goal_type,
      target_tables: targetTables,
      output_preview: JSON.stringify(winner.output).substring(0, 2000),
      total_tokens_used: totalTokens,
    };

    // Insert gate: human_approval PENDING
    await this.dataService.insertGateResult({
      run_id: runId,
      gate_name: 'human_approval',
      gate_type: 'hard',
      verdict: 'PENDING',
      reason: `Awaiting human approval to write to: ${targetTables.join(', ') || 'none'}`,
    });

    // Record evidence with the full payload
    await this.evidenceLedger.record({
      runId,
      evidenceType: 'computation',
      content: {
        phase: 'apply',
        awaiting_human_approval: true,
        apply_payload: applyPayload,
      },
      source: 'agentic-processor:apply',
      truthLevel: 'L1',
    });

    // Update run with token count but keep in 'applying' phase (NOT completed)
    await this.dataService.updateRunExtra(runId, {
      total_tokens_used: totalTokens,
    });

    await this.runManager.saveCheckpoint(runId);

    this.logger.log(
      `[APPLY] Run ${runId.slice(0, 8)} — AWAITING HUMAN APPROVAL. ` +
        `Winner: ${winner.strategy_label} (${winner.critic_score}/100). ` +
        `Target tables: ${targetTables.join(', ') || 'none'}. ` +
        `Use POST /api/admin/agentic/runs/${runId}/approve to apply.`,
    );
  }

  // ── CHAIN EVALUATION ──────────────────────────────────

  private async evaluateChainRules(
    completedRun: { id: string; goal_type: string; goal: string },
    branches: Array<{ critic_score?: number | null; status?: string }>,
    queue: Queue,
  ): Promise<void> {
    const chainRules = await this.dataService.getChainRules(
      completedRun.goal_type,
    );

    if (chainRules.length === 0) return;

    // Best score from completed branches
    const bestScore = Math.max(
      0,
      ...branches
        .filter((b) => b.status === 'completed' && b.critic_score != null)
        .map((b) => b.critic_score ?? 0),
    );

    for (const rule of chainRules) {
      const minScore =
        (rule.condition as { min_score?: number })?.min_score ?? 60;

      if (bestScore < minScore) {
        this.logger.log(
          `[CHAIN] Skipping ${completedRun.goal_type} → ${rule.to_goal_type}: ` +
            `score ${bestScore} < min ${minScore}`,
        );
        continue;
      }

      this.logger.log(
        `[CHAIN] Triggering ${completedRun.goal_type} → ${rule.to_goal_type} ` +
          `(score ${bestScore} >= ${minScore})`,
      );

      // Create chained run via RunManager
      const chainResult = await this.runManager.createRun({
        goal: `Chained from ${completedRun.goal_type}: ${completedRun.goal}`,
        goal_type: rule.to_goal_type as GoalType,
        triggered_by: `chain:${completedRun.id.slice(0, 8)}`,
        correlation_id: completedRun.id,
      });

      if (chainResult.success && chainResult.run) {
        await this.runManager.transitionPhase(chainResult.run.id, 'planning');
        await queue.add(
          'agentic-plan',
          { runId: chainResult.run.id } as AgenticPlanJobData,
          {
            attempts: AGENTIC_DEFAULTS.RETRIES.plan.attempts + 1,
            backoff: {
              type: 'exponential',
              delay: AGENTIC_DEFAULTS.RETRIES.plan.delay,
            },
            removeOnComplete: 20,
            removeOnFail: 20,
          },
        );

        await this.evidenceLedger.record({
          runId: completedRun.id,
          evidenceType: 'computation',
          content: {
            action: 'chain_triggered',
            from_run_id: completedRun.id,
            to_run_id: chainResult.run.id,
            to_goal_type: rule.to_goal_type,
            best_score: bestScore,
            min_score: minScore,
            chain_rule_id: rule.id,
          },
          source: 'agentic-processor:chain',
          truthLevel: 'L1',
        });
      }
    }
  }
}
