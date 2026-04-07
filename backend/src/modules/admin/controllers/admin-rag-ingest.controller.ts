import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { PdfTextExtractorService } from '../../rag-proxy/services/pdf-text-extractor.service';
import { PdfRagClassifierService } from '../../rag-proxy/services/pdf-rag-classifier.service';
import { RagMdMergerService } from '../../rag-proxy/services/rag-md-merger.service';
import { RagGammeDetectionService } from '../../rag-proxy/services/rag-gamme-detection.service';
import { RagCleanupService } from '../../rag-proxy/services/rag-cleanup.service';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';

/**
 * Admin endpoints for the PDF → RAG merge pipeline.
 *
 * Flow: PDF upload → text extraction → LLM classification → merge into .md
 * Content generation is handled by /content-gen skill (not automated pipeline).
 */
@Controller('api/admin/rag/pdf-merge')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminRagIngestController {
  private readonly logger = new Logger(AdminRagIngestController.name);

  constructor(
    private readonly pdfExtractor: PdfTextExtractorService,
    private readonly pdfClassifier: PdfRagClassifierService,
    private readonly ragMerger: RagMdMergerService,
    private readonly gammeDetection: RagGammeDetectionService,
    private readonly ragCleanupService: RagCleanupService,
  ) {}

  /**
   * Preview: extract PDF text + classify into a merge-patch (no disk write).
   */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async preview(
    @Body()
    dto: {
      pdfPath: string;
      pgAlias: string;
      truthLevel?: string;
      sourceRef?: string;
    },
  ) {
    const truthLevel = dto.truthLevel || 'L2';
    const sourceRef = dto.sourceRef || `pdf-${Date.now().toString(36)}`;

    // 1. Extract text
    const extractResult = await this.pdfExtractor.extractText(dto.pdfPath);
    this.logger.log(
      `PDF extracted: ${extractResult.pages.length} pages, ${extractResult.fullText.length} chars`,
    );

    // 2. Classify via LLM
    const patch = await this.pdfClassifier.classify(
      extractResult.fullText,
      dto.pgAlias,
      truthLevel,
      sourceRef,
    );

    return {
      status: 'preview',
      pgAlias: dto.pgAlias,
      extractedChars: extractResult.fullText.length,
      pages: extractResult.pages.length,
      patch,
    };
  }

  /**
   * Apply: extract + classify + merge .md + sync to DB.
   * Content generation: use /content-gen skill after apply.
   */
  @Post('apply')
  @HttpCode(HttpStatus.OK)
  async apply(
    @Body()
    dto: {
      pdfPath: string;
      pgAlias: string;
      truthLevel?: string;
      sourceRef?: string;
    },
  ) {
    const truthLevel = dto.truthLevel || 'L2';
    const sourceRef = dto.sourceRef || `pdf-${Date.now().toString(36)}`;

    // 1. Extract text
    const extractResult = await this.pdfExtractor.extractText(dto.pdfPath);

    // 2. Classify via LLM
    const patch = await this.pdfClassifier.classify(
      extractResult.fullText,
      dto.pgAlias,
      truthLevel,
      sourceRef,
    );

    // 3. Merge into .md
    const mergeResult = this.ragMerger.merge(dto.pgAlias, patch);

    // 3b. Sync merged .md to __rag_knowledge DB (non-blocking — merge already succeeded)
    const knowledgeBasePath = RAG_KNOWLEDGE_PATH;
    let syncResult: { synced: number; skipped: number; errors: string[] } = {
      synced: 0,
      skipped: 0,
      errors: [],
    };
    try {
      syncResult = await this.ragCleanupService.syncFilesToDb(
        [mergeResult.filePath],
        knowledgeBasePath,
      );
      this.logger.log(
        `DB sync for ${dto.pgAlias}: ${syncResult.synced} synced, ${syncResult.skipped} skipped`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`DB sync failed for ${dto.pgAlias}: ${msg}`);
      syncResult.errors.push(msg);
    }

    // 4. Emit ingestion completed event (for audit trail)
    const ragFilePath = mergeResult.filePath;
    await this.gammeDetection.emitIngestionCompleted(
      `pdf-merge-${Date.now()}`,
      'pdf',
      { valid: [ragFilePath], quarantined: [] },
    );

    this.logger.log(
      `RAG merged for ${dto.pgAlias}. Use /content-gen skill to generate content.`,
    );

    return {
      status: 'applied',
      pgAlias: dto.pgAlias,
      extractedChars: extractResult.fullText.length,
      mergedFile: mergeResult.filePath,
      dbSync: syncResult,
      message: 'RAG merged. Use /content-gen skill to generate content.',
    };
  }

  /**
   * Force-enrich: no longer queues automated pipeline.
   * Use /content-gen skill instead.
   */
  @Post('force-enrich')
  @HttpCode(HttpStatus.OK)
  async forceEnrich(
    @Body() dto: { pgAlias: string; sectionsFilter?: string[] },
  ) {
    this.logger.log(
      `Force-enrich requested for ${dto.pgAlias} — use /content-gen skill instead`,
    );

    return {
      status: 'pipeline_removed',
      pgAlias: dto.pgAlias,
      message:
        'Content refresh pipeline removed. Use /content-gen skill to generate content.',
    };
  }
}
