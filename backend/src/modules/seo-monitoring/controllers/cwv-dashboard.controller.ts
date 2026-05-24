/**
 * CWV Dashboard Controller — Bloc 6 / CWV Runtime Observability.
 *
 * Routes admin (`IsAdminGuard` requis) :
 *   - GET /api/seo/cwv/dashboard?from&to&priority_tier   — vue tabulaire admin
 *   - GET /api/seo/cwv/funnel-correlation?from_ts&to_ts  — corrélation INP × conversion
 *   - GET /api/seo/cwv/health                            — health snapshot (route admin/monitoring)
 *
 * Routes consommées par `frontend/app/routes/admin.seo-hub.cwv.tsx` (route
 * Remix loader-fetched). Discipline V1 : table view, pas de Recharts complet
 * (gardé pour V1.1 si owner confirme valeur).
 */
import { Controller, Get, Logger, Query, UseGuards } from '@nestjs/common';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import {
  CwvDashboardService,
  type CwvDashboardRow,
  type CwvFunnelCorrelationRow,
  type CwvHealthInfo,
} from '../services/cwv-dashboard.service';

@Controller('api/seo/cwv')
export class CwvDashboardController {
  private readonly logger = new Logger(CwvDashboardController.name);

  constructor(private readonly dashboard: CwvDashboardService) {}

  @Get('dashboard')
  @UseGuards(IsAdminGuard)
  async getDashboard(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('priority_tier') priorityTier: string | undefined,
  ): Promise<{ rows: CwvDashboardRow[]; from: string; to: string }> {
    const toDate = this.parseDateOrDefault(to, 0); // J
    const fromDate = this.parseDateOrDefault(from, -7); // J-7 par défaut
    const tier = this.validPriorityTier(priorityTier);

    const rows = await this.dashboard.getDashboard(fromDate, toDate, tier);
    return { rows, from: fromDate, to: toDate };
  }

  @Get('funnel-correlation')
  @UseGuards(IsAdminGuard)
  async getFunnelCorrelation(
    @Query('from_ts') fromTs: string | undefined,
    @Query('to_ts') toTs: string | undefined,
  ): Promise<{ rows: CwvFunnelCorrelationRow[]; from_ts: string; to_ts: string }> {
    // Default window : 24h (raw TTL 48h, restons safe)
    const to = toTs ? new Date(toTs) : new Date();
    const from = fromTs
      ? new Date(fromTs)
      : new Date(to.getTime() - 24 * 60 * 60 * 1000);

    const rows = await this.dashboard.getFunnelCorrelation(
      from.toISOString(),
      to.toISOString(),
    );
    return { rows, from_ts: from.toISOString(), to_ts: to.toISOString() };
  }

  @Get('health')
  @UseGuards(IsAdminGuard)
  async getHealth(): Promise<CwvHealthInfo> {
    return this.dashboard.getHealth();
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private parseDateOrDefault(raw: string | undefined, daysOffset: number): string {
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + daysOffset);
    return d.toISOString().slice(0, 10);
  }

  private validPriorityTier(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    if (raw === 'CWV_P0' || raw === 'CWV_P1' || raw === 'CWV_P2') return raw;
    return undefined;
  }
}
