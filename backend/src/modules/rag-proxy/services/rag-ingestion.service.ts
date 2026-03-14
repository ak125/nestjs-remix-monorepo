import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  HttpException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  PdfIngestSingleRequestDto,
  PdfIngestRunResponseDto,
  PdfIngestJobStatusResponseDto,
} from '../dto/pdf-ingest.dto';
import { getErrorMessage } from '../../../common/utils/error.utils';
import { ExternalServiceException } from '../../../common/exceptions';
import { RagRedisJobService, type WebJob } from './rag-redis-job.service';
import { FrontmatterValidatorService } from './frontmatter-validator.service';
import { RagGammeDetectionService } from './rag-gamme-detection.service';
import { RagCleanupService } from './rag-cleanup.service';
import { RagWebIngestDbService } from './rag-web-ingest-db.service';
import { RagImageManagementService } from './rag-image-management.service';
import { classifyIngestError, ERROR_LABELS } from '../types/web-ingest-errors';

@Injectable()
export class RagIngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RagIngestionService.name);
  private readonly ragUrl: string;
  private readonly ragApiKey: string;
  private readonly ragPdfDropHostRoot: string;
  private readonly ragPdfDropContainerRoot: string;

  /** Track active poll timers for cleanup on destroy */
  private readonly activePollTimers = new Set<ReturnType<typeof setInterval>>();

  /** Concurrency pool: up to N web ingests in parallel. */
  private readonly activeWebIngestJobs = new Set<string>();
  private readonly activeWebIngestStartTimes = new Map<string, number>();
  private lockWatchdogTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly MAX_CONCURRENT = 3;
  private static readonly LOCK_WATCHDOG_INTERVAL_MS = 5 * 60_000; // check every 5 min
  private static readonly LOCK_MAX_AGE_MS = 10 * 60_000; // 10 min max

  /** Deferred reindex: accumulate paths, flush when all slots free. */
  private readonly pendingReindexPaths = new Set<string>();

  /** In-memory queue for web ingest requests when all slots are busy. */
  private readonly pendingWebIngests: Array<{
    url: string;
    truthLevel: string;
    jobId: string;
  }> = [];
  private static readonly MAX_PENDING = 10;

  async onModuleInit() {
    // 1. Mark orphaned "running" jobs as failed in DB (crash recovery)
    await this.ragWebIngestDbService.failOrphanedRunningJobs();

    // 1b. Also mark orphaned "running" jobs as failed in Redis
    const allRedisJobs = await this.ragRedisJobService.getAllJobs();
    for (const job of allRedisJobs) {
      if (job.status === 'running') {
        job.status = 'failed';
        job.finishedAt = Math.floor(Date.now() / 1000);
        job.logLines = [...(job.logLines || []), 'Orphaned: server restarted'];
        await this.ragRedisJobService.setJob(job);
        this.logger.warn(`Marked orphaned Redis job ${job.jobId} as failed`);
      }
    }

    // 1c. Force-clear in-memory pool (any "running" job from previous process is dead)
    this.activeWebIngestJobs.clear();
    this.activeWebIngestStartTimes.clear();

    // 2. Rehydrate "queued" jobs from DB into pendingWebIngests
    const queued = await this.ragWebIngestDbService.listJobsByStatus('queued');
    for (const job of queued) {
      this.pendingWebIngests.push({
        jobId: job.job_id,
        url: job.url,
        truthLevel: job.truth_level,
      });
    }
    if (this.pendingWebIngests.length > 0) {
      this.logger.log(
        `Rehydrated ${this.pendingWebIngests.length} queued job(s) from DB`,
      );
      // Drain immediately (slots are free after startup)
      this.drainPendingQueue();
    }

    // 3. Rehydrate pending reindex paths from Redis
    const pendingPaths = await this.ragRedisJobService.getPendingReindexPaths();
    for (const p of pendingPaths) this.pendingReindexPaths.add(p);
    if (pendingPaths.length > 0) {
      this.logger.log(
        `Rehydrated ${pendingPaths.length} pending reindex path(s)`,
      );
      void this.flushReindex();
    }

    // 4. Start lock watchdog
    this.lockWatchdogTimer = setInterval(() => {
      this.checkStaleLock();
    }, RagIngestionService.LOCK_WATCHDOG_INTERVAL_MS);
  }

  private checkStaleLock(): void {
    if (this.activeWebIngestStartTimes.size === 0) return;
    let released = 0;
    for (const [jobId, startedAt] of this.activeWebIngestStartTimes) {
      const age = Date.now() - startedAt;
      if (age > RagIngestionService.LOCK_MAX_AGE_MS) {
        this.logger.warn(
          `Watchdog: slot held by ${jobId} for ${Math.round(age / 1000)}s — force-releasing`,
        );
        this.activeWebIngestJobs.delete(jobId);
        this.activeWebIngestStartTimes.delete(jobId);
        released++;
      }
    }
    if (released > 0) this.drainPendingQueue();
  }

  onModuleDestroy() {
    const count = this.activePollTimers.size;
    for (const timer of this.activePollTimers) {
      clearInterval(timer);
    }
    this.activePollTimers.clear();
    if (this.lockWatchdogTimer) {
      clearInterval(this.lockWatchdogTimer);
      this.lockWatchdogTimer = null;
    }
    this.logger.log(
      `RagIngestionService destroyed, cleared ${count} poll timers, ` +
        `${this.activeWebIngestJobs.size} active + ${this.pendingWebIngests.length} pending ingests dropped`,
    );
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly ragRedisJobService: RagRedisJobService,
    private readonly frontmatterValidator: FrontmatterValidatorService,
    private readonly ragGammeDetectionService: RagGammeDetectionService,
    private readonly ragCleanupService: RagCleanupService,
    private readonly ragWebIngestDbService: RagWebIngestDbService,
    private readonly ragImageManagementService: RagImageManagementService,
  ) {
    // URL externe obligatoire - le RAG est sur un serveur SEPARE (pas Docker local)
    this.ragUrl = this.configService.getOrThrow<string>('RAG_SERVICE_URL');
    this.ragApiKey = this.configService.getOrThrow<string>('RAG_API_KEY');
    this.ragPdfDropHostRoot =
      process.env.RAG_PDF_DROP_HOST_ROOT || '/opt/automecanik/rag/pdfs';
    this.ragPdfDropContainerRoot =
      process.env.RAG_PDF_DROP_CONTAINER_ROOT || '/app/pdfs';
  }

  // ── PDF Ingestion ──

  async ingestSinglePdf(
    request: PdfIngestSingleRequestDto,
  ): Promise<PdfIngestRunResponseDto> {
    const sourcePath = request.pdfPath.trim();
    if (!sourcePath.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('pdfPath must point to a .pdf file');
    }

    const sourceStat = await this.safeStat(sourcePath);
    if (!sourceStat || !sourceStat.isFile()) {
      throw new BadRequestException(`PDF not found: ${sourcePath}`);
    }

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const safeName = this.sanitizeFileName(path.basename(sourcePath));
    const hostInputDir = path.join(this.ragPdfDropHostRoot, '_single', runId);
    const stagedPdfHostPath = path.join(hostInputDir, safeName);
    const containerInputDir = path.posix.join(
      this.ragPdfDropContainerRoot.replace(/\/+$/, ''),
      '_single',
      runId,
    );

    try {
      await fs.mkdir(hostInputDir, { recursive: true });
      await fs.copyFile(sourcePath, stagedPdfHostPath);
    } catch (error) {
      this.logger.error(
        `Failed staging single PDF: ${sourcePath} -> ${stagedPdfHostPath} (${getErrorMessage(error)})`,
      );
      throw new ExternalServiceException({
        message:
          `Failed to stage PDF for ingest. ` +
          `Check access to ${this.ragPdfDropHostRoot} and source path.`,
        serviceName: 'rag',
      });
    }

    const payload = {
      input_dir: containerInputDir,
      truth_level: request.truthLevel,
      max_retries: request.maxRetries,
      timeout_seconds: request.timeoutSeconds,
    };

    try {
      const response = await fetch(`${this.ragUrl}/admin/ingest/pdf/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RAG-API-Key': this.ragApiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `RAG single PDF ingest error: ${response.status} - ${errorText}`,
        );
        throw new ExternalServiceException({
          message: 'RAG single PDF ingest failed',
          serviceName: 'rag',
        });
      }

      const data = (await response.json()) as {
        job_id?: string;
        status?: string;
        pid?: number;
        log_path?: string;
      };

      const result = {
        jobId: data.job_id || '',
        status: data.status || 'unknown',
        pid: data.pid ?? null,
        logPath: data.log_path || '',
        inputDir: containerInputDir,
        stagedPdfPath: stagedPdfHostPath,
      };

      // Start polling for completion -> emit RAG_INGESTION_COMPLETED
      if (result.jobId) {
        this.pollPdfAndEmit(result.jobId);
      }

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Failed to trigger single PDF ingest: ${getErrorMessage(error)}`,
      );
      throw new ExternalServiceException({
        message: 'Failed to trigger single PDF ingest',
        serviceName: 'rag',
      });
    }
  }

  async getSinglePdfJobStatus(
    jobId: string,
    tailLines = 120,
  ): Promise<PdfIngestJobStatusResponseDto> {
    try {
      const response = await fetch(
        `${this.ragUrl}/admin/ingest/pdf/jobs/${encodeURIComponent(jobId)}?tail_lines=${tailLines}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-RAG-API-Key': this.ragApiKey,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `RAG ingest status error: ${response.status} - ${errorText}`,
        );
        throw new ExternalServiceException({
          message: 'RAG ingest status failed',
          serviceName: 'rag',
        });
      }

      const data = (await response.json()) as {
        job_id?: string;
        status?: string;
        pid?: number;
        started_at?: number | null;
        finished_at?: number | null;
        return_code?: number | null;
        log_path?: string;
        log_tail?: string[];
      };

      return {
        jobId: data.job_id || jobId,
        status: data.status || 'unknown',
        pid: data.pid ?? null,
        startedAt: data.started_at ?? null,
        finishedAt: data.finished_at ?? null,
        returnCode: data.return_code ?? null,
        logPath: data.log_path || '',
        logTail: Array.isArray(data.log_tail) ? data.log_tail : [],
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Failed to fetch ingest status: ${getErrorMessage(error)}`,
      );
      throw new ExternalServiceException({
        message: 'Failed to fetch ingest status',
        serviceName: 'rag',
      });
    }
  }

  // ── Web Ingestion ──

  /**
   * Ingest a single web URL into RAG knowledge.
   * Fetches URL in Node.js then POSTs content to RAG admin endpoint.
   */
  async ingestWebUrl(request: {
    url?: string;
    truthLevel?: string;
    jobId?: string;
    force?: boolean;
  }): Promise<{ jobId: string; status: string }> {
    const url = (request.url || '').trim();
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    // Dedup guard: block if a successful ingest already exists for this URL
    if (!request.force) {
      const existing = await this.ragWebIngestDbService.findDoneJobByUrl(url);
      if (existing) {
        throw new ConflictException(
          `URL already ingested (job ${existing.job_id}, ${existing.finished_at}). Use force:true to re-ingest.`,
        );
      }
    }

    const jobId =
      request.jobId ||
      `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const truthLevel = request.truthLevel || 'L3';

    // Concurrency pool: queue if all slots busy
    if (this.activeWebIngestJobs.size >= RagIngestionService.MAX_CONCURRENT) {
      if (this.pendingWebIngests.length >= RagIngestionService.MAX_PENDING) {
        throw new ConflictException(
          `Web ingest queue full (${RagIngestionService.MAX_PENDING} pending). Try again later.`,
        );
      }
      const busyIds = [...this.activeWebIngestJobs].join(', ');
      this.pendingWebIngests.push({ url, truthLevel, jobId });
      const job: WebJob = {
        jobId,
        url,
        status: 'queued',
        truthLevel,
        startedAt: Math.floor(Date.now() / 1000),
        finishedAt: null,
        returnCode: null,
        logLines: [
          `Queued (${this.activeWebIngestJobs.size}/${RagIngestionService.MAX_CONCURRENT} slots busy: ${busyIds})`,
        ],
      };
      await this.ragRedisJobService.setJob(job);
      void this.ragWebIngestDbService.upsertJob(job);
      this.logger.log(
        `Web ingest queued: ${jobId} for ${url} (${this.activeWebIngestJobs.size} slots busy)`,
      );
      return { jobId, status: 'queued' };
    }
    this.activeWebIngestJobs.add(jobId);
    this.activeWebIngestStartTimes.set(jobId, Date.now());

    const job: WebJob = {
      jobId,
      url,
      status: 'running',
      truthLevel,
      startedAt: Math.floor(Date.now() / 1000),
      finishedAt: null,
      returnCode: null,
      logLines: [],
    };
    await this.ragRedisJobService.setJob(job);
    await this.ragRedisJobService.addToIndex(jobId);
    void this.ragWebIngestDbService.upsertJob(job);

    // Process asynchronously (don't block the HTTP response)
    this.processWebIngest(job)
      .then(() => {
        this.releaseSlot(jobId);
      })
      .catch(async (err) => {
        this.releaseSlot(jobId);
        job.status = 'failed';
        job.finishedAt = Math.floor(Date.now() / 1000);
        job.returnCode = 1;
        job.logLines.push(`Error: ${getErrorMessage(err)}`);
        await this.ragRedisJobService.setJob(job);
        void this.ragWebIngestDbService.upsertJob(job);
        this.logger.error(
          `Web ingest job ${jobId} failed: ${getErrorMessage(err)}`,
        );
      });

    this.logger.log(`Web ingest job started: ${jobId} for ${url}`);
    return { jobId, status: 'running' };
  }

  /**
   * Background pipeline: use RAG container's ingest_web.py + reindex.
   * Writes to /tmp/ (writable) inside container, then docker cp to host.
   * The local `job` object accumulates log lines during docker exec streaming,
   * then is persisted to Redis at key milestones to avoid excessive writes.
   */
  private async processWebIngest(job: WebJob): Promise<void> {
    const containerName = process.env.RAG_CONTAINER_NAME || 'rag-api-prod';
    if (!/^[a-z0-9_-]+$/i.test(containerName)) {
      throw new Error(`Invalid container name: ${containerName}`);
    }
    const knowledgeHostPath =
      process.env.RAG_KNOWLEDGE_PATH || '/opt/automecanik/rag/knowledge';
    const containerTmpPath = `/tmp/web-import/${job.jobId}`;
    const safeUrl = job.url.replace(/'/g, "'\\''");

    // Snapshot existing image hashes before ingest (to detect new ones later)
    const imgDir = path.join(knowledgeHostPath, '_raw', 'web-images');
    const existingImageHashes = new Set<string>();
    try {
      for (const f of readdirSync(imgDir)) {
        const m = f.match(/^([a-f0-9]{16})\.(jpg|jpeg|png|webp|gif)$/);
        if (m) existingImageHashes.add(m[1]);
      }
    } catch {
      // _raw/web-images/ may not exist yet
    }

    // Step 1: Run ingest_web.py (writes sections to /tmp/ in container)
    job.logLines.push(`Running ingest_web.py for ${job.url}`);
    const ingestCmd = [
      'PYTHONPATH=/app',
      'ENV=dev',
      'python3 /app/scripts/ingestors/ingest_web.py',
      `--url '${safeUrl}'`,
      `--knowledge-path '${containerTmpPath}'`,
      `--truth-level ${job.truthLevel}`,
      `--source-url '${safeUrl}'`,
      '-v',
    ].join(' ');

    try {
      await this.execDockerCmd(containerName, ingestCmd, job);
    } catch (err) {
      const code = classifyIngestError(1, job.logLines);
      throw new Error(
        `Step 1: ${ERROR_LABELS[code]} — ${getErrorMessage(err)}`,
      );
    }
    await this.ragRedisJobService.setJob(job); // persist after ingest step

    // Step 2: Detect output subdirectory (web/ or web-catalog/)
    const { execFileSync } = await import('node:child_process');
    let lsOutput: string;
    try {
      lsOutput = execFileSync(
        'docker',
        ['exec', containerName, 'ls', `${containerTmpPath}/`],
        { encoding: 'utf-8', timeout: 5_000 },
      ).trim();
      if (!lsOutput) {
        throw new Error(
          'Step 2: Empty output directory — no .md files produced',
        );
      }
    } catch (err) {
      if (getErrorMessage(err).startsWith('Step 2:')) throw err;
      throw new Error(
        `Step 2: Output detection failed — ${getErrorMessage(err)}`,
      );
    }
    const subDir = lsOutput.includes('web-catalog') ? 'web-catalog' : 'web';
    job.logLines.push(`Output: ${subDir}/ (${lsOutput.replace(/\n/g, ', ')})`);

    // Step 3: Copy results from container /tmp/ to host knowledge dir
    execFileSync(
      'docker',
      ['cp', `${containerName}:${containerTmpPath}/.`, `${knowledgeHostPath}/`],
      { timeout: 15_000 },
    );
    job.logLines.push('Copied sections to knowledge directory');

    // Detect newly downloaded images by comparing with pre-ingest snapshot
    const newImageHashes: string[] = [];
    try {
      for (const f of readdirSync(imgDir)) {
        const m = f.match(/^([a-f0-9]{16})\.(jpg|jpeg|png|webp|gif)$/);
        if (m && !existingImageHashes.has(m[1])) newImageHashes.push(m[1]);
      }
    } catch {
      // _raw/web-images/ may not exist yet
    }
    if (newImageHashes.length > 0) {
      job.logLines.push(`New images: ${newImageHashes.length}`);
    }

    // Step 3b: Validate frontmatter BEFORE reindex (quarantine invalid files)
    const validation = this.frontmatterValidator.validateIntakeZone(
      knowledgeHostPath,
      subDir,
    );
    if (validation.quarantined.length > 0) {
      job.logLines.push(
        `\u26A0 Quarantined ${validation.quarantined.length} file(s): ${validation.quarantined.map((q) => q.filename).join(', ')}`,
      );
    }
    if (validation.valid.length > 0) {
      job.logLines.push(
        `\u2713 ${validation.valid.length} file(s) passed validation`,
      );
    }
    // Step 3c: Early gamme detection + image enrichment (before reindex which may timeout)
    if (validation.valid.length > 0) {
      try {
        const earlyGammeMap =
          await this.ragGammeDetectionService.resolveGammesFromFiles(
            validation.valid,
          );
        const earlyGammes = Array.from(earlyGammeMap.keys());
        if (earlyGammes.length > 0) {
          let totalEnriched = 0;
          // Enrich new images from this job
          if (newImageHashes.length > 0) {
            totalEnriched +=
              this.ragImageManagementService.enrichNewImagePrompts(
                newImageHashes,
                earlyGammes[0],
              );
          }
          // Also enrich orphaned images from previous failed jobs (same domain)
          totalEnriched +=
            this.ragImageManagementService.enrichOrphanedImagesBySourceUrl(
              job.url,
              earlyGammes[0],
            );
          if (totalEnriched > 0) {
            job.logLines.push(
              `Auto-enriched ${totalEnriched} image(s) with gamme: ${earlyGammes[0]}`,
            );
          }
        }
      } catch (enrichErr) {
        job.logLines.push(
          `Image enrichment skipped: ${enrichErr instanceof Error ? enrichErr.message : String(enrichErr)}`,
        );
      }
    }

    await this.ragRedisJobService.setJob(job); // persist after copy + validation + enrichment

    // Step 4: Defer reindex (will run as batch when all slots free)
    this.pendingReindexPaths.add(subDir);
    await this.ragRedisJobService.addPendingReindexPath(subDir);
    job.logLines.push(
      `Reindex deferred for ${subDir}/ (will batch when slots free)`,
    );

    // Step 5: Cleanup container temp
    execFileSync(
      'docker',
      ['exec', containerName, 'rm', '-rf', containerTmpPath],
      {
        timeout: 5_000,
      },
    );

    // Step 5b: Sync validated chunks to __rag_knowledge in Supabase
    let dbSyncOk = true;
    if (validation.valid.length > 0) {
      try {
        const syncResult = await this.ragCleanupService.syncFilesToDb(
          validation.valid,
          knowledgeHostPath,
        );
        job.logLines.push(
          `DB sync: ${syncResult.synced} synced, ${syncResult.skipped} skipped` +
            (syncResult.errors.length
              ? `, ${syncResult.errors.length} errors`
              : ''),
        );
        // Phase 1 R1: log receipt summary
        if (syncResult.receipts.length > 0) {
          const passed = syncResult.receipts.filter(
            (r) => r.phase1Status === 'passed',
          ).length;
          const failed = syncResult.receipts.filter(
            (r) => r.phase1Status === 'failed',
          ).length;
          const quarantined = syncResult.receipts.filter(
            (r) => r.phase1Status === 'quarantined',
          ).length;
          job.logLines.push(
            `Phase1 receipts: ${passed} passed, ${failed} failed, ${quarantined} quarantined`,
          );
        }
      } catch (syncErr) {
        dbSyncOk = false;
        const msg =
          syncErr instanceof Error ? syncErr.message : String(syncErr);
        job.logLines.push(`DB sync failed (non-blocking): ${msg}`);
        this.logger.error(`DB sync failed for job ${job.jobId}: ${msg}`);
      }
    }

    job.status = 'done';
    job.returnCode = 0;
    job.finishedAt = Math.floor(Date.now() / 1000);
    job.logLines.push(`Done — ${subDir}/ sections ingested and indexed`);

    // Emit event to trigger content refresh pipeline
    const { affectedGammes } =
      await this.ragGammeDetectionService.emitIngestionCompleted(
        job.jobId,
        'web',
        validation,
        dbSyncOk,
      );

    if (affectedGammes.length === 0) {
      job.logLines.push(
        'Warning: No gammes detected — content refresh NOT triggered',
      );
    } else {
      job.logLines.push(
        `Content refresh queued for gammes: [${affectedGammes.join(', ')}]`,
      );
    }

    await this.ragRedisJobService.setJob(job); // persist final state
    void this.ragWebIngestDbService.upsertJob(job, affectedGammes);
    this.logger.log(`Web ingest job ${job.jobId} completed for ${job.url}`);
  }

  /** Exec a command inside a docker container with log streaming. */
  private async execDockerCmd(
    container: string,
    cmd: string,
    job: { logLines: string[] },
    timeoutMs = 120_000,
  ): Promise<void> {
    const { spawn } = await import('node:child_process');
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const child = spawn('docker', ['exec', container, 'bash', '-c', cmd]);
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill('SIGKILL');
          reject(new Error(`Command timed out after ${timeoutMs / 1000}s`));
        }
      }, timeoutMs);
      child.stdout?.on('data', (d: Buffer) => {
        for (const line of d.toString().split('\n').filter(Boolean)) {
          job.logLines.push(line.trim());
        }
      });
      child.stderr?.on('data', (d: Buffer) => {
        for (const line of d.toString().split('\n').filter(Boolean)) {
          job.logLines.push(line.trim());
        }
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        if (code === 0) resolve();
        else reject(new Error(`Command exited with code ${code}`));
      });
    });
  }

  /**
   * Poll PDF ingest job status every 15s (max 20 attempts = 5 min).
   * Emits RAG_INGESTION_COMPLETED when the job finishes.
   */
  private pollPdfAndEmit(jobId: string): void {
    const MAX_ATTEMPTS = 20;
    const INTERVAL_MS = 15_000;
    let attempt = 0;
    const jobStartedAt = Date.now();

    const timer = setInterval(async () => {
      attempt++;
      try {
        const status = await this.getSinglePdfJobStatus(jobId, 10);
        if (status.status === 'done' || status.status === 'completed') {
          clearInterval(timer);
          this.activePollTimers.delete(timer);

          // Validate frontmatter on recently modified knowledge files (like web flow)
          const knowledgePath =
            process.env.RAG_KNOWLEDGE_PATH || '/opt/automecanik/rag/knowledge';
          let validationResult:
            | {
                valid: string[];
                quarantined: Array<{
                  filename: string;
                  reason: string;
                }>;
              }
            | undefined;
          try {
            const subDirs = readdirSync(knowledgePath, {
              withFileTypes: true,
            })
              .filter(
                (d) =>
                  d.isDirectory() &&
                  !d.name.startsWith('.') &&
                  d.name !== '_quarantine' &&
                  d.name !== '__pycache__',
              )
              .map((d) => d.name);
            for (const subDir of subDirs) {
              const result = this.frontmatterValidator.validateIntakeZone(
                knowledgePath,
                subDir,
                jobStartedAt,
              );
              if (result.quarantined.length > 0 || result.valid.length > 0) {
                if (!validationResult) {
                  validationResult = { valid: [], quarantined: [] };
                }
                validationResult.valid.push(...result.valid);
                validationResult.quarantined.push(...result.quarantined);
              }
            }
          } catch (valErr) {
            this.logger.warn(
              `PDF frontmatter validation skipped: ${getErrorMessage(valErr)}`,
            );
          }

          // Sync validated files to __rag_knowledge DB
          let pdfDbSyncOk = true;
          if (validationResult && validationResult.valid.length > 0) {
            try {
              const syncResult = await this.ragCleanupService.syncFilesToDb(
                validationResult.valid,
                knowledgePath,
              );
              this.logger.log(
                `PDF poll DB sync for ${jobId}: ${syncResult.synced} synced, ${syncResult.skipped} skipped` +
                  (syncResult.errors.length
                    ? `, ${syncResult.errors.length} errors`
                    : ''),
              );
            } catch (syncErr) {
              pdfDbSyncOk = false;
              this.logger.error(
                `PDF poll DB sync failed for ${jobId}: ${getErrorMessage(syncErr)}`,
              );
            }
          }

          await this.ragGammeDetectionService.emitIngestionCompleted(
            jobId,
            'pdf',
            validationResult,
            pdfDbSyncOk,
          );
        } else if (
          status.status === 'failed' ||
          status.status === 'error' ||
          attempt >= MAX_ATTEMPTS
        ) {
          clearInterval(timer);
          this.activePollTimers.delete(timer);
          if (attempt >= MAX_ATTEMPTS) {
            this.logger.warn(
              `PDF ingest poll timeout for job ${jobId} after ${MAX_ATTEMPTS} attempts`,
            );
            // Persist timeout failure to DB for admin visibility
            void this.ragWebIngestDbService.upsertJob({
              jobId,
              url: `pdf-poll:${jobId}`,
              truthLevel: 'L1',
              status: 'failed',
              startedAt: Math.floor(jobStartedAt / 1000),
              finishedAt: Math.floor(Date.now() / 1000),
              returnCode: 1,
              logLines: [
                `PDF poll timeout after ${MAX_ATTEMPTS} attempts (${(MAX_ATTEMPTS * INTERVAL_MS) / 1000}s)`,
              ],
            });
          }
        }
      } catch (err) {
        this.logger.error(
          `PDF ingest poll error for ${jobId}: ${getErrorMessage(err)}`,
        );
        if (attempt >= MAX_ATTEMPTS) {
          clearInterval(timer);
          this.activePollTimers.delete(timer);
        }
      }
    }, INTERVAL_MS);

    this.activePollTimers.add(timer);
  }

  // ── Private helpers ──

  private async safeStat(
    filePath: string,
  ): Promise<Awaited<ReturnType<typeof fs.stat>> | null> {
    try {
      return await fs.stat(filePath);
    } catch {
      return null;
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  // ── Quarantine management ──

  /**
   * List all quarantined files with their REASON.log metadata.
   */
  async listQuarantinedFiles(): Promise<{
    files: Array<{
      filename: string;
      originalPath: string;
      reason: string;
      details: string;
      quarantinedAt: string;
    }>;
    count: number;
  }> {
    const knowledgePath =
      this.configService.get('RAG_KNOWLEDGE_PATH') ||
      '/opt/automecanik/rag/knowledge';
    const quarantineDir = path.join(knowledgePath, '_quarantine');

    const {
      existsSync: exists,
      readdirSync: readdir,
      readFileSync,
    } = await import('node:fs');

    if (!exists(quarantineDir)) {
      return { files: [], count: 0 };
    }

    const reasonFiles = readdir(quarantineDir).filter((f: string) =>
      f.endsWith('.REASON.log'),
    );

    const files = reasonFiles.map((reasonFile: string) => {
      const content = readFileSync(
        path.join(quarantineDir, reasonFile),
        'utf-8',
      );
      const lines = content.split('\n');
      const get = (prefix: string) =>
        lines
          .find((l: string) => l.startsWith(prefix))
          ?.slice(prefix.length)
          .trim() ?? '';

      return {
        filename: reasonFile.replace('.REASON.log', ''),
        originalPath: get('original_path:'),
        reason: get('reason:'),
        details: get('details:'),
        quarantinedAt: get('quarantined_at:'),
      };
    });

    return { files, count: files.length };
  }

  /**
   * Retry a quarantined file: move back to original path, re-validate.
   */
  async retryQuarantinedFile(
    filename: string,
  ): Promise<{ success: boolean; message: string }> {
    const knowledgePath =
      this.configService.get('RAG_KNOWLEDGE_PATH') ||
      '/opt/automecanik/rag/knowledge';
    const quarantineDir = path.join(knowledgePath, '_quarantine');

    const {
      existsSync: exists,
      readFileSync,
      renameSync,
      unlinkSync,
    } = await import('node:fs');

    const qFilePath = path.join(quarantineDir, filename);
    const reasonPath = `${qFilePath}.REASON.log`;

    if (!exists(qFilePath)) {
      return { success: false, message: `File not found: ${filename}` };
    }

    // Read original path from REASON.log
    let originalPath = '';
    if (exists(reasonPath)) {
      const content = readFileSync(reasonPath, 'utf-8');
      const line = content
        .split('\n')
        .find((l: string) => l.startsWith('original_path:'));
      originalPath = line?.slice('original_path:'.length).trim() ?? '';
    }

    if (!originalPath) {
      return {
        success: false,
        message: `Cannot determine original path for ${filename}`,
      };
    }

    const targetPath = path.join(knowledgePath, originalPath);

    // Move file back to original location
    renameSync(qFilePath, targetPath);
    if (exists(reasonPath)) unlinkSync(reasonPath);

    // Re-validate
    const subDir = path.dirname(originalPath);
    const validation = this.frontmatterValidator.validateIntakeZone(
      knowledgePath,
      subDir,
    );

    const wasQuarantined = validation.quarantined.some(
      (q) => q.originalPath === originalPath,
    );

    if (wasQuarantined) {
      return {
        success: false,
        message: `File re-quarantined after retry: ${validation.quarantined.find((q) => q.originalPath === originalPath)?.reason ?? 'unknown'}`,
      };
    }

    this.logger.log(
      `Quarantine retry successful for ${filename} → ${originalPath}`,
    );
    return {
      success: true,
      message: `File restored to ${originalPath} and passed validation`,
    };
  }

  // ── Slot management + queue drain ──

  /**
   * Release a concurrency slot and trigger drain + reindex flush.
   */
  private releaseSlot(jobId: string): void {
    this.activeWebIngestJobs.delete(jobId);
    this.activeWebIngestStartTimes.delete(jobId);
    this.drainPendingQueue();
    void this.flushReindex();
  }

  /**
   * Drain pending queue: fill available slots immediately.
   */
  private drainPendingQueue(): void {
    while (
      this.activeWebIngestJobs.size < RagIngestionService.MAX_CONCURRENT &&
      this.pendingWebIngests.length > 0
    ) {
      const next = this.pendingWebIngests.shift();
      if (!next) break;

      this.logger.log(
        `Draining pending web ingest: ${next.jobId} for ${next.url}`,
      );

      void this.ingestWebUrl({
        url: next.url,
        truthLevel: next.truthLevel,
        jobId: next.jobId,
        force: true, // already validated, skip dedup
      }).catch((err) => {
        this.logger.error(
          `Failed to drain pending ingest ${next.jobId}: ${getErrorMessage(err)}`,
        );
      });
    }
  }

  /**
   * Flush deferred reindex paths when all slots are free.
   */
  private async flushReindex(): Promise<void> {
    if (
      this.activeWebIngestJobs.size > 0 ||
      this.pendingReindexPaths.size === 0
    )
      return;

    const paths = [...this.pendingReindexPaths];
    this.pendingReindexPaths.clear();
    await this.ragRedisJobService.clearPendingReindex();
    const containerName = process.env.RAG_CONTAINER_NAME || 'rag-api-prod';

    this.logger.log(
      `Batch reindex for ${paths.length} path(s): ${paths.join(', ')}`,
    );

    const dummyLog = { logLines: [] as string[] };
    for (const p of paths) {
      const reindexCmd = [
        'exec 8>/tmp/rag-global.lock;',
        'for i in 1 2 3 4 5 6; do flock -n 8 && break; echo "Lock busy, retry $i/6 in 20s..."; sleep 20; done;',
        "if ! flock -n 8; then echo 'Lock still held after 120s, aborting'; exit 1; fi;",
        'ENV=dev',
        'WEAVIATE_URL=http://weaviate-prod:8080',
        'python3 /app/scripts/reindex.py',
        `--path '/knowledge/${p}'`,
        '--collection AUTO',
        '--batch-size 10',
        '--cpu-strict',
        '--strict-routing',
      ].join(' ');

      try {
        await this.execDockerCmd(containerName, reindexCmd, dummyLog, 600_000);
        this.logger.log(`Reindex completed for ${p}/`);
      } catch (err) {
        this.logger.error(
          `Batch reindex failed for ${p}/: ${getErrorMessage(err)}`,
        );
      }
    }
  }
}
