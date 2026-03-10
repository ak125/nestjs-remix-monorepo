/**
 * RunManagerService — State machine, transitions, checkpoints, budget guard
 *
 * Orchestrates the lifecycle of agentic runs.
 * Max 4 dependencies (anti God Processor pattern).
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgenticDataService } from './agentic-data.service';
import { EvidenceLedgerService } from './evidence-ledger.service';
import { AGENTIC_EVENTS } from '../events/agentic.events';
import {
  PHASE_TRANSITIONS,
  AGENTIC_DEFAULTS,
  type RunPhase,
} from '../constants/agentic.constants';
import {
  CreateRunInputSchema,
  type CreateRunInput,
  type AgenticRun,
  type AgenticCheckpoint,
} from '../types/run-state.schema';
import { FeatureFlagsService } from '../../../config/feature-flags.service';

@Injectable()
export class RunManagerService {
  private readonly logger = new Logger(RunManagerService.name);

  constructor(
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  // ── Create Run ──

  async createRun(rawInput: unknown): Promise<{
    success: boolean;
    run?: AgenticRun;
    error?: string;
  }> {
    // Validate input
    const parsed = CreateRunInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: `Validation: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      };
    }

    const input: CreateRunInput = parsed.data;

    // Check feature flag
    if (!this.featureFlags.agenticEngineEnabled) {
      return { success: false, error: 'Agentic engine is disabled' };
    }

    // Budget guard: check daily token usage for this goal_type
    const budgetOk = await this.checkDailyBudget(input.goal_type);
    if (!budgetOk) {
      return {
        success: false,
        error: `Daily token budget exceeded for goal_type: ${input.goal_type}`,
      };
    }

    // Create the run
    const run = await this.dataService.createRun(input);
    if (!run) {
      return { success: false, error: 'Failed to create run in database' };
    }

    // Record evidence
    await this.evidenceLedger.record({
      runId: run.id,
      evidenceType: 'computation',
      content: { action: 'run_created', input },
      source: 'run-manager',
      truthLevel: 'L1',
    });

    // Emit event
    this.eventEmitter.emit(AGENTIC_EVENTS.RUN_CREATED, {
      runId: run.id,
      goalType: run.goal_type,
      triggeredBy: run.triggered_by,
    });

    this.logger.log(`Run created: ${run.id} (${run.goal_type})`);
    return { success: true, run };
  }

  // ── Phase Transition ──

  async transitionPhase(
    runId: string,
    toPhase: RunPhase,
    extra?: Partial<AgenticRun>,
  ): Promise<boolean> {
    const run = await this.dataService.getRun(runId);
    if (!run) {
      this.logger.warn(`Run not found: ${runId}`);
      return false;
    }

    const currentPhase = run.phase as RunPhase;
    const allowedTransitions = PHASE_TRANSITIONS[currentPhase];

    if (!allowedTransitions?.includes(toPhase)) {
      this.logger.warn(
        `Invalid transition: ${currentPhase} → ${toPhase} for run ${runId}`,
      );
      return false;
    }

    // Compute duration_ms for terminal phases
    const transitionExtra = { ...extra };
    if (toPhase === 'completed' || toPhase === 'failed') {
      const startedAt = run.created_at
        ? new Date(run.created_at).getTime()
        : Date.now();
      transitionExtra.duration_ms = Date.now() - startedAt;
    }

    const success = await this.dataService.updateRunPhase(
      runId,
      currentPhase,
      toPhase,
      transitionExtra,
    );

    if (success) {
      this.eventEmitter.emit(AGENTIC_EVENTS.RUN_PHASE_CHANGED, {
        runId,
        fromPhase: currentPhase,
        toPhase,
        timestamp: new Date().toISOString(),
      });

      // Terminal state events
      if (toPhase === 'completed') {
        this.eventEmitter.emit(AGENTIC_EVENTS.RUN_COMPLETED, {
          runId,
          winningBranchId: transitionExtra.winning_branch_id ?? null,
          durationMs: transitionExtra.duration_ms ?? 0,
          totalTokensUsed: run.total_tokens_used ?? 0,
        });
      } else if (toPhase === 'failed') {
        this.eventEmitter.emit(AGENTIC_EVENTS.RUN_FAILED, {
          runId,
          phase: currentPhase,
          errorMessage: transitionExtra.error_message ?? 'Unknown error',
        });
      } else if (toPhase === 'suspended') {
        this.eventEmitter.emit(AGENTIC_EVENTS.RUN_SUSPENDED, {
          runId,
          phase: currentPhase,
        });
      }

      this.logger.log(
        `Phase transition: ${runId} ${currentPhase} → ${toPhase}`,
      );
    }

    return success;
  }

  // ── Fail Run ──

  async failRun(runId: string, errorMessage: string): Promise<boolean> {
    const run = await this.dataService.getRun(runId);
    if (!run) return false;

    await this.evidenceLedger.record({
      runId,
      evidenceType: 'computation',
      content: { action: 'run_failed', error: errorMessage, phase: run.phase },
      source: 'run-manager',
      truthLevel: 'L1',
    });

    return this.transitionPhase(runId, 'failed', {
      error_message: errorMessage,
    });
  }

  // ── Checkpoint ──

  async saveCheckpoint(runId: string): Promise<AgenticCheckpoint | null> {
    const run = await this.dataService.getRun(runId);
    if (!run) return null;

    const branches = await this.dataService.getBranchesByRun(runId);
    const evidence = await this.dataService.getEvidenceByRun(runId);
    const gates = await this.dataService.getGateResultsByRun(runId);

    return this.dataService.saveCheckpoint({
      run_id: runId,
      phase: run.phase,
      snapshot: {
        run,
        branches,
        evidence_count: evidence.length,
        gate_results: gates,
      },
    });
  }

  // ── Budget Guard ──

  async checkDailyBudget(goalType: string): Promise<boolean> {
    const totalUsed = await this.dataService.getDailyTokenUsage(goalType);
    const limit = this.featureFlags.agenticDailyTokenBudget;

    if (totalUsed >= limit) {
      this.logger.warn(
        `Budget exceeded for ${goalType}: ${totalUsed}/${limit} tokens`,
      );
      this.eventEmitter.emit(AGENTIC_EVENTS.BUDGET_WARNING, {
        goalType,
        totalUsed,
        limit,
        percentUsed: Math.round((totalUsed / limit) * 100),
      });
      return false;
    }

    // Warn at 80%
    if (totalUsed >= limit * 0.8) {
      this.eventEmitter.emit(AGENTIC_EVENTS.BUDGET_WARNING, {
        goalType,
        totalUsed,
        limit,
        percentUsed: Math.round((totalUsed / limit) * 100),
      });
    }

    return true;
  }

  // ── Critic Loop Check ──

  canCriticLoop(run: AgenticRun): boolean {
    const maxLoops = Math.min(
      this.featureFlags.agenticMaxCriticLoops,
      AGENTIC_DEFAULTS.MAX_CRITIC_LOOPS_CAP,
    );
    return (run.critic_loops ?? 0) < maxLoops;
  }

  // ── Airlock Check (stub — gated off by default) ──

  async handleAirlockCheck(runId: string): Promise<'apply' | 'block'> {
    if (!this.featureFlags.agenticAirlockEnabled) {
      return 'apply'; // Bypass — phase disabled
    }
    // Future: produce signed bundle, validate via airlock.sh
    this.logger.log(`Airlock check for run ${runId} — stub mode`);
    return 'apply';
  }

  // ── Get Run ──

  async getRun(runId: string): Promise<AgenticRun | null> {
    return this.dataService.getRun(runId);
  }

  // ── List Runs ──

  async listRuns(limit?: number, goalType?: string): Promise<AgenticRun[]> {
    return this.dataService.listRuns(limit, goalType);
  }
}
