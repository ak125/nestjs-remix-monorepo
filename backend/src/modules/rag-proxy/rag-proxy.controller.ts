import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
  UsePipes,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { RagProxyService } from './rag-proxy.service';
import { RagCleanupService } from './services/rag-cleanup.service';
import { RagWebIngestDbService } from './services/rag-web-ingest-db.service';
import { RagIngestionService } from './services/rag-ingestion.service';
import { RagImageManagementService } from './services/rag-image-management.service';
import type { RagDocInput, IngestDecision } from './types/rag-ingest.types';
import {
  ChatRequestSchema,
  ChatRequestDto,
  ChatResponseDto,
} from './dto/chat.dto';
import {
  SearchRequestSchema,
  SearchRequestDto,
  SearchResponseDto,
} from './dto/search.dto';
import {
  PdfIngestSingleRequestSchema,
  PdfIngestSingleRequestDto,
  PdfIngestRunResponseDto,
  PdfIngestJobStatusResponseDto,
} from './dto/pdf-ingest.dto';
import {
  WebIngestRequestSchema,
  WebIngestRequestDto,
} from './dto/web-ingest.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthenticatedGuard } from '../../auth/authenticated.guard';
import { IsAdminGuard } from '../../auth/is-admin.guard';
import { InternalApiKeyGuard } from '../../auth/internal-api-key.guard';
import { existsSync } from 'node:fs';
import path from 'node:path';

