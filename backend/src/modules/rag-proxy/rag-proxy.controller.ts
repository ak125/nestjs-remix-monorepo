import {
  Controller,
  Post,
  Get,
  Delete,
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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { RagProxyService } from './rag-proxy.service';
import { RagCleanupService } from './services/rag-cleanup.service';
import { RagImageManagementService } from './services/rag-image-management.service';
import { RagVideoManagementService } from './services/rag-video-management.service';
import { RagGammeDetectionService } from './services/rag-gamme-detection.service';
import { RagPhase2aShadowAuditService } from './services/rag-phase2a-shadow-audit.service';
import { WebhookAuditService } from './services/webhook-audit.service';
import type { Phase2aArtifactType } from './types/rag-phase2a.types';
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
  WebhookIngestionCompleteSchema,
  WebhookIngestionCompleteDto,
} from './dto/webhook-ingest.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { InternalApiKeyGuard } from '../../auth/internal-api-key.guard';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { RAG_KNOWLEDGE_PATH } from '../../config/rag.config';

@ApiTags('RAG')
@Controller('api/rag')
export class RagProxyController {
  constructor(
    private readonly ragProxyService: RagProxyService,
    private readonly ragCleanupService: RagCleanupService,
    private readonly ragImageManagementService: RagImageManagementService,
    private readonly ragVideoManagementService: RagVideoManagementService,
    private readonly ragGammeDetectionService: RagGammeDetectionService,
    private readonly ragPhase2aShadowAuditService: RagPhase2aShadowAuditService,
    private readonly webhookAuditService: WebhookAuditService,
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
    return this.ragProxyService.listKnowledgeDocsFromDb(prefix);
  }

