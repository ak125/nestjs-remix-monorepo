/**
 * ADR-059 Phase B PR-7b — SeoProjectionReadController.
 *
 * Endpoint HTTP minimal exposant l'adapter lecture vers Remix.
 *
 * **Garde-fous architecturaux** :
 *  - GET-only (aucun mutation endpoint ici)
 *  - Lit via `SeoProjectionReadAdapter` uniquement (qui consomme la RPC SECURITY DEFINER)
 *  - JAMAIS d'accès direct `.from('__seo_*')` ou `.from('mv_seo_*')` ici
 *  - Status response refléte le `ProjectionReadResult.status` enum (success / empty /
 *    rpc_failed / validation_failed) → le caller (loader Remix) peut décider
 *    fallback legacy ou pas
 *  - Pas de cache au niveau controller (cache RPC PostgreSQL STABLE suffit
 *    pour Phase B initiale ; cache Redis applicatif éventuel = PR followup)
 *
 * Path canonique : `GET /api/seo-projection/:entity_id` (avec query `?role=R3_CONSEILS`).
 */
import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  Query,
} from '@nestjs/common';

import { SeoProjectionReadAdapter } from './seo-projection-read.adapter';


@Controller('api/seo-projection')
export class SeoProjectionReadController {
  private readonly readLogger = new Logger(SeoProjectionReadController.name);

  constructor(private readonly adapter: SeoProjectionReadAdapter) {}

  /**
   * Récupère la projection active pour une entité.
   *
   * Response shape :
   * ```
   * {
   *   status: 'success' | 'empty' | 'rpc_failed' | 'validation_failed',
   *   payload: ProjectionPayload | null,
   *   error: string | null
   * }
   * ```
   *
   * HTTP semantics :
   *  - 200 quel que soit le status (le caller traite avec son fallback)
   *  - 400 sur entity_id mal formé (validation pré-RPC)
   */
  @Get(':entity_id')
  async getActive(
    @Param('entity_id') entityId: string,
    @Query('role') role?: string,
  ) {
    if (!entityId || typeof entityId !== 'string') {
      throw new BadRequestException('entity_id required');
    }
    const result = await this.adapter.getActiveProjection(entityId, {
      role: role ?? null,
    });
    if (result.status === 'rpc_failed') {
      this.readLogger.warn(
        `RPC failed for ${entityId}: ${result.error ?? 'unknown'}`,
      );
    }
    return result;
  }
}
