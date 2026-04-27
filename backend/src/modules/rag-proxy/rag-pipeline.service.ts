import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  statSync,
} from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { RAG_KNOWLEDGE_PATH } from '../../config/rag.config';
import { CacheService } from '@cache/cache.service';
import { getErrorMessage } from '@common/utils/error.utils';
import type {
  PipelineRun,
  PipelineRunStatus,
  PipelineRunSummary,
  PipelineLaunchDto,
  PipelineArtifact,
} from './dto/pipeline.dto';

// ── Redis key constants ──────────────────────────────────────────────────────

const LOCK_KEY = 'rag:pipeline:lock';
const LOCK_TTL_SECONDS = 1800; // 30 min
const LOCK_HEARTBEAT_MS = 30_000; // 30s
const LOCK_STALE_MS = 5 * 60_000; // 5 min — no heartbeat → orphan
const RUN_KEY_PREFIX = 'rag:pipeline:runs:';
const LOG_KEY_PREFIX = 'rag:pipeline:logs:';
const RUN_TTL_SECONDS = 7 * 24 * 3600; // 7 days
const LOG_TTL_SECONDS = 7 * 24 * 3600; // 7 days
const LOG_MAX_LINES = 10_000;
const MAX_ARTIFACTS_RUNS = 30;

// ── Sanitization ─────────────────────────────────────────────────────────────

const REDACT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /X-RAG-API-Key:\s*\S+/gi,
    replacement: 'X-RAG-API-Key: [REDACTED]',
  },
  { pattern: /X-Admin-Key:\s*\S+/gi, replacement: 'X-Admin-Key: [REDACTED]' },
  {
    pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g,
    replacement: 'Bearer [REDACTED]',
  },
  {
    pattern: /:\/\/[^:@\s]+:[^@\s]+@/g,
    replacement: '://[REDACTED]:[REDACTED]@',
  },
  { pattern: /ADMIN_API_KEY=\S+/g, replacement: 'ADMIN_API_KEY=[REDACTED]' },
  { pattern: /api[-_]?key[=:]\s*\S+/gi, replacement: 'api_key=[REDACTED]' },
];

