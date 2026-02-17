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
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { RagProxyService } from './rag-proxy.service';
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
import { existsSync } from 'node:fs';
import path from 'node:path';

@ApiTags('RAG')
@Controller('api/rag')
export class RagProxyController {
  constructor(private readonly ragProxyService: RagProxyService) {}

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
  @ApiOperation({ summary: 'List all web URL ingestion jobs' })
  @ApiResponse({ status: 200, description: 'List of web ingestion jobs' })
  listWebJobs() {
    return this.ragProxyService.listWebJobs();
  }

  @Get('admin/ingest/web/jobs/:jobId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Get web URL ingest job status and logs' })
  @ApiResponse({ status: 200, description: 'Job status with logs' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  getWebJobStatus(@Param('jobId') jobId: string) {
    const job = this.ragProxyService.getWebJob(jobId);
    if (!job) throw new NotFoundException('Web ingest job not found');
    return job;
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
}