@ApiTags('RAG')
@Controller('api/rag')
export class RagProxyController {
  constructor(
    private readonly ragProxyService: RagProxyService,
    private readonly ragCleanupService: RagCleanupService,
    private readonly ragWebIngestDbService: RagWebIngestDbService,
    private readonly ragIngestionService: RagIngestionService,
    private readonly ragImageManagementService: RagImageManagementService,
  ) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(ChatRequestSchema))
  @ApiOperation({ summary: 'Chat with RAG assistant' })
  @ApiResponse({ status: 200, description: 'Chat response' })
  @ApiResponse({ status: 503, description: 'RAG service unavailable' })
  async chat(@Body() request: ChatRequestDto): Promise<ChatResponseDto> {
    return this.ragProxyService.chat(request);
  }

  @Post('chat/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat with RAG assistant (SSE streaming)' })
  @ApiResponse({ status: 200, description: 'SSE stream of chat response' })
  async chatStream(
    @Body() request: ChatRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    await this.ragProxyService.chatStream(request, res);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(SearchRequestSchema))
  @ApiOperation({ summary: 'Semantic search in knowledge base' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(@Body() request: SearchRequestDto): Promise<SearchResponseDto> {
    return this.ragProxyService.search(request);
  }

  @Get('health')
  @ApiOperation({ summary: 'Check RAG service health' })
  @ApiResponse({ status: 200, description: 'Health status' })
  async health() {
    return this.ragProxyService.health();
  }

  @Get('intents/stats')
  @ApiOperation({ summary: 'Get in-memory intent routing stats' })
  @ApiResponse({
    status: 200,
    description: 'Intent stats by volume/confidence',
  })
  async getIntentStats() {
    return this.ragProxyService.getIntentStats();
  }

  @Get('admin/knowledge')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'List all knowledge documents with metadata' })
  @ApiResponse({ status: 200, description: 'List of documents' })
  async listKnowledgeDocs(@Query('prefix') prefix?: string) {
    return this.ragProxyService.listKnowledgeDocsFull(prefix);
  }

  @Get('admin/knowledge/doc/:docId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Get a single knowledge document by ID' })
  @ApiResponse({ status: 200, description: 'Document content and metadata' })
  async getKnowledgeDoc(@Param('docId') docId: string) {
    return this.ragProxyService.getKnowledgeDoc(docId);
  }

  @Get('admin/corpus/stats')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Get corpus statistics for admin dashboard' })
  @ApiResponse({ status: 200, description: 'Corpus stats' })
  async getCorpusStats() {
    return this.ragProxyService.getCorpusStats();
  }

  @Get('admin/ingest/pdf/jobs')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'List all PDF ingestion jobs' })
  @ApiResponse({ status: 200, description: 'List of ingestion jobs' })
  async listIngestionJobs() {
    return this.ragProxyService.listIngestionJobs();
  }

  @Post('admin/ingest/pdf/single')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @UsePipes(new ZodValidationPipe(PdfIngestSingleRequestSchema))
  @ApiOperation({ summary: 'Trigger single-PDF ingest + reindex job' })
  @ApiResponse({ status: 202, description: 'Job started' })
  @ApiResponse({ status: 400, description: 'Invalid payload/path' })
  @ApiResponse({ status: 503, description: 'RAG service unavailable' })
  async ingestSinglePdf(
    @Body() request: PdfIngestSingleRequestDto,
  ): Promise<PdfIngestRunResponseDto> {
    return this.ragProxyService.ingestSinglePdf(request);
  }

  @Get('admin/ingest/pdf/jobs/:jobId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Get single-PDF ingest job status' })
  @ApiResponse({ status: 200, description: 'Job status' })
  async getSinglePdfJobStatus(
    @Param('jobId') jobId: string,
    @Query('tailLines') tailLines?: string,
  ): Promise<PdfIngestJobStatusResponseDto> {
    const parsedTailLines = Number.parseInt(tailLines || '120', 10);
    const safeTailLines = Number.isFinite(parsedTailLines)
      ? Math.min(500, Math.max(1, parsedTailLines))
      : 120;
    return this.ragProxyService.getSinglePdfJobStatus(jobId, safeTailLines);
  }

  @Post('admin/ingest/web/single')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @UsePipes(new ZodValidationPipe(WebIngestRequestSchema))
  @ApiOperation({ summary: 'Trigger web URL ingest job' })
  @ApiResponse({ status: 202, description: 'Job started' })
  @ApiResponse({ status: 400, description: 'Invalid URL' })
  async ingestWebUrl(@Body() request: WebIngestRequestDto) {
    return this.ragProxyService.ingestWebUrl(request);
  }

  @Get('admin/ingest/web/jobs')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'List all web URL ingestion jobs (Redis + DB)' })
  @ApiResponse({ status: 200, description: 'List of web ingestion jobs' })
  async listWebJobs() {
    // Redis (hot, last 24h) + DB fallback for historical jobs
    const redisJobs = await this.ragProxyService.listWebJobs();
    const dbJobs = await this.ragWebIngestDbService.listJobs(50);

    // Merge: Redis wins for current jobs, DB fills gaps (expired from Redis)
    const redisIds = new Set(redisJobs.map((j) => j.jobId));
    const dbOnly = dbJobs
      .filter((j) => !redisIds.has(j.job_id))
      .map((j) => ({
        jobId: j.job_id,
        url: j.url,
        status: j.status,
        truthLevel: j.truth_level,
        startedAt: Math.floor(new Date(j.started_at).getTime() / 1000),
        finishedAt: j.finished_at
          ? Math.floor(new Date(j.finished_at).getTime() / 1000)
          : null,
        returnCode: j.return_code,
        logLines: [] as string[],
        errorMessage: j.error_message,
      }));

    // Add errorMessage to Redis jobs from DB (Redis doesn't store it separately)
    const dbByJobId = new Map(dbJobs.map((j) => [j.job_id, j]));
    const enrichedRedis = redisJobs.map((j) => ({
      ...j,
      errorMessage: dbByJobId.get(j.jobId)?.error_message ?? null,
    }));

    return [...enrichedRedis, ...dbOnly].sort(
      (a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0),
    );
  }

  @Get('admin/ingest/web/jobs/:jobId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Get web URL ingest job status and logs' })
  @ApiResponse({ status: 200, description: 'Job status with logs' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getWebJobStatus(@Param('jobId') jobId: string) {
    // Try Redis first (has live logLines for running jobs)
    const redisJob = await this.ragProxyService.getWebJob(jobId);
    if (redisJob) return redisJob;

    // Fallback to DB (permanent store, survives Redis TTL expiry)
    const dbJob = await this.ragWebIngestDbService.getJob(jobId);
    if (!dbJob) throw new NotFoundException('Web ingest job not found');

    return {
      jobId: dbJob.job_id,
      url: dbJob.url,
      status: dbJob.status,
      truthLevel: dbJob.truth_level,
      startedAt: Math.floor(new Date(dbJob.started_at).getTime() / 1000),
      finishedAt: dbJob.finished_at
        ? Math.floor(new Date(dbJob.finished_at).getTime() / 1000)
        : null,
      returnCode: dbJob.return_code,
      logLines: dbJob.log_lines || [],
      errorMessage: dbJob.error_message,
    };
  }

  @Post('admin/ingest/web/jobs/:jobId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Retry a failed web ingest job' })
  @ApiResponse({ status: 202, description: 'Retry job started' })
  @ApiResponse({ status: 404, description: 'Original job not found' })
  @ApiResponse({ status: 409, description: 'Job still running' })
  async retryWebJob(@Param('jobId') jobId: string) {
    const existing = await this.ragWebIngestDbService.getJob(jobId);
    if (!existing) throw new NotFoundException('Job not found or expired');
    if (existing.status === 'running') {
      throw new ConflictException('Job is still running');
    }
    return this.ragProxyService.ingestWebUrl({
      url: existing.url,
      truthLevel: existing.truth_level,
    });
  }

  /** List quarantined files with reason metadata. */
  @Get('admin/quarantine')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'List quarantined RAG files with reasons' })
  @ApiResponse({ status: 200, description: 'List of quarantined files' })
  async listQuarantinedFiles() {
    return this.ragIngestionService.listQuarantinedFiles();
  }

  /** Retry a quarantined file: move back, re-validate. */
  @Post('admin/quarantine/:filename/retry')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({
    summary: 'Retry a quarantined file (move back + re-validate)',
  })
  @ApiResponse({ status: 200, description: 'Retry result' })
  async retryQuarantinedFile(@Param('filename') filename: string) {
    return this.ragIngestionService.retryQuarantinedFile(filename);
  }

  /** List all RAG knowledge images (admin only). */
  @Get('admin/images')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'List all RAG knowledge images' })
  @ApiResponse({ status: 200, description: 'Array of image metadata' })
  listImages() {
    return this.ragProxyService.listImages();
  }

  /** Describe an image using Claude Vision for recreation prompt (admin only). */
  @Post('admin/images/:hash/describe')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate image description prompt via Claude Vision',
  })
  @ApiResponse({ status: 200, description: 'Image description prompt' })
  async describeImage(@Param('hash') hash: string) {
    return this.ragProxyService.describeImage(hash);
  }

  /** Upload a generated image to Supabase Storage. */
  @Post('admin/images/:hash/upload-generated')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload a generated image for a RAG image hash' })
  @ApiResponse({ status: 200, description: 'Upload result with public URL' })
  async uploadGeneratedImage(
    @Param('hash') hash: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.ragImageManagementService.uploadGeneratedImage(hash, file);
  }

  /** Assign an uploaded image to a gamme (pg_pic/pg_img/pg_wall or R3 slot). */
  @Post('admin/images/assign')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign an image URL to a gamme target' })
  @ApiResponse({ status: 200, description: 'Assignment result' })
  async assignImage(
    @Body()
    body: {
      imageUrl: string;
      pgAlias: string;
      target: string;
      slotId?: string;
    },
  ) {
    return this.ragImageManagementService.assignImage(body);
  }

  /** Resolve a gamme alias to the exact DB pg_alias (fuzzy via pg_trgm). */
  @Get('admin/images/resolve-gamme/:alias')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Resolve a gamme alias to exact DB pg_alias' })
  @ApiResponse({
    status: 200,
    description: 'Resolved alias with similarity score',
  })
  async resolveGammeAlias(@Param('alias') alias: string) {
    const result =
      await this.ragImageManagementService.resolveGammeAlias(alias);
    if (!result) {
      throw new NotFoundException(`Aucune gamme trouvee pour: "${alias}"`);
    }
    return result;
  }

  /** List R3 image slots for a gamme. */
  @Get('admin/images/r3-slots/:pgAlias')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'List R3 image prompt slots for a gamme' })
  @ApiResponse({ status: 200, description: 'Array of R3 slots' })
  async listR3Slots(@Param('pgAlias') pgAlias: string) {
    return this.ragImageManagementService.listR3Slots(pgAlias);
  }

  /** Serve RAG knowledge images (web-images ingested from URLs). */
  @Get('images/:hash')
  @ApiOperation({ summary: 'Serve a RAG knowledge image by hash' })
  @ApiResponse({ status: 200, description: 'Image file' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  async serveImage(
    @Param('hash') hash: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!/^[a-f0-9]{16}\.(jpg|jpeg|png|webp|gif)$/.test(hash)) {
      throw new BadRequestException('Invalid image hash format');
    }

    const knowledgePath =
      process.env.RAG_KNOWLEDGE_PATH || '/opt/automecanik/rag/knowledge';
    const imagePath = path.join(knowledgePath, '_raw', 'web-images', hash);

    if (!existsSync(imagePath)) {
      throw new NotFoundException('Image not found');
    }

    const ext = path.extname(hash).slice(1);
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(imagePath);
  }

  // ── Webhook: RAG container → NestJS bridge ─────────────────────

  @Post('webhook/ingestion-complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalApiKeyGuard)
  @ApiOperation({
    summary: 'Webhook called by RAG container after ingestion completes',
  })
  @ApiResponse({
    status: 200,
    description: 'Gammes detected and content-refresh queued',
  })
  @ApiResponse({ status: 403, description: 'Invalid X-Internal-Key' })
  async webhookIngestionComplete(
    @Body()
    body: {
      job_id: string;
      source: 'pdf' | 'web';
      status: 'done' | 'failed';
      files_created?: string[];
    },
  ) {
    if (!body.job_id || !body.source || !body.status) {
      throw new BadRequestException(
        'Missing required fields: job_id, source, status',
      );
    }
    if (!['pdf', 'web'].includes(body.source)) {
      throw new BadRequestException('source must be "pdf" or "web"');
    }
    if (!['done', 'failed'].includes(body.status)) {
      throw new BadRequestException('status must be "done" or "failed"');
    }
    return this.ragProxyService.handleWebhookCompletion(body);
  }

  // ── Cleanup endpoints (RagCleanupService) ─────────────────────

  @Post('admin/cleanup/decide')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Dry-run ingestion decision for a single document' })
  @ApiResponse({ status: 200, description: 'Ingestion decision result' })
  async cleanupDecide(@Body() body: RagDocInput) {
    if (
      !body.title ||
      !body.content ||
      !body.source ||
      !body.domain ||
      !body.category ||
      !body.truth_level
    ) {
      throw new BadRequestException(
        'Missing required fields: title, content, source, domain, category, truth_level',
      );
    }
    return this.ragCleanupService.decideIngest(body);
  }

  @Post('admin/cleanup/apply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({
    summary: 'Apply an ingestion decision (upsert/archive/quarantine)',
  })
  @ApiResponse({ status: 200, description: 'Applied document ID' })
  async cleanupApply(
    @Body() body: { doc: RagDocInput; decision: IngestDecision },
  ) {
    if (!body.doc || !body.decision) {
      throw new BadRequestException('Missing required fields: doc, decision');
    }
    return this.ragCleanupService.applyIngest(body.doc, body.decision);
  }

  @Post('admin/cleanup/batch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({
    summary: 'Batch cleanup scan for exact fingerprint duplicates',
  })
  @ApiResponse({ status: 200, description: 'Cleanup report' })
  async cleanupBatch(@Body() body: { mode?: 'dry' | 'commit' }) {
    const mode = body.mode === 'commit' ? 'commit' : 'dry';
    return this.ragCleanupService.runCleanupBatch(mode);
  }

  @Post('admin/cleanup/backfill-fingerprints')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({
    summary: 'Backfill fingerprints for active docs without one',
  })
  @ApiResponse({ status: 200, description: 'Number of fingerprints computed' })
  async cleanupBackfillFingerprints(@Body() body: { batchSize?: number }) {
    const batchSize = Math.min(body.batchSize ?? 50, 200);
    const updated =
      await this.ragCleanupService.backfillFingerprints(batchSize);
    return { updated, message: `Backfilled ${updated} fingerprints` };
  }

  @Post('admin/cleanup/sync-files')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({
    summary: 'Sync .md files from disk to __rag_knowledge DB',
  })
  @ApiResponse({ status: 200, description: 'Sync report' })
  async cleanupSyncFiles(
    @Body()
    body: {
      /** Glob pattern relative to knowledge base (e.g. "web/2d8006fe60a7-s*.md") */
      pattern: string;
    },
  ) {
    const MAX_FILES = 200;

    if (!body.pattern || body.pattern.length > 256) {
      throw new BadRequestException('pattern must be 1-256 characters');
    }
    if (!/^[a-z0-9._/*?-]+$/i.test(body.pattern)) {
      throw new BadRequestException(
        'Invalid characters in pattern (allowed: a-z 0-9 . _ / * ? -)',
      );
    }

    const knowledgeBasePath =
      process.env.RAG_KNOWLEDGE_PATH || '/opt/automecanik/rag/knowledge';

    const { readdirSync } = await import('node:fs');
    const { join, resolve } = await import('node:path');

    const parts = body.pattern.split('/');
    const dir = join(knowledgeBasePath, parts[0]);

    // Path traversal guard: resolved dir must stay inside knowledgeBasePath
    const resolvedDir = resolve(dir);
    if (!resolvedDir.startsWith(resolve(knowledgeBasePath))) {
      throw new BadRequestException(
        'Invalid directory: path traversal detected',
      );
    }

    // Build regex from glob — escape metacharacters first, then convert * and ?
    const filePattern = parts.slice(1).join('/') || '*';
    const escaped = filePattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    const regex = new RegExp('^' + escaped + '$');

    let files: string[] = [];
    try {
      files = readdirSync(dir)
        .filter((f: string) => regex.test(f) && f.endsWith('.md'))
        .map((f: string) => join(dir, f));
    } catch {
      throw new BadRequestException(`Cannot read directory: ${parts[0]}/`);
    }

    if (files.length > MAX_FILES) {
      throw new BadRequestException(
        `Too many files matched (${files.length} > ${MAX_FILES}). Narrow your pattern.`,
      );
    }

    if (files.length === 0) {
      return { synced: 0, skipped: 0, errors: [], message: 'No files matched' };
    }

    const result = await this.ragCleanupService.syncFilesToDb(
      files,
      knowledgeBasePath,
    );
    return { ...result, filesMatched: files.length };
  }
}
