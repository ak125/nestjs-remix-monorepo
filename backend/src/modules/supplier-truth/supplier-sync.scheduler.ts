import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

/**
 * Schedules the recurring supplier sync (Task 12) via Bull.
 *
 * `onModuleInit` is SYNCHRONOUS and defers the repeatable-job wiring with `void`
 * (CLAUDE.md non-blocking rule: no remote I/O awaited in init, or the port never
 * binds on a cold CI runner). The actual work runs in the @Processor handler.
 *
 * Anti-ban cadence: every 4h by default; the working-set is bounded upstream.
 */

export const SUPPLIER_SYNC_QUEUE = 'supplier-sync';
export const SUPPLIER_SYNC_JOB = 'sync';
const REPEATABLE_CRON = '0 */4 * * *';
const REPEATABLE_JOB_ID = 'supplier-sync-repeatable';

@Injectable()
export class SupplierSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(SupplierSyncScheduler.name);

  constructor(
    @InjectQueue(SUPPLIER_SYNC_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  /**
   * Activation flag — INERT by default (owner-gated). The sentinel NEVER syncs
   * unless `SUPPLIER_TRUTH_SYNC_ENABLED` is explicitly `'true'`. Off → no
   * repeatable job is ever armed → the @Processor never receives work → no
   * connector login / portal hit / DB write.
   */
  isSyncEnabled(): boolean {
    return this.config.get<string>('SUPPLIER_TRUTH_SYNC_ENABLED') === 'true';
  }

  onModuleInit(): void {
    if (!this.isSyncEnabled()) {
      this.logger.log(
        '⏸️ supplier-sync INERT — SUPPLIER_TRUTH_SYNC_ENABLED!=true: scheduler present, NO repeatable job armed, no portal hit',
      );
      return;
    }
    this.logger.log(
      '🚀 init — deferring repeatable supplier-sync setup (non-blocking)',
    );
    void this.configureRepeatable();
  }

  /** Idempotent: a fixed jobId prevents duplicate repeatables across restarts. */
  async configureRepeatable(): Promise<void> {
    try {
      await this.queue.add(
        SUPPLIER_SYNC_JOB,
        {},
        {
          repeat: { cron: REPEATABLE_CRON },
          jobId: REPEATABLE_JOB_ID,
          removeOnComplete: 20,
          removeOnFail: 50,
        },
      );
      this.logger.log(`📅 supplier-sync scheduled (${REPEATABLE_CRON})`);
    } catch (e) {
      this.logger.error(
        `failed to schedule supplier-sync: ${(e as Error).message}`,
      );
    }
  }

  /** Manual one-off trigger (admin/ops). */
  async triggerNow(): Promise<void> {
    await this.queue.add(SUPPLIER_SYNC_JOB, {}, { removeOnComplete: true });
  }
}
