import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { promises as fs, readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import {
  RAG_INGESTION_COMPLETED,
  type RagIngestionCompletedEvent,
} from '../events/rag-ingestion.events';
import type { WebJob } from '../rag-proxy.service';
import { ExternalServiceException } from '../../../common/exceptions';
import { getErrorMessage } from '../../../common/utils/error.utils';
import { WebhookAuditService } from './webhook-audit.service';
import { RagGammeDetectionService } from './rag-gamme-detection.service';
import { RagRedisJobService } from './rag-redis-job.service';

@Injectable()
export class RagWebhookCompletionService {
  private readonly logger = new Logger(RagWebhookCompletionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly webhookAuditService: WebhookAuditService,
    private readonly ragGammeDetectionService: RagGammeDetectionService,
    private readonly ragRedisJobService: RagRedisJobService,
  ) {}

  /**
   * Handle webhook callback from RAG Python container after ingestion completes.
   * Resolves affected gammes from files_created and emits rag.ingestion.completed event.
   */
  async handleWebhookCompletion(dto: {
    job_id: string;
    source: 'pdf' | 'web';
    status: 'done' | 'failed';
    files_created?: string[];
  }): Promise<{
    gammes_detected: string[];
    diagnostics_detected: string[];
    event_emitted: boolean;
  }> {
    const startTime = Date.now();
    this.logger.log(
      `Webhook received: jobId=${dto.job_id}, source=${dto.source}, status=${dto.status}, files=${dto.files_created?.length ?? 0}`,
    );

    if (dto.status === 'failed') {
      this.logger.warn(
        `Webhook: ingestion job ${dto.job_id} reported failure — skipping event`,
      );
      // Record failed webhook in audit trail
      this.webhookAuditService
        .recordWebhook({
          job_id: dto.job_id,
          source: dto.source,
          status: dto.status,
          files_created: dto.files_created || [],
          gammes_detected: [],
          diagnostics_detected: [],
          event_emitted: false,
          error_message: 'Ingestion reported failure',
          processing_ms: Date.now() - startTime,
        })
        .catch((err) =>
          this.logger.warn(`Audit trail write failed: ${err.message}`),
        );
      return {
        gammes_detected: [],
        diagnostics_detected: [],
        event_emitted: false,
      };
    }

    // Resolve relative paths to absolute paths
    const knowledgePath =
      this.configService.get<string>('RAG_KNOWLEDGE_PATH') ||
      '/opt/automecanik/rag/knowledge';
    const absolutePaths = (dto.files_created ?? []).map((f) =>
      path.isAbsolute(f) ? f : path.join(knowledgePath, f),
    );

    // Reuse existing resolution logic via RagGammeDetectionService
    const affectedGammesMap =
      absolutePaths.length > 0
        ? await this.ragGammeDetectionService.resolveGammesFromFiles(
            absolutePaths,
          )
        : this.ragGammeDetectionService.detectAffectedGammes();
    const affectedGammes = Array.from(affectedGammesMap.keys());
    const affectedDiagnostics =
      this.ragGammeDetectionService.detectAffectedDiagnostics();

    // Emit the event that ContentRefreshService listens to
    const event: RagIngestionCompletedEvent = {
      jobId: dto.job_id,
      source: dto.source,
      status: 'done',
      completedAt: Math.floor(Date.now() / 1000),
      affectedGammes,
      affectedGammesMap: Object.fromEntries(affectedGammesMap),
      ...(affectedDiagnostics.length > 0 ? { affectedDiagnostics } : {}),
    };

    this.eventEmitter.emit(RAG_INGESTION_COMPLETED, event);
    this.logger.log(
      `Webhook emitted ${RAG_INGESTION_COMPLETED}: jobId=${dto.job_id}, gammes=[${affectedGammes.join(', ')}]` +
        (affectedDiagnostics.length > 0
          ? `, diagnostics=[${affectedDiagnostics.join(', ')}]`
          : ''),
    );

    // Record successful webhook in audit trail (fire-and-forget)
    this.webhookAuditService
      .recordWebhook({
        job_id: dto.job_id,
        source: dto.source,
        status: dto.status,
        files_created: dto.files_created || [],
        gammes_detected: affectedGammes,
        diagnostics_detected: affectedDiagnostics,
        event_emitted: true,
        processing_ms: Date.now() - startTime,
      })
      .catch((err) =>
        this.logger.warn(`Audit trail write failed: ${err.message}`),
      );

    return {
      gammes_detected: affectedGammes,
      diagnostics_detected: affectedDiagnostics,
      event_emitted: true,
    };
  }

  /**
   * List web ingestion jobs persisted in Redis (most recent first).
   */
  async listWebJobs(): Promise<Omit<WebJob, 'logLines'>[]> {
    const jobs = await this.ragRedisJobService.getAllJobs();
    return jobs
      .sort((a, b) => b.startedAt - a.startedAt)
      .map(({ logLines: _logs, ...rest }) => rest);
  }

  /**
   * Get a single web ingestion job by ID from Redis, including logs.
   */
  async getWebJob(jobId: string): Promise<WebJob | null> {
    return this.ragRedisJobService.getJob(jobId);
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
      this.configService.get<string>('RAG_KNOWLEDGE_PATH') ||
      '/opt/automecanik/rag/knowledge';
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
      this.configService.get<string>('RAG_KNOWLEDGE_PATH') ||
      '/opt/automecanik/rag/knowledge';
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

    const DESCRIBE_PROMPT = `Tu es un expert en description d'images pour la g\u00e9n\u00e9ration par IA.
D\u00e9cris cette image de mani\u00e8re TR\u00c8S d\u00e9taill\u00e9e pour qu'un g\u00e9n\u00e9rateur d'image puisse la recr\u00e9er fid\u00e8lement.

R\u00c8GLES OBLIGATOIRES \u2014 Droits d'auteur et propri\u00e9t\u00e9 intellectuelle :
- JAMAIS de nom de marque, logo, sigle ou embl\u00e8me (remplacer par des termes g\u00e9n\u00e9riques : "une marque premium", "un \u00e9quipementier reconnu")
- JAMAIS de packaging identifiable, d'\u00e9tiquette commerciale ou de code-barres
- JAMAIS de nom de produit sp\u00e9cifique, de r\u00e9f\u00e9rence catalogue ou de num\u00e9ro de pi\u00e8ce
- JAMAIS de typographie ou police de caract\u00e8res reconnaissable d'une marque
- JAMAIS de slogan, baseline ou texte marketing
- JAMAIS de mention de site web, URL ou QR code
- Si l'image contient un logo/marque visible, le d\u00e9crire comme "un \u00e9l\u00e9ment graphique d\u00e9coratif" ou l'omettre
- D\u00e9crire les pi\u00e8ces automobiles de fa\u00e7on technique et g\u00e9n\u00e9rique (ex: "disque de frein ventil\u00e9 en fonte" et non "disque Ferodo Premier")
- Ne JAMAIS reproduire de texte lisible pr\u00e9sent sur l'image originale

Inclus dans la description :
- Le sujet principal et sa position
- Les couleurs exactes et le contraste
- L'\u00e9clairage (direction, intensit\u00e9, temp\u00e9rature)
- L'arri\u00e8re-plan et le contexte
- Le style photographique (macro, studio, vue d'ensemble)
- Les textures et mat\u00e9riaux visibles
- Les proportions et la composition

R\u00e9ponds en fran\u00e7ais. Format : un paragraphe descriptif de 150-250 mots utilisable comme prompt pour un g\u00e9n\u00e9rateur d'image.
Le r\u00e9sultat doit \u00eatre 100% libre de droits et ne r\u00e9f\u00e9rencer aucune propri\u00e9t\u00e9 intellectuelle.`;

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
