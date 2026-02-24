import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  HttpException,
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

@Injectable()
export class RagIngestionService {
  private readonly logger = new Logger(RagIngestionService.name);
  private readonly ragUrl: string;
  private readonly ragApiKey: string;
  private readonly ragPdfDropHostRoot: string;
  private readonly ragPdfDropContainerRoot: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly ragRedisJobService: RagRedisJobService,
    private readonly frontmatterValidator: FrontmatterValidatorService,
    private readonly ragGammeDetectionService: RagGammeDetectionService,
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
  }): Promise<{ jobId: string; status: string }> {
    const url = (request.url || '').trim();
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    const jobId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const truthLevel = request.truthLevel || 'L3';

    // Prevent concurrent web ingestions
    const allJobs = await this.ragRedisJobService.getAllJobs();
    const runningJob = allJobs.find((j) => j.status === 'running');
    if (runningJob) {
      throw new ConflictException(
        `Web ingest already running: ${runningJob.jobId} (${runningJob.url})`,
      );
    }

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

    // Process asynchronously (don't block the HTTP response)
    this.processWebIngest(job).catch(async (err) => {
      job.status = 'failed';
      job.finishedAt = Math.floor(Date.now() / 1000);
      job.returnCode = 1;
      job.logLines.push(`Error: ${getErrorMessage(err)}`);
      await this.ragRedisJobService.setJob(job);
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

    await this.execDockerCmd(containerName, ingestCmd, job);
    await this.ragRedisJobService.setJob(job); // persist after ingest step

    // Step 2: Detect output subdirectory (web/ or web-catalog/)
    const { execSync } = await import('node:child_process');
    const lsOutput = execSync(
      `docker exec ${containerName} ls ${containerTmpPath}/`,
      { encoding: 'utf-8', timeout: 5_000 },
    ).trim();
    const subDir = lsOutput.includes('web-catalog') ? 'web-catalog' : 'web';
    job.logLines.push(`Output: ${subDir}/ (${lsOutput.replace(/\n/g, ', ')})`);

    // Step 3: Copy results from container /tmp/ to host knowledge dir
    execSync(
      `docker cp ${containerName}:${containerTmpPath}/. ${knowledgeHostPath}/`,
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

    await this.execDockerCmd(containerName, reindexCmd, job);

    // Step 5: Cleanup container temp
    execSync(`docker exec ${containerName} rm -rf ${containerTmpPath}`, {
      timeout: 5_000,
    });

    job.status = 'done';
    job.returnCode = 0;
    job.finishedAt = Math.floor(Date.now() / 1000);
    job.logLines.push(`Done — ${subDir}/ sections ingested and indexed`);
    await this.ragRedisJobService.setJob(job); // persist final state
    this.logger.log(`Web ingest job ${job.jobId} completed for ${job.url}`);

    // Emit event to trigger content refresh pipeline
    await this.ragGammeDetectionService.emitIngestionCompleted(
      job.jobId,
      'web',
      validation,
    );
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

    const timer = setInterval(async () => {
      attempt++;
      try {
        const status = await this.getSinglePdfJobStatus(jobId, 10);
        if (status.status === 'done' || status.status === 'completed') {
          clearInterval(timer);

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

          await this.ragGammeDetectionService.emitIngestionCompleted(
            jobId,
            'pdf',
            validationResult,
          );
        } else if (
          status.status === 'failed' ||
          status.status === 'error' ||
          attempt >= MAX_ATTEMPTS
        ) {
          clearInterval(timer);
          if (attempt >= MAX_ATTEMPTS) {
            this.logger.warn(
              `PDF ingest poll timeout for job ${jobId} after ${MAX_ATTEMPTS} attempts`,
            );
          }
        }
      } catch (err) {
        this.logger.error(
          `PDF ingest poll error for ${jobId}: ${getErrorMessage(err)}`,
        );
        if (attempt >= MAX_ATTEMPTS) {
          clearInterval(timer);
        }
      }
    }, INTERVAL_MS);
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
}
