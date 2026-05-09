import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

import { getEffectiveSupabaseKey } from '@common/utils';

import type { SurfaceKey } from '@repo/seo-role-contracts';

import type { DiffResult } from './types';

/**
 * Mapping `surface → subtype` figé (cf. plan §4.6 + §2bis Adjusted).
 *
 * IMPORTANT — décision §2bis : l'enum Postgres `seo_event_type` ne contient pas
 * `seo.shadow.r*.divergence`. Plutôt qu'une migration ALTER TYPE, on utilise
 * la valeur existante `'anomaly_detected'` (sémantiquement aligné — divergence
 * shadow = anomalie observée) et on place le slug shadow dans `payload.subtype`.
 */
const SURFACE_SUBTYPE: Partial<Record<SurfaceKey, string>> = {
  R7_BRAND_HUB: 'seo.shadow.r7.divergence',
  R8_VEHICLE: 'seo.shadow.r8.divergence',
  // Retrofit rm-builder : R1 gamme×véhicule (legacy `/api/rm/page-v2`).
  R1_GAMME_VEHICLE_ROUTER: 'seo.shadow.r1_rm.divergence',
};

const TABLE = '__seo_event_log';
const SCHEMA_VERSION = 1; // bump si format `payload.diffs[*]` change

/** Mapping legacy event_log severity (notre 'warn'/'info') → seo_severity enum. */
function mapSeverity(policyDivergence: boolean): 'medium' | 'info' {
  return policyDivergence ? 'medium' : 'info';
}

/**
 * Persiste les observations shadow dans `__seo_event_log` + envoie un event
 * Sentry (warning level) sur `policy_divergence`.
 *
 * Garanties :
 *   - Aucune URL canonical brute écrite — uniquement les hashes 12 hex via
 *     `DiffResult.diffs[*].legacyHash/chainHash`.
 *   - `Sentry.withScope` + `captureMessage` (vs breadcrumb seul) car
 *     `setImmediate` détache du request scope HTTP — un breadcrumb orphelin
 *     ne serait jamais attaché à un event.
 *   - Si Supabase écrit en erreur → log error + propage (le caller gère).
 *
 * @see plan seo-v9 PR-6 §4.6
 */
@Injectable()
export class SeoShadowEventSink {
  private readonly logger = new Logger(SeoShadowEventSink.name);
  private readonly supabase: SupabaseClient;

  constructor(cfg: ConfigService) {
    const url = cfg.get<string>('SUPABASE_URL') ?? '';
    const key = getEffectiveSupabaseKey();
    this.supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async write(
    surface: SurfaceKey,
    entityId: string,
    requestUrl: string,
    diff: DiffResult,
  ): Promise<void> {
    const subtype = SURFACE_SUBTYPE[surface];
    if (!subtype) {
      throw new Error(
        `SeoShadowEventSink: surface ${surface} non mappée dans SURFACE_SUBTYPE`,
      );
    }
    const severity = mapSeverity(diff.policyDivergence);

    const { error } = await this.supabase.from(TABLE).insert({
      event_type: 'anomaly_detected', // valeur enum existante (cf. §2bis Adjusted)
      entity_url: requestUrl,
      severity,
      payload: {
        schema_version: SCHEMA_VERSION,
        subtype, // 'seo.shadow.r7.divergence' / 'seo.shadow.r8.divergence'
        surface,
        entity_id: entityId,
        divergence_types: diff.divergenceTypes,
        policy_divergence: diff.policyDivergence,
        diffs: diff.diffs,
        observed_at: new Date().toISOString(),
      },
    });
    if (error) {
      this.logger.error(
        `[SEO_SHADOW] event_log insert failed (${subtype}): ${error.message}`,
      );
      throw new Error(`event_log insert failed: ${error.message}`);
    }

    if (diff.policyDivergence) {
      // setImmediate détache du request scope Sentry → withScope + captureMessage.
      Sentry.withScope((scope) => {
        scope.setTag('seo.surface', surface);
        scope.setTag('seo.policy_divergence', 'true');
        scope.setTag('seo.shadow_subtype', subtype);
        scope.setExtra('entity_id', entityId);
        scope.setExtra('divergence_types', diff.divergenceTypes);
        scope.setExtra('schema_version', SCHEMA_VERSION);
        Sentry.captureMessage(
          `[SEO_SHADOW][${surface}] policy_divergence entity_id=${entityId}`,
          'warning',
        );
      });
    }
  }
}
