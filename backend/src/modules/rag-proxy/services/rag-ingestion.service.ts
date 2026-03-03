import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  HttpException,
  OnModuleDestroy,
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
import { classifyIngestError, ERROR_LABELS } from '../types/web-ingest-errors';

@Injectable()
export class RagIngestionService implements OnModuleDestroy {
  private readonly logger = new Logger(RagIngestionService.name);
  private readonly ragUrl: string;
  private readonly ragApiKey: string;
  private readonly ragPdfDropHostRoot: string;
  private readonly ragPdfDropContainerRoot: string;

  /** Track active poll timers for cleanup on destroy */
  private readonly activePollTimers = new Set<ReturnType<typeof setInterval>>();

  /** Atomic lock: only one web ingest at a time (single-process guard). */
  private activeWebIngestJobId: string | null = null;

  /** In-memory queue for web ingest requests when lock is held. */
  private readonly pendingWebIngests: Array<{
    url: string;
    truthLevel: string;
    jobId: string;
  }> = [];
  private pendingDrainTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly MAX_PENDING = 10;
  private static readonly DRAIN_INTERVAL_MS = 30_000; // retry every 30s

  onModuleDestroy() {
    const count = this.activePollTimers.size;
    for (const timer of this.activePollTimers) {
      clearInterval(timer);
    }
    this.activePollTimers.clear();
    if (this.pendingDrainTimer) {
      clearTimeout(this.pendingDrainTimer);
      this.pendingDrainTimer = null;
    }
    this.logger.log(
      `RagIngestionService destroyed, cleared ${count} poll timers, ` +
        `${this.pendingWebIngests.length} pending ingests dropped`,
    );
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly ragRedisJobService: RagRedisJobService,
    private readonly frontmatterValidator: FrontmatterValidatorService,
    private readonly ragGammeDetectionService: RagGammeDetectionService,
    private readonly ragCleanupService: RagCleanupService,
    private readonly ragWebIngestDbService: RagWebIngestDbService,
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
  }): Promise<{ jobId: string; status: string }> {
    const url = (request.url || '').trim();
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    const jobId =
      request.jobId ||
      `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const truthLevel = request.truthLevel || 'L3';

    // Prevent concurrent web ingestions (atomic in-process lock + Redis fallback)
    const allJobs = await this.ragRedisJobService.getAllJobs();
    const runningJob = allJobs.find((j) => j.status === 'running');

    if (this.activeWebIngestJobId || runningJob) {
      // Queue instead of rejecting — will drain when lock is released
      if (this.pendingWebIngests.length >= RagIngestionService.MAX_PENDING) {
        throw new ConflictException(
          `Web ingest queue full (${RagIngestionService.MAX_PENDING} pending). Try again later.`,
        );
      }
      this.pendingWebIngests.push({ url, truthLevel, jobId });
      this.scheduleDrain();
      const job: WebJob = {
        jobId,
        url,
        status: 'queued',
        truthLevel,
        startedAt: Math.floor(Date.now() / 1000),
        finishedAt: null,
        returnCode: null,
        logLines: [
          `Queued behind ${this.activeWebIngestJobId || runningJob?.jobId}`,
        ],
      };
      await this.ragRedisJobService.setJob(job);
      void this.ragWebIngestDbService.upsertJob(job);
      this.logger.log(
        `Web ingest queued: ${jobId} for ${url} (behind ${this.activeWebIngestJobId || runningJob?.jobId})`,
      );
      return { jobId, status: 'queued' };
    }
    this.activeWebIngestJobId = jobId;

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
        this.activeWebIngestJobId = null;
        this.drainPendingQueue();
      })
      .catch(async (err) => {
        this.activeWebIngestJobId = null;
        this.drainPendingQueue();
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

    // Step 1: Run ingest_web.py (writes sections to /tmp/ in container)
    job.logLines.push(`Running ingest_web.py for ${job.url}`);
    const ingestCmd = [
      'PYTHONPATH=/app',
      'ENV=dev',
      'python3 /app/scripts/ingestors/ingest_web.py',
      `--url '${safeUrl}'`,
      `--knowledge-path '${containerTmpPath}'`,
      `--truth-level ${job.truthLevel}`,
      '--no-images',
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
    await this.ragRedisJobService.setJob(job); // persist after copy + validation

    // Step 4: Reindex the new files in Weaviate
    job.logLines.push('Reindexing...');
    const reindexCmd = [
      'exec 8>/tmp/rag-global.lock;',
      "if ! flock -n 8; then echo 'Another RAG operation active (global lock), aborting web reindex'; exit 1; fi;",
      'ENV=dev',
      'WEAVIATE_URL=http://weaviate-prod:8080',
      'python3 /app/scripts/reindex.py',
      `--path '/knowledge/${subDir}'`,
      '--collection AUTO',
      '--batch-size 5',
      '--cpu-strict',
      '--strict-routing',
    ].join(' ');

    try {
      await this.execDockerCmd(containerName, reindexCmd, job);
    } catch (err) {
      const code = classifyIngestError(4, job.logLines);
      throw new Error(
        `Step 4: ${ERROR_LABELS[code]} — ${getErrorMessage(err)}`,
      );
    }

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
  ): Promise<void> {
    const { spawn } = await import('node:child_process');
    return new Promise<void>((resolve, reject) => {
      const child = spawn('docker', ['exec', container, 'bash', '-c', cmd]);
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

  // ── Pending queue drain ──

  /**
   * Schedule a drain attempt if not already scheduled.
   */
  private scheduleDrain(): void {
    if (this.pendingDrainTimer) return;
    this.pendingDrainTimer = setTimeout(() => {
      this.pendingDrainTimer = null;
      this.drainPendingQueue();
    }, RagIngestionService.DRAIN_INTERVAL_MS);
  }

  /**
   * Drain the next pending web ingest if the lock is free.
   */
  private drainPendingQueue(): void {
    if (this.activeWebIngestJobId || this.pendingWebIngests.length === 0)
      return;

    const next = this.pendingWebIngests.shift();
    if (!next) return;

    this.logger.log(
      `Draining pending web ingest: ${next.jobId} for ${next.url}`,
    );

    // Fire-and-forget: call ingestWebUrl which will acquire the lock
    // Pass the original jobId to prevent orphaned queued records
    void this.ingestWebUrl({
      url: next.url,
      truthLevel: next.truthLevel,
      jobId: next.jobId,
    }).catch((err) => {
      this.logger.error(
        `Failed to drain pending ingest ${next.jobId}: ${getErrorMessage(err)}`,
      );
    });
  }
}
