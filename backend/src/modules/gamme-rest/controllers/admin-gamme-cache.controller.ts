/**
 * ADR-024 — Admin endpoints pour `__gamme_page_cache`.
 *
 * Routes (toutes sous /api/admin/gamme-cache, auth + admin guard) :
 *   GET    /stats                      → total / stale / oldest_built_at / newest_built_at
 *   POST   /rebuild/:pgId              → rebuild immediat (one-shot)
 *   POST   /mark-stale                 → body { pg_ids:number[], reason?:string }
 *   POST   /refresh-stale              → query ?limit=100 → rafraichit N lignes stale
 *
 * Phase 1 (scaffolding) : les fonctions sous-jacentes existent en DB mais ne
 * sont pas encore appelees par le chemin de lecture R1 (controller continue
 * d'utiliser get_gamme_page_data_optimized via gamme-rest-rpc-v2.controller).
 * Les endpoints admin restent utilisables des cette phase pour valider le
 * comportement DDL (rebuild, mark-stale, stats).
 *
 * Parite ADR-016 : meme contrat que admin-vehicle-cache.controller.ts.
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
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { GammeRpcService } from '../services/gamme-rpc.service';

@Controller('api/admin/gamme-cache')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class AdminGammeCacheController extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    AdminGammeCacheController.name,
  );

  constructor(
    private readonly gammeRpcService: GammeRpcService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  @Get('stats')
  async getStats() {
    return this.gammeRpcService.getDbCacheStats();
  }

  @Post('rebuild/:pgId')
  async rebuildOne(@Param('pgId', ParseIntPipe) pgId: number) {
    const built = await this.gammeRpcService.rebuildDbCache(pgId);
    if (!built) {
      return {
        pg_id: pgId,
        built: false,
        reason: 'gamme_not_found_or_invalid',
      };
    }
    return { pg_id: pgId, built: true };
  }

  @Post('mark-stale')
  async markStale(@Body() body: { pg_ids?: number[]; reason?: string }) {
    const ids = Array.isArray(body?.pg_ids)
      ? body.pg_ids.filter((n) => Number.isFinite(n) && n > 0)
      : [];
    if (!ids.length) {
      throw new BadRequestException('pg_ids must be a non-empty number[]');
    }
    const reason = typeof body?.reason === 'string' ? body.reason : 'manual';
    return this.gammeRpcService.markDbCacheStale(ids, reason);
  }

  @Post('refresh-stale')
  async refreshStale(@Query('limit') limitRaw?: string) {
    const limit = Math.min(
      Math.max(parseInt(limitRaw ?? '100', 10) || 100, 1),
      500,
    );
    const { data, error } = await this.callRpc<number>(
      'refresh_stale_gamme_cache',
      { p_batch_size: limit },
      { source: 'api' },
    );
    if (error) throw error;
    return { refreshed: data ?? 0, limit };
  }
}
