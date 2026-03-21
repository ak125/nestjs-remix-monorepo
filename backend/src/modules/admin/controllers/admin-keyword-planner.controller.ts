import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';

interface CoverageRow {
  role: string;
  label: string;
  count: number;
  total: number;
  pct: number;
}

@Controller('api/admin/keyword-planner')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminKeywordPlannerController {
  private readonly logger = new Logger(AdminKeywordPlannerController.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase = createClient(url!, key!);
  }

  /**
   * GET /api/admin/keyword-planner/coverage
   * Returns KP coverage per role + gammes list with per-role flags.
   */
  @Get('coverage')
  async coverage() {
    this.logger.log('GET /api/admin/keyword-planner/coverage');

    // 1. Active gammes (source of truth — sgpg_pg_id is VARCHAR in DB)
    const { data: guideRows } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_pg_id');
    const activeIds = (guideRows ?? []).map(
      (r: { sgpg_pg_id: string | number }) => Number(r.sgpg_pg_id),
    );
    const totalGammes = activeIds.length || 221;

    // 2. Gamme names (pg_id is INTEGER — pass numbers)
    const { data: pgRows } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .in('pg_id', activeIds);
    const pgMap = new Map(
      (pgRows ?? []).map(
        (r: { pg_id: number; pg_alias: string; pg_name: string }) => [
          Number(r.pg_id),
          r,
        ],
      ),
    );

    // 3. Coverage counts per role
    const tables: [string, string, string][] = [
      ['R1', '__seo_r1_keyword_plan', 'rkp_pg_id'],
      ['R3', '__seo_r3_keyword_plan', 'skp_pg_id'],
      ['R4', '__seo_r4_keyword_plan', 'r4kp_pg_id'],
      ['R5', '__seo_r5_keyword_plan', 'rkp_pg_id'],
      ['R6', '__seo_r6_keyword_plan', 'r6kp_pg_id'],
    ];

    const roleLabels: Record<string, string> = {
      R1: 'Router',
      R2: 'Product',
      R3: 'Conseils',
      R4: 'Reference',
      R5: 'Diagnostic',
      R6: 'Guide Achat',
      R7: 'Brand',
      R8: 'Vehicle',
    };

    const kpSets: Record<string, Set<number>> = {};
    for (const [role, table, col] of tables) {
      try {
        const { data } = await this.supabase.from(table).select(col);
        kpSets[role] = new Set(
          (data ?? []).map((r) =>
            Number((r as unknown as Record<string, unknown>)[col]),
          ),
        );
      } catch {
        kpSets[role] = new Set();
      }
    }
    // R2, R7, R8 = empty for now
    kpSets['R2'] = new Set();
    kpSets['R7'] = new Set();
    kpSets['R8'] = new Set();

    const coverage: CoverageRow[] = Object.entries(roleLabels).map(
      ([role, label]) => {
        const count = kpSets[role]?.size ?? 0;
        return {
          role,
          label,
          count,
          total: totalGammes,
          pct: Math.round((count / totalGammes) * 100),
        };
      },
    );

    // 4. Gammes with per-role flags (all IDs normalized to number)
    const gammes = activeIds.map((pid: number) => {
      const pg = pgMap.get(Number(pid));
      return {
        pg_id: pid,
        pg_alias: pg?.pg_alias ?? '',
        pg_name: pg?.pg_name ?? `Gamme #${pid}`,
        has_r1: kpSets['R1']?.has(pid) ?? false,
        has_r3: kpSets['R3']?.has(pid) ?? false,
        has_r4: kpSets['R4']?.has(pid) ?? false,
        has_r5: kpSets['R5']?.has(pid) ?? false,
        has_r6: kpSets['R6']?.has(pid) ?? false,
      };
    });
    gammes.sort((a: { pg_name: string }, b: { pg_name: string }) =>
      a.pg_name.localeCompare(b.pg_name),
    );

    return { coverage, gammes, totalGammes };
  }
}
