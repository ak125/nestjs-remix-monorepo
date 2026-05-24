/**
 * TrendSignalsService — middle-ground ingestion into `__trend_signals`.
 *
 * Cf. spec docs/superpowers/specs/2026-05-23-ai-additive-layer-phase-0-and-1-design.md §4.6
 * Task 1.10 — light ingestion from public sources, no auto content gen.
 *
 * Sources V1 :
 *   - rappels_gouv_fr : rappels-conso-marchandises-automobile
 *   - obd_codes_frequent (à venir)
 *   - saisonnalite_ct (à venir)
 *
 * Pattern : extends SupabaseBaseService (like DiagnosticEngineDataService).
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import {
  fetchRappelsGouvFr,
  TrendSignalRow,
} from './sources/rappels-gouv-fr.fetcher';

@Injectable()
export class TrendSignalsService extends SupabaseBaseService {
  protected readonly logger = new Logger(TrendSignalsService.name);

  /**
   * Ingestion mensuelle : fetch rappels.gouv.fr puis upsert dans `__trend_signals`.
   * Renvoie le nombre de lignes insérées (0 si fetch vide ou DB erreur).
   * Aucune exception ne traverse — signal-only, graceful degradation.
   */
  async ingestRappels(): Promise<number> {
    const rows = await fetchRappelsGouvFr();
    return this.bulkInsert(rows);
  }

  private async bulkInsert(rows: TrendSignalRow[]): Promise<number> {
    if (!rows.length) return 0;
    const { count, error } = await this.supabase
      .from('__trend_signals')
      .upsert(rows, {
        onConflict: 'source,label,recorded_at',
        count: 'exact',
      });
    if (error) {
      this.logger.error(`__trend_signals upsert failed: ${error.message}`);
      return 0;
    }
    return count ?? 0;
  }
}