function sanitize(text: string): string {
  let out = text;
  for (const { pattern, replacement } of REDACT_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

// ── Lock payload stored in Redis ─────────────────────────────────────────────

interface LockPayload {
  run_id: string;
  step: string;
  scope: string;
  started_at: string;
  last_heartbeat_at: string;
  pid?: number;
}

@Injectable()
export class RagPipelineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RagPipelineService.name);

  private readonly ragServiceUrl: string;
  private readonly ragApiKey: string;
  private readonly scriptsDir: string;
  private readonly reindexScript: string;
  private readonly knowledgePath: string;
  private readonly artifactsDir: string;
  private readonly reindexTimeoutMs: number;
  private readonly ragContainerName: string;

  /** Active spawned process for the current run (V1: single PID) */
  private activeProcess: ChildProcess | null = null;
  private activeRunId: string | null = null;

  /** Heartbeat interval handle */
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.ragServiceUrl =
      this.configService.getOrThrow<string>('RAG_SERVICE_URL');
    this.ragApiKey = this.configService.getOrThrow<string>('RAG_API_KEY');
    this.scriptsDir = this.configService.get<string>(
      'RAG_PIPELINE_SCRIPTS_DIR',
      '/opt/automecanik/app/scripts/seo',
    );
    this.reindexScript = this.configService.get<string>(
      'RAG_REINDEX_SCRIPT',
      '/opt/automecanik/rag/scripts/reindex.py',
    );
    this.knowledgePath = RAG_KNOWLEDGE_PATH;
    this.artifactsDir = this.configService.get<string>(
      'RAG_PIPELINE_ARTIFACTS_DIR',
      '/opt/automecanik/app/backend/data/pipeline-runs',
    );
    this.reindexTimeoutMs = parseInt(
      this.configService.get<string>('RAG_REINDEX_TIMEOUT_MS', '1800000'),
      10,
    );
    this.ragContainerName = this.configService.get<string>(
      'RAG_CONTAINER_NAME',
      'rag-api-prod',
    );

    // Ensure artifacts directory exists
    try {
      mkdirSync(this.artifactsDir, { recursive: true });
      this.logger.log(`Artifacts dir: ${this.artifactsDir}`);
    } catch (err) {
      this.logger.error(`Cannot create artifacts dir: ${getErrorMessage(err)}`);
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    this.logger.log('RagPipelineService startup: scanning orphaned runs...');
    await this.handleOrphanedRuns();
  }

  onModuleDestroy(): void {
    this.stopHeartbeat();
    this.logger.log('RagPipelineService destroyed');
  }

  /**
   * On startup: mark any runs that were `running` (from a previous process) as `abandoned`,
   * and clean up stale lock.
   */
  private async handleOrphanedRuns(): Promise<void> {
    try {
      // Check lock
      const lock = await this.getLock();
      if (lock) {
        const isStale = this.isLockStale(lock);
        if (isStale) {
          this.logger.warn(
            `Startup: found stale lock for run ${lock.run_id} — marking abandoned and clearing`,
          );
          const run = await this.getRun(lock.run_id);
          if (run && run.status === 'running') {
            await this.updateRun(lock.run_id, {
              status: 'abandoned',
              finished_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              error: sanitize('service_restarted: process no longer exists'),
            });
          }
          await this.releaseLock();
        } else {
          // Lock not stale but we just restarted — process is gone
          this.logger.warn(
            `Startup: lock present for run ${lock.run_id} but service just restarted — marking abandoned`,
          );
          const run = await this.getRun(lock.run_id);
          if (run && run.status === 'running') {
            await this.updateRun(lock.run_id, {
              status: 'abandoned',
              finished_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              error: sanitize('abandoned: service_restarted'),
            });
          }
          await this.releaseLock();
        }
      }
    } catch (err) {
      this.logger.error(`Startup orphan scan failed: ${getErrorMessage(err)}`);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async launch(
    dto: PipelineLaunchDto,
  ): Promise<{ run_id: string; status: PipelineRunStatus }> {
    // Validate scope dir exists for reindex (before acquiring lock)
    if (dto.step === 'reindex' && dto.scope !== 'all') {
      const scopePath = path.join(this.knowledgePath, 'gammes', dto.scope);
      if (!existsSync(scopePath)) {
        throw new BadRequestException(
          `scope '${dto.scope}' introuvable : ${scopePath}`,
        );
      }
    }

    // Check lock
    const lock = await this.getLock();
    if (lock) {
      if (this.isLockStale(lock)) {
        this.logger.warn(
          `Stale lock detected for run ${lock.run_id}, cleaning up`,
        );
        const staleRun = await this.getRun(lock.run_id);
        if (staleRun && staleRun.status === 'running') {
          await this.updateRun(lock.run_id, {
            status: 'abandoned',
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            error: sanitize('abandoned: lock_stale'),
          });
        }
        await this.releaseLock();
      } else {
        throw new ConflictException(
          `Pipeline already running: run_id=${lock.run_id} step=${lock.step}`,
        );
      }
    }

    const run_id = randomUUID();
    const now = new Date().toISOString();

    const run: PipelineRun = {
      run_id,
      step: dto.step,
      status: 'queued',
      has_warnings: false,
      created_at: now,
      updated_at: now,
      triggered_by: dto.triggered_by ?? 'manual',
      origin: dto.origin ?? 'admin_manual',
      scope: dto.scope ?? 'all',
      dry_run: dto.dry_run ?? false,
    };

    await this.saveRun(run);

    // Fire-and-forget: run in background
    setImmediate(() => void this.executeRun(run_id, dto));

    return { run_id, status: 'queued' };
  }

  async getStatus(): Promise<object> {
    const lock = await this.getLock();
    const recentRuns = await this.getRecentRuns(5);

    let corpusMetrics: object | null = null;
    try {
      corpusMetrics = await this.fetchWeaviateStats();
    } catch {
      corpusMetrics = null;
    }

    return {
      lock: lock
        ? {
            active: true,
            run_id: lock.run_id,
            step: lock.step,
            last_heartbeat_at: lock.last_heartbeat_at,
            stale: this.isLockStale(lock),
          }
        : { active: false },
      last_runs: recentRuns.map((r) => ({
        run_id: r.run_id,
        step: r.step,
        status: r.status,
        has_warnings: r.has_warnings,
        scope: r.scope,
        created_at: r.created_at,
        finished_at: r.finished_at,
      })),
      corpus_metrics: corpusMetrics,
    };
  }

  async getRunById(runId: string): Promise<PipelineRun> {
    const run = await this.getRun(runId);
    if (!run) {
      throw new NotFoundException(`Run not found: ${runId}`);
    }
    return run;
  }

  async getRunLogs(
    runId: string,
    tail: number = 200,
  ): Promise<{
    run_id: string;
    lines: string[];
    truncated: boolean;
    updated_at: string;
  }> {
    const run = await this.getRun(runId);
    if (!run) {
      throw new NotFoundException(`Run not found: ${runId}`);
    }
    const allLines = await this.getLogs(runId);
    const maxTail = Math.min(tail, LOG_MAX_LINES);
    const sliced = allLines.slice(-maxTail);
    return {
      run_id: runId,
      lines: sliced,
      truncated: allLines.length > maxTail,
      updated_at: run.updated_at,
    };
  }

  async cancelRun(
    runId: string,
  ): Promise<{ run_id: string; status: PipelineRunStatus }> {
    const run = await this.getRun(runId);
    if (!run) {
      throw new NotFoundException(`Run not found: ${runId}`);
    }

    if (run.status === 'queued') {
      // No process yet — cancel directly
      const now = new Date().toISOString();
      await this.updateRun(runId, {
        status: 'cancelled',
        cancel_requested_at: now,
        cancelled_at: now,
        finished_at: now,
        updated_at: now,
        exit_code: -1,
      });
      await this.releaseLock();
      return { run_id: runId, status: 'cancelled' };
    }

    if (!['running'].includes(run.status)) {
      throw new BadRequestException(
        `Cannot cancel run in status: ${run.status}`,
      );
    }

    const now = new Date().toISOString();
    await this.updateRun(runId, {
      cancel_requested_at: now,
      updated_at: now,
    });

    // Signal the active process (V1: PID only, no pgid)
    if (this.activeProcess && this.activeRunId === runId) {
      try {
        this.activeProcess.kill('SIGTERM');
        this.logger.log(
          `Sent SIGTERM to pid=${this.activeProcess.pid} for run ${runId}`,
        );

        await new Promise<void>((resolve) => setTimeout(resolve, 5000));

        if (this.activeProcess && !this.activeProcess.killed) {
          this.activeProcess.kill('SIGKILL');
          this.logger.warn(
            `Sent SIGKILL to pid=${this.activeProcess.pid} for run ${runId}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Kill failed for run ${runId}: ${getErrorMessage(err)}`,
        );
      }
    } else {
      this.logger.warn(
        `Cancel requested for run ${runId} but no active process found (may have finished)`,
      );
    }

    const cancelledAt = new Date().toISOString();
    await this.updateRun(runId, {
      status: 'cancelled',
      cancelled_at: cancelledAt,
      finished_at: cancelledAt,
      updated_at: cancelledAt,
      exit_code: -1,
    });
    await this.releaseLock();
    this.stopHeartbeat();

    return { run_id: runId, status: 'cancelled' };
  }

  // ── Execution engine ────────────────────────────────────────────────────────

  private async executeRun(
    runId: string,
    dto: PipelineLaunchDto,
  ): Promise<void> {
    const now = new Date().toISOString();

    try {
      await this.acquireLock({
        run_id: runId,
        step: dto.step,
        scope: dto.scope ?? 'all',
        started_at: now,
        last_heartbeat_at: now,
      });
    } catch (err) {
      this.logger.error(
        `Failed to acquire lock for run ${runId}: ${getErrorMessage(err)}`,
      );
      await this.updateRun(runId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error: sanitize(`lock_acquisition_failed: ${getErrorMessage(err)}`),
      });
      return;
    }

    this.startHeartbeat(runId);

    await this.updateRun(runId, {
      status: 'running',
      started_at: now,
      updated_at: now,
    });

    try {
      switch (dto.step) {
        case 'audit':
          await this.runAudit(runId, dto);
          break;
        case 'enrich':
          await this.runEnrich(runId, dto);
          break;
        case 'reindex':
          await this.runReindex(runId, dto);
          break;
      }
    } catch (err) {
      const errMsg = sanitize(getErrorMessage(err));
      this.logger.error(`Run ${runId} failed: ${errMsg}`);
      await this.updateRun(runId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error: errMsg,
      });
    } finally {
      this.stopHeartbeat();
      await this.releaseLock();
      this.activeProcess = null;
      this.activeRunId = null;
    }
  }

  // ── Step: audit ─────────────────────────────────────────────────────────────

  private async runAudit(runId: string, dto: PipelineLaunchDto): Promise<void> {
    const startedAt = Date.now();
    const summary: PipelineRunSummary = {};

    // Source 1: rag-check.py (content quality)
    const ragCheckScript = path.join(this.scriptsDir, 'rag-check.py');
    const ragCheckArgs = ['--all'];
    if (dto.dry_run) ragCheckArgs.push('--summary');

    let ragCheckOutput = '';
    try {
      ragCheckOutput = await this.spawnAndCapture(
        runId,
        'python3',
        [ragCheckScript, ...ragCheckArgs],
        {},
        this.reindexTimeoutMs,
      );
      this.parseRagCheckOutput(ragCheckOutput, summary);
    } catch (err) {
      await this.appendLogs(runId, [
        `[audit/rag-check] ERROR: ${sanitize(getErrorMessage(err))}`,
      ]);
      summary.errors = [
        ...(summary.errors ?? []),
        `rag-check failed: ${sanitize(getErrorMessage(err))}`,
      ];
    }

    // Source 2: Weaviate stats (FastAPI)
    try {
      const stats = await this.fetchWeaviateStats();
      if (stats) {
        const s = stats as Record<string, unknown>;
        summary.docs_indexed_weaviate = (s.total_documents as number) ?? 0;
        const byTruth = (s.by_truth_level as Record<string, number>) ?? {};
        summary.corpus_by_truth_level = {
          L1: byTruth.L1 ?? 0,
          L2: byTruth.L2 ?? 0,
          L3: byTruth.L3 ?? 0,
          L4: byTruth.L4 ?? 0,
        };
        // Low coverage if < 500 docs indexed (conservative threshold)
        summary.weaviate_low_coverage_suspected =
          summary.docs_indexed_weaviate < 500;
        // index_gap_confirmed is indeterminate at audit time — needs reindex+re-audit comparison
        summary.index_gap_confirmed = null;
        summary.index_gap_root_cause = 'unknown';
      }
    } catch (err) {
      await this.appendLogs(runId, [
        `[audit/weaviate-stats] ERROR: ${sanitize(getErrorMessage(err))}`,
      ]);
      summary.errors = [
        ...(summary.errors ?? []),
        `weaviate stats failed: ${sanitize(getErrorMessage(err))}`,
      ];
    }

    // Write artifact
    const artifactName = `${runId}-audit.json`;
    const artifact = await this.writeArtifact(
      runId,
      artifactName,
      summary,
      'audit_json',
    );

    const duration_ms = Date.now() - startedAt;
    const hasWarnings = (summary.errors?.length ?? 0) > 0;

    await this.updateRun(runId, {
      status: hasWarnings ? 'done_with_warnings' : 'done',
      has_warnings: hasWarnings,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      duration_ms,
      summary: {
        ...summary,
        artifacts: artifact ? [artifact] : [],
        log_lines: (await this.getLogs(runId)).length,
      },
    });

    await this.rotateArtifacts();
  }

  // ── Step: enrich ─────────────────────────────────────────────────────────────

  private async runEnrich(
    runId: string,
    dto: PipelineLaunchDto,
  ): Promise<void> {
    const startedAt = Date.now();
    const summary: PipelineRunSummary = {};
    const dryRunFlag = dto.dry_run ? ['--dry-run'] : [];

    const scripts = [
      { name: 'rag-enrich-from-web-corpus.py', args: dryRunFlag },
      { name: 'rag-enrich-from-purchase-guide.py', args: dryRunFlag },
      { name: 'rag-enrich-metier-templates.py', args: dryRunFlag },
      { name: 'rag-fill-frontmatter-gaps.py', args: dryRunFlag },
      {
        name: 'materialize-db-to-md.py',
        args: dto.dry_run ? ['--dry-run'] : ['--apply'],
      },
    ];

    let stepFailed: string | undefined;
    let gammes_processed = 0;

    for (const script of scripts) {
      const scriptPath = path.join(this.scriptsDir, script.name);
      if (!existsSync(scriptPath)) {
        const msg = `Script not found: ${scriptPath}`;
        await this.appendLogs(runId, [`[enrich] SKIP ${script.name}: ${msg}`]);
        continue;
      }

      try {
        await this.appendLogs(runId, [`[enrich] Starting ${script.name}`]);
        const scopeArgs = dto.scope !== 'all' ? ['--scope', dto.scope] : [];

        await this.spawnAndCapture(
          runId,
          'python3',
          [scriptPath, ...script.args, ...scopeArgs],
          {},
          this.reindexTimeoutMs,
        );
        gammes_processed++;
        await this.appendLogs(runId, [`[enrich] Completed ${script.name}`]);
      } catch (err) {
        stepFailed = script.name;
        const errMsg = sanitize(getErrorMessage(err));
        summary.step_failed = stepFailed;
        summary.errors = [
          ...(summary.errors ?? []),
          `${script.name}: ${errMsg}`,
        ];
        await this.appendLogs(runId, [
          `[enrich] FAILED ${script.name}: ${errMsg}`,
        ]);
        break; // stop chain on first failure
      }
    }

    summary.gammes_processed = gammes_processed;

    const artifactName = `${runId}-enrich-summary.json`;
    const artifact = await this.writeArtifact(
      runId,
      artifactName,
      summary,
      'enrich_summary',
    );

    const duration_ms = Date.now() - startedAt;
    const failed = !!stepFailed;
    const hasWarnings = !failed && (summary.errors?.length ?? 0) > 0;

    await this.updateRun(runId, {
      status: failed ? 'failed' : hasWarnings ? 'done_with_warnings' : 'done',
      has_warnings: hasWarnings,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      duration_ms,
      error: failed
        ? sanitize(summary.errors?.join('; ') ?? 'enrich failed')
        : undefined,
      summary: {
        ...summary,
        artifacts: artifact ? [artifact] : [],
        log_lines: (await this.getLogs(runId)).length,
      },
    });

    await this.rotateArtifacts();
  }

  // ── Step: reindex ────────────────────────────────────────────────────────────

  private async runReindex(
    runId: string,
    dto: PipelineLaunchDto,
  ): Promise<void> {
    const startedAt = Date.now();
    const summary: PipelineRunSummary = {};

    // reindex.py runs INSIDE the Docker container (all deps: weaviate, fastembed, pydantic_settings)
    // Knowledge path inside container is /knowledge (mapped from /opt/automecanik/rag/knowledge)
    const containerKnowledgePath = '/knowledge';
    const spawnPath =
      dto.scope === 'all'
        ? containerKnowledgePath
        : `${containerKnowledgePath}/gammes/${dto.scope}`;

    // Quarantine log inside container (accessible via docker logs/exec)
    const quarantineLog = `/tmp/rag_quarantine_${runId}.jsonl`;

    // docker exec -e ENV=dev rag-api-prod python3 /app/scripts/reindex.py ...
    const args = [
      'exec',
      '-e',
      'ENV=dev', // KILL SWITCH: enforce_build_plane() requires ENV in allowed list
      this.ragContainerName,
      'python3',
      '/app/scripts/reindex.py',
      '--path',
      spawnPath,
      '--cpu-strict',
      '--quarantine-log',
      quarantineLog,
    ];
    if (dto.dry_run) args.push('--dry-run');

    let reindexOutput = '';
    let exitCode = 0;

    try {
      reindexOutput = await this.spawnAndCapture(
        runId,
        'docker',
        args,
        {}, // ENV=dev passed via docker exec -e flag, not via process.env
        this.reindexTimeoutMs,
      );
    } catch (err: unknown) {
      const e = err as { exitCode?: number; output?: string };
      exitCode = e?.exitCode ?? 1;
      reindexOutput = e?.output ?? '';
      summary.errors = [sanitize(getErrorMessage(err))];
    }

    // Parse stdout metrics
    const parsed = this.parseReindexOutput(reindexOutput);
    summary.docs_indexed = parsed.indexed;
    summary.blocked_docs = parsed.blockedDocs;
    summary.blocked_chunks = parsed.blockedChunks;
    summary.duration_seconds = parsed.durationSeconds;

    const artifactName = `${runId}-reindex-summary.json`;
    const artifact = await this.writeArtifact(
      runId,
      artifactName,
      summary,
      'reindex_summary',
    );

    const duration_ms = Date.now() - startedAt;

    // Status decision table (exit_code === 0 is NOT sufficient)
    let status: PipelineRunStatus;
    let hasWarnings = false;

    if (exitCode !== 0) {
      status = 'failed';
    } else if (dto.dry_run && (parsed.documents ?? 0) > 0) {
      // dry_run: indexed=0 by design — documents found is sufficient for success
      status = 'done';
    } else if ((parsed.documents ?? 0) === 0 || (parsed.indexed ?? 0) === 0) {
      // doc_count = 0 → silent exit 0 → treat as failure
      status = 'failed';
      summary.errors = [
        ...(summary.errors ?? []),
        `No documents indexed (documents=${parsed.documents}, indexed=${parsed.indexed}) — path may be empty or all files excluded`,
      ];
    } else if ((parsed.blockedDocs ?? 0) > 0) {
      status = 'done_with_warnings';
      hasWarnings = true;
      summary.errors = [
        ...(summary.errors ?? []),
        `blocked_docs=${parsed.blockedDocs} blocked_chunks=${parsed.blockedChunks} — check quarantine: ${quarantineLog}`,
      ];
    } else {
      status = 'done';
    }

    await this.updateRun(runId, {
      status,
      has_warnings: hasWarnings,
      exit_code: exitCode,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      duration_ms,
      error:
        status === 'failed'
          ? sanitize(summary.errors?.join('; ') ?? 'reindex failed')
          : undefined,
      summary: {
        ...summary,
        artifacts: artifact ? [artifact] : [],
        log_lines: (await this.getLogs(runId)).length,
      },
    });

    await this.rotateArtifacts();
  }

  // ── Spawn helper ─────────────────────────────────────────────────────────────

  private spawnAndCapture(
    runId: string,
    command: string,
    args: string[],
    extraEnv: Record<string, string>,
    timeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env, ...extraEnv };
      const child = spawn(command, args, {
        env,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.activeProcess = child;
      this.activeRunId = runId;

      // Update lock with pid
      void this.updateLockPid(runId, child.pid);

      const outputLines: string[] = [];
      let lineBuffer = '';

      const processLine = (data: Buffer, prefix: string) => {
        lineBuffer += data.toString();
        const parts = lineBuffer.split('\n');
        lineBuffer = parts.pop() ?? '';
        for (const line of parts) {
          if (line.trim()) {
            const sanitizedLine = sanitize(`${prefix}${line}`);
            outputLines.push(sanitizedLine);
            void this.appendLogs(runId, [sanitizedLine]);
          }
        }
      };

      child.stdout?.on('data', (data: Buffer) => processLine(data, ''));
      child.stderr?.on('data', (data: Buffer) =>
        processLine(data, '[stderr] '),
      );

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 5000);
        reject(
          Object.assign(new Error(`Process timed out after ${timeoutMs}ms`), {
            exitCode: -2,
            output: outputLines.join('\n'),
          }),
        );
      }, timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timer);
        // Flush remaining buffer
        if (lineBuffer.trim()) {
          const sanitizedLine = sanitize(lineBuffer.trim());
          outputLines.push(sanitizedLine);
          void this.appendLogs(runId, [sanitizedLine]);
        }
        if (code === 0) {
          resolve(outputLines.join('\n'));
        } else {
          reject(
            Object.assign(new Error(`Process exited with code ${code}`), {
              exitCode: code ?? 1,
              output: outputLines.join('\n'),
            }),
          );
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(
          Object.assign(err, { exitCode: 1, output: outputLines.join('\n') }),
        );
      });
    });
  }

  // ── Output parsers ──────────────────────────────────────────────────────────

  private parseReindexOutput(output: string): {
    documents?: number;
    indexed?: number;
    blockedDocs?: number;
    blockedChunks?: number;
    durationSeconds?: number;
  } {
    const extract = (label: string): number | undefined => {
      const m = output.match(new RegExp(`${label}\\s*:\\s*(\\d+)`));
      return m ? parseInt(m[1], 10) : undefined;
    };
    const durationMatch = output.match(/Duration:\s*([\d.]+)s/);

    // Dry-run format: "Total: N documents, Y chunks" (no indexation occurs)
    const dryRunMatch = output.match(
      /Total:\s*(\d+)\s+documents?,\s*(\d+)\s+chunks?/i,
    );
    if (dryRunMatch) {
      return {
        documents: parseInt(dryRunMatch[1], 10),
        indexed: 0,
        blockedDocs: 0,
        blockedChunks: 0,
        durationSeconds: durationMatch
          ? parseFloat(durationMatch[1])
          : undefined,
      };
    }

    return {
      documents: extract('Documents'),
      indexed: extract('Indexed'),
      blockedDocs: extract('Blocked docs'),
      blockedChunks: extract('Blocked chunks'),
      durationSeconds: durationMatch ? parseFloat(durationMatch[1]) : undefined,
    };
  }

  private parseRagCheckOutput(
    output: string,
    summary: PipelineRunSummary,
  ): void {
    // Parse: "Completes (natif V4) : N | Completes (avec V1 fallback) : N | Avec FAIL : N"
    const totalMatch = output.match(/(\d+)\s+gammes\s+analys/i);
    const failMatch = output.match(/Avec FAIL\s*:\s*(\d+)/i);
    const _v4Match = output.match(/Schema V4\s*:\s*(\d+)/i);
    const sourcesMatch = output.match(/Sans sources\s*:\s*(\d+)/i);

    const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
    const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
    const ok = total - failed;
    const withoutSources = sourcesMatch ? parseInt(sourcesMatch[1], 10) : 0;

    summary.gammes_total = total;
    summary.gammes_ok = ok;
    summary.gammes_blocked = failed;
    summary.gammes_without_sources = withoutSources;
    summary.content_gap_confirmed = total > 0 && failed / total > 0.1;
  }

  // ── Weaviate stats ──────────────────────────────────────────────────────────

  private async fetchWeaviateStats(): Promise<object | null> {
    const url = `${this.ragServiceUrl}/api/knowledge/stats`;
    const response = await fetch(url, {
      headers: { 'X-RAG-API-Key': this.ragApiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Weaviate stats HTTP ${response.status}`);
    }
    return response.json() as Promise<object>;
  }

  // ── Lock management ─────────────────────────────────────────────────────────

  private async acquireLock(
    payload: Omit<LockPayload, 'last_heartbeat_at'> & {
      last_heartbeat_at?: string;
    },
  ): Promise<void> {
    const existing = await this.getLock();
    if (existing && !this.isLockStale(existing)) {
      throw new ConflictException(
        `Lock already held by run ${existing.run_id}`,
      );
    }
    const lock: LockPayload = {
      ...payload,
      last_heartbeat_at: payload.last_heartbeat_at ?? new Date().toISOString(),
    };
    await this.cacheService.set(LOCK_KEY, lock, LOCK_TTL_SECONDS);
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.cacheService.del(LOCK_KEY);
    } catch (err) {
      this.logger.warn(`Failed to release lock: ${getErrorMessage(err)}`);
    }
  }

  private async getLock(): Promise<LockPayload | null> {
    try {
      return await this.cacheService.get<LockPayload>(LOCK_KEY);
    } catch {
      return null;
    }
  }

  private async updateLockPid(
    runId: string,
    pid: number | undefined,
  ): Promise<void> {
    try {
      const lock = await this.getLock();
      if (lock && lock.run_id === runId) {
        lock.pid = pid;
        lock.last_heartbeat_at = new Date().toISOString();
        await this.cacheService.set(LOCK_KEY, lock, LOCK_TTL_SECONDS);
      }
    } catch {
      // non-critical
    }
  }

  private isLockStale(lock: LockPayload): boolean {
    const lastHeartbeat = new Date(lock.last_heartbeat_at).getTime();
    return Date.now() - lastHeartbeat > LOCK_STALE_MS;
  }

  private startHeartbeat(runId: string): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(async () => {
      try {
        const lock = await this.getLock();
        if (lock && lock.run_id === runId) {
          lock.last_heartbeat_at = new Date().toISOString();
          await this.cacheService.set(LOCK_KEY, lock, LOCK_TTL_SECONDS);
        }
      } catch (err) {
        this.logger.warn(`Heartbeat failed: ${getErrorMessage(err)}`);
      }
    }, LOCK_HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ── Run persistence ─────────────────────────────────────────────────────────

  private async saveRun(run: PipelineRun): Promise<void> {
    try {
      await this.cacheService.set(
        `${RUN_KEY_PREFIX}${run.run_id}`,
        run,
        RUN_TTL_SECONDS,
      );
      // Update index
      const index =
        (await this.cacheService.get<string[]>(`${RUN_KEY_PREFIX}_index`)) ??
        [];
      if (!index.includes(run.run_id)) {
        index.unshift(run.run_id);
        if (index.length > 100) index.length = 100; // keep last 100 in index
        await this.cacheService.set(
          `${RUN_KEY_PREFIX}_index`,
          index,
          RUN_TTL_SECONDS,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to save run ${run.run_id}: ${getErrorMessage(err)}`,
      );
    }
  }

  private async updateRun(
    runId: string,
    partial: Partial<PipelineRun>,
  ): Promise<void> {
    try {
      const existing = await this.getRun(runId);
      if (!existing) {
        this.logger.warn(`updateRun: run ${runId} not found`);
        return;
      }
      const updated = {
        ...existing,
        ...partial,
        updated_at: new Date().toISOString(),
      };
      await this.cacheService.set(
        `${RUN_KEY_PREFIX}${runId}`,
        updated,
        RUN_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to update run ${runId}: ${getErrorMessage(err)}`,
      );
    }
  }

  async getRun(runId: string): Promise<PipelineRun | null> {
    try {
      return await this.cacheService.get<PipelineRun>(
        `${RUN_KEY_PREFIX}${runId}`,
      );
    } catch {
      return null;
    }
  }

  private async getRecentRuns(limit: number): Promise<PipelineRun[]> {
    try {
      const index =
        (await this.cacheService.get<string[]>(`${RUN_KEY_PREFIX}_index`)) ??
        [];
      const runs: PipelineRun[] = [];
      for (const id of index.slice(0, limit)) {
        const run = await this.getRun(id);
        if (run) runs.push(run);
      }
      return runs;
    } catch {
      return [];
    }
  }

  // ── Log management ──────────────────────────────────────────────────────────

  private async appendLogs(runId: string, lines: string[]): Promise<void> {
    try {
      const existing =
        (await this.cacheService.get<string[]>(`${LOG_KEY_PREFIX}${runId}`)) ??
        [];
      const updated = [...existing, ...lines];
      // LTRIM equivalent: keep last LOG_MAX_LINES
      const trimmed =
        updated.length > LOG_MAX_LINES
          ? updated.slice(updated.length - LOG_MAX_LINES)
          : updated;
      await this.cacheService.set(
        `${LOG_KEY_PREFIX}${runId}`,
        trimmed,
        LOG_TTL_SECONDS,
      );
    } catch {
      // non-critical
    }
  }

  private async getLogs(runId: string): Promise<string[]> {
    try {
      return (
        (await this.cacheService.get<string[]>(`${LOG_KEY_PREFIX}${runId}`)) ??
        []
      );
    } catch {
      return [];
    }
  }

  // ── Artifact management ─────────────────────────────────────────────────────

  private async writeArtifact(
    runId: string,
    name: string,
    data: object,
    type: PipelineArtifact['artifact_type'],
  ): Promise<PipelineArtifact | null> {
    try {
      const filePath = path.join(this.artifactsDir, name);
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      this.logger.log(`Artifact written: ${filePath}`);
      return {
        artifact_type: type,
        artifact_name: name,
        relative_path: name, // relative to artifactsDir
      };
    } catch (err) {
      this.logger.warn(
        `Failed to write artifact ${name}: ${getErrorMessage(err)}`,
      );
      return null;
    }
  }

  /** Rotate artifacts: keep only the last MAX_ARTIFACTS_RUNS run directories */
  private async rotateArtifacts(): Promise<void> {
    try {
      const files = readdirSync(this.artifactsDir)
        .filter((f) => f.endsWith('.json') || f.endsWith('.md'))
        .map((f) => ({
          name: f,
          mtime: statSync(path.join(this.artifactsDir, f)).mtime as Date,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Group by run_id prefix (first 36 chars = UUID)
      const runIds = new Set<string>();
      for (const f of files) {
        if (f.name.length >= 36) {
          runIds.add(f.name.substring(0, 36));
        }
      }

      if (runIds.size <= MAX_ARTIFACTS_RUNS) return;

      // Remove oldest runs
      const runIdsArr = [...runIds];
      const toRemove = runIdsArr.slice(MAX_ARTIFACTS_RUNS);
      for (const oldRunId of toRemove) {
        for (const f of files.filter((x) => x.name.startsWith(oldRunId))) {
          try {
            unlinkSync(path.join(this.artifactsDir, f.name));
            this.logger.debug(`Rotated artifact: ${f.name}`);
          } catch {
            // ignore individual delete errors
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Artifact rotation failed: ${getErrorMessage(err)}`);
    }
  }
}
