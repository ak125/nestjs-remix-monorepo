import { Injectable, HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchRequestDto, SearchResponseDto } from '../dto/search.dto';
import { getErrorMessage } from '../../../common/utils/error.utils';
import { ExternalServiceException } from '../../../common/exceptions';
import { RagCircuitBreakerService } from './rag-circuit-breaker.service';
import { RagCleanupService } from './rag-cleanup.service';

@Injectable()
export class RagKnowledgeService {
  private readonly logger = new Logger(RagKnowledgeService.name);
  private readonly ragUrl: string;
  private readonly ragApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: RagCircuitBreakerService,
    private readonly ragCleanupService: RagCleanupService,
  ) {
    this.ragUrl = this.configService.getOrThrow<string>('RAG_SERVICE_URL');
    this.ragApiKey = this.configService.getOrThrow<string>('RAG_API_KEY');
  }

  /**
   * Forward search request to RAG service.
   */
  async search(request: SearchRequestDto): Promise<SearchResponseDto> {
    this.circuitBreaker.cbGuard();
    try {
      // Etage 1: filtres par defaut (L1+L2 uniquement), overridable par l'appelant
      const defaultFilters = { truth_levels: ['L1', 'L2'] };
      const mergedFilters = { ...defaultFilters, ...(request.filters || {}) };

      const response = await fetch(`${this.ragUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RAG-API-Key': this.ragApiKey,
        },
        body: JSON.stringify({
          query: request.query,
          limit: request.limit || 10,
          filters: mergedFilters,
        }),
      });

      if (!response.ok) {
        throw new ExternalServiceException({
          message: 'RAG search error',
          serviceName: 'rag',
        });
      }

      const data = await response.json();

      this.circuitBreaker.cbSuccess();
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

      // Hydrate full content when requested (opt-in, uses getKnowledgeDoc per result)
      if (request.includeFullContent && normalizedResults.length > 0) {
        for (const result of normalizedResults) {
          const docId =
            (result.docId as string) || (result.doc_id as string) || '';
          if (docId) {
            try {
              const fullDoc = await this.getKnowledgeDoc(docId);
              result.fullContent = fullDoc.content;
            } catch {
              /* keep truncated content */
            }
          }
        }
      }

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
          this.circuitBreaker.cbFailure();
        }
        throw error;
      }

      this.circuitBreaker.cbFailure();
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
    this.circuitBreaker.cbGuard();
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
      this.circuitBreaker.cbSuccess();
      return data;
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.circuitBreaker.cbFailure();
      }
      this.logger.error(
        `Failed to fetch knowledge doc ${docId}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * List all knowledge document IDs, optionally filtered by prefix.
   * Example: listKnowledgeDocs('guides.') -> ['guides.choisir-disques-frein', ...]
   */
  async listKnowledgeDocs(prefix?: string): Promise<string[]> {
    this.circuitBreaker.cbGuard();
    try {
      const allIds: string[] = [];
      const perPage = 100;
      const maxPages = 10;

      for (let page = 1; page <= maxPages; page++) {
        const response = await fetch(
          `${this.ragUrl}/api/knowledge?limit=${perPage}&page=${page}`,
          { headers: { 'X-RAG-API-Key': this.ragApiKey } },
        );

        if (!response.ok) {
          throw new Error(`Failed to list knowledge docs: ${response.status}`);
        }

        const data = await response.json();
        const docs: Array<{ id?: string; doc_id?: string }> = Array.isArray(
          data,
        )
          ? data
          : data?.documents || data?.results || [];
        const ids = docs.map((d) => d.id || d.doc_id || '').filter(Boolean);
        allIds.push(...ids);

        if (docs.length < perPage) break;
      }

      this.circuitBreaker.cbSuccess();

      if (prefix) {
        return allIds.filter((id) => id.startsWith(prefix));
      }
      return allIds;
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.circuitBreaker.cbFailure();
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
    this.circuitBreaker.cbGuard();
    try {
      const allDocs: Array<Record<string, unknown>> = [];
      const perPage = 100;
      const maxPages = 10; // safety cap: 1000 docs max

      for (let page = 1; page <= maxPages; page++) {
        const response = await fetch(
          `${this.ragUrl}/api/knowledge?limit=${perPage}&page=${page}`,
          { headers: { 'X-RAG-API-Key': this.ragApiKey } },
        );

        if (!response.ok) {
          throw new Error(`Failed to list knowledge docs: ${response.status}`);
        }

        const data = await response.json();
        const docs: Array<Record<string, unknown>> = Array.isArray(data)
          ? data
          : data?.documents || data?.results || [];

        allDocs.push(...docs);

        // Stop when we got fewer than a full page (last page reached)
        if (docs.length < perPage) break;
      }

      this.circuitBreaker.cbSuccess();

      const mapped = allDocs.map((d) => ({
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
        this.circuitBreaker.cbFailure();
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
    byStatus: Record<string, number>;
    byTruthLevel: Record<string, number>;
    byDomain: Record<string, number>;
    retrievableCount: number;
    ragStatus: 'up' | 'down';
  }> {
    try {
      const { data: rows } = await this.ragCleanupService.client
        .from('__rag_knowledge')
        .select('status, truth_level, domain, retrievable');

      const byStatus: Record<string, number> = {};
      const byTruthLevel: Record<string, number> = {};
      const byDomain: Record<string, number> = {};
      let retrievableCount = 0;

      for (const row of rows ?? []) {
        const s = row.status || 'unknown';
        byStatus[s] = (byStatus[s] || 0) + 1;
        const tl = row.truth_level || 'unknown';
        byTruthLevel[tl] = (byTruthLevel[tl] || 0) + 1;
        const d = row.domain || 'unknown';
        byDomain[d] = (byDomain[d] || 0) + 1;
        if (row.retrievable) retrievableCount++;
      }

      return {
        total: rows?.length ?? 0,
        byStatus,
        byTruthLevel,
        byDomain,
        retrievableCount,
        ragStatus: 'up',
      };
    } catch {
      return {
        total: 0,
        byStatus: {},
        byTruthLevel: {},
        byDomain: {},
        retrievableCount: 0,
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
}
