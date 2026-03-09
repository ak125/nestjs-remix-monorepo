/**
 * AgenticProcessor — BullMQ processor for agentic-engine queue
 *
 * Handles 6 job types, one per phase.
 * Max dependencies: 4 core services (anti God Processor pattern).
 * Auto-pause queue if 3 consecutive runs FAILED.
 */
import { Process, Processor, InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { RunManagerService } from './services/run-manager.service';
import { PlannerService } from './services/planner.service';
import { SolverService } from './services/solver.service';
import { CriticService } from './services/critic.service';
import { VerifierService } from './services/verifier.service';
import { ArbiterService } from './services/arbiter.service';
import { AgenticDataService } from './services/agentic-data.service';
import {
  AGENTIC_QUEUE_NAME,
  AGENTIC_DEFAULTS,
} from './constants/agentic.constants';
import { AgenticJobDataSchema } from './types/run-state.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AGENTIC_EVENTS } from './events/agentic.events';

@Processor(AGENTIC_QUEUE_NAME)
export class AgenticProcessor {
  private readonly logger = new Logger(AgenticProcessor.name);

  constructor(
    @InjectQueue(AGENTIC_QUEUE_NAME) private readonly agenticQueue: Queue,
    private readonly runManager: RunManagerService,
    private readonly planner: PlannerService,
    private readonly solver: SolverService,
    private readonly critic: CriticService,
    private readonly verifier: VerifierService,
    private readonly arbiter: ArbiterService,
    private readonly dataService: AgenticDataService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log('AgenticProcessor initialized');
  }

  // ── PLANNING ──

  @Process('agentic-plan')
  async handlePlan(job: Job): Promise<void> {
    const parsed = AgenticJobDataSchema.safeParse(job.data);
    if (!parsed.success) {
      this.logger.error('Invalid job data for agentic-plan', parsed.error);
      return;
    }

    const { runId, criticFeedback } = parsed.data;
    this.logger.log(`[PLAN] Run ${runId}`);

    try {
      const run = await this.runManager.getRun(runId);
      if (!run) throw new Error(`Run not found: ${runId}`);

      // Transition to planning
      await this.runManager.transitionPhase(runId, 'planning');

      // Execute planning
      const branches = await this.planner.plan(run, criticFeedback);
      if (branches.length === 0) {
        await this.runManager.failRun(runId, 'Planning produced no branches');
        return;
      }

      // Update run with branch count
      await this.dataService.updateRunPhase(runId, 'planning', 'planning', {
        branches_total: branches.length,
      });

      // Dispatch solve jobs for each branch
      await this.runManager.transitionPhase(runId, 'solving');
      for (const branch of branches) {
        await this.agenticQueue.add('agentic-solve', {
          runId,
          branchId: branch.id,
        });
      }
    } catch (error) {
      await this.runManager.failRun(
        runId,
        error instanceof Error ? error.message : 'Unknown planning error',
      );
    }
  }

  // ── SOLVING ──

  @Process('agentic-solve')
  async handleSolve(job: Job): Promise<void> {
    const parsed = AgenticJobDataSchema.safeParse(job.data);
    if (!parsed.success) return;

    const { runId, branchId } = parsed.data;
    if (!branchId) return;

    this.logger.log(`[SOLVE] Run ${runId}, Branch ${branchId}`);

    try {
      const branches = await this.dataService.getBranchesByRun(runId);
      const branch = branches.find((b) => b.id === branchId);
      if (!branch) throw new Error(`Branch not found: ${branchId}`);

      // Execute solving
      const result = await this.solver.solve(runId, branch);
      if (!result.success) {
        await this.dataService.updateBranchStatus(branchId, 'failed');
      }

      // Fan-in: increment completed count, check if all done
      const completed = await this.dataService.incrementBranchesCompleted(runId);
      const run = await this.runManager.getRun(runId);
      if (run && completed !== null && completed >= (run.branches_total ?? 0)) {
        // All branches done — dispatch critique
        await this.agenticQueue.add('agentic-critique', { runId });
      }
    } catch (error) {
      await this.dataService.updateBranchStatus(branchId, 'failed', {
        error_message: error instanceof Error ? error.message : 'Unknown solve error',
      });
    }
  }

  // ── CRITIQUING ──

  @Process('agentic-critique')
  async handleCritique(job: Job): Promise<void> {
    const parsed = AgenticJobDataSchema.safeParse(job.data);
    if (!parsed.success) return;

    const { runId } = parsed.data;
    this.logger.log(`[CRITIQUE] Run ${runId}`);

    try {
      await this.runManager.transitionPhase(runId, 'critiquing');

      const branches = await this.dataService.getBranchesByRun(runId);
      const result = await this.critic.critique(runId, branches);

      const run = await this.runManager.getRun(runId);
      if (!run) throw new Error(`Run not found: ${runId}`);

      // Check if critic wants re-planning
      if (result.needsReplan && this.runManager.canCriticLoop(run)) {
        // Increment critic_loops and go back to planning
        await this.dataService.updateRunPhase(runId, 'critiquing', 'critiquing', {
          critic_loops: (run.critic_loops ?? 0) + 1,
        });
        const feedback = result.scores
          .map((s) => s.feedback)
          .join('; ');
        await this.runManager.transitionPhase(runId, 'planning');
        await this.agenticQueue.add('agentic-plan', {
          runId,
          criticFeedback: feedback,
        });
        return;
      }

      // Proceed to verification
      await this.agenticQueue.add('agentic-verify', { runId });
    } catch (error) {
      await this.runManager.failRun(
        runId,
        error instanceof Error ? error.message : 'Unknown critique error',
      );
    }
  }

  // ── VERIFYING ──

  @Process('agentic-verify')
  async handleVerify(job: Job): Promise<void> {
    const parsed = AgenticJobDataSchema.safeParse(job.data);
    if (!parsed.success) return;

    const { runId } = parsed.data;
    this.logger.log(`[VERIFY] Run ${runId}`);

    try {
      await this.runManager.transitionPhase(runId, 'verifying');

      const safeToApply = await this.verifier.verify(runId);

      if (safeToApply.decision === 'block') {
        await this.runManager.failRun(
          runId,
          `Gate blocked: ${safeToApply.reason}`,
        );
        return;
      }

      if (safeToApply.decision === 'defer_to_human') {
        await this.runManager.transitionPhase(runId, 'suspended');
        return;
      }

      // Proceed to arbitration
      await this.agenticQueue.add('agentic-arbitrate', { runId });
    } catch (error) {
      await this.runManager.failRun(
        runId,
        error instanceof Error ? error.message : 'Unknown verify error',
      );
    }
  }

  // ── ARBITRATING ──

  @Process('agentic-arbitrate')
  async handleArbitrate(job: Job): Promise<void> {
    const parsed = AgenticJobDataSchema.safeParse(job.data);
    if (!parsed.success) return;

    const { runId } = parsed.data;
    this.logger.log(`[ARBITRATE] Run ${runId}`);

    try {
      await this.runManager.transitionPhase(runId, 'arbitrating');

      const result = await this.arbiter.arbitrate(runId);

      if (!result.winningBranchId) {
        await this.runManager.failRun(runId, 'No winning branch selected');
        return;
      }

      // Airlock check (stub — gated off by default)
      const airlockResult = await this.runManager.handleAirlockCheck(runId);
      if (airlockResult === 'block') {
        await this.runManager.failRun(runId, 'Airlock rejected');
        return;
      }

      // Dispatch apply
      await this.agenticQueue.add('agentic-apply', {
        runId,
        branchId: result.winningBranchId,
      });
    } catch (error) {
      await this.runManager.failRun(
        runId,
        error instanceof Error ? error.message : 'Unknown arbitrate error',
      );
    }
  }

  // ── APPLYING ──

  @Process('agentic-apply')
  async handleApply(job: Job): Promise<void> {
    const parsed = AgenticJobDataSchema.safeParse(job.data);
    if (!parsed.success) return;

    const { runId, branchId } = parsed.data;
    this.logger.log(`[APPLY] Run ${runId}, Branch ${branchId}`);

    try {
      await this.runManager.transitionPhase(runId, 'applying');

      // Save checkpoint before applying
      await this.runManager.saveCheckpoint(runId);

      // Stub: mark as completed (Phase 3 will implement real mutations)
      await this.runManager.transitionPhase(runId, 'completed', {
        winning_branch_id: branchId,
      });

      this.logger.log(`Run ${runId} completed successfully`);

      // Check consecutive failures for auto-pause
      await this.checkConsecutiveFailures();
    } catch (error) {
      await this.runManager.failRun(
        runId,
        error instanceof Error ? error.message : 'Unknown apply error',
      );
      await this.checkConsecutiveFailures();
    }
  }

  // ── Auto-pause queue if N consecutive FAILED ──

  private async checkConsecutiveFailures(): Promise<void> {
    const recent = await this.dataService.getRecentRunPhases(
      AGENTIC_DEFAULTS.AUTO_PAUSE_THRESHOLD,
    );

    if (
      recent.length >= AGENTIC_DEFAULTS.AUTO_PAUSE_THRESHOLD &&
      recent.every((r) => r.phase === 'failed')
    ) {
      this.logger.error(
        `${AGENTIC_DEFAULTS.AUTO_PAUSE_THRESHOLD} consecutive runs FAILED — pausing queue`,
      );
      await this.agenticQueue.pause();
      this.eventEmitter.emit(AGENTIC_EVENTS.QUEUE_PAUSED, {
        reason: 'Consecutive failures threshold reached',
        consecutiveFailures: AGENTIC_DEFAULTS.AUTO_PAUSE_THRESHOLD,
      });
    }
  }
}
