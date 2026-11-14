/**
 * GSC Links Fetcher Service
 *
 * Destiné à ingérer les top backlinks gratuits de Google Search Console
 * (snapshot hebdo ~1000 top liens) dans `__seo_gsc_links_weekly`.
 * État : collecte non implémentée — voir `fetchAndPersist`.
 *
 * Pas de paid provider (DataForSEO/Ahrefs reportés V2 budget).
 *
 * Refs:
 * - ADR-025-seo-department-architecture
 * - 20260425_seo_observability_timeseries.sql (table cible)
 * - packages/seo-types/src/observability.ts (GSCLinkSchema)
 */
import { Injectable, Logger } from '@nestjs/common';
import { GoogleCredentialsService } from './google-credentials.service';

/**
 * Avertissement rendu tant que la collecte des liens n'est pas implémentée.
 * Le job quotidien le lit pour rapporter la source « ignorée », pas « ok ».
 */
export const GSC_LINKS_COLLECTOR_NOT_IMPLEMENTED = 'collector_not_implemented';

export interface GscLinksFetchOptions {
  /** Snapshot date (YYYY-MM-DD). Default: today. */
  snapshotDate?: string;
  dryRun?: boolean;
}

export interface GscLinksFetchResult {
  snapshotDate: string;
  runId: string;
  rowsFetched: number;
  rowsInserted: number;
  durationSeconds: number;
  warnings: string[];
}

@Injectable()
export class GscLinksFetcherService {
  private readonly logger = new Logger(GscLinksFetcherService.name);

  constructor(private readonly credentials: GoogleCredentialsService) {}

  /**
   * Search Console API v1 n'expose pas d'endpoint public listant les liens
   * entrants. Les voies gratuites restantes :
   * 1. GSC bulk export (alpha) — activation au niveau de la propriété
   * 2. URL Inspection API → `linksToYourSite` (limité)
   * Le scraping de l'interface est interdit par les conditions d'utilisation.
   *
   * Tant qu'aucune de ces voies n'est branchée, cette méthode ne collecte
   * rien et le dit : elle n'écrit pas de run dans `__seo_event_log`. Elle y
   * écrivait chaque jour un `ingestion_run_completed` à 0 ligne, que la santé
   * des sources lisait comme un succès récent de la collecte des liens.
   */
  async fetchAndPersist(
    options: GscLinksFetchOptions = {},
  ): Promise<GscLinksFetchResult> {
    const snapshotDate =
      options.snapshotDate ?? new Date().toISOString().slice(0, 10);
    const result: GscLinksFetchResult = {
      snapshotDate,
      runId: '',
      rowsFetched: 0,
      rowsInserted: 0,
      durationSeconds: 0,
      warnings: [],
    };

    if (!this.credentials.isMonitoringEnabled()) {
      result.warnings.push('monitoring_disabled');
      return result;
    }

    if (!this.credentials.getGSCAuth()) {
      result.warnings.push('credentials_missing');
      return result;
    }

    result.warnings.push(GSC_LINKS_COLLECTOR_NOT_IMPLEMENTED);
    this.logger.warn(
      '⚠️ Collecte des liens GSC non implémentée — aucune donnée collectée, aucun run journalisé',
    );
    return result;
  }
}
