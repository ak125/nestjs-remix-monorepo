/**
 * GSC Links Fetcher Service
 *
 * Ingère les top backlinks gratuits de Google Search Console
 * (snapshot hebdo ~1000 top liens) dans `__seo_gsc_links_weekly`.
 *
 * Pas de paid provider (DataForSEO/Ahrefs reportés V2 budget).
 *
 * Refs:
 * - ADR-025-seo-department-architecture
 * - 20260425_seo_observability_timeseries.sql (table cible)
 * - packages/seo-types/src/observability.ts (GSCLinkSchema)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';
import { google } from 'googleapis';
import { GoogleCredentialsService } from './google-credentials.service';
import { SeoMonitoringRunsService } from './seo-monitoring-runs.service';

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
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly credentials: GoogleCredentialsService,
    private readonly runsService: SeoMonitoringRunsService,
    configService: ConfigService,
  ) {
    const url = configService.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const key = getEffectiveSupabaseKey();
    if (!url || !key) {
      this.logger.warn(
        'GscLinksFetcherService: Supabase env missing — service will fail on first call',
      );
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /**
   * Note : GSC API ne fournit pas d'endpoint officiel "list all backlinks" via
   * v1 stable. La donnée Liens visible dans Search Console UI vient d'un export
   * interne. En attendant, on capture via Search Analytics avec dimension
   * "page" + filtre custom-search OU via le dashboard scraping (V2).
   *
   * Phase 1 : implémentation stub qui retourne 0 row + warning. La méthode
   * existe pour les schedulers et le monitoring runs, ne casse pas l'audit.
   * Phase 1b : GSC bulk export API (en alpha) si activée pour la propriété.
   */
  async fetchAndPersist(
    options: GscLinksFetchOptions = {},
  ): Promise<GscLinksFetchResult> {
    const startedAt = Date.now();
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

    const auth = this.credentials.getGSCAuth();
    if (!auth) {
      result.warnings.push('credentials_missing');
      return result;
    }

    const runId = await this.runsService.logStarted(this.supabase, {
      source: 'gsc_links',
      scope: snapshotDate,
    });
    result.runId = runId;

    try {
      // Search Console API v1 n'expose pas d'endpoint listBacklinks public.
      // Les options gratuites :
      // 1. GSC bulk export (alpha) — nécessite activation property-level
      // 2. UI scraping (interdit par TOS)
      // 3. URL Inspection API → `linksToYourSite` (limité)
      //
      // Pour Phase 1, on utilise sites.list() comme health-check de l'auth
      // et on log warning explicite. Phase 1b ajoutera bulk export si dispo.
      const sc = google.searchconsole({ version: 'v1', auth });
      await sc.sites.list({});

      result.warnings.push(
        'gsc_links_endpoint_not_publicly_available_v1__use_bulk_export_or_v2_dataforseo',
      );

      result.durationSeconds = (Date.now() - startedAt) / 1000;
      await this.runsService.logCompleted(this.supabase, {
        runId,
        source: 'gsc_links',
        rowsInserted: 0,
        rowsUpdated: 0,
        durationSeconds: result.durationSeconds,
        apiCalls: 1,
        warnings: result.warnings,
      });
      this.logger.warn(
        '⚠️ GSC Links endpoint non disponible v1 — Phase 1b ou DataForSEO V2 requis',
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      await this.runsService.logFailed(this.supabase, {
        runId,
        source: 'gsc_links',
        errorClass: 'unknown',
        errorMessage: message,
        partialRowsInserted: 0,
        retryScheduled: false,
      });
      throw err;
    }
  }
}
