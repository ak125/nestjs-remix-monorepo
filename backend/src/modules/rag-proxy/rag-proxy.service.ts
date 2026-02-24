import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { SearchRequestDto, SearchResponseDto } from './dto/search.dto';
import {
  PdfIngestSingleRequestDto,
  PdfIngestRunResponseDto,
  PdfIngestJobStatusResponseDto,
} from './dto/pdf-ingest.dto';
import { RagChatService } from './services/rag-chat.service';
import { RagKnowledgeService } from './services/rag-knowledge.service';
import { RagIngestionService } from './services/rag-ingestion.service';
import { RagWebhookCompletionService } from './services/rag-webhook-completion.service';

/** Shape of a web ingestion job stored in Redis. */
export interface WebJob {
  jobId: string;
  url: string;
  status: string;
  truthLevel: string;
  startedAt: number;
  finishedAt: number | null;
  returnCode: number | null;
  logLines: string[];
}

/**
 * Thin facade over the extracted RAG sub-services.
 *
 * Preserves the existing public API so that RagProxyController,
 * content-refresh.processor, and enricher services continue to
 * inject RagProxyService without any change.
 */
@Injectable()
export class RagProxyService {
  constructor(
    private readonly chatService: RagChatService,
    private readonly knowledgeService: RagKnowledgeService,
    private readonly ingestionService: RagIngestionService,
    private readonly webhookService: RagWebhookCompletionService,
  ) {}

  // ── Chat ──

  chat(request: ChatRequestDto): Promise<ChatResponseDto> {
    return this.chatService.chat(request);
  }

  chatStream(request: ChatRequestDto, res: Response): Promise<void> {
    return this.chatService.chatStream(request, res);
  }

  getIntentStats() {
    return this.chatService.getIntentStats();
  }

  // ── Knowledge / Search ──

  search(request: SearchRequestDto): Promise<SearchResponseDto> {
    return this.knowledgeService.search(request);
  }

  getKnowledgeDoc(docId: string) {
    return this.knowledgeService.getKnowledgeDoc(docId);
  }

  listKnowledgeDocs(prefix?: string) {
    return this.knowledgeService.listKnowledgeDocs(prefix);
  }

  listKnowledgeDocsFull(prefix?: string) {
    return this.knowledgeService.listKnowledgeDocsFull(prefix);
  }

  getCorpusStats() {
    return this.knowledgeService.getCorpusStats();
  }

  listIngestionJobs() {
    return this.knowledgeService.listIngestionJobs();
  }

  health() {
    return this.knowledgeService.health();
  }

  // ── Ingestion ──

  ingestSinglePdf(
    request: PdfIngestSingleRequestDto,
  ): Promise<PdfIngestRunResponseDto> {
    return this.ingestionService.ingestSinglePdf(request);
  }

  getSinglePdfJobStatus(
    jobId: string,
    tailLines?: number,
  ): Promise<PdfIngestJobStatusResponseDto> {
    return this.ingestionService.getSinglePdfJobStatus(jobId, tailLines);
  }

  ingestWebUrl(request: {
    url?: string;
    truthLevel?: string;
  }): Promise<{ jobId: string; status: string }> {
    return this.ingestionService.ingestWebUrl(request);
  }

  // ── Webhook / Admin ──

  handleWebhookCompletion(dto: {
    job_id: string;
    source: 'pdf' | 'web';
    status: 'done' | 'failed';
    files_created?: string[];
  }) {
    return this.webhookService.handleWebhookCompletion(dto);
  }

  async listWebJobs(): Promise<Omit<WebJob, 'logLines'>[]> {
    return this.webhookService.listWebJobs();
  }

  async getWebJob(jobId: string): Promise<WebJob | null> {
    return this.webhookService.getWebJob(jobId);
  }

  listImages() {
    return this.webhookService.listImages();
  }

  describeImage(hash: string) {
    return this.webhookService.describeImage(hash);
  }
}