  @Get('admin/knowledge/doc/:docId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Get a single knowledge document by ID' })
  @ApiResponse({ status: 200, description: 'Document content and metadata' })
  async getKnowledgeDoc(@Param('docId') docId: string) {
    return this.ragProxyService.getKnowledgeDocFromDb(docId);
  }

  @Get('admin/gamme-coverage')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Get RAG document coverage per active gamme' })
  @ApiResponse({
    status: 200,
    description: 'List of gammes with RAG doc count',
  })
  async getGammeCoverage() {
    return this.ragProxyService.getGammeCoverage();
  }

  @Get('admin/gamme-slugs')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'List all valid gamme slugs (for autocomplete)' })
  @ApiResponse({ status: 200, description: 'Array of slug strings' })
  async getGammeSlugs() {
    return this.ragGammeDetectionService.getKnownGammeAliases(
      RAG_KNOWLEDGE_PATH,
    );
  }

  @Get('admin/corpus/stats')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Get corpus statistics for admin dashboard' })
  @ApiResponse({ status: 200, description: 'Corpus stats' })
  async getCorpusStats() {
    return this.ragProxyService.getCorpusStats();
  }

  /** List all RAG knowledge images (admin only). */
  @Get('admin/images')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'List all RAG knowledge images' })
  @ApiResponse({ status: 200, description: 'Array of image metadata' })
  listImages() {
    return this.ragProxyService.listImages();
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

  @Delete('admin/images/:hash')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Delete a RAG image and its .prompt.md sidecar' })
  @ApiResponse({ status: 200, description: 'Image deleted' })
  async deleteImage(@Param('hash') hash: string) {
    return this.ragImageManagementService.deleteImage(hash);
  }

  @Post('admin/images/bulk-reassign')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Bulk reassign images from one gamme to another' })
  async bulkReassignImages(
    @Body() body: { hashes: string[]; fromGamme: string; toGamme: string },
  ) {
    if (!body.hashes?.length || !body.fromGamme || !body.toGamme) {
      throw new BadRequestException(
        'hashes, fromGamme, and toGamme are required',
      );
    }
    return this.ragImageManagementService.reassignImageGammes(
      body.hashes,
      body.fromGamme,
      body.toGamme,
    );
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

    const knowledgePath = RAG_KNOWLEDGE_PATH;
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

  // ── Video management endpoints ─────────────────────────────────

  @Get('admin/videos')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'List all RAG videos with metadata' })
  async listVideos() {
    return this.ragVideoManagementService.listVideos();
  }

  @Post('admin/ingest/video/single')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Ingest a video from URL (yt-dlp)' })
  async ingestVideoUrl(
    @Body() body: { url: string; gamme?: string; type?: string },
  ) {
    if (!body.url) {
      throw new BadRequestException('url is required');
    }
    return this.ragVideoManagementService.ingestVideoUrl(body.url, {
      gamme: body.gamme,
      type: body.type,
    });
  }

  @Post('admin/videos/assign')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Assign gamme to a video' })
  async assignVideo(@Body() body: { hash: string; gamme: string }) {
    if (!body.hash || !body.gamme) {
      throw new BadRequestException('hash and gamme are required');
    }
    const count = this.ragVideoManagementService.enrichVideoPrompts(
      [body.hash],
      body.gamme,
    );
    return { success: true, enriched: count };
  }

  @Delete('admin/videos/:hash')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Delete a RAG video and its sidecars' })
  async deleteVideo(@Param('hash') hash: string) {
    return this.ragVideoManagementService.deleteVideo(hash);
  }

  @Get('videos/:hashWithExt')
  @ApiOperation({ summary: 'Stream a RAG video by hash' })
  async serveVideo(
    @Param('hashWithExt') hashWithExt: string,
    @Res() res: Response,
  ): Promise<void> {
    this.ragVideoManagementService.streamVideo(hashWithExt, res);
  }

  // ── Webhook: RAG container → NestJS bridge ─────────────────────

  @Post('webhook/ingestion-complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalApiKeyGuard)
  @UsePipes(new ZodValidationPipe(WebhookIngestionCompleteSchema))
  @ApiOperation({
    summary: 'Webhook called by RAG container after ingestion completes',
  })
  @ApiResponse({
    status: 200,
    description: 'Gammes detected and content-refresh queued',
  })
  @ApiResponse({ status: 403, description: 'Invalid X-Internal-Key' })
  async webhookIngestionComplete(@Body() body: WebhookIngestionCompleteDto) {
    return this.ragProxyService.handleWebhookCompletion(body);
  }

  @Get('admin/webhook-audit')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({
    summary: 'List recent ingestion webhook audit records (read-only)',
  })
  @ApiResponse({ status: 200, description: 'Recent webhook audit entries' })
  async getWebhookAudit(@Query('limit') limit?: string) {
    const parsedLimit = Number.parseInt(limit || '30', 10);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(100, Math.max(1, parsedLimit))
      : 30;
    return this.webhookAuditService.getRecentWebhooks(safeLimit, 0);
  }

  @Get('admin/webhook-stats')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({
    summary: 'Aggregated ingestion webhook stats over last N days (read-only)',
  })
  @ApiResponse({ status: 200, description: 'Webhook stats' })
  async getWebhookStats(@Query('days') days?: string) {
    const parsedDays = Number.parseInt(days || '7', 10);
    const safeDays = Number.isFinite(parsedDays)
      ? Math.min(90, Math.max(1, parsedDays))
      : 7;
    return this.webhookAuditService.getWebhookStats(safeDays);
  }

  // ── Gamme detection admin ─────────────────────

  @Post('admin/gamme-detection/rerun')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({
    summary: 'Re-run gamme detection on orphan entries and optionally persist',
  })
  @ApiResponse({ status: 200, description: 'Detection results' })
  async rerunGammeDetection(
    @Body() body: { dryRun?: boolean; subDir?: string },
  ) {
    return this.ragGammeDetectionService.rerunDetection({
      dryRun: body.dryRun ?? true,
      subDir: body.subDir,
    });
  }

  @Post('admin/gamme-detection/map-orphans')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({
    summary: 'Map transversal orphans (diagnostic, guides) to gamme aliases',
  })
  @ApiResponse({ status: 200, description: 'Orphan mapping results' })
  async mapTransversalOrphans(@Body() body: { dryRun?: boolean }) {
    return this.ragGammeDetectionService.mapTransversalOrphans({
      dryRun: body.dryRun ?? true,
    });
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

    const knowledgeBasePath = RAG_KNOWLEDGE_PATH;

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

  // ── Pipeline endpoints RETIRÉS — rag-purge B8 (ADR-031/046) ──────────
  // Les endpoints admin/pipeline/* (launch/status/runs/logs/cancel) pilotaient
  // RagPipelineService = ingestion/reindex RAG « propre » (spawn de scripts → Weaviate).
  // Architecture cible : RAG = consommateur du wiki, pour le chat seulement ; sa seule
  // entrée d'ingestion = le sync wiki→rag (scripts/rag-sync/sync-wiki-exports-to-rag.py).
  // L'application ne déclenche plus aucune ingestion RAG. RagPipelineService est conservé
  // pour salvage (bannerisé, non câblé) — voir rag-pipeline.service.ts.

  // ── Phase 2A — Legacy Adapted Shadow Audit ──────────────

  @Post('phase2a/audit')
  @UseGuards(IsAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run Phase 2A shadow audit (legacy→canonical projection)',
  })
  @ApiResponse({ status: 200, description: 'Audit report' })
  async runPhase2aAudit(
    @Body()
    body?: Record<string, unknown>,
  ) {
    return this.ragPhase2aShadowAuditService.runAudit(
      body as
        | { artifactTypes?: Phase2aArtifactType[]; dryRun?: boolean }
        | undefined,
    );
  }
}
