import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getEffectiveSupabaseKey } from '@common/utils';
import { getAppConfig } from '../../../config/app.config';
import { GoogleCredentialsService } from './google-credentials.service';
import { canonicalizeGscPageKey } from '../util/gsc-page-key';

/**
 * PR-1 — Attribution « action SEO appliquée » (boucle OBSERVE).
 *
 * Écrit une ligne d'attribution dans le ledger admin EXISTANT `__admin_audit_log`
 * (on ÉTEND le ledger admin_audit — namespace `aal_action='seo_action_applied'`,
 * comme `cc_orchestration_shadow_plan` d'ADR-087 — JAMAIS de table de ledger parallèle).
 *
 * Invariants (plan « fermer la boucle OBSERVE » + CHECK-0 2026-06-18) :
 *  - READ_ONLY (PREPROD, ADR-028 Option D) → court-circuit surfacé `{recorded:false}` ;
 *  - clé page canonicalisée vers le format GSC ABSOLU (sinon 0-join silencieux) via la
 *    MÊME source que le fetcher (`GoogleCredentialsService.getGSCSiteUrl()`) ;
 *  - `applied_at_utc` en ISO-8601 « Z » (pas d'off-by-one TZ) ;
 *  - diagnostic non-bloquant `gsc_match_rows` SURFACÉ (no-silent-fallback) : 0 ligne GSC
 *    pour la clé ⇒ warn explicite, la mesure resterait vide.
 */

/** Vocabulaire contrôlé des types d'action (anti-dérive ; extensible par revue de code). */
export const SEO_ACTION_KINDS = [
  'meta_rewrite',
  'content_enrich',
  'internal_link',
  'regen_artifact',
  'other',
] as const;

export const SeoActionAppliedInputSchema = z
  .object({
    /** URL absolue OU chemin ; canonicalisée côté serveur vers le format GSC. */
    page: z.string().min(1),
    action_kind: z.enum(SEO_ACTION_KINDS),
    /** ISO-8601 UTC (suffixe « Z »). Absent ⇒ now() serveur. */
    applied_at: z
      .string()
      .datetime()
      .refine(
        (s) => s.endsWith('Z'),
        'applied_at doit être en UTC (suffixe « Z »)',
      )
      .optional(),
    source_action_id: z.string().min(1).nullable().optional(),
    baseline_window_days: z
      .number()
      .int()
      .min(7)
      .max(90)
      .optional()
      .default(28),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export type SeoActionAppliedInput = z.infer<typeof SeoActionAppliedInputSchema>;

export interface SeoActionAppliedResult {
  recorded: boolean;
  /** raison du non-enregistrement (`read_only`, message DB…) si recorded=false. */
  reason?: string;
  /** clé page canonicalisée réellement écrite (utile à l'opérateur pour vérifier la jointure). */
  canonical_page?: string;
  /** diagnostic : nb de lignes GSC pour cette clé (0 ⇒ la mesure restera vide). undefined si check KO. */
  gsc_match_rows?: number;
}

@Injectable()
export class SeoActionAttributionService {
  private readonly logger = new Logger(SeoActionAttributionService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly credentials: GoogleCredentialsService,
    configService: ConfigService,
  ) {
    const url = configService.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback ANON_KEY en mode READ_ONLY (RLS protège les writes).
    const key = getEffectiveSupabaseKey();
    if (!url || !key) {
      this.logger.warn(
        'SeoActionAttributionService: env Supabase manquant — échec au premier appel',
      );
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /** Enregistre « action `action_kind` appliquée à la page à T0 » dans le ledger. */
  async recordActionApplied(
    input: SeoActionAppliedInput,
    actor: string,
  ): Promise<SeoActionAppliedResult> {
    // READ_ONLY (PREPROD) : court-circuit canonique, surfacé (pas de write tenté).
    if (getAppConfig().supabase.readOnly) {
      this.logger.warn(
        { metric: 'readonly.skipped', operation: 'seo-action-attribution' },
        '[READ_ONLY] Skip seed seo_action_applied',
      );
      return { recorded: false, reason: 'read_only' };
    }

    const canonicalPage = canonicalizeGscPageKey(
      input.page,
      this.credentials.getGSCSiteUrl(),
    );
    const appliedAtUtc = input.applied_at ?? new Date().toISOString();

    const { error } = await this.supabase.from('__admin_audit_log').insert({
      aal_action: 'seo_action_applied',
      aal_entity_type: 'seo_page',
      aal_entity_id: canonicalPage,
      aal_user_id: actor,
      aal_new_value: {
        action_kind: input.action_kind,
        applied_at_utc: appliedAtUtc,
        source_action_id: input.source_action_id ?? null,
        baseline_window_days: input.baseline_window_days,
        notes: input.notes ?? null,
      },
      aal_metadata: { schema: 'seo_action_applied.v1' },
    });

    if (error) {
      this.logger.error(
        `seo_action_applied insert KO (${canonicalPage}): ${error.message}`,
      );
      return {
        recorded: false,
        reason: error.message,
        canonical_page: canonicalPage,
      };
    }

    // Diagnostic non-bloquant : la clé joint-elle GSC ? (no-silent-fallback : on SURFACE 0).
    const gscMatchRows = await this.countGscRows(canonicalPage);
    if (gscMatchRows === 0) {
      this.logger.warn(
        `seo_action_applied : 0 ligne GSC pour « ${canonicalPage} » — la mesure restera vide ` +
          `tant que GSC n'aura pas de données (vérifier la clé page).`,
      );
    }

    return {
      recorded: true,
      canonical_page: canonicalPage,
      gsc_match_rows: gscMatchRows,
    };
  }

  /** Compte les lignes GSC (grain query, 71 j d'historique — cf. CHECK-0) pour la clé. */
  private async countGscRows(page: string): Promise<number | undefined> {
    try {
      const { count, error } = await this.supabase
        .from('__seo_gsc_daily')
        .select('*', { count: 'exact', head: true })
        .eq('page', page);
      if (error) {
        this.logger.warn(`countGscRows KO (${page}): ${error.message}`);
        return undefined;
      }
      return count ?? 0;
    } catch (e) {
      this.logger.warn(
        `countGscRows a levé (${page}): ${(e as Error).message}`,
      );
      return undefined;
    }
  }
}
