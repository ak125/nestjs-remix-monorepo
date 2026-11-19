/**
 * Mandat BT — passage quotidien de la lecture des mails Paybox.
 *
 * `ScheduleModule` est désactivé dans AppModule (`@Cron` inerte) : le passage
 * est un job répétable Bull, comme supplier-sync et diagnostic-projection.
 * 06:30 heure de Paris, après la télécollecte (≈ 04:55). Une seule tentative :
 * au plus un mail d'écarts par jour.
 *
 * Mode `off` (défaut, ou jeton absent) ou jeton aux portées trop larges : aucun
 * job armé, et celui qu'un démarrage précédent aurait laissé dans Redis est
 * retiré. Le processeur relit le mode à chaque passage.
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import type { Queue } from 'bull';
import {
  PayboxMailImportService,
  type ImportReport,
} from './paybox-mail-import.service';

export const PAYBOX_MAIL_QUEUE = 'paybox-mail-import';
export const PAYBOX_MAIL_JOB = 'daily';
export const PAYBOX_MAIL_CRON = '30 6 * * *';
export const PAYBOX_MAIL_TZ = 'Europe/Paris';
const REPEATABLE_JOB_ID = 'paybox-mail-import-daily';

@Injectable()
export class PayboxMailImportScheduler implements OnModuleInit {
  private readonly logger = new Logger(PayboxMailImportScheduler.name);

  constructor(
    @InjectQueue(PAYBOX_MAIL_QUEUE) private readonly queue: Queue,
    private readonly service: PayboxMailImportService,
  ) {}

  onModuleInit(): void {
    void this.configure();
  }

  async configure(): Promise<void> {
    try {
      await this.disarm();
      const mode = this.service.mode();
      if (mode === 'off') {
        this.logger.log(
          '⏸️ Lecture des mails Paybox : mode off, aucun passage armé',
        );
        return;
      }
      if (!(await this.service.checkToken())) {
        this.logger.error(
          '⛔ Lecture des mails Paybox : jeton refusé, aucun passage armé',
        );
        return;
      }
      await this.queue.add(
        PAYBOX_MAIL_JOB,
        {},
        {
          repeat: { cron: PAYBOX_MAIL_CRON, tz: PAYBOX_MAIL_TZ },
          jobId: REPEATABLE_JOB_ID,
          attempts: 1,
          removeOnComplete: 30,
          removeOnFail: 30,
        },
      );
      this.logger.log(
        `📅 Lecture des mails Paybox (${mode}) armée : ${PAYBOX_MAIL_CRON} ${PAYBOX_MAIL_TZ}`,
      );
    } catch (e) {
      this.logger.error(
        `Passage des mails Paybox non armé : ${(e as Error).message}`,
      );
    }
  }

  /** Retire tout répétable de ce job (mode changé, cron changé, retour à off). */
  async disarm(): Promise<number> {
    let removed = 0;
    for (const job of await this.queue.getRepeatableJobs()) {
      if (job.name === PAYBOX_MAIL_JOB) {
        await this.queue.removeRepeatableByKey(job.key);
        removed++;
      }
    }
    return removed;
  }
}

@Processor(PAYBOX_MAIL_QUEUE)
export class PayboxMailImportProcessor {
  private readonly logger = new Logger(PayboxMailImportProcessor.name);

  constructor(private readonly service: PayboxMailImportService) {}

  @Process(PAYBOX_MAIL_JOB)
  async handle(): Promise<ImportReport> {
    const report = await this.service.runScheduled();
    this.logger.log(
      `Passage des mails Paybox : ${report.status} (${report.mode}), ${report.applied ?? 0} écritures, ${report.discrepancies?.length ?? 0} écarts, mail ${report.mail ?? 'none'}`,
    );
    return report;
  }
}
