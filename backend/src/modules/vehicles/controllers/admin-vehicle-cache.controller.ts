/**
 * ADR-016 — Admin endpoints pour `__vehicle_page_cache`.
 *
 * Routes (toutes sous /api/admin/vehicle-cache, auth + admin guard) :
 *   GET    /stats                      → total / stale / oldest_built_at / newest_built_at
 *   POST   /rebuild/:typeId            → rebuild immédiat (one-shot)
 *   POST   /mark-stale                 → body { type_ids:number[], reason?:string }
 *   POST   /refresh-stale              → query ?limit=500 → rafraîchit N lignes stale
 *
 * Utilisation typique :
 *   - Rebuild ciblé après modif éditoriale (ex: nouveau contenu R8).
 *   - Mark-stale batch après ingestion TecDoc.
 *   - Refresh-stale pour déclencher manuellement ce que fait le cron.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { VehicleRpcService } from '../services/vehicle-rpc.service';

@Controller('api/admin/vehicle-cache')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class AdminVehicleCacheController extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    AdminVehicleCacheController.name,
  );

  constructor(
    private readonly vehicleRpcService: VehicleRpcService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  @Get('stats')
  async getStats() {
    return this.vehicleRpcService.getDbCacheStats();
  }

  @Post('rebuild/:typeId')
  async rebuildOne(@Param('typeId', ParseIntPipe) typeId: number) {
    const built = await this.vehicleRpcService.rebuildDbCache(typeId);
    if (!built) {
      return {
        type_id: typeId,
        built: false,
        reason: 'vehicle_not_found_or_invalid',
      };
    }
    return { type_id: typeId, built: true };
  }

  @Post('mark-stale')
  async markStale(@Body() body: { type_ids?: number[]; reason?: string }) {
    const ids = Array.isArray(body?.type_ids)
      ? body.type_ids.filter((n) => Number.isFinite(n) && n > 0)
      : [];
    if (!ids.length) {
      throw new BadRequestException('type_ids must be a non-empty number[]');
    }
    const reason = typeof body?.reason === 'string' ? body.reason : 'manual';
    return this.vehicleRpcService.markDbCacheStale(ids, reason);
  }

  @Post('refresh-stale')
  async refreshStale(@Query('limit') limitRaw?: string) {
    const limit = Math.min(
      Math.max(parseInt(limitRaw ?? '500', 10) || 500, 1),
      2000,
    );
    const { data, error } = await this.callRpc<number>(
      'refresh_stale_vehicle_cache',
      { p_batch_size: limit },
      { source: 'api' },
    );
    if (error) throw error;
    return { refreshed: data ?? 0, limit };
  }
}
