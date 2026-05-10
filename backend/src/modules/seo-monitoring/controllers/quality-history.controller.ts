/**
 * Quality History Controller — endpoints admin pour ADR-050 (Phase 0 baseline).
 *
 * Expose :
 *  POST /api/admin/quality-history/snapshot           — declenche snapshot tous rôles
 *  POST /api/admin/quality-history/ensure-partition   — RPC ensure_next_quality_history_partition
 *  GET  /api/admin/quality-history/outliers           — RPC detect_quality_outliers
 *
 * Auth : à protéger par IsAdminGuard via AppModule (pattern SeoMonitoringController).
 *
 * Usage cron système (crontab) :
 *   30 02 25 * * curl -X POST -H "X-Admin-Token: $TOK" \
 *                 https://api.../api/admin/quality-history/ensure-partition
 *   0  03  1 * * curl -X POST -H "X-Admin-Token: $TOK" \
 *                 https://api.../api/admin/quality-history/snapshot \
 *                 -d '{"kind":"monthly_cron"}'
 */

import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { getEffectiveSupabaseKey } from '@common/utils';
import {
  QualityHistorySnapshotService,
  SnapshotKind,
} from '../services/quality-history-snapshot.service';

@Controller('api/admin/quality-history')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class QualityHistoryController {
  private readonly logger = new Logger(QualityHistoryController.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly service: QualityHistorySnapshotService,
    configService: ConfigService,
  ) {
    const url = configService.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const key = getEffectiveSupabaseKey();
    if (!url || !key) {
      this.logger.warn(
        'QualityHistoryController: Supabase env missing — service will fail on first call',
      );
    }
    this.supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /**
   * Déclenche un snapshot complet (8 rôles).
   * Body optionnel : { kind: 'monthly_cron' | 'on_demand', metadata?: object }
   */
  @Post('snapshot')
  async snapshot(
    @Body()
    body: { kind?: SnapshotKind; metadata?: Record<string, unknown> } = {},
  ): Promise<{ inserted: number; kind: SnapshotKind }> {
    const kind: SnapshotKind = body.kind ?? 'on_demand';
    const inserted = await this.service.snapshotAllRoles(
      this.supabase,
      kind,
      body.metadata,
    );
    return { inserted, kind };
  }

  /**
   * Crée la partition du mois suivant (idempotent). À appeler le 25 de chaque mois.
   */
  @Post('ensure-partition')
  async ensurePartition(): Promise<{ result: string }> {
    const result = await this.service.ensureNextMonthPartition(this.supabase);
    return { result };
  }

  /**
   * Liste les outliers (drop ≥ dropPct sur la fenêtre).
   *
   * Query params :
   *   ?windowDays=30    (default 30)
   *   ?dropPct=0.15     (default 0.15)
   *   ?roleId=R1_ROUTER (optional filter)
   *   ?metricName=gatekeeper_score (default)
   */
  @Get('outliers')
  async outliers(
    @Query('windowDays') windowDays?: string,
    @Query('dropPct') dropPct?: string,
    @Query('roleId') roleId?: string,
    @Query('metricName') metricName?: string,
  ) {
    const outliers = await this.service.detectOutliers(this.supabase, {
      windowDays: windowDays ? Number(windowDays) : undefined,
      dropPct: dropPct ? Number(dropPct) : undefined,
      roleId: roleId || null,
      metricName: metricName || undefined,
    });
    return { count: outliers.length, outliers };
  }
}
