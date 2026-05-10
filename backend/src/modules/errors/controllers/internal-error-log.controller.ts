/**
 * InternalErrorLogController
 *
 * INC-2026-007 — Étape 7 du plan
 *
 * Comble le blindspot d'instrumentation : les `throw new Response(503)` côté
 * loader Remix ne s'écrivent pas dans `__error_logs` puisque c'est NestJS qui
 * détient la connexion DB. Cet endpoint permet au loader Remix de logger les
 * 5xx qu'il génère, en réutilisant le service centralisé `ErrorLogService`
 * (buffer, dedup 60s, circuit breaker, bot filter).
 *
 * Sécurité : protégé par `InternalApiKeyGuard` (header `X-Internal-Key` validé
 * en `timingSafeEqual` contre `INTERNAL_API_KEY` env var).
 *
 * NOT exposed via Caddy en prod (localhost only).
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalApiKeyGuard } from '../../../auth/internal-api-key.guard';
import { ErrorLogService } from '../services/error-log.service';

interface LoaderErrorLogBody {
  status: number;
  url: string;
  subject?: string;
  message?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Controller('api/internal/error-log')
@UseGuards(InternalApiKeyGuard)
export class InternalErrorLogController {
  private readonly logger = new Logger(InternalErrorLogController.name);

  constructor(private readonly errorLogService: ErrorLogService) {}

  /**
   * POST /api/internal/error-log
   * Body: { status, url, subject?, message?, userAgent?, metadata? }
   *
   * Le loader Remix appelle ce endpoint en fire-and-forget AVANT de throw 503,
   * pour que le 503 soit visible dans `__error_logs` (sinon blindspot total).
   */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logFromLoader(@Body() body: LoaderErrorLogBody): Promise<void> {
    if (!body || typeof body.status !== 'number' || !body.url) {
      this.logger.warn(
        `Invalid loader error-log payload: ${JSON.stringify(body)}`,
      );
      return;
    }

    await this.errorLogService.logError({
      code: body.status,
      url: body.url,
      userAgent: body.userAgent,
      metadata: {
        loader_subject: body.subject ?? `LOADER_${body.status}`,
        loader_message: body.message,
        ...(body.metadata ?? {}),
      },
    });
  }
}
