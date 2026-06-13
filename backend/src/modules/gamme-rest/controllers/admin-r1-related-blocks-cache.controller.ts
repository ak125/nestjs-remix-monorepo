/**
 * ADR-024 Phase 5 — Observabilité de `__seo_r1_related_blocks_cache`.
 *
 * Route (sous /api/admin/r1-related-blocks-cache, auth + admin guard) :
 *   GET /stats → total / stale / oldest_built_at / newest_built_at
 *
 * Les endpoints rebuild* (Phase 2/3) ont été retirés avec la bascule Phase 5 :
 * ils recalculaient les blocs depuis le filesystem RAG (RAG = chatbot only,
 * ADR-031/046). Le repeuplement/rafraîchissement du cache appartient au sync
 * wiki→DB ADR-059 (contrat candidat §C2,
 * audit/seo-wiki-to-content-db-wiring-design-20260610.md).
 */

import {
  Controller,
  Get,
  Logger,
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
}
