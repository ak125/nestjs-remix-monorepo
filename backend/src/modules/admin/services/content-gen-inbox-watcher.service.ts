/**
 * ContentGenInboxWatcherService — Automated CSV inbox watcher for Google Ads KP.
 *
 * Runs every 5 min (via @nestjs/schedule Cron). Scans `data/keywords/inbox/` for
 * new CSV files dropped by the user (exported from Chrome Google Ads KP).
 *
 * For each new CSV:
 *  1. Extract gamme slug from filename (e.g., "plaquette-de-frein_2026-04-13.csv" → "plaquette-de-frein")
 *  2. Call `scripts/seo/import-gads-kp.py` to import + filter KW into __seo_keywords
 *  3. Enqueue 4 BullMQ jobs (R1/R3/R4/R6) in content-gen queue
 *  4. Move CSV from inbox/ → processed/ (or failed/ on error)
 *
 * Workflow:
 *   User: export CSV from Chrome → scp to data/keywords/inbox/
 *   Cron (5 min): auto-detect + import + enqueue jobs
 *   BullMQ workers: generate drafts with rate limit (10 req/min)
 *   Human: review sg_content_draft → promote to sg_content manually
 *
 * Disabled by default (env CONTENT_GEN_INBOX_WATCHER=true to enable).
 */
import {
  Injectable,
  Logger,
  Optional,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { ContentGenJobData } from '../../../workers/processors/content-gen.processor';
import type { ContentRole } from './content-generator.service';

const execFileAsync = promisify(execFile);

const INBOX_DIR = '/opt/automecanik/app/data/keywords/inbox';
const PROCESSED_DIR = '/opt/automecanik/app/data/keywords/processed';
const FAILED_DIR = '/opt/automecanik/app/data/keywords/failed';
const IMPORT_SCRIPT = '/opt/automecanik/app/scripts/seo/import-gads-kp.py';

const ALL_ROLES: ContentRole[] = [
  'R1_ROUTER',
  'R3_CONSEILS',
  'R4_REFERENCE',
  'R6_GUIDE_ACHAT',
];

@Injectable()
export class ContentGenInboxWatcherService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ContentGenInboxWatcherService.name);
  private readonly enabled: boolean;
  private intervalHandle: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @InjectQueue('content-gen')
    private readonly contentGenQueue?: Queue<ContentGenJobData>,
  ) {
    this.enabled =
      this.configService.get<string>('CONTENT_GEN_INBOX_WATCHER') === 'true';
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log(
        'Inbox watcher disabled (set CONTENT_GEN_INBOX_WATCHER=true to enable)',
      );
      return;
    }

    // Ensure directories exist
    for (const dir of [INBOX_DIR, PROCESSED_DIR, FAILED_DIR]) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (err) {
        this.logger.warn(`Cannot create dir ${dir}: ${err}`);
      }
    }

    this.logger.log(
      `Inbox watcher ACTIVE — scanning ${INBOX_DIR} every ${this.INTERVAL_MS / 1000}s for new CSVs`,
    );

    // Start interval (setInterval instead of @Cron — ScheduleModule disabled due to version conflict)
    this.intervalHandle = setInterval(() => {
      this.watchInbox().catch((err) =>
        this.logger.error(`watchInbox error: ${err}`),
      );
    }, this.INTERVAL_MS);

    // Run once on boot (after 30s to let everything warm up)
    setTimeout(() => {
      this.watchInbox().catch((err) =>
        this.logger.error(`initial watchInbox error: ${err}`),
      );
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Main scan entry — scans inbox and processes any new CSV.
   */
  async watchInbox(): Promise<void> {
    if (!this.enabled) return;
    if (!this.contentGenQueue) {
      this.logger.warn('content-gen queue not available, skipping inbox scan');
      return;
    }

    if (!existsSync(INBOX_DIR)) {
      return;
    }

    let files: string[];
    try {
      files = await fs.readdir(INBOX_DIR);
    } catch (err) {
      this.logger.error(`readdir failed: ${err}`);
      return;
    }

    const csvFiles = files.filter(
      (f) => f.toLowerCase().endsWith('.csv') && !f.startsWith('.'),
    );
    if (csvFiles.length === 0) return;

    this.logger.log(`Inbox scan: found ${csvFiles.length} CSV(s) to process`);

    for (const csvFile of csvFiles) {
      await this.processCsv(csvFile);
    }
  }

  /**
   * Process a single CSV: import KW → enqueue content gen jobs → move file.
   */
  private async processCsv(csvFile: string): Promise<void> {
    const fullPath = join(INBOX_DIR, csvFile);
    const slug = this.extractSlug(csvFile);

    if (!slug) {
      this.logger.warn(
        `Cannot extract slug from filename: ${csvFile} (expected format: gamme-slug[_date].csv)`,
      );
      await this.moveFile(fullPath, FAILED_DIR);
      return;
    }

    this.logger.log(`Processing ${csvFile} → slug=${slug}`);

    // Step 1: Call import-gads-kp.py
    try {
      const { stdout, stderr } = await execFileAsync(
        'python3',
        [IMPORT_SCRIPT, fullPath],
        { timeout: 120_000 }, // 2 min max
      );
      this.logger.log(
        `import-gads-kp.py stdout: ${stdout.split('\n').slice(-5).join(' | ')}`,
      );
      if (stderr) {
        this.logger.warn(`import-gads-kp.py stderr: ${stderr.slice(0, 500)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`import-gads-kp.py failed for ${csvFile}: ${msg}`);
      await this.moveFile(fullPath, FAILED_DIR);
      return;
    }

    // Step 2: Enqueue 4 generation jobs (R1/R3/R4/R6) — one per role
    try {
      for (const role of ALL_ROLES) {
        await this.contentGenQueue!.add('generate', {
          role,
          pgAlias: slug,
          dryRun: false,
          force: false,
          trigger: 'cron_inbox',
        });
      }
      this.logger.log(`Enqueued 4 jobs (R1/R3/R4/R6) for ${slug}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Enqueue failed for ${slug}: ${msg}`);
      await this.moveFile(fullPath, FAILED_DIR);
      return;
    }

    // Step 3: Move CSV to processed/
    await this.moveFile(fullPath, PROCESSED_DIR);
  }

  /**
   * Extract gamme slug from filename.
   * Accepts: "plaquette-de-frein.csv", "plaquette-de-frein_2026-04-13.csv", "raw__plaquette-de-frein__FR.csv"
   */
  private extractSlug(filename: string): string | null {
    let base = filename.replace(/\.csv$/i, '');
    // Strip "raw__" prefix and region suffixes like "__FR__fr__20260123"
    base = base.replace(/^raw__/, '');
    base = base.replace(/__[A-Z]{2}.*$/, '');
    // Strip trailing _YYYY-MM-DD or _YYYYMMDD
    base = base.replace(/_\d{4}-?\d{2}-?\d{2}.*$/, '');
    // Normalize (some filenames use "filtre-huile" instead of "filtre-a-huile")
    if (/^[a-z0-9-]+$/.test(base) && base.length >= 3) {
      return base;
    }
    return null;
  }

  private async moveFile(src: string, destDir: string): Promise<void> {
    try {
      await fs.mkdir(destDir, { recursive: true });
      const dest = join(destDir, basename(src));
      await fs.rename(src, dest);
      this.logger.log(`Moved ${basename(src)} → ${destDir}`);
    } catch (err) {
      this.logger.error(`Failed to move ${src} → ${destDir}: ${err}`);
    }
  }
}
