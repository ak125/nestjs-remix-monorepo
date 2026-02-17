import {
  Injectable,
  HttpException,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ExternalServiceException } from '../../common/exceptions';
import { ConfigService } from '@nestjs/config';
import { promises as fs, readdirSync, statSync, readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import path from 'node:path';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { SearchRequestDto, SearchResponseDto } from './dto/search.dto';
import {
  PdfIngestSingleRequestDto,
  PdfIngestRunResponseDto,
  PdfIngestJobStatusResponseDto,
} from './dto/pdf-ingest.dto';
import { getErrorMessage } from '../../common/utils/error.utils';
import {
  RAG_INGESTION_COMPLETED,
  type RagIngestionCompletedEvent,
} from './events/rag-ingestion.events';

/** Simple circuit breaker state for the RAG external service. */
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const CB_THRESHOLD = 5; // failures before opening
const CB_RESET_MS = 30_000; // 30s before half-open probe

@Injectable()
export class RagProxyService {
  private readonly logger = new Logger(RagProxyService.name);
  private readonly ragUrl: string;
  private readonly ragApiKey: string;
  private readonly ragPdfDropHostRoot: string;
  private readonly ragPdfDropContainerRoot: string;
  private readonly cb: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    state: 'closed',
  };
  private readonly supportedUserIntents = [
    'define',
    'choose',
    'do',
    'maintain',
    'compare',
    'cost',
    'policy',
    'troubleshoot',
    'fitment',
  ] as const;
  private readonly intentStats = new Map<
    string,
    { count: number; confidenceSum: number; lastSeenAt: string }
  >();

  /** In-memory store for web ingestion jobs (survives until server restart). */
  private readonly webJobs = new Map<
    string,
    {
      jobId: string;
      url: string;
      status: string;
      truthLevel: string;
      startedAt: number;
      finishedAt: number | null;
      returnCode: number | null;
      logLines: string[];
    }
  >();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // URL externe obligatoire - le RAG est sur un serveur SÉPARÉ (pas Docker local)
    this.ragUrl = this.configService.getOrThrow<string>('RAG_SERVICE_URL');
    this.ragApiKey = this.configService.getOrThrow<string>('RAG_API_KEY');
    this.ragPdfDropHostRoot =
      process.env.RAG_PDF_DROP_HOST_ROOT || '/opt/automecanik/rag/pdfs';
    this.ragPdfDropContainerRoot =
      process.env.RAG_PDF_DROP_CONTAINER_ROOT || '/app/pdfs';

    this.logger.log(`RAG Service URL: ${this.ragUrl}`);
    this.logger.log(`RAG PDF staging host root: ${this.ragPdfDropHostRoot}`);
  }

  /** Check circuit breaker before calling RAG service. Throws if open. */
  private cbGuard(): void {
    if (this.cb.state === 'open') {
      if (Date.now() - this.cb.lastFailure > CB_RESET_MS) {
        this.cb.state = 'half-open';
        this.logger.log('Circuit breaker → half-open (probing RAG service)');
      } else {
        throw new ExternalServiceException({
          message:
            'Le service RAG est temporairement indisponible. Réessayez dans quelques secondes.',
          serviceName: 'rag',
          code: 'EXTERNAL.CIRCUIT_OPEN',
        });
      }
    }
  }

  /** Record a successful call — resets the circuit breaker. */
  private cbSuccess(): void {
    if (this.cb.state !== 'closed') {
      this.logger.log('Circuit breaker → closed (RAG service recovered)');
    }
    this.cb.failures = 0;
    this.cb.state = 'closed';
  }

  /** Record a failed call — may open the circuit breaker. */
  private cbFailure(): void {
    this.cb.failures++;
    this.cb.lastFailure = Date.now();
    if (this.cb.failures >= CB_THRESHOLD) {
      this.cb.state = 'open';
      this.logger.warn(
        `Circuit breaker → open after ${this.cb.failures} failures (cooldown ${CB_RESET_MS}ms)`,
      );
    }
  }

  /**
   * Forward chat request to RAG service.
   */
  async chat(request: ChatRequestDto): Promise<ChatResponseDto> {
    this.cbGuard();
    const startTime = Date.now();
    try {
      const existingRouting = this.extractRoutingFromContext(request.context);
      const routing = existingRouting || this.classifyIntent(request.message);
      const vehicleContext = {
        ...(request.context || {}),
        intent_routing: routing,
      };

      const response = await fetch(`${this.ragUrl}/chat/v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RAG-API-Key': this.ragApiKey,
        },
        body: JSON.stringify({
          message: request.message,
          session_id: request.sessionId,
          locale: 'fr',
          vehicle_context: vehicleContext,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `RAG service error: ${response.status} - ${errorText}`,
        );
        throw new ExternalServiceException({
          message: 'RAG service error',
          serviceName: 'rag',
        });
      }

      const data = await response.json();

      this.cbSuccess();
      const duration = Date.now() - startTime;
      const confidence = data.truth_metadata?.composite_confidence ?? 0;
      this.recordIntentMetric(routing.userIntent, confidence);
      this.logger.log(
        `RAG chat: ${duration}ms | user_intent=${routing.userIntent} | family=${routing.intentFamily} | guardrails=${data.passed_guardrails} | type=${data.query_type} | confidence=${data.truth_metadata?.composite_confidence}`,
      );
      if (duration > 3000) {
        this.logger.warn(
          `RAG response slow: ${duration}ms (threshold: 3000ms)`,
        );
      }

      return {
        answer: data.response || '',
        sources: data.sources || [],
        sessionId: data.session_id,
        confidence,
        citations: data.citations || [],
        queryType: data.query_type || null,
        passedGuardrails: data.passed_guardrails ?? false,
        refusalReason: data.refusal_reason || null,
        responseMode:
          (data.response_mode as 'answer' | 'partial' | 'clarify') ||
          (data.clarify_questions?.length ? 'clarify' : 'answer'),
        needsClarification:
          Boolean(data.needs_clarification) ||
          Boolean(data.truth_metadata?.needs_clarification) ||
          (Array.isArray(data.clarify_questions) &&
            data.clarify_questions.length > 0),
        clarifyQuestions: Array.isArray(data.clarify_questions)
          ? data.clarify_questions.slice(0, 2)
          : [],
        sourcesCitation:
          typeof data.sources_citation === 'string'
            ? data.sources_citation
            : '',
        truthMetadata:
          data.truth_metadata && typeof data.truth_metadata === 'object'
            ? data.truth_metadata
            : {},
      };
    } catch (error) {
      if (error instanceof HttpException) {
        // Circuit-open exceptions are HttpExceptions — don't count them again
        if (
          !(
            error instanceof ExternalServiceException &&
            error.code === 'EXTERNAL.CIRCUIT_OPEN'
          )
        ) {
          this.cbFailure();
        }
        throw error;
      }

      this.cbFailure();
      this.logger.error(
        `Failed to call RAG service: ${getErrorMessage(error)}`,
      );
      throw new ExternalServiceException({
        message: 'Failed to connect to RAG service',
        serviceName: 'rag',
      });
    }
  }

  /**
   * Stream chat response via SSE.
   * Calls /chat/v2 (blocking), then emits the response progressively.
   */
  async chatStream(request: ChatRequestDto, res: Response): Promise<void> {
    try {
      const chatResponse = await this.chat(request);

      // Metadata first (immediate)
      this.sseWrite(res, 'metadata', {
        sessionId: chatResponse.sessionId,
        queryType: chatResponse.queryType,
        confidence: chatResponse.confidence,
        responseMode: chatResponse.responseMode || 'answer',
        needsClarification: chatResponse.needsClarification || false,
        clarifyQuestions: chatResponse.clarifyQuestions || [],
        sourcesCitation: chatResponse.sourcesCitation || '',
        truthMetadata: chatResponse.truthMetadata || {},
      });

      // Stream answer word-by-word
      const words = chatResponse.answer.split(/(\s+)/);
      for (const word of words) {
        if (word) {
          this.sseWrite(res, 'chunk', { text: word });
          await this.delay(30);
        }
      }

      // Sources after text
      if (chatResponse.sources?.length) {
        this.sseWrite(res, 'sources', { sources: chatResponse.sources });
      }

      // Done
      this.sseWrite(res, 'done', { confidence: chatResponse.confidence });
      res.end();
    } catch (error) {
      this.logger.error(`SSE stream error: ${getErrorMessage(error)}`);
      this.sseWrite(res, 'error', { message: 'Service indisponible' });
      res.end();
    }
  }

  private sseWrite(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractRoutingFromContext(
    context: ChatRequestDto['context'] | undefined,
  ): {
    userIntent: string;
    intentFamily: string;
    pageIntent: string;
  } | null {
    if (!context || typeof context !== 'object') {
      return null;
    }
    const routing = (context as Record<string, unknown>).intent_routing;
    if (!routing || typeof routing !== 'object') {
      return null;
    }
    const userIntent = (routing as Record<string, unknown>).userIntent;
    const intentFamily = (routing as Record<string, unknown>).intentFamily;
    const pageIntent = (routing as Record<string, unknown>).pageIntent;
    if (
      typeof userIntent !== 'string' ||
      typeof intentFamily !== 'string' ||
      typeof pageIntent !== 'string'
    ) {
      return null;
    }
    return { userIntent, intentFamily, pageIntent };
  }

  private classifyIntent(message: string): {
    userIntent: string;
    intentFamily: string;
    pageIntent: string;
  } {
    const text = message.trim().toLowerCase();
    const has = (patterns: RegExp[]) => patterns.some((p) => p.test(text));

    const map = (
      userIntent: string,
      intentFamily: string,
      pageIntent: string,
    ) => ({
      userIntent,
      intentFamily,
      pageIntent,
    });

    if (
      has([
        /\bcompatibilite\b/,
        /\bcompatible\b/,
        /\bvin\b/,
        /\bimmatriculation\b/,
        /\bmon vehicule\b/,
      ])
    ) {
      return map('fitment', 'catalog', 'selection');
    }

    if (
      has([
        /\bdiagnosti/,
        /\bpanne\b/,
        /\bsymptome\b/,
        /\bbruit\b/,
        /\bvibration\b/,
        /\bvoyant\b/,
        /\bne demarre pas\b/,
      ])
    ) {
      return map('troubleshoot', 'diagnostic', 'diagnosis');
    }

    if (
      has([
        /\blivraison\b/,
        /\bretour\b/,
        /\bgaranti/,
        /\brembourse/,
        /\bcgv\b/,
        /\bdelai\b/,
      ])
    ) {
      return map('policy', 'knowledge', 'support');
    }

    if (
      has([/\bprix\b/, /\bcout\b/, /\bcombien\b/, /\btarif\b/, /\bpromo\b/])
    ) {
      return map('cost', 'catalog', 'purchase');
    }

    if (
      has([
        /\bcompar/,
        /\bdifference\b/,
        /\bversus\b/,
        /\bvs\b/,
        /\bmeilleur\b/,
      ])
    ) {
      return map('compare', 'knowledge', 'education');
    }

    if (
      has([
        /\bentretien\b/,
        /\bmaintenance\b/,
        /\bintervalle\b/,
        /\bquand changer\b/,
        /\bfrequence\b/,
      ])
    ) {
      return map('maintain', 'knowledge', 'education');
    }

    if (
      has([
        /\bcomment faire\b/,
        /\bcomment remplacer\b/,
        /\btutoriel\b/,
        /\bhow to\b/,
        /\binstaller\b/,
        /\bmonter\b/,
      ])
    ) {
      return map('do', 'knowledge', 'education');
    }

    if (
      has([
        /\bc'?est quoi\b/,
        /\bdefinition\b/,
        /\bque signifie\b/,
        /\bveut dire\b/,
      ])
    ) {
      return map('define', 'knowledge', 'definition');
    }

    return map('choose', 'catalog', 'selection');
  }

  private recordIntentMetric(userIntent: string, confidence: number): void {
    const now = new Date().toISOString();
    const key = this.supportedUserIntents.includes(userIntent as never)
      ? userIntent
      : 'choose';
    const previous = this.intentStats.get(key) || {
      count: 0,
      confidenceSum: 0,
      lastSeenAt: now,
    };
    this.intentStats.set(key, {
      count: previous.count + 1,
      confidenceSum: previous.confidenceSum + confidence,
      lastSeenAt: now,
    });
  }

  getIntentStats(): {
    totalMessages: number;
    generatedAt: string;
    intents: Array<{
      userIntent: string;
      volume: number;
      averageConfidence: number;
      lastSeenAt: string | null;
    }>;
  } {
    const intents = this.supportedUserIntents.map((intent) => {
      const stat = this.intentStats.get(intent);
      if (!stat) {
        return {
          userIntent: intent,
          volume: 0,
          averageConfidence: 0,
          lastSeenAt: null,
        };
      }
      return {
        userIntent: intent,
        volume: stat.count,
        averageConfidence: stat.count > 0 ? stat.confidenceSum / stat.count : 0,
        lastSeenAt: stat.lastSeenAt,
      };
    });

    return {
      totalMessages: intents.reduce((sum, item) => sum + item.volume, 0),
      generatedAt: new Date().toISOString(),
      intents,
    };
  }

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

      // Start polling for completion → emit RAG_INGESTION_COMPLETED
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

  /**
   * Forward search request to RAG service.
   */
  async search(request: SearchRequestDto): Promise<SearchResponseDto> {
    this.cbGuard();
    try {
      const response = await fetch(`${this.ragUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RAG-API-Key': this.ragApiKey,
        },
        body: JSON.stringify({
          query: request.query,
          limit: request.limit || 10,
          filters: request.filters,
        }),
      });

      if (!response.ok) {
        throw new ExternalServiceException({
          message: 'RAG search error',
          serviceName: 'rag',
        });
      }

      const data = await response.json();

      this.cbSuccess();
      const normalizedResults = Array.isArray(data.results)
        ? data.results.map((result: Record<string, unknown>) => ({
            ...result,
            sourcePath:
              (result.sourcePath as string) ||
              (result.source_path as string) ||
              '',
            sourceType:
              (result.sourceType as string) ||
              (result.source_type as string) ||
              '',
          }))
        : [];

      return {
        results: normalizedResults,
        query: data.query || request.query,
        total: data.total || 0,
        response_mode: data.response_mode || 'answer',
        needs_clarification: Boolean(data.needs_clarification),
        clarify_questions: Array.isArray(data.clarify_questions)
          ? data.clarify_questions.slice(0, 2)
          : [],
        sources_citation:
          typeof data.sources_citation === 'string'
            ? data.sources_citation
            : '',
        truth_metadata:
          data.truth_metadata && typeof data.truth_metadata === 'object'
            ? data.truth_metadata
            : {},
      };
    } catch (error) {
      if (error instanceof HttpException) {
        if (
          !(
            error instanceof ExternalServiceException &&
            error.code === 'EXTERNAL.CIRCUIT_OPEN'
          )
        ) {
          this.cbFailure();
        }
        throw error;
      }

      this.cbFailure();
      this.logger.error(`Failed to call RAG search: ${getErrorMessage(error)}`);
      throw new ExternalServiceException({
        message: 'Failed to connect to RAG service',
        serviceName: 'rag',
      });
    }
  }

  /**
   * Fetch a full knowledge document by ID (not chunked).
   * Example: getKnowledgeDoc('gammes.disque-de-frein')
   */
  async getKnowledgeDoc(docId: string): Promise<{
    id: string;
    content: string;
    source_path: string;
    truth_level: string;
    verification_status: string;
  }> {
    this.cbGuard();
    try {
      const response = await fetch(
        `${this.ragUrl}/api/knowledge/${encodeURIComponent(docId)}`,
        {
          headers: { 'X-RAG-API-Key': this.ragApiKey },
        },
      );

      if (!response.ok) {
        throw new Error(`Knowledge doc ${docId} not found: ${response.status}`);
      }

      const data = await response.json();
      this.cbSuccess();
      return data;
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.cbFailure();
      }
      this.logger.error(
        `Failed to fetch knowledge doc ${docId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * List all knowledge document IDs, optionally filtered by prefix.
   * Example: listKnowledgeDocs('guides.') → ['guides.choisir-disques-frein', ...]
   */
  async listKnowledgeDocs(prefix?: string): Promise<string[]> {
    this.cbGuard();
    try {
      const response = await fetch(`${this.ragUrl}/api/knowledge?limit=500`, {
        headers: { 'X-RAG-API-Key': this.ragApiKey },
      });

      if (!response.ok) {
        throw new Error(`Failed to list knowledge docs: ${response.status}`);
      }

      const data = await response.json();
      this.cbSuccess();

      // Extract IDs from the response (array of doc objects)
      const docs: Array<{ id?: string; doc_id?: string }> = Array.isArray(data)
        ? data
        : data?.documents || data?.results || [];
      const ids = docs.map((d) => d.id || d.doc_id || '').filter(Boolean);

      if (prefix) {
        return ids.filter((id) => id.startsWith(prefix));
      }
      return ids;
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.cbFailure();
      }
      this.logger.error(
        `Failed to list knowledge docs: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * List all knowledge documents with full metadata.
   * Returns array of document objects (not just IDs).
   */
  async listKnowledgeDocsFull(prefix?: string): Promise<
    Array<{
      id: string;
      title: string;
      doc_family: string;
      source_type: string;
      category: string;
      truth_level: string;
      verification_status: string;
    }>
  > {
    this.cbGuard();
    try {
      const response = await fetch(`${this.ragUrl}/api/knowledge?limit=500`, {
        headers: { 'X-RAG-API-Key': this.ragApiKey },
      });

      if (!response.ok) {
        throw new Error(`Failed to list knowledge docs: ${response.status}`);
      }

      const data = await response.json();
      this.cbSuccess();

      const docs: Array<Record<string, unknown>> = Array.isArray(data)
        ? data
        : data?.documents || data?.results || [];

      const mapped = docs.map((d) => ({
        id: String(d.id || d.doc_id || ''),
        title: String(d.title || d.id || ''),
        doc_family: String(d.doc_family || ''),
        source_type: String(d.source_type || ''),
        category: String(d.category || ''),
        truth_level: String(d.truth_level || 'L3'),
        verification_status: String(d.verification_status || 'pending'),
      }));

      if (prefix) {
        return mapped.filter((d) => d.id.startsWith(prefix));
      }
      return mapped;
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.cbFailure();
      }
      this.logger.error(
        `Failed to list knowledge docs (full): ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get corpus stats for the admin dashboard.
   */
  async getCorpusStats(): Promise<{
    total: number;
    byTruthLevel: Record<string, number>;
    byDocFamily: Record<string, number>;
    bySourceType: Record<string, number>;
    ragStatus: 'up' | 'down';
  }> {
    try {
      const docs = await this.listKnowledgeDocsFull();

      const byTruthLevel: Record<string, number> = {};
      const byDocFamily: Record<string, number> = {};
      const bySourceType: Record<string, number> = {};

      for (const doc of docs) {
        byTruthLevel[doc.truth_level] =
          (byTruthLevel[doc.truth_level] || 0) + 1;
        if (doc.doc_family) {
          byDocFamily[doc.doc_family] = (byDocFamily[doc.doc_family] || 0) + 1;
        }
        if (doc.source_type) {
          bySourceType[doc.source_type] =
            (bySourceType[doc.source_type] || 0) + 1;
        }
      }

      return {
        total: docs.length,
        byTruthLevel,
        byDocFamily,
        bySourceType,
        ragStatus: 'up',
      };
    } catch {
      return {
        total: 0,
        byTruthLevel: {},
        byDocFamily: {},
        bySourceType: {},
        ragStatus: 'down',
      };
    }
  }

  /**
   * List ingestion jobs from RAG service.
   */
  async listIngestionJobs(): Promise<
    Array<{
      jobId: string;
      status: string;
      startedAt: number | null;
      finishedAt: number | null;
      returnCode: number | null;
    }>
  > {
    try {
      const response = await fetch(`${this.ragUrl}/admin/ingest/pdf/jobs`, {
        headers: { 'X-RAG-API-Key': this.ragApiKey },
      });

      if (!response.ok) {
        this.logger.warn(`Failed to list ingest jobs: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const jobs: Array<Record<string, unknown>> = Array.isArray(data)
        ? data
        : data?.jobs || [];

      return jobs.map((j) => ({
        jobId: String(j.job_id || j.jobId || ''),
        status: String(j.status || 'unknown'),
        startedAt: (j.started_at as number) ?? null,
        finishedAt: (j.finished_at as number) ?? null,
        returnCode: (j.return_code as number) ?? null,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to list ingest jobs: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  /**
   * Check RAG service health.
   */
  async health(): Promise<{
    status: string;
    services: Record<string, unknown>;
  }> {
    try {
      const response = await fetch(`${this.ragUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          status: 'unhealthy',
          services: {
            rag: { status: 'down', error: `HTTP ${response.status}` },
          },
        };
      }

      const result = await response.json();

      // Enrich with corpus stats
      try {
        const statsResp = await fetch(`${this.ragUrl}/api/knowledge/stats`, {
          headers: { 'X-RAG-API-Key': this.ragApiKey },
        });
        if (statsResp.ok) {
          const stats = await statsResp.json();
          result.services = result.services || {};
          result.services.corpus = {
            total_documents: stats.total_documents,
            by_truth_level: stats.by_truth_level,
          };
        }
      } catch {
        /* stats non-critical */
      }

      return result;
    } catch (error) {
      return {
        status: 'unhealthy',
        services: { rag: { status: 'down', error: getErrorMessage(error) } },
      };
    }
  }

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

    const job = {
      jobId,
      url,
      status: 'running',
      truthLevel,
      startedAt: Math.floor(Date.now() / 1000),
      finishedAt: null as number | null,
      returnCode: null as number | null,
      logLines: [] as string[],
    };
    this.webJobs.set(jobId, job);

    // Process asynchronously (don't block the HTTP response)
    this.processWebIngest(job).catch((err) => {
      job.status = 'failed';
      job.finishedAt = Math.floor(Date.now() / 1000);
      job.returnCode = 1;
      job.logLines.push(`Error: ${getErrorMessage(err)}`);
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
   */
  private async processWebIngest(job: {
    jobId: string;
    url: string;
    status: string;
    truthLevel: string;
    finishedAt: number | null;
    returnCode: number | null;
    logLines: string[];
  }): Promise<void> {
    const containerName = process.env.RAG_CONTAINER_NAME || 'rag-api-prod';
    const knowledgeHostPath =
      process.env.RAG_KNOWLEDGE_PATH || '/opt/automecanik/rag/knowledge';
    const containerTmpPath = `/tmp/web-import/${job.jobId}`;
    const safeUrl = job.url.replace(/'/g, "'\\''");

    // Step 1: Run ingest_web.py (writes sections to /tmp/ in container)
    job.logLines.push(`Running ingest_web.py for ${job.url}`);
    const ingestCmd = [
      'ENV=dev',
      'python3 /app/scripts/ingest_web.py',
      `--url '${safeUrl}'`,
      `--knowledge-path '${containerTmpPath}'`,
      `--truth-level ${job.truthLevel}`,
      '--no-images',
      '-v',
    ].join(' ');

    await this.execDockerCmd(containerName, ingestCmd, job);

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

    // Step 4: Reindex the new files in Weaviate
    job.logLines.push('Reindexing...');
    const reindexCmd = [
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
    this.logger.log(`Web ingest job ${job.jobId} completed for ${job.url}`);

    // Emit event to trigger content refresh pipeline
    this.emitIngestionCompleted(job.jobId, 'web');
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

  /** Strip HTML to markdown-like text, preserving basic structure. */
  private htmlToText(html: string): string {
    let t = html;
    // Phase 1: strip data-* attrs and non-content blocks
    t = t.replace(/\sdata-[a-z-]+="[^"]*"/gi, '');
    t = t.replace(
      /<(script|style|noscript|svg|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi,
      '',
    );
    t = t.replace(
      /<(nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi,
      '',
    );
    // eslint-disable-next-line no-useless-escape
    t = t.replace(
      /<[^>]+(class|id)="[^"]*\b(cookie|banner|popup|modal|gdpr|consent|sidebar|menu)\b[^"]*"[^>]*>[\s\S]*?<\/[a-z]+>/gi,
      '',
    );
    // Phase 2: convert to markdown
    t = t.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
    t = t.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
    t = t.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
    t = t.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
    t = t.replace(/<h[56][^>]*>([\s\S]*?)<\/h[56]>/gi, '\n##### $1\n');
    t = t.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
    t = t.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
    t = t.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
    t = t.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
    t = t.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
    t = t.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');
    t = t.replace(/<br\s*\/?>/gi, '\n');
    t = t.replace(
      /<\/?(p|div|tr|table|section|article|blockquote)[^>]*>/gi,
      '\n',
    );
    t = t.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
    // Phase 3: cleanup
    t = t.replace(/<[^>]+>/g, '');
    t = t.replace(/&nbsp;/g, ' ');
    t = t.replace(/&amp;/g, '&');
    t = t.replace(/&lt;/g, '<');
    t = t.replace(/&gt;/g, '>');
    t = t.replace(/&quot;/g, '"');
    t = t.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
    t = t.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
    t = t.replace(/&\w+;/g, '');
    t = t.replace(/<\/?\w+[^>]*>/g, '');
    t = t.replace(/\{[^}]{50,}\}/g, '');
    t = t.replace(/\t/g, ' ');
    t = t.replace(/ {2,}/g, ' ');
    t = t
      .split('\n')
      .map((line) => line.trim())
      .join('\n');
    t = t.replace(/\n{3,}/g, '\n\n');
    return t.trim();
  }

  /** Extract <title> from HTML. */
  private extractTitle(html: string): string {
    const m = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return (
      m?.[1]
        ?.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim() || ''
    );
  }

  // ── Content Refresh Pipeline: Event emission ──

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
          this.emitIngestionCompleted(jobId, 'pdf');
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

  /**
   * Emit RAG_INGESTION_COMPLETED event after ingestion finishes.
   * Detects affected gammes by scanning recently modified knowledge files.
   */
  private emitIngestionCompleted(jobId: string, source: 'pdf' | 'web'): void {
    const affectedGammes = this.detectAffectedGammes();
    const event: RagIngestionCompletedEvent = {
      jobId,
      source,
      status: 'done',
      completedAt: Math.floor(Date.now() / 1000),
      affectedGammes,
    };
    this.eventEmitter.emit(RAG_INGESTION_COMPLETED, event);
    this.logger.log(
      `Emitted ${RAG_INGESTION_COMPLETED}: jobId=${jobId}, source=${source}, gammes=[${affectedGammes.join(', ')}]`,
    );
  }

  /**
   * Scan knowledge directories for recently modified .md files.
   * - gammes/ → filename = pg_alias (direct match)
   * - web/, web-catalog/ → read frontmatter for `gamme:` field
   * Returns array of pg_alias slugs (deduplicated).
   */
  private detectAffectedGammes(): string[] {
    const knowledgePath =
      process.env.RAG_KNOWLEDGE_PATH || '/opt/automecanik/rag/knowledge';
    const cutoff = Date.now() - 30 * 60 * 1000; // 30 min window for long PDF ingestions
    const results = new Set<string>();

    // 1. Scan gammes/ directory (filename = alias)
    const gammeDir = path.join(knowledgePath, 'gammes');
    try {
      for (const f of readdirSync(gammeDir)) {
        if (!f.endsWith('.md')) continue;
        if (statSync(path.join(gammeDir, f)).mtimeMs > cutoff) {
          results.add(f.replace('.md', ''));
        }
      }
    } catch {
      this.logger.warn(`Could not scan gamme knowledge dir: ${gammeDir}`);
    }

    // 2. Scan web/ and web-catalog/ for frontmatter `gamme:` field
    for (const subDir of ['web', 'web-catalog']) {
      const dir = path.join(knowledgePath, subDir);
      try {
        for (const f of readdirSync(dir)) {
          if (!f.endsWith('.md')) continue;
          const fullPath = path.join(dir, f);
          if (statSync(fullPath).mtimeMs <= cutoff) continue;

          // Read first 500 chars to find frontmatter gamme field
          try {
            const head = readFileSync(fullPath, 'utf-8').slice(0, 500);
            const gammeMatch = head.match(/^gamme:\s*(.+)$/m);
            if (gammeMatch) {
              results.add(gammeMatch[1].trim());
              continue;
            }
            const categoryMatch = head.match(/^category:\s*(.+)$/m);
            if (categoryMatch) {
              // Convert "Filtre à huile" → "filtre-a-huile"
              const slug = categoryMatch[1]
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
              if (slug.length > 3) results.add(slug);
            }
          } catch {
            // Skip unreadable files
          }
        }
      } catch {
        // Directory may not exist
      }
    }

    return Array.from(results);
  }

  /**
   * List in-memory web ingestion jobs (most recent first).
   */
  listWebJobs() {
    return Array.from(this.webJobs.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .map(({ logLines: _logs, ...rest }) => rest);
  }

  /**
   * Get a single web ingestion job by ID, including logs.
   */
  getWebJob(jobId: string) {
    const job = this.webJobs.get(jobId);
    if (!job) return null;
    return job;
  }

  /**
   * List all images in the RAG knowledge web-images directory.
   */
  listImages(): Array<{
    hash: string;
    ext: string;
    size: number;
    url: string;
  }> {
    const knowledgePath =
      process.env.RAG_KNOWLEDGE_PATH || '/opt/automecanik/rag/knowledge';
    const imgDir = path.join(knowledgePath, '_raw', 'web-images');

    try {
      const files = readdirSync(imgDir);
      return files
        .filter((f) => /^[a-f0-9]{16}\.(jpg|jpeg|png|webp|gif)$/.test(f))
        .map((f) => {
          const ext = path.extname(f).slice(1);
          const size = statSync(path.join(imgDir, f)).size;
          return { hash: f, ext, size, url: `/api/rag/images/${f}` };
        })
        .sort((a, b) => b.size - a.size);
    } catch {
      return [];
    }
  }

  /**
   * Describe an image using Claude Vision to generate a recreation prompt.
   * Anti-copyright V2: 9 exclusion rules for brands/logos/packaging.
   */
  async describeImage(hash: string): Promise<{ prompt: string }> {
    if (!/^[a-f0-9]{16}\.(jpg|jpeg|png|webp|gif)$/.test(hash)) {
      throw new BadRequestException('Invalid image hash format');
    }

    const knowledgePath =
      process.env.RAG_KNOWLEDGE_PATH || '/opt/automecanik/rag/knowledge';
    const imagePath = path.join(knowledgePath, '_raw', 'web-images', hash);

    try {
      await fs.access(imagePath);
    } catch {
      throw new NotFoundException(`Image not found: ${hash}`);
    }

    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new ExternalServiceException({
        message: 'ANTHROPIC_API_KEY not configured',
        serviceName: 'anthropic',
      });
    }

    const ext = path.extname(hash).slice(1);
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    const mediaType = mimeMap[ext] || 'image/jpeg';

    const imageData = readFileSync(imagePath);
    const base64 = imageData.toString('base64');

    const client = new Anthropic({ apiKey });

    const DESCRIBE_PROMPT = `Tu es un expert en description d'images pour la génération par IA.
Décris cette image de manière TRÈS détaillée pour qu'un générateur d'image puisse la recréer fidèlement.

RÈGLES OBLIGATOIRES — Droits d'auteur et propriété intellectuelle :
- JAMAIS de nom de marque, logo, sigle ou emblème (remplacer par des termes génériques : "une marque premium", "un équipementier reconnu")
- JAMAIS de packaging identifiable, d'étiquette commerciale ou de code-barres
- JAMAIS de nom de produit spécifique, de référence catalogue ou de numéro de pièce
- JAMAIS de typographie ou police de caractères reconnaissable d'une marque
- JAMAIS de slogan, baseline ou texte marketing
- JAMAIS de mention de site web, URL ou QR code
- Si l'image contient un logo/marque visible, le décrire comme "un élément graphique décoratif" ou l'omettre
- Décrire les pièces automobiles de façon technique et générique (ex: "disque de frein ventilé en fonte" et non "disque Ferodo Premier")
- Ne JAMAIS reproduire de texte lisible présent sur l'image originale

Inclus dans la description :
- Le sujet principal et sa position
- Les couleurs exactes et le contraste
- L'éclairage (direction, intensité, température)
- L'arrière-plan et le contexte
- Le style photographique (macro, studio, vue d'ensemble)
- Les textures et matériaux visibles
- Les proportions et la composition

Réponds en français. Format : un paragraphe descriptif de 150-250 mots utilisable comme prompt pour un générateur d'image.
Le résultat doit être 100% libre de droits et ne référencer aucune propriété intellectuelle.`;

    try {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType as
                    | 'image/jpeg'
                    | 'image/png'
                    | 'image/webp'
                    | 'image/gif',
                  data: base64,
                },
              },
              {
                type: 'text',
                text: DESCRIBE_PROMPT,
              },
            ],
          },
        ],
      });

      const textBlock = message.content.find((c) => c.type === 'text');
      const prompt =
        textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';

      this.logger.log(`Image described: ${hash} → ${prompt.length} chars`);
      return { prompt };
    } catch (error) {
      this.logger.error(
        `Claude Vision error for ${hash}: ${getErrorMessage(error)}`,
      );
      throw new ExternalServiceException({
        message: 'Failed to describe image with Claude Vision',
        serviceName: 'anthropic',
      });
    }
  }
}
