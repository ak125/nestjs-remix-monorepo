/**
 * ADR-024 Phase 2 — Admin endpoints pour `__seo_r1_related_blocks_cache`.
 *
 * Routes (toutes sous /api/admin/r1-related-blocks-cache, auth + admin guard) :
 *   GET    /stats                      → total / stale / oldest_built_at / newest_built_at
 *   POST   /rebuild/:pgId              → rebuild d'une gamme (parse RAG + persist)
 *   POST   /rebuild-all                → backfill 238 G1/G2 (utilise pour Phase 3)
 *
 * Phase 2 (scaffolding) : la table existe et peut etre populee via ces
 * endpoints, mais le chemin de lecture SSR R1 continue d'appeler
 * R1RelatedResourcesService.buildRelatedBlocks (qui relit le RAG fs a
 * chaque hit). La Phase 5 cleanup fera basculer le service pour lire
 * depuis la table en priorite.
 *
 * Parite ADR-016 + Phase 1 (admin-vehicle-cache, admin-gamme-cache).
 */

import {
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { R1RelatedResourcesService } from '../services/r1-related-resources.service';

@Controller('api/admin/r1-related-blocks-cache')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class AdminR1RelatedBlocksCacheController extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    AdminR1RelatedBlocksCacheController.name,
  );

  constructor(
    private readonly r1RelatedService: R1RelatedResourcesService,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  @Get('stats')
  async getStats() {
    return this.r1RelatedService.getCacheStats();
  }

  @Post('rebuild/:pgId')
  async rebuildOne(@Param('pgId', ParseIntPipe) pgId: number) {
    // Resolve alias + name from pieces_gamme to drive the rebuild
    const { data: gamme, error } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_id', pgId)
      .maybeSingle();

    if (error || !gamme) {
      return { pg_id: pgId, built: false, reason: 'gamme_not_found' };
    }

    const result = await this.r1RelatedService.rebuildCacheForGamme(
      pgId,
      String(gamme.pg_alias ?? ''),
      String(gamme.pg_name ?? ''),
    );
    return { pg_id: pgId, ...result };
  }

  @Post('rebuild-all')
  async rebuildAll() {
    return this.r1RelatedService.rebuildCacheForAllG1G2();
  }
}
