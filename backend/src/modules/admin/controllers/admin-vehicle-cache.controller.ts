/**
 * AdminVehicleCacheController
 *
 * INC-2026-007 — Étape 5 du plan
 *
 * Endpoints admin pour piloter manuellement le cache `__vehicle_page_cache`
 * (force rebuild, invalidate Redis, stats). Complète :
 *   - le trigger auto_type (Étape 3, rebuild auto à INSERT/activation)
 *   - le wrapper SQL mark_stale_with_followup_rebuild (Étape 4, garde-fou pour scripts)
 *   - le cron one-shot backfill (Étape 2, rattrapage des stale existants)
 *
 * Réutilise les méthodes déjà présentes dans VehicleRpcService :
 *   - rebuildDbCache(typeId) : ligne 233 vehicle-rpc.service.ts
 *   - invalidateCache(typeId) : ligne 184
 *   - getDbCacheStats() : ligne 260
 */

import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Logger,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { VehicleRpcService } from '../../vehicles/services/vehicle-rpc.service';

@Controller('api/admin/vehicle-cache')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminVehicleCacheController {
  private readonly logger = new Logger(AdminVehicleCacheController.name);

  constructor(private readonly vehicleRpc: VehicleRpcService) {}

  /**
   * GET /api/admin/vehicle-cache/stats
   * Retourne total / stale / oldest_built_at / newest_built_at.
   */
  @Get('stats')
  async getStats() {
    this.logger.log('GET /api/admin/vehicle-cache/stats');
    return await this.vehicleRpc.getDbCacheStats();
  }

  /**
   * POST /api/admin/vehicle-cache/:typeId/rebuild
   * Force le rebuild DB d'un type_id + invalide Redis L1.
   * Idempotent.
   */
  @Post(':typeId/rebuild')
  async rebuild(@Param('typeId', ParseIntPipe) typeId: number) {
    if (typeId <= 0) {
      throw new BadRequestException('typeId must be a positive integer');
    }
    this.logger.log(`POST /api/admin/vehicle-cache/${typeId}/rebuild`);
    const rebuilt = await this.vehicleRpc.rebuildDbCache(typeId);
    return { typeId, rebuilt, success: rebuilt };
  }

  /**
   * POST /api/admin/vehicle-cache/:typeId/invalidate
   * Invalide uniquement Redis L1 pour un type_id (la table DB reste).
   */
  @Post(':typeId/invalidate')
  async invalidate(@Param('typeId', ParseIntPipe) typeId: number) {
    if (typeId <= 0) {
      throw new BadRequestException('typeId must be a positive integer');
    }
    this.logger.log(`POST /api/admin/vehicle-cache/${typeId}/invalidate`);
    await this.vehicleRpc.invalidateCache(typeId);
    return { typeId, invalidated: true };
  }
}
