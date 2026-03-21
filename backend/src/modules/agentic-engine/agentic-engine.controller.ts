/**
 * AgenticEngineController — Admin REST API
 *
 * Endpoints for managing agentic runs.
 * Protected by admin-level access (throttled).
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RunManagerService } from './services/run-manager.service';
import { AgenticDataService } from './services/agentic-data.service';
import { EvidenceLedgerService } from './services/evidence-ledger.service';
import {
  AGENTIC_QUEUE_NAME,
  type GoalType,
} from './constants/agentic.constants';

@Controller('api/admin/agentic')
export class AgenticEngineController {
  private readonly logger = new Logger(AgenticEngineController.name);

  constructor(
    @InjectQueue(AGENTIC_QUEUE_NAME) private readonly agenticQueue: Queue,
    private readonly runManager: RunManagerService,
    private readonly dataService: AgenticDataService,
    private readonly evidenceLedger: EvidenceLedgerService,
  ) {}

  /**
   * POST /api/admin/agentic/runs — Create and start a new run
   */
  @Post('runs')
  async createRun(
    @Body()
    body: {
      goal: string;
      goal_type: string;
      triggered_by: string;
      correlation_id?: string;
    },
  ) {
    const result = await this.runManager.createRun(body);
    if (!result.success) {
      throw new HttpException({ error: result.error }, HttpStatus.BAD_REQUEST);
    }

    // Transition to planning phase and dispatch the first job
    const transitioned = await this.runManager.transitionPhase(
      result.run!.id,
      'planning',
    );

    if (!transitioned) {
      throw new HttpException(
        { error: 'Failed to transition to planning phase' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await this.agenticQueue.add('agentic-plan', {
      runId: result.run!.id,
    });

    return { success: true, run: { ...result.run, phase: 'planning' } };
  }

  /**
   * GET /api/admin/agentic/runs — List runs
   */
  @Get('runs')
  async listRuns(
    @Query('limit') limit?: string,
    @Query('goal_type') goalType?: string,
  ) {
    const runs = await this.runManager.listRuns(
      limit ? parseInt(limit, 10) : 20,
      goalType,
    );
    return { success: true, runs, count: runs.length };
  }

  /**
   * GET /api/admin/agentic/runs/:id — Get run details
   */
  @Get('runs/:id')
  async getRun(@Param('id') id: string) {
    const run = await this.runManager.getRun(id);
    if (!run) {
      throw new HttpException({ error: 'Run not found' }, HttpStatus.NOT_FOUND);
    }

    const [branches, evidence, gates] = await Promise.all([
      this.dataService.getBranchesByRun(id),
      this.evidenceLedger.getTrail(id),
      this.dataService.getGateResultsByRun(id),
    ]);

    return { success: true, run, branches, evidence, gates };
  }

  /**
   * GET /api/admin/agentic/runs/:id/evidence — Get evidence trail
   */
  @Get('runs/:id/evidence')
  async getEvidence(@Param('id') id: string) {
    const evidence = await this.evidenceLedger.getTrail(id);
    return { success: true, evidence, count: evidence.length };
  }

  /**
   * POST /api/admin/agentic/runs/:id/resume — Resume a suspended run
   */
  @Post('runs/:id/resume')
  async resumeRun(@Param('id') id: string) {
    const run = await this.runManager.getRun(id);
    if (!run) {
      throw new HttpException({ error: 'Run not found' }, HttpStatus.NOT_FOUND);
    }

    if (run.phase !== 'suspended') {
      throw new HttpException(
        { error: `Cannot resume run in phase: ${run.phase}` },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Resume from the checkpoint — re-dispatch to planning
    await this.agenticQueue.add('agentic-plan', { runId: id });
    return { success: true, message: 'Run resumed' };
  }

  /**
   * GET /api/admin/agentic/stats — Dashboard stats
   */
  @Get('stats')
  async getStats() {
    const stats = await this.dataService.getStats();
    return { success: true, ...stats };
  }

  /**
   * GET /api/admin/agentic/queue/status — Queue health
   */
  @Get('queue/status')
  async getQueueStatus() {
    const [waiting, active, completed, failed, paused] = await Promise.all([
      this.agenticQueue.getWaitingCount(),
      this.agenticQueue.getActiveCount(),
      this.agenticQueue.getCompletedCount(),
      this.agenticQueue.getFailedCount(),
      this.agenticQueue.isPaused(),
    ]);

    return {
      success: true,
      queue: {
        name: AGENTIC_QUEUE_NAME,
        waiting,
        active,
        completed,
        failed,
        paused,
      },
    };
  }

  /**
   * POST /api/admin/agentic/runs/:id/approve — Approve apply (human gate)
   *
   * Marks the human_approval gate as PASS, transitions run to completed,
   * and evaluates chain rules for follow-up runs.
   */
  @Post('runs/:id/approve')
  async approveRun(@Param('id') id: string) {
    const run = await this.runManager.getRun(id);
    if (!run) {
      throw new HttpException({ error: 'Run not found' }, HttpStatus.NOT_FOUND);
    }

    if (run.phase !== 'applying') {
      throw new HttpException(
        {
          error: `Cannot approve run in phase: ${run.phase}. Must be 'applying'.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Update gate verdict
    await this.dataService.updateGateVerdict(
      id,
      'human_approval',
      'PASS',
      'Approved by human via API',
    );

    // Record evidence
    await this.evidenceLedger.record({
      runId: id,
      evidenceType: 'human_input',
      content: {
        action: 'human_approved',
        winning_branch_id: run.winning_branch_id,
        approved_at: new Date().toISOString(),
      },
      source: 'controller:approve',
      truthLevel: 'L1',
    });

    // Transition to completed
    await this.runManager.transitionPhase(id, 'completed', {
      total_tokens_used: run.total_tokens_used ?? 0,
    });

    // Evaluate chain rules for follow-up runs
    if (run.goal_type && run.goal) {
      const branches = await this.dataService.getBranchesByRun(id);
      const chainRules = await this.dataService.getChainRules(run.goal_type);

      if (chainRules.length > 0) {
        const bestScore = Math.max(
          0,
          ...branches
            .filter((b) => b.status === 'completed' && b.critic_score != null)
            .map((b) => b.critic_score ?? 0),
        );

        for (const rule of chainRules) {
          const minScore =
            (rule.condition as { min_score?: number })?.min_score ?? 60;
          if (bestScore < minScore) continue;

          const chainResult = await this.runManager.createRun({
            goal: `Chained from ${run.goal_type}: ${run.goal}`,
            goal_type: rule.to_goal_type as GoalType,
            triggered_by: `chain:${id.slice(0, 8)}`,
            correlation_id: id,
          });

          if (chainResult.success && chainResult.run) {
            await this.runManager.transitionPhase(
              chainResult.run.id,
              'planning',
            );
            await this.agenticQueue.add('agentic-plan', {
              runId: chainResult.run.id,
            });

            this.logger.log(
              `[CHAIN] ${run.goal_type} → ${rule.to_goal_type} (score ${bestScore} >= ${minScore})`,
            );
          }
        }
      }
    }

    this.logger.log(`Run ${id.slice(0, 8)} APPROVED and completed`);
    return {
      success: true,
      message: 'Run approved and completed',
      run_id: id,
      winning_branch_id: run.winning_branch_id,
    };
  }

  /**
   * POST /api/admin/agentic/runs/:id/reject — Reject apply (human gate)
   *
   * Marks the human_approval gate as FAIL, transitions run to failed.
   */
  @Post('runs/:id/reject')
  async rejectRun(@Param('id') id: string, @Body() body: { reason?: string }) {
    const run = await this.runManager.getRun(id);
    if (!run) {
      throw new HttpException({ error: 'Run not found' }, HttpStatus.NOT_FOUND);
    }

    if (run.phase !== 'applying') {
      throw new HttpException(
        {
          error: `Cannot reject run in phase: ${run.phase}. Must be 'applying'.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const reason = body.reason || 'Rejected by human via API';

    // Update gate verdict
    await this.dataService.updateGateVerdict(
      id,
      'human_approval',
      'FAIL',
      reason,
    );

    // Record evidence
    await this.evidenceLedger.record({
      runId: id,
      evidenceType: 'human_input',
      content: {
        action: 'human_rejected',
        reason,
        rejected_at: new Date().toISOString(),
      },
      source: 'controller:reject',
      truthLevel: 'L1',
    });

    // Transition to failed
    await this.runManager.failRun(id, `Human rejected: ${reason}`);

    this.logger.log(`Run ${id.slice(0, 8)} REJECTED: ${reason}`);
    return { success: true, message: 'Run rejected', run_id: id, reason };
  }

  /**
   * POST /api/admin/agentic/queue/resume — Resume paused queue
   */
  @Post('queue/resume')
  async resumeQueue() {
    await this.agenticQueue.resume();
    this.logger.log('Agentic queue resumed manually');
    return { success: true, message: 'Queue resumed' };
  }
}
