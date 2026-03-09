/**
 * AgenticProcessor — BullMQ Processor for agentic-engine queue
 *
 * Phase 2: Real LLM-powered plan/solve/critique via services.
 * Verify/arbitrate/airlock/apply remain Phase 1 stubs.
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
} from '../../modules/agentic-engine/constants/agentic.constants';
import { AgenticDataService } from '../../modules/agentic-engine/services/agentic-data.service';
import { EvidenceLedgerService } from '../../modules/agentic-engine/services/evidence-ledger.service';
import { RunManagerService } from '../../modules/agentic-engine/services/run-manager.service';
import { PlannerService } from '../../modules/agentic-engine/services/planner.service';
import { SolverService } from '../../modules/agentic-engine/services/solver.service';
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
    private readonly planner: PlannerService,
    private readonly solver: SolverService,
    private readonly critic: CriticService,
  ) {}

  // ── PLAN ──────────────────────────────────────────────

  @Process({ name: 'agentic-plan', concurrency: 1 })
  async handlePlan(job: Job<AgenticPlanJobData>): Promise<void> {
    const { runId, correlationId, criticFeedback } = job.data;
    const startTime = performance.now();
    this.logger.log(
      `🧠 [PLAN] Run ${runId.slice(0, 8)} — Planning${criticFeedback ? ' (critic loop)' : ''}...`,
    );

    const run = await this.dataService.getRun(runId);
    if (!run) {
      this.logger.error(`❌ [PLAN] Run ${runId.slice(0, 8)} not found`);
      return;
    }

    // Use PlannerService for real LLM-based planning
    const branches = await this.planner.plan(run, criticFeedback);

    if (branches.length === 0) {
      await this.runManager.failRun(runId, 'Planning produced no branches');
      return;
    }

    // Transition to solving
    await this.runManager.transitionPhase(runId, 'solving', {
      branches_total: branches.length,
      branches_completed: 0,
      plan: {
        strategies: branches.map((b) => ({ label: b.strategy_label })),
        critic_feedback: criticFeedback ?? null,
        llm_generated: true,
      },
    });

    // Save checkpoint after planning
    await this.runManager.saveCheckpoint(runId);

    // Fan-out: enqueue solve jobs for each branch
    for (const branch of branches) {
      await (job.queue as Queue).add(
        'agentic-solve',
        { runId, branchId: branch.id, correlationId } as AgenticSolveJobData,
        {
          attempts: AGENTIC_DEFAULTS.RETRIES.solve.attempts + 1,
          backoff: {
            type: 'exponential',
            delay: AGENTIC_DEFAULTS.RETRIES.solve.delay,
          },
          removeOnComplete: 20,
          removeOnFail: 20,
        },
      );
    }

    const elapsed = (performance.now() - startTime).toFixed(1);
    this.logger.log(
      `✅ [PLAN] Run ${runId.slice(0, 8)} — ${branches.length} branches enqueued in ${elapsed}ms`,
    );
  }

  // ── SOLVE ─────────────────────────────────────────────

  @Process({ name: 'agentic-solve', concurrency: 2 })
  async handleSolve(job: Job<AgenticSolveJobData>): Promise<void> {
    const { runId, branchId } = job.data;
    const startTime = performance.now();
    this.logger.log(
      `🔧 [SOLVE] Run ${runId.slice(0, 8)} / Branch ${branchId.slice(0, 8)}...`,
    );

    const run = await this.dataService.getRun(runId);
    if (!run) {
      this.logger.error(`❌ [SOLVE] Run ${runId.slice(0, 8)} not found`);
      return;
    }

    const branches = await this.dataService.getBranchesByRun(runId);
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) {
      this.logger.error(`❌ [SOLVE] Branch ${branchId.slice(0, 8)} not found`);
      return;
    }

    // Use SolverService for real LLM + RAG solving
    const result = await this.solver.solve(run, branch);

    if (!result.success) {
      this.logger.warn(
        `⚠️ [SOLVE] Branch ${branchId.slice(0, 8)} failed: ${result.error}`,
      );
    }

    // Fan-in: atomically increment and check if all branches done
    const counts = await this.dataService.incrementBranchesCompleted(runId);
    if (counts != null) {
      if (
        counts.branches_completed >= counts.branches_total &&
        counts.branches_total > 0
      ) {
        this.logger.log(
          `✅ [SOLVE] Run ${runId.slice(0, 8)} — All ${counts.branches_total} branches complete, enqueueing critique`,
        );

        await this.runManager.transitionPhase(runId, 'critiquing');

        await (job.queue as Queue).add(
          'agentic-critique',
          { runId } as AgenticCritiqueJobData,
          {
            attempts: AGENTIC_DEFAULTS.RETRIES.critique.attempts + 1,
            backoff: {
              type: 'exponential',
              delay: AGENTIC_DEFAULTS.RETRIES.critique.delay,
            },
            removeOnComplete: 20,
            removeOnFail: 20,
          },
        );
      }
    }

    const elapsed = (performance.now() - startTime).toFixed(1);
    this.logger.log(
      `✅ [SOLVE] Branch ${branchId.slice(0, 8)} done in ${elapsed}ms`,
    );
  }

  // ── CRITIQUE ──────────────────────────────────────────

  @Process({ name: 'agentic-critique', concurrency: 1 })
  async handleCritique(job: Job<AgenticCritiqueJobData>): Promise<void> {
    const { runId } = job.data;
    const startTime = performance.now();
    this.logger.log(`🔍 [CRITIQUE] Run ${runId.slice(0, 8)}...`);

    const run = await this.dataService.getRun(runId);
    if (!run) {
      this.logger.error(`❌ [CRITIQUE] Run ${runId.slice(0, 8)} not found`);
      return;
    }

    const branches = await this.dataService.getBranchesByRun(runId);

    // Use CriticService for real LLM-based evaluation
    const result = await this.critic.critique(run, branches);

    // Critic loop: if re-plan needed and loops remaining
    if (result.needsReplan && this.runManager.canCriticLoop(run)) {
      const criticFeedback = this.critic.buildCriticFeedback(result);
      this.logger.log(
        `🔄 [CRITIQUE] Run ${runId.slice(0, 8)} — Critic loop ${(run.critic_loops ?? 0) + 1}: ${result.replanReason}`,
      );

      // Increment critic loop counter and transition back to planning
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

    const elapsed = (performance.now() - startTime).toFixed(1);
    this.logger.log(
      `✅ [CRITIQUE] Run ${runId.slice(0, 8)} — ${result.scores.length} branches scored in ${elapsed}ms`,
    );
  }

  // ── VERIFY (Phase 1 stub) ──────────────────────────────

  @Process({ name: 'agentic-verify', concurrency: 1 })
  async handleVerify(job: Job<AgenticVerifyJobData>): Promise<void> {
    const { runId } = job.data;
    const startTime = performance.now();
    this.logger.log(`🛡️ [VERIFY] Run ${runId.slice(0, 8)}...`);

    // Phase 1 STUB: All gates pass
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

    // Advance to arbitrating
    await this.runManager.transitionPhase(runId, 'arbitrating');
    await (job.queue as Queue).add(
      'agentic-arbitrate',
      { runId } satisfies AgenticArbitrateJobData,
      { attempts: 1, removeOnComplete: 20, removeOnFail: 20 },
    );

    const elapsed = (performance.now() - startTime).toFixed(1);
    this.logger.log(
      `✅ [VERIFY] Run ${runId.slice(0, 8)} — All gates passed in ${elapsed}ms`,
    );
  }

  // ── ARBITRATE ─────────────────────────────────────────

  @Process({ name: 'agentic-arbitrate', concurrency: 1 })
  async handleArbitrate(job: Job<AgenticArbitrateJobData>): Promise<void> {
    const { runId } = job.data;
    const startTime = performance.now();
    this.logger.log(`⚖️ [ARBITRATE] Run ${runId.slice(0, 8)}...`);

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
        `❌ [ARBITRATE] Run ${runId.slice(0, 8)} — No valid branches to select`,
      );
      await this.runManager.failRun(
        runId,
        'No valid branches after arbitration',
      );
    }

    const elapsed = (performance.now() - startTime).toFixed(1);
    this.logger.log(
      `✅ [ARBITRATE] Run ${runId.slice(0, 8)} — Winner: ${winner?.id?.slice(0, 8) || 'none'} (${winner?.strategy_label || '-'}) in ${elapsed}ms`,
    );
  }

  // ── AIRLOCK CHECK (stub — gated off by default) ─────────

  @Process({ name: 'agentic-airlock-check', concurrency: 1 })
  async handleAirlockCheck(
    job: Job<AgenticAirlockCheckJobData>,
  ): Promise<void> {
    const { runId } = job.data;
    this.logger.log(
      `🔒 [AIRLOCK] Run ${runId.slice(0, 8)} — Stub: airlock check bypassed`,
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

  // ── APPLY (dry-run in Phase 1-2) ─────────────────────────

  @Process({ name: 'agentic-apply', concurrency: 1 })
  async handleApply(job: Job<AgenticApplyJobData>): Promise<void> {
    const { runId } = job.data;
    const startTime = performance.now();
    this.logger.log(`🚀 [APPLY] Run ${runId.slice(0, 8)}...`);

    const run = await this.dataService.getRun(runId);

    // Phase 2: Still dry-run — mark completed without side effects
    // In Phase 3, this will check AGENTIC_APPLY_ENABLED and execute mutations

    // Accumulate total tokens from all steps
    const branches = await this.dataService.getBranchesByRun(runId);
    let totalTokens = 0;
    for (const branch of branches) {
      const steps = await this.dataService.getStepsByBranch(branch.id);
      for (const step of steps) {
        totalTokens += step.tokens_used ?? 0;
      }
    }

    await this.runManager.transitionPhase(runId, 'completed', {
      total_tokens_used: totalTokens,
    });

    await this.evidenceLedger.record({
      runId,
      evidenceType: 'computation',
      content: {
        phase: 'apply',
        dry_run: true,
        winning_branch_id: run?.winning_branch_id,
        total_tokens_used: totalTokens,
        branches_count: branches.length,
      },
      source: 'agentic-processor:apply',
      truthLevel: 'L1',
    });

    // Save final checkpoint
    await this.runManager.saveCheckpoint(runId);

    const elapsed = (performance.now() - startTime).toFixed(1);
    this.logger.log(
      `✅ [APPLY] Run ${runId.slice(0, 8)} — COMPLETED (dry-run) in ${elapsed}ms, ${totalTokens} tokens total`,
    );
  }
}
